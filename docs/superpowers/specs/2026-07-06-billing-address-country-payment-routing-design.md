# Billing Address & Country-Based Payment Routing — Design

**Date:** 2026-07-06
**Status:** Approved design, pending implementation plan
**Related:** [Ameriabank Payment Integration — Design](./2026-07-06-ameriabank-payments-design.md), [Ameriabank go-live gate](../go-live-ameriabank.md)

## Goal

Collect a **billing address** at checkout and route the payment by the billing **country**:

- Billing country **Armenia (`AM`) → Ameriabank** (existing, working).
- Billing country **anything else → Polar** (Merchant of Record — new, deferred).

This changes the payment routing key from **currency** (today) to **billing country**, and adds a **billing country** to both purchase flows (order checkout and credit packs). For the skeleton only the country is collected; a full billing address (for Polar's Merchant-of-Record tax needs) is deferred to the Polar follow-up.

This task ships the **skeleton**: the billing-country capture, the country-based routing, the `polar` route value, and a feature flag. Polar itself is **not integrated** here. While Polar is off, non-Armenia billing shows a **"temporarily unavailable"** notice and the purchase is blocked (no order/transaction created). The full Polar integration is a follow-up spec (outlined at the end).

## Context

- App: Uniqraft marketplace — Next.js 16 App Router + Supabase.
- Two purchase flows: order checkout (`app/checkout/actions.ts`, `app/checkout/page.tsx`) and credit packs (`app/credits/actions.ts`, `app/credits/page.tsx`). Each creates a pending `transactions` row, then redirects to Ameriabank or falls to the `bank_manual` "pending, admin follows up" state.
- **Today's routing is currency-based.** `getPaymentRoute(currency)` (`lib/payments/router.ts`) reads `currencies.payment_route` from the DB → `'ameria' | 'bank_manual'`. The comment in `lib/currency.ts` records the intent: card currencies (USD/EUR) → Ameriabank vPOS, AMD/RUB → manual. Ameriabank vPOS is the **card** gateway; it is not Armenia-specific.
- **No billing address exists anywhere.** Checkout collects one shipping address; its `countryCode` comes from the destination **market** (a country switcher / geo cookie via `resolveMarket()`), rendered as a hidden input — not a typed billing address.
- **Polar is greenfield** — zero references in the repo. Polar is a Merchant of Record: it needs an SDK, checkout-session creation, a webhook settlement handler, product/price setup, and env config. Its hosted-checkout `url` mirrors the Ameria redirect shape (init → hosted page → settle → fulfill).
- `payment_provider_route` / `payment_route` are DB check-constrained enums (`stripe, bank_manual, manual, ameria`). Adding `polar` requires a migration.
- Fulfillment (`lib/payments/fulfillment.ts`: `fulfillOrderPayment`, `fulfillCreditPurchase`) is already provider-agnostic and needs no change for the skeleton.

## Decisions (locked)

1. **Skeleton now, Polar later.** Build billing address + country routing + `polar` enum + feature flag now; the actual Polar API integration is a separate follow-up spec.
2. **Polar charge currency: always USD.** For the `polar` route, the order total is converted to USD (via the existing `convertMoney`) at Polar-init time. Polar does not settle AMD; this is a documented contract for the follow-up, not code shipped now.
3. **Billing country: collected at checkout, defaults to the shipping/destination country.** For the skeleton only the billing **country** is captured — an editable selector pre-filled with the shipping country (i.e. "same as shipping" by default). The billing country is the routing key. Full billing address fields are deferred to the Polar follow-up.
4. **Credits too.** Credit-pack purchases also route by a billing country (a country selector on the credits flow, defaulting to the resolved market country).
5. **Unavailable-while-off UX (amended).** While `POLAR_ENABLED` is off, a non-Armenia billing country shows an inline "International payments are temporarily unavailable" notice and disables the purchase button; a server-side guard rejects the `polar` route before any order/transaction is created.

## Routing

New pure function in `lib/payments/router.ts`:

```
resolvePaymentRoute(billingCountryCode: string | null | undefined): 'ameria' | 'polar'
```

- Normalizes the code (uppercase, 2-letter). `AM → 'ameria'`. Everything else (including unknown/blank) `→ 'polar'`.
- Replaces `getPaymentRoute(currency)` at the two purchase call sites.
- The currency-based `getPaymentRoute` and the admin `currencies.payment_route` control become **unused for routing**. They are left in place (dead-but-harmless) and removed in a later cleanup — out of scope here to avoid touching the admin currencies UI.

`'polar'` is added to `PAYMENT_ROUTES` in `lib/payments/types.ts` so `PaymentRoute = 'ameria' | 'bank_manual' | 'polar'`.

## Data model

One new migration:

- Widen the check constraints to include `'polar'`:
  - `orders.payment_provider_route`: `('stripe','bank_manual','ameria','polar')`
  - `transactions.payment_provider_route`: `('stripe','bank_manual','manual','ameria','polar')`
  - (`currencies.payment_route` is not extended — it no longer drives routing.)
- Add to `orders`:
  - `billing_country_code text` — the collected billing country / routing key (ISO-3166 alpha-2, e.g. `AM`, `US`).
  - (A full `billing_address jsonb` is **not** added here — deferred to the Polar follow-up when the MoR tax flow needs it.)
- Credits have no order row: the billing country for a credit purchase lives in `transactions.metadata.billingCountryCode`.
- No new tables.

## Checkout flow changes

**Page (`app/checkout/page.tsx`).** Add a **billing country** field rendered by a new client component (`components/checkout/billing-country-field.tsx`) that owns:

- A **billing country selector**, pre-filled with the shipping/destination country (reusing the country list already built on the page) and editable ("same as shipping" by default; the buyer can pick a different billing country).
- The **unavailable guard**: given `polarEnabled` (server prop) and the selected billing country, when `!polarEnabled && billingCountry !== 'AM'` it renders the "temporarily unavailable" notice and disables the submit button.

**Action (`app/checkout/actions.ts`).** Extend the Zod schema with `billingCountryCode` (a 2-letter code; defaults to the shipping `countryCode` if absent). Then:

1. `route = resolvePaymentRoute(billingCountryCode)`.
2. If `route === 'polar' && !POLAR_ENABLED` → **stop before creating anything** and return the "temporarily unavailable" state (redirect `/checkout?checkout=polar_unavailable`, rendered as a notice). The cart is not converted.
3. Otherwise proceed: `createOrderFromCart` stores `billing_country_code` and uses `resolvePaymentRoute(billingCountryCode)` for `payment_provider_route`; Ameria path is unchanged (`initiateAmeriaPayment` → redirect).

**`lib/orders.ts` (`createOrderFromCart`).** Accept `billingCountryCode`; store `billing_country_code`; replace the internal `getPaymentRoute(orderCurrency)` call with `resolvePaymentRoute(billingCountryCode)`.

## Credits flow changes

**Page (`app/credits/page.tsx`).** Each pack form gains a **billing country selector** (client component `components/credits/credit-purchase-form.tsx`), defaulting to the resolved market country. Same unavailable guard: when `!polarEnabled && selectedCountry !== 'AM'`, show the notice and disable "Buy". The per-pack route label ("Ameria" vs "manual") is replaced by provider-neutral copy driven by the selected country.

**Action (`app/credits/actions.ts`, `createCreditPackCheckoutAction`).** Add `billingCountryCode` to the schema. `route = resolvePaymentRoute(billingCountryCode)`. If `route === 'polar' && !POLAR_ENABLED` → return the unavailable state (`/credits?checkout=polar_unavailable`) without creating a transaction. Otherwise Ameria path unchanged; store `billingCountryCode` in transaction metadata. (`requestManualCreditPackAction` is left as-is unless it collides — it targets the manual admin-credit path.)

## Feature flag & environment

Add to `lib/env.ts` (server schema) and `.env.local.example`:

| Variable | Purpose | Default |
|---|---|---|
| `POLAR_ENABLED` | Master switch for the Polar route. While `false`, non-Armenia billing is blocked with the "temporarily unavailable" notice. | `false` |

The flag is read server-side and passed to the client components as a `polarEnabled` boolean prop. No Polar credentials are added in this task (they belong to the follow-up spec).

## Currency contract (deferred)

For the `polar` route the charge currency is **USD**: the order/pack total is converted from its currency to USD via `convertMoney(..., 'USD')` at Polar checkout-session creation. AMD/RUB carts therefore charge a USD-converted amount; USD carts pass through. This is documented here and implemented in the Polar follow-up; nothing charges in the skeleton.

## i18n

New message keys in `messages/{en,ru,am}.json` for: the billing-country field label, the "international payments temporarily unavailable" notice, and the neutralized credits route copy. Follow the existing `checkout.*` / `credits.*` namespaces.

## Testing

- **Unit** (`tests/payments/`): `resolvePaymentRoute` — `AM`/`am`/` am ` → `ameria`; `US`, `RU`, unknown, blank, `null` → `polar`.
- **Smoke** (`scripts/smoke/payments-ameria.mjs` or a new `smoke:checkout-routing`): Armenia billing → `ameria` transaction initiated; non-Armenia billing with `POLAR_ENABLED=false` → no transaction created and the unavailable state returned; same for a credit pack.
- **Regression:** existing Ameria unit tests and `smoke:credits` stay green (Armenia path unchanged); `pnpm typecheck` clean.

## Out of scope (→ Polar follow-up spec)

- Polar SDK wiring, `POST /checkouts` checkout-session creation with ad-hoc `prices`, `customerBillingAddress`, `customer_ip_address`.
- Polar webhook settlement handler and its route (`app/api/payments/polar/...`), reusing `fulfillOrderPayment` / `fulfillCreditPurchase`.
- USD conversion code on the `polar` route; Polar product/price setup; Polar env credentials; `POLAR_ENABLED=true` behavior.
- Removing the now-unused currency-based `getPaymentRoute` and the admin `currencies.payment_route` control.
- Full billing **address** (beyond country) on checkout and credits — and the `orders.billing_address jsonb` column — deferred to the Polar MoR tax flow.

## Polar follow-up — integration sketch (informational)

From Polar's live docs (Context7, `/websites/polar_sh`): create a checkout session via `POST /checkouts` (or the TS SDK `checkouts.create`) with `products`, an explicit `currency: "USD"` + ad-hoc `prices` (so a single "Uniqraft order" product covers every order without per-order product creation), `customerBillingAddress` (from the collected billing address), `success_url` back to the order/credits page, and `customer_ip_address` forwarded from the request. The response `url` is the hosted checkout to redirect to. Settlement arrives by **webhook** (`order.paid` / checkout events) — verify signature, match our transaction via `metadata`, then run the existing fulfillment. This mirrors the Ameria init→settle→fulfill shape with a real server-to-server webhook instead of a redirect callback.

## Open items for implementation

- Decide the precise "temporarily unavailable" copy per locale.
- Confirm whether `requestManualCreditPackAction` (manual admin-credit request) also needs a billing country or stays untouched.
