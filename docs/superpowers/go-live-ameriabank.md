# Ameriabank go-live gate

The Ameriabank payments code is merged, but every currency must stay routed to
`bank_manual` in `/admin/currencies` for production until every item in this
checklist passes. The DB-driven currency router makes this a staged rollout:
flipping a currency to `ameria` only takes effect for that currency, so
individual currencies can be enabled one at a time as their checks clear.

## 1. Contract verification (needs bank-issued test credentials in `.env.local`)

- Run `pnpm smoke:payments` — InitPayment and GetPaymentDetails must both pass.
- Record the exact `PaymentState` string returned for a fresh payment; confirm
  the vocabulary (`payment_started` / `payment_approved` / `payment_deposited`
  / `payment_declined` / `payment_void`) matches the assumptions baked into
  `lib/payments/ameria-core.ts`.
- Confirm the currency code format returned in GetPaymentDetails responses
  (e.g. `'051'` string vs `51` numeric) against `AMERIA_CURRENCY_CODES`.
- Confirm the callback query parameter name is `paymentID` by completing one
  hosted-page payment end to end and inspecting the redirect URL.
- Confirm the merchant account is SINGLE-STAGE (auto-capture): pay with a test
  card and verify the final state is `payment_deposited`. If `payment_approved`
  is a resting terminal state instead, the account is dual-stage and a
  ConfirmPayment step must be added before enabling any currency.
  `decideOutcome` currently treats `approved` as pending (not success), so on
  a dual-stage account payments would stall rather than mis-fulfill — but they
  still need the capture step wired up before go-live.
- Confirm the assigned OrderID range and set `AMERIA_ORDER_ID_BASE`
  accordingly. Note: the smoke script derives OrderIDs from the clock in the
  same low window the app's sequence uses — run smokes before enabling live
  traffic, or reserve a sub-range for smoke tests only.

## 2. Credit-grant atomicity follow-up (before real payment volume)

- `lib/credits.ts` `adjustCredits` upserts the balance before inserting the
  ledger row. A mid-operation failure followed by a settlement retry can
  double-increment a balance. Rework this to a single atomic RPC (or reorder
  to ledger-first) AND add a partial unique index on
  `credit_ledger(reference_type, reference_id) where reference_type='payment_transaction'`.
  These two changes must land together — the index alone would just turn a
  duplicate insert into balance corruption given the current write order.

## 3. Manual test checklist

See the checklist at the end of
`docs/superpowers/plans/2026-07-06-ameriabank-payments.md`
("Manual test checklist"): pay, declined card, cancel, abandon + admin
reconcile, manual-route fallback, callback tamper.

## 4. Deploy notes

- Any Stripe checkout session still in flight at deploy time can no longer be
  fulfilled (the Stripe webhook was removed as part of this branch) — settle
  those manually via the admin transactions `reconcile` action.
- Watch the first CI/other-machine install after the lockfile normalization
  from removing Stripe (optional platform binaries may need to be
  re-resolved).
