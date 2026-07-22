# Checkout Country Refactor — Design

**Date:** 2026-07-22
**Status:** Approved for planning

## Problem

The checkout page still carries UI and logic from an earlier, multi-country / multi-provider
model that no longer matches how the store operates:

1. A **"Shipping destination"** aside at the top of the checkout sidebar lets the buyer switch
   country via `CountrySwitcherClient`, and shows *"Select a country from the header before
   checkout."* when no country is resolved. The store now ships to Armenia only, so this
   selector and its "no country → disable checkout" branch are dead weight.
2. A **"Billing country"** dropdown plus a *"International payments are temporarily unavailable.
   Choose Armenia as the billing country or contact support."* message gate non-Armenia billing
   when Polar is off. Polar now handles multi-currency international payments, so this gate is
   obsolete — **all payments route through Polar for now.**
3. The **"State / province (optional)"** label is long and shares a 2-column grid row with City,
   so it doesn't fit the layout cleanly.

## Goals

- Remove the header-style country switcher and all "must select a country" checkout-disable logic.
- Show the shipping country inside the delivery address form as a **disabled field fixed to
  Armenia**.
- Remove the billing country dropdown and the Polar-unavailable messaging; route all payments
  through Polar.
- Move **State / province (optional)** onto its own line so it no longer collides with City.

## Non-Goals

- No changes to the cart page's country/shipping display (it reads the market cookie; out of scope).
- No change to the underlying `resolveMarket` / `resolvePaymentRoute` / Ameria-flag architecture.
- No new database migrations.

## Payment routing note (important)

`createOrderFromCart` derives the order's route via `resolvePaymentRoute(billingCountryCode)`
(`lib/payments/router.ts`), which returns `ameria` **only** when the Ameria flag is enabled *and*
the country is `AM`, otherwise `polar`. Ameria is currently flag-disabled, so once the billing UI
is removed and billing defaults to the Armenia shipping country, **every order routes to Polar
today**.

We intentionally keep the existing flag mechanism rather than hard-bypassing `resolvePaymentRoute`.
This honors "always Polar for now" under current configuration while preserving the flag-gated
Ameria path for a possible future re-enable. If the Ameria flag is turned on later, Armenia orders
would route to Ameria again — a deliberate, config-driven behavior, not a regression.

## Changes

### 1. Remove the "Shipping destination" aside — `app/checkout/page.tsx`

- Delete the aside `<div className="space-y-2 rounded-lg border p-5">` block containing
  `checkout.destination`, `checkout.destination_help`, `CountrySwitcherClient`, and the
  `checkout.select_country` fallback (current lines ~114–127).
- Remove the `CountrySwitcherClient` import.

### 2. Pin the market to Armenia — `app/checkout/page.tsx`

- Resolve the market with Armenia pinned: `resolveMarket({ checkoutCountryCode: 'AM' })`.
- Result: `market.countryCode` is always `AM`, `totals` always computes, and the
  `checkout.select_destination` shipping-row fallback becomes unreachable.

### 3. Disabled Armenia country field in the delivery address form — `app/checkout/page.tsx`

- Add a **disabled** country field **below Address line 2, above City**, using the existing
  `checkout.country` ("Country") label and displaying "Armenia".
- Disabled controls do not submit, so keep the existing hidden `<input name="countryCode"
  value="AM">` (already present) as the value the server action reads.
- The disabled display can be a disabled `<Input>` with value "Armenia" (localized country name
  via `getCountryDisplayName('AM', locale)`), or a disabled single-option `<select>`. Either is
  acceptable; prefer a disabled `<Input>` for simplicity.

### 4. Remove billing country + Polar-unavailable messaging

- **`app/checkout/page.tsx`:**
  - Remove the `BillingCountryField` usage and its import; replace with a plain full-width submit
    `<Button type="submit">{t('checkout.create_order')}</Button>`.
  - Remove the `checkout.polar_unavailable` banner block (current lines ~68–72).
  - Remove the `isPolarEnabled` import and the `countries` list if no longer used elsewhere
    (verify: it was only consumed by the switcher + billing field).
  - Button disabled state becomes `issues.length > 0 || !totals` (drop `!market.countryCode`).
- **`components/checkout/billing-country-field.tsx`:** delete the file (no longer imported).
- **`app/checkout/actions.ts`:**
  - Remove the pre-check block that redirects to `?checkout=polar_unavailable`
    (`resolvePaymentRoute` + `isPolarEnabled` guard, current lines ~55–58).
  - Remove now-unused imports (`resolvePaymentRoute`, `isPolarEnabled`).
  - Keep passing shipping country as-is; billing defaults to shipping AM inside
    `createOrderFromCart`. `billingCountryCode` form field handling may remain harmless, but
    since the dropdown is gone it will always be empty and fall back to `countryCode` — acceptable.

### 5. Fix the State/province layout — `app/checkout/page.tsx`

- Take `administrativeArea` (State / province) out of the shared 2-column grid.
- **City** on its own full-width row; **State / province (optional)** on its own full-width row
  below it.

### 6. i18n cleanup — `messages/en.json`, `messages/ru.json`, `messages/am.json`

Remove now-dead keys under `checkout`:
- `destination`
- `destination_help`
- `select_country`
- `billing_country`
- `polar_unavailable`

Keep: `checkout.country` (reused as the disabled field label), `checkout.region`, `checkout.city`,
`checkout.create_order`. `checkout.select_destination` may be kept as a harmless safety fallback or
removed — leave it in place unless it produces a lint/unused warning.

### 7. Regenerate the knowledge graph

Run `graphify update .` after code changes (AST-only, no API cost) per project convention.

## Testing / Verification

- Load `/checkout` with items in cart as an authenticated user:
  - No "Shipping destination" aside; no country switcher.
  - Delivery address form shows a disabled "Country = Armenia" field below Address line 2.
  - City and State/province each occupy their own full-width row.
  - No "International payments are temporarily unavailable" banner.
  - Totals (subtotal / shipping / total) render (Armenia market resolves).
  - Submit creates an order and redirects into the Polar checkout flow.
- Confirm no unused-import / lint errors (`billing-country-field` removed, imports pruned).
- Confirm the three message files remain valid JSON and stay key-aligned.

## Rollback

Pure UI/logic refactor with no schema changes — revert the commit to restore prior behavior.
