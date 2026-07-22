# Polar as Default Payment System (disable Ameriabank)

- **Date:** 2026-07-21
- **Status:** Design approved, pending spec review
- **Related:** `docs/superpowers/specs/2026-07-06-ameriabank-payments-design.md`,
  `docs/superpowers/specs/2026-07-06-billing-address-country-payment-routing-design.md`

## Goal

Make **Polar** ([polar.sh](https://polar.sh)) the default payment system for every
buyer, and **disable Ameriabank** for now (reversibly). Polar is currently a stub
(`lib/payments/polar.ts` only exposes an `isPolarEnabled()` feature flag; there is no
real integration). This project builds the full Polar integration — hosted checkout,
webhook + return-verify settlement, and fulfillment — then routes all payments to it.

Two currency-related changes ride along:
- **Drop RUB** from the supported currencies.
- **Charge in the buyer's original currency** (AMD/EUR/USD) via Polar — Polar supports
  130+ pricing currencies including AMD, so no forced USD conversion.
- Switch the exchange-rate provider to **ExchangeRate-API v6** and add an admin
  **"Refresh rates"** button on `/admin/currencies`.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope | Build the **full** Polar integration (checkout + webhook + fulfillment), then default to it. |
| Armenia routing after Ameria off | **Armenia → Polar too.** Polar becomes the single default for everyone. |
| Currency handling | **Charge in original currency** (AMD/EUR/USD). Polar supports AMD, so no USD conversion. |
| RUB | **Removed.** |
| Rate refresh | **Yes** — admin button; provider switched to **ExchangeRate-API v6** (Polar has no FX API). |
| Disabling Ameria | Reversible via feature flag, not deletion ("for now"). |

## Current state (as built)

- **Routing is by billing country** — `resolvePaymentRoute(country)` in
  `lib/payments/router.ts`: `AM → 'ameria'`, everything else `→ 'polar'`. Used by
  checkout (`app/checkout/actions.ts`), credits (`app/credits/actions.ts`), and
  order creation (`lib/orders.ts`).
- **Ameriabank is fully built** — `initiateAmeriaPayment` (`lib/payments/ameria.ts`),
  a browser-redirect callback (`app/api/payments/ameria/callback/route.ts`), and
  settlement (`settleAmeriaPayment` in `lib/payments/fulfillment.ts`).
- **Polar is a stub** — `isPolarEnabled()` only. Non-Armenia buyers currently hit a
  `?checkout=polar_unavailable` notice and no order/payment is created.
- **Fulfillment is already provider-agnostic** — `fulfillOrderPayment` and
  `fulfillCreditPurchase` in `lib/payments/fulfillment.ts` are reusable as-is.
  `claimTransactionSuccess` is private to that file (currently Ameria-only).
- **A second, currency-based route helper** exists: `getPaymentRoute(currency)`
  (DB `currencies.payment_route`, returns `ameria|bank_manual`) — used by the
  **manual credit request** flow (`requestManualCreditPackAction`) and the admin
  dropdown. This is separate from the country-based checkout router.
- **Currencies:** `APP_CURRENCIES = ['AMD','EUR','USD','RUB']`, default `AMD`.
  Exchange rates fetched lazily from a configurable provider
  (`fetchProviderRate`, default `open.er-api.com`), cached per day in
  `exchange_rates` (unique on `base_currency,target_currency,rate_date`). No admin
  refresh button today. `fetchProviderRate` already parses both `rates` and
  `conversion_rates` and reads a `result` field — so ExchangeRate-API's response
  shape is already supported.

## Architecture

Approach chosen: **mirror the Ameriabank pattern.** A Polar provider module plus a
settle function that reuses the existing generic fulfillment, driven by two entry
points that both call the same idempotent settle. This matches the codebase's
existing principle — *browser redirect params carry no authority; server truth
decides* — and reuses fulfillment logic already trusted in production.

Rejected alternatives:
- **`@polar-sh/nextjs` adapter handlers** — opinionated `Checkout()`/`Webhooks()`
  handlers don't map to our transaction / idempotent-claim / fulfillment model; we
  would still write the settle logic and fight the abstraction.
- **Webhook-only settlement** — leaves a window where the buyer sees "success"
  before credits/order update, and depends entirely on webhook delivery.

### Components

**1. Routing / disabling Ameriabank (reversible)**
- Add `isAmeriaEnabled()` to `lib/payments/ameria.ts` (or a small
  `lib/payments/flags.ts`): reads env `AMERIA_ENABLED`, default `false`.
- `resolvePaymentRoute(country)` becomes: return `'ameria'` **iff**
  `isAmeriaEnabled()` **and** normalized country is `AM`; otherwise `'polar'`.
  With Ameria disabled, every buyer (including Armenia) → `'polar'`.
  Re-enabling Ameria later = set `AMERIA_ENABLED=true`.
- Set `POLAR_ENABLED=true`. Keep the existing `polar_unavailable` guard as a
  misconfiguration safety net (if `POLAR_ENABLED` is somehow false).
- Widen `payment_provider_route` TS unions (currently `'ameria' | 'bank_manual' | null`
  in `app/checkout/actions.ts`) to include `'polar'`.

**2. Polar provider — `lib/payments/polar.ts`**
- Keep `isPolarEnabled()`.
- `initiatePolarCheckout(service, input: InitiatePaymentInput): Promise<InitiatePaymentResult>`
  — same interface as `initiateAmeriaPayment`. Creates a Polar **checkout session**
  with an **ad-hoc price** (`amountCents`, `currency`), `metadata: { transactionId }`,
  and `success_url` pointing at the return-verify route (with the checkout id).
  Returns `{ redirectUrl, providerReference }` where `redirectUrl` is Polar's hosted
  checkout `url` and `providerReference` is the Polar checkout/order id.
- Uses `@polar-sh/sdk` configured from `POLAR_ACCESS_TOKEN` and `POLAR_SERVER`
  (`sandbox`|`production`). Attaches ad-hoc price to `POLAR_PRODUCT_ID` if Polar
  requires a product reference (see Open questions).

**3. Settlement — `lib/payments/fulfillment.ts`**
- Extract `claimTransactionSuccess` so it is shared (already generic — claims from
  `pending|failed|cancelled → succeeded`, returns whether this call won the claim).
- Add `settlePolarPayment(service, args: { transactionId; amountCents; currency; providerState })`:
  1. Load the transaction by id; if `succeeded` already → `already_succeeded`.
  2. Verify the paid amount/currency match the transaction (amount-verified success,
     mirroring `decideOutcome`). Mismatch → mark `needs_attention`, do not fulfill.
  3. `claimTransactionSuccess`; if won, call `fulfillCreditPurchase` (type
     `credit_purchase`) or `fulfillOrderPayment` (else). On fulfillment error,
     roll the claim back to `pending` (same recovery pattern as Ameria).
- `settleAmeriaPayment` keeps its Ameria-specific `fetchAmeriaPaymentDetails` +
  `decideOutcome` front half and now calls the shared claim/fulfill helpers.

**4. Two settle entry points**
- `app/api/payments/polar/webhook/route.ts` (`runtime = 'nodejs'`, `POST`):
  verify the Polar signature with `POLAR_WEBHOOK_SECRET`; on `order.paid` (and/or
  `checkout.updated` with a succeeded status), read `metadata.transactionId` and the
  paid amount/currency, then `settlePolarPayment`. Return 200 on handled/duplicate,
  non-2xx only on unexpected error (so Polar retries).
- `app/api/payments/polar/return/route.ts` (`GET`): the `success_url` target. Reads
  the checkout id from the query, fetches checkout status from the Polar API
  (server truth, not query params), and if paid calls `settlePolarPayment`
  (idempotent with the webhook). Redirects to
  `/orders/{id}?checkout=success` or `/credits?checkout=success` (via the transaction's
  `redirectBase`), or `?checkout=pending` if Polar has not finalized yet.

### Data flow (checkout)

```
Buyer submits checkout/credits
  -> createOrderFromCart / createCreditPurchaseTransaction (transaction: pending,
       provider = resolvePaymentRoute(country) = 'polar')
  -> initiatePolarCheckout(amountCents, currency, metadata.transactionId, success_url)
  -> redirect to Polar hosted checkout
Buyer pays on Polar
  -> success_url -> /api/payments/polar/return (GET): fetch checkout, settle if paid
  -> webhook order.paid -> /api/payments/polar/webhook (POST): settle
Both paths -> settlePolarPayment (idempotent):
  verify amount -> claimTransactionSuccess -> fulfillOrderPayment | fulfillCreditPurchase
```

`app/checkout/actions.ts` and `app/credits/actions.ts` replace the current
`route === 'ameria' ? initiateAmeriaPayment : redirect(bank_pending)` branch with:
`route === 'polar' ? initiatePolarCheckout` / `route === 'ameria' ? initiateAmeriaPayment`
/ else `bank_pending`.

### Currency & exchange rates

- **Drop RUB:** remove `'RUB'` from `APP_CURRENCIES`; update `isCardCurrency`/
  `getPaymentRouteForCurrency` comments and the `domain-helpers.test.ts` cases that
  reference RUB. Migration: set the `currencies` row for `RUB` to `is_enabled=false`
  (or delete it) and remove RUB `exchange_rates`. Historical transactions keep their
  stored `currency` string — do not retroactively rewrite them; verify display paths
  (`formatPrice`, `formatLocalizedCurrency`) tolerate a non-`APP_CURRENCIES` code.
- **Original-currency checkout:** pass the transaction's `amountCents` + `currency`
  (AMD/EUR/USD) straight to Polar. Verify Polar minor-unit handling for AMD during
  implementation (the app stores integer minor units; Polar expects minor units).
- **ExchangeRate-API v6:** set
  `EXCHANGE_RATE_API_URL = https://v6.exchangerate-api.com/v6/{apiKey}/latest/{base}`,
  key in `EXCHANGE_RATE_API_KEY` (secret — `.env.local` + Vercel, never committed).
  Add `{apiKey}` placeholder substitution to `fetchProviderRate` (currently only
  `{base}`/`{target}`; the API key goes in the URL path, not a Bearer header). Set
  `EXCHANGE_RATE_PROVIDER='exchangerate-api'` for provenance labelling.
- **Admin "Refresh rates" button** on `/admin/currencies`: a server action
  (`refreshExchangeRatesAction`, admin-gated via `requireAdminPermission`) that, for
  each enabled non-default currency, force-fetches the current rate from the provider
  and upserts it into `exchange_rates` (bypassing the same-day cache short-circuit in
  `getExchangeRate`). Writes an admin audit log. Revalidates `/admin/currencies`.
  Add `'polar'` as an option in the admin `payment_route` dropdown and to
  `getPaymentRoute`'s recognized values.

### New dependencies, env, and provisioning

- **Dependency:** `@polar-sh/sdk`.
- **Env additions** (in `lib/env.ts` `serverShape`, `.env.local.example`, Vercel):
  - `POLAR_ACCESS_TOKEN` — Polar organization access token (secret)
  - `POLAR_WEBHOOK_SECRET` — webhook signing secret (secret)
  - `POLAR_SERVER` — `sandbox` | `production`
  - `POLAR_PRODUCT_ID` — id of the "Uniqraft Order" product ad-hoc prices attach to
    (if required by Polar)
  - `POLAR_ENABLED=true`
  - `AMERIA_ENABLED=false`
  - `EXCHANGE_RATE_API_KEY`, `EXCHANGE_RATE_API_URL`, `EXCHANGE_RATE_PROVIDER`
- **Go-live provisioning** (manual, like Ameria creds / boilerplate recreation):
  1. Create a Polar organization + "Uniqraft Order" product (custom/PWYW pricing).
  2. Register the webhook endpoint (`/api/payments/polar/webhook`) in Polar and copy
     the signing secret.
  3. Populate the env vars in Vercel (sandbox first, then production).

## Testing

- `resolvePaymentRoute`: Ameria disabled → all countries `'polar'` (incl. `AM`);
  Ameria enabled → `AM` `'ameria'`, others `'polar'`.
- `settlePolarPayment`: idempotent claim (double-settle grants once); order vs credit
  fulfillment dispatch; amount/currency mismatch → `needs_attention`, no fulfillment;
  claim-rollback on fulfillment error.
- Polar webhook route: valid signature accepted, invalid rejected; `order.paid`
  triggers settle; duplicate delivery is a no-op.
- Return-verify route: paid checkout settles + redirects success; unpaid → pending.
- `fetchProviderRate` with the ExchangeRate-API URL/`{apiKey}` template and
  `conversion_rates` response shape.
- `refreshExchangeRatesAction`: admin-gated; upserts fresh rates bypassing the daily
  cache; audit log written.
- Existing Ameria tests continue to pass (shared claim/fulfill refactor is behavior-
  preserving).

## Risks & assumptions

- **Merchant of Record scope.** Polar's MoR is designed for **digital products/SaaS**.
  This marketplace ships **physical** personalized goods. Polar's ToS and tax handling
  may not cover physical fulfillment — **confirm with Polar before production go-live**.
  Credit purchases are digital and fit cleanly. (Not a blocker for the build; a
  go-live gate.)
- **Webhook reliability** — mitigated by the return-verify route + idempotent settle.
- **AMD minor units on Polar** — verify during implementation.
- **`POLAR_PRODUCT_ID` requirement** — confirm whether ad-hoc/custom checkout prices
  need an attached product (see Open questions).

## Open questions (resolve during implementation)

1. Does Polar require a product reference for an ad-hoc-priced checkout session, or
   can a session be fully custom? Determines whether `POLAR_PRODUCT_ID` is required.
2. Exact success event to fulfill on: `order.paid` vs `checkout.updated`
   (`status = 'succeeded'/'confirmed'`). Confirm against Polar webhook docs.
3. Polar signature verification helper in `@polar-sh/sdk` (Standard Webhooks) —
   confirm the exact function/name.

## Out of scope

- Refunds/disputes via Polar (future).
- Migrating historical Ameria transactions.
- Removing Ameria code (kept, flag-disabled, for easy re-enable).
- Subscriptions/recurring billing (one-time payments only).
