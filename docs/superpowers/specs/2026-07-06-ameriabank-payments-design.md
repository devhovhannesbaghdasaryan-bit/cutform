# Ameriabank Payment Integration — Design

**Date:** 2026-07-06
**Status:** Approved design, pending implementation plan

## Goal

Replace Stripe with Ameriabank vPOS 3.0 as the online payment gateway for all four app currencies (AMD, USD, EUR, RUB), covering both purchase flows: order checkout and credit packs. The manual bank route (`bank_manual`) stays available as a per-currency fallback, and the integration is built behind a small provider abstraction so future payment systems can be added without rework.

## Context

- App: Uniqraft marketplace — Next.js 16 App Router + Supabase.
- Two payment flows exist: order checkout (`app/checkout/actions.ts`) and credit packs (`app/credits/actions.ts`). Both create a pending row in `transactions`, then either redirect to Stripe Checkout or fall to `bank_manual` (admin settles manually).
- Routing is currently hardcoded in `lib/currency.ts` (`getPaymentRouteForCurrency`: USD/EUR → stripe, AMD/RUB → bank_manual), even though the `currencies` table already has a `payment_route` column displayed in the admin panel. This design makes the DB column authoritative.
- Fulfillment (mark order paid / grant credits) currently lives inside the Stripe webhook (`app/api/webhooks/stripe/route.ts`).
- Credentials: Ameriabank **test environment only** for now (`servicestest.ameriabank.am`); production credentials come later. Test env is AMD-only with fixed test cards.

## Ameriabank vPOS mechanics that shape the design

1. **Redirect-based, no webhooks.** `InitPayment` returns a `PaymentID`; the user is redirected to Ameriabank's hosted payment page; afterwards the browser is redirected to our `BackURL` with query parameters. There is no signed server-to-server notification. Callback query params are never trusted — the server must call `GetPaymentDetails` and decide from that response alone.
2. **Numeric OrderIDs.** Each payment needs a unique integer `OrderID` within a bank-assigned range. A DB sequence generates these; our transaction UUID travels in the `Opaque` field.
3. **Amounts in major units.** vPOS takes amounts like `2500.50`, not cents — conversion happens at the provider boundary.
4. **Environment switching.** Test and production differ in host, credentials, and OrderID range — all env-driven from day one.

## Architecture

### New module: `lib/payments/`

- **`types.ts`** — the provider contract:
  - `initiate({ transactionId, amountCents, currency, description, locale, returnPath }) → { redirectUrl, providerReference }`
  - `verifyCallback(params: URLSearchParams) → { transactionId, outcome: 'succeeded' | 'failed' | 'cancelled', providerReference, raw }`
- **`ameria.ts`** — vPOS 3.0 client implementing the contract:
  - `initiate` calls `InitPayment` (credentials from env, `OrderID` from the DB sequence plus env base offset, amount converted from cents to major units, transaction UUID in `Opaque`) and returns `{base}/Payments/Pay?id={PaymentID}&lang={am|ru|en}`.
  - `verifyCallback` reads `paymentID` from the callback query, calls `GetPaymentDetails`, and determines the outcome only from that response (`ResponseCode === '00'`, payment state, and amount/currency matching the transaction row). The transaction UUID is recovered from `Opaque`.
  - The HTTP layer is injectable (takes a `fetch`-like function) so request building and response parsing are unit-testable.
- **`fulfillment.ts`** — provider-agnostic fulfillment extracted from the Stripe webhook: `fulfillOrderPayment(transactionId)` and `fulfillCreditPurchase(transactionId)`. Idempotent (no-op if the transaction is already `succeeded`). Reads order id, user id, credit amount, and pack key from the transaction row and its metadata rather than from provider-specific session objects.
- **`router.ts`** — `getPaymentRoute(currency)` reads `currencies.payment_route` from the DB, replacing the hardcoded function. The admin currencies page becomes the real routing control.

### Callback route

`GET /api/payments/ameria/callback` — verifies via `verifyCallback`, updates the transaction status, runs fulfillment on success, then redirects the browser:

- Order payments → `/orders/{id}?checkout=success|failed`
- Credit packs → `/credits?checkout=success|failed`

The callback is idempotent: a replay re-verifies and finds the transaction already `succeeded`, so fulfillment does not run twice (same guard pattern as the current Stripe webhook).

### Payment flow (both checkout and credit packs)

1. Server action creates the pending `transactions` row (unchanged), then asks the router for the currency's route.
2. Route `ameria` → `initiate()` → store `PaymentID` in `provider_reference` → redirect the user to the hosted page. Route `bank_manual` → unchanged existing behavior.
3. User pays; Ameriabank redirects to the callback route.
4. Callback verifies with `GetPaymentDetails`, marks the transaction, fulfills, redirects the user.

The two server actions shrink: Stripe session code is replaced by one `initiate` call through the router.

## Data model

One new migration:

- `create sequence payment_order_ids` — source of numeric vPOS OrderIDs. The effective OrderID is `AMERIA_ORDER_ID_BASE + nextval`, so the range can be aligned to the bank-assigned window per environment without recreating the sequence.
- Widen check constraints to include `'ameria'`:
  - `orders.payment_provider_route`: `('stripe', 'bank_manual', 'ameria')`
  - `transactions.payment_provider_route`: `('stripe', 'bank_manual', 'manual', 'ameria')`
  - `currencies.payment_route`: `('stripe', 'bank_manual', 'ameria')`
  - `'stripe'` stays in the constraints so historical rows remain valid; new rows never write it.
- Update `currencies.payment_route` to `'ameria'` for all four currencies (each can be flipped back to `bank_manual` in admin).
- No new tables. `transactions` already carries what is needed: `provider = 'ameria'`, `provider_reference` = vPOS `PaymentID`, and `metadata` gains `ameriaOrderId` alongside the existing fulfillment payload (`purchaseType`, `creditAmount`, `packKey`).

## Environment variables

Added to the `lib/env.ts` schema:

| Variable | Purpose |
|---|---|
| `AMERIA_API_BASE_URL` | Test vs production host |
| `AMERIA_CLIENT_ID` | Merchant ClientID |
| `AMERIA_USERNAME` | API username |
| `AMERIA_PASSWORD` | API password |
| `AMERIA_ORDER_ID_BASE` | Offset aligning the sequence to the bank-assigned OrderID range |

Stripe env vars are removed from the schema.

## Error handling

- **InitPayment fails** (non-success ResponseCode or network error): transaction marked `failed`; user sees an error on the checkout/credits page. The order stays `pending_payment`, so retrying creates a fresh transaction and fresh OrderID (one transaction per attempt, matching the existing pattern).
- **Callback with unknown/missing `paymentID`** or an `Opaque` that doesn't match a pending transaction: redirect to a failure state; nothing is mutated.
- **Tampering protection:** outcome is decided solely by `GetPaymentDetails`, including checking that the returned amount and currency match the transaction row. Query params carry no authority.
- **User cancels on the hosted page:** Ameriabank redirects back; `GetPaymentDetails` reports the cancelled state; transaction marked `cancelled`.
- **User pays but never returns:** transaction stays `pending`; resolved by the admin reconciliation action below.

## Admin reconciliation

On `app/admin/transactions/[id]`, a **"Check with Ameriabank"** action for pending `ameria` transactions calls `GetPaymentDetails` with the stored `PaymentID` and applies the same verify-and-fulfill path as the callback. A customer who paid but never returned gets their order/credits after one admin click. The action writes an `admin_audit_log` entry. No cron job for now — admins already review pending transactions on that page.

## Stripe removal

- Delete `lib/stripe.ts`, `app/api/webhooks/stripe/route.ts`, and the `stripe` dependency.
- Remove Stripe env vars from `lib/env.ts`.
- Replace `isStripeCurrency` / `getPaymentRouteForCurrency` in `lib/currency.ts` with the DB-driven router; `PaymentRoute` becomes `'ameria' | 'bank_manual'`.
- Historical `provider = 'stripe'` transactions remain untouched and still render in admin.

## Testing

- **Unit tests:** request building and response parsing in `lib/payments/ameria.ts` via the injectable fetch.
- **Smoke script:** `scripts/smoke/payments-ameria.mjs` (npm script `smoke:payments`) runs checkout against the Ameriabank test environment with a published test card: InitPayment → callback verify → transaction `succeeded`, order `paid`. Test env is AMD-only; routing logic is currency-independent, so this covers the mechanism.
- **Updated smokes:** `smoke:credits` and `smoke:currency` adjusted for the new routes.
- **Manual checklist:** successful payment; cancel on hosted page; declined test card; abandon then admin reconcile.

## Out of scope

- Refunds/cancellations via the Ameriabank API (handled in the bank portal if needed).
- Card binding/saving and recurring payments.
- RUB settlement specifics — if the merchant account cannot settle RUB, flip RUB to `bank_manual` in admin.
- Rewriting or migrating historical Stripe transaction data.

## Open items for implementation

- Confirm exact vPOS 3.0 field names and response codes against current Ameriabank documentation during implementation (e.g., the callback parameter spelling, `PaymentState` values) — do not rely on memory.
- Obtain the test OrderID range and test cards from Ameriabank's developer documentation.
