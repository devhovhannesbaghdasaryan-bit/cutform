# Checkout Country Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the checkout shipping country to a disabled "Armenia" field inside the delivery address form, remove the header-style country switcher and billing-country/Polar-unavailable logic (all payments route via Polar), and put State/province on its own line.

**Architecture:** Pure UI/logic refactor of the checkout route. Pin the resolved market to Armenia so shipping totals always compute, delete the `BillingCountryField` client component, drop the Polar-unavailable server-action guard, and prune dead i18n keys. No schema or payment-architecture changes.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), next-intl, TypeScript, Biome (lint/format), Zod. No component-test framework in this repo — verification is `pnpm typecheck`, `pnpm lint`, `pnpm smoke:i18n`, `pnpm build`, and a manual browser check. This is the established pattern in this codebase; do not add a new test harness.

## Global Constraints

- Shipping country is always Armenia (`AM`); the visible country field is disabled and the submitted value comes from a hidden `<input name="countryCode" value="AM">`.
- All orders route to Polar under current config; do NOT delete the flag-gated Ameria path in `lib/payments/router.ts` or `createOrderFromCart`/`createCreditPurchaseTransaction`. Billing defaults to Armenia (`AM`) wherever a billing country was previously user-selectable.
- Message files `messages/en.json`, `messages/ru.json`, `messages/am.json` must remain valid JSON and stay key-aligned across all three locales.
- Package manager is `pnpm`. Commit after each task.
- After code changes are complete, run `graphify update .` (AST-only, no API cost) per project convention.

**Scope amendment (added after Task 2 review):** The `checkout.polar_unavailable` i18n key and its "choose Armenia as billing country" guard are also used by the credits/top-up flow (`app/credits/page.tsx`, `app/credits/actions.ts`, `components/credits/credit-purchase-form.tsx`), which mirrors checkout's old billing-country-dropdown pattern. The user has asked to remove billing-country selection there too, so this plan now also covers that flow (Task 3 below). Tasks 1 and 2 (checkout-only) are unaffected and already complete.

---

### Task 1: Refactor the checkout page UI

**Files:**
- Modify: `app/checkout/page.tsx`
- Delete: `components/checkout/billing-country-field.tsx`

**Interfaces:**
- Consumes: `resolveMarket({ checkoutCountryCode })` from `lib/market.ts` (returns `ResolvedMarket` with `countryCode: string | null`); `getCountryDisplayName(code, locale)` from `lib/market.ts`; `Input`, `Label`, `Button` UI components.
- Produces: A checkout page with no country switcher, no billing dropdown, no Polar-unavailable banner; a disabled Armenia country field; a plain submit button.

- [ ] **Step 1: Pin the market to Armenia and drop the geography lookup**

In `app/checkout/page.tsx`, change the `Promise.all` (currently lines ~35–40). Remove `listMarketGeography` from the batch and pin the market:

```tsx
  const locale = await getRequestLocale();
  const [{ items }, market, t] = await Promise.all([
    listCartItems(supabase, { userId: user.id }),
    resolveMarket({ checkoutCountryCode: 'AM' }),
    getTranslations(),
  ]);
```

- [ ] **Step 2: Delete the now-unused `countries` list**

Remove the `countries` computation (currently lines ~59–62):

```tsx
  const countries = geography.countries
    .filter((country) => country.is_active)
    .map((country) => ({ code: country.code, label: getCountryDisplayName(country.code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
```

(Delete the whole block. `getCountryDisplayName` stays imported — it is reused in Step 5.)

- [ ] **Step 3: Remove the Polar-unavailable banner**

Delete the banner block at the top of `<main>` (currently lines ~68–72):

```tsx
        {checkoutStatus === 'polar_unavailable' ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t('checkout.polar_unavailable')}
          </div>
        ) : null}
```

`checkoutStatus` / `searchParams` may now be unused. If `checkoutStatus` is no longer referenced anywhere in the file, also remove its destructure (`const { checkout: checkoutStatus } = await searchParams;`) and simplify the `searchParams` param — but only if truly unused; verify with a search before removing. Leaving the `searchParams` prop typed and unread is acceptable if simpler.

- [ ] **Step 4: Remove the "Shipping destination" aside**

Delete the entire aside destination block (currently lines ~114–127):

```tsx
            <div className="space-y-2 rounded-lg border p-5">
              <Label>{t('checkout.destination')}</Label>
              <p className="text-xs text-muted-foreground">{t('checkout.destination_help')}</p>
              {market.countryCode ? (
                <CountrySwitcherClient
                  activeCountry={market.countryCode}
                  countries={countries}
                  placeholder={t('checkout.country')}
                />
              ) : (
                <p className="text-sm text-destructive">{t('checkout.select_country')}</p>
              )}
            </div>
```

- [ ] **Step 5: Add the disabled Armenia country field below Address line 2**

The hidden country input already exists inside the `<form>`; set it explicitly to `AM`:

```tsx
              <input type="hidden" name="countryCode" value="AM" />
```

Then, immediately AFTER the Address line 2 block (the `<div>` ending with the `addressLine2` `<Input>`, currently lines ~162–165) and BEFORE the City row, insert the disabled display field:

```tsx
              <div className="space-y-2">
                <Label htmlFor="countryDisplay">{t('checkout.country')}</Label>
                <Input
                  id="countryDisplay"
                  value={getCountryDisplayName('AM', locale)}
                  disabled
                  readOnly
                />
              </div>
```

- [ ] **Step 6: Put City and State/province on their own full-width rows**

Replace the 2-column City/region grid (currently lines ~166–179):

```tsx
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('checkout.city')}</Label>
                  <Input id="city" name="city" autoComplete="address-level2" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="administrativeArea">{t('checkout.region')}</Label>
                  <Input
                    id="administrativeArea"
                    name="administrativeArea"
                    autoComplete="address-level1"
                  />
                </div>
              </div>
```

with two stacked full-width blocks:

```tsx
              <div className="space-y-2">
                <Label htmlFor="city">{t('checkout.city')}</Label>
                <Input id="city" name="city" autoComplete="address-level2" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="administrativeArea">{t('checkout.region')}</Label>
                <Input
                  id="administrativeArea"
                  name="administrativeArea"
                  autoComplete="address-level1"
                />
              </div>
```

- [ ] **Step 7: Replace `BillingCountryField` with a plain submit button**

Replace the `BillingCountryField` usage (currently lines ~209–217):

```tsx
              <BillingCountryField
                countries={countries}
                defaultCountry={market.countryCode ?? 'AM'}
                polarEnabled={isPolarEnabled()}
                baseDisabled={issues.length > 0 || !market.countryCode || !totals}
                billingLabel={t('checkout.billing_country')}
                unavailableLabel={t('checkout.polar_unavailable')}
                submitLabel={t('checkout.create_order')}
              />
```

with:

```tsx
              <Button type="submit" className="w-full" disabled={issues.length > 0 || !totals}>
                {t('checkout.create_order')}
              </Button>
```

- [ ] **Step 8: Prune imports**

At the top of `app/checkout/page.tsx`, remove these imports:
- `import { BillingCountryField } from '@/components/checkout/billing-country-field';`
- `import { CountrySwitcherClient } from '@/components/country-switcher-client';`
- `import { isPolarEnabled } from '@/lib/payments/polar';`
- From `@/lib/market`, drop `listMarketGeography` (keep `getCountryDisplayName` and `resolveMarket`).

Confirm `Button`, `Input`, `Label` remain imported (all still used).

- [ ] **Step 9: Delete the billing-country field component**

```bash
git rm components/checkout/billing-country-field.tsx
```

- [ ] **Step 10: Typecheck and lint**

Run: `pnpm typecheck`
Expected: PASS, no errors. (Catches any leftover reference to a removed import/variable.)

Run: `pnpm lint`
Expected: PASS, no unused-import or unused-variable errors in `app/checkout/page.tsx`.

If either fails, fix the reported leftover (commonly a still-imported symbol or an unused `checkoutStatus`) and re-run until both pass.

- [ ] **Step 11: Commit**

```bash
git add app/checkout/page.tsx components/checkout/billing-country-field.tsx
git commit -m "refactor(checkout): fixed Armenia shipping field; drop country switcher and billing dropdown"
```

---

### Task 2: Remove the Polar-unavailable guard from the checkout action

**Files:**
- Modify: `app/checkout/actions.ts`

**Interfaces:**
- Consumes: `createOrderFromCart` (unchanged — still derives the route internally via `resolvePaymentRoute(billingCountryCode)`), `initiatePolarCheckout`, `initiateAmeriaPayment`.
- Produces: A checkout action that no longer redirects to `?checkout=polar_unavailable`; routing is decided solely by the order's `payment_provider_route`.

- [ ] **Step 1: Remove the pre-check redirect block**

In `app/checkout/actions.ts`, delete the guard (currently lines ~56–58), keeping the `billingCountryCode` line above it (still used by `createOrderFromCart`):

```tsx
  if (resolvePaymentRoute(billingCountryCode) === 'polar' && !isPolarEnabled()) {
    redirect('/checkout?checkout=polar_unavailable');
  }
```

Result — the surrounding code becomes:

```tsx
  const billingCountryCode = parsed.data.billingCountryCode || parsed.data.countryCode;

  const order = await createOrderFromCart(supabase, user.id, {
```

- [ ] **Step 2: Prune imports**

Update the imports:
- Remove `import { resolvePaymentRoute } from '@/lib/payments/router';` (line ~9).
- Change `import { initiatePolarCheckout, isPolarEnabled } from '@/lib/payments/polar';` to `import { initiatePolarCheckout } from '@/lib/payments/polar';` (drop `isPolarEnabled`).

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm lint`
Expected: PASS, no unused-import errors for `resolvePaymentRoute` / `isPolarEnabled`.

- [ ] **Step 4: Commit**

```bash
git add app/checkout/actions.ts
git commit -m "refactor(checkout): drop polar-unavailable guard; all orders route via existing provider logic"
```

---

### Task 3: Remove billing-country selection from the credits page

**Files:**
- Modify: `components/credits/credit-purchase-form.tsx`
- Modify: `app/credits/page.tsx`
- Modify: `app/credits/actions.ts`

**Interfaces:**
- Consumes: `resolvePaymentRoute(billingCountryCode)` from `lib/payments/router.ts` (unchanged signature); `createCreditPurchaseTransaction` from `lib/transactions.ts` (unchanged); `initiatePolarCheckout`, `initiateAmeriaPayment` (unchanged).
- Produces: `CreditPurchaseForm` reduced to `{ packKey, buyLabel, children }` (no country/polar props); a credits page with no billing-country dropdown and no Polar-unavailable banner; `createCreditPackCheckoutAction` always resolves billing as Armenia (`'AM'`).

- [ ] **Step 1: Simplify `CreditPurchaseForm`**

Replace the full contents of `components/credits/credit-purchase-form.tsx` with:

```tsx
'use client';

import type { ReactNode } from 'react';
import { createCreditPackCheckoutAction } from '@/app/credits/actions';
import { Button } from '@/components/ui/button';

export function CreditPurchaseForm({
  packKey,
  buyLabel,
  children,
}: {
  packKey: string;
  buyLabel: string;
  children: ReactNode;
}) {
  return (
    <form action={createCreditPackCheckoutAction} className="space-y-4 rounded-md border p-4">
      <input type="hidden" name="packKey" value={packKey} />
      {children}
      <Button type="submit" className="w-full">
        {buyLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Remove billing-country plumbing from `app/credits/page.tsx`**

Remove the Polar-unavailable banner (currently lines ~95–99):

```tsx
        {checkoutStatus === 'polar_unavailable' ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t('checkout.polar_unavailable')}
          </div>
        ) : null}
```

Remove the `checkoutStatus` destructure and the `searchParams` prop entirely (mirroring the same cleanup done in `app/checkout/page.tsx` in Task 1) — change:

```tsx
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout: checkoutStatus } = await searchParams;
  const [supabase, locale, t] = await Promise.all([
```

to:

```tsx
export default async function CreditsPage() {
  const [supabase, locale, t] = await Promise.all([
```

Remove the market/geography/billing computation (currently lines ~83–89):

```tsx
  const [market, geography] = await Promise.all([resolveMarket(), listMarketGeography(supabase)]);
  const countries = geography.countries
    .filter((country) => country.is_active)
    .map((country) => ({ code: country.code, label: getCountryDisplayName(country.code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  const defaultBillingCountry = market.countryCode ?? 'AM';
  const polarEnabled = isPolarEnabled();
```

Update the `<CreditPurchaseForm>` invocation (currently lines ~163–171) from:

```tsx
              <CreditPurchaseForm
                key={pack.key}
                packKey={pack.key}
                countries={countries}
                defaultCountry={defaultBillingCountry}
                polarEnabled={polarEnabled}
                billingLabel={t('checkout.billing_country')}
                unavailableLabel={t('checkout.polar_unavailable')}
                buyLabel={t('credits.buy')}
              >
```

to:

```tsx
              <CreditPurchaseForm key={pack.key} packKey={pack.key} buyLabel={t('credits.buy')}>
```

Prune imports: remove `getCountryDisplayName`, `listMarketGeography`, `resolveMarket` (from `@/lib/market`) and `isPolarEnabled` (from `@/lib/payments/polar`). Verify none of these four symbols are referenced anywhere else in the file before removing (they should not be — `locale` is still used elsewhere, but the `market`/`geography` values themselves are only used in the block just removed).

- [ ] **Step 3: Hardcode billing to Armenia in `app/credits/actions.ts`**

Simplify the shared schema (currently lines ~14–22) from:

```tsx
const creditPackRequestSchema = z.object({
  packKey: z.string().trim().min(1),
  billingCountryCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .or(z.literal('')),
});
```

to:

```tsx
const creditPackRequestSchema = z.object({
  packKey: z.string().trim().min(1),
});
```

In `createCreditPackCheckoutAction`, remove `billingCountryCode` from the parsed input (currently lines ~73–76):

```tsx
  const parsed = creditPackRequestSchema.safeParse({
    packKey: formData.get('packKey'),
    billingCountryCode: formData.get('billingCountryCode') || '',
  });
```

becomes:

```tsx
  const parsed = creditPackRequestSchema.safeParse({
    packKey: formData.get('packKey'),
  });
```

Remove the billing-country resolution and Polar-unavailable guard (currently lines ~93–97):

```tsx
  const billingCountryCode = parsed.data.billingCountryCode || '';
  const paymentRoute = resolvePaymentRoute(billingCountryCode);
  if (paymentRoute === 'polar' && !isPolarEnabled()) {
    redirect('/credits?checkout=polar_unavailable');
  }
```

replace with:

```tsx
  const billingCountryCode = 'AM';
  const paymentRoute = resolvePaymentRoute(billingCountryCode);
```

The `metadata.billingCountryCode` field further down (currently ~line 114) keeps working unchanged — it now always records `'AM'`, matching the audit-metadata pattern checkout uses.

Prune the import (currently line ~9):

```tsx
import { initiatePolarCheckout, isPolarEnabled } from '@/lib/payments/polar';
```

becomes:

```tsx
import { initiatePolarCheckout } from '@/lib/payments/polar';
```

`resolvePaymentRoute` stays imported from `@/lib/payments/router` (still used) — only `isPolarEnabled` is dropped from the polar import; `getPaymentRoute` (used by the separate `requestManualCreditPackAction`) is untouched.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck`
Expected: PASS (aside from the pre-existing, unrelated `tests/lib/supabase/server.test.ts` failure noted in Task 1 — do not attempt to fix that here).

Run: `pnpm lint`
Expected: PASS, no unused-import/unused-variable errors in the three modified files.

- [ ] **Step 5: Commit**

```bash
git add components/credits/credit-purchase-form.tsx app/credits/page.tsx app/credits/actions.ts
git commit -m "refactor(credits): drop billing-country selection and polar-unavailable guard"
```

---

### Task 4: Remove dead checkout/credits i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ru.json`
- Modify: `messages/am.json`

**Interfaces:**
- Consumes: nothing (leaf change).
- Produces: three locale files with the dead `checkout.*` keys removed and still key-aligned.

- [ ] **Step 1: Remove the keys from each locale's `checkout` object**

This step requires Task 3 to be complete first — `"polar_unavailable"` is only safe to remove once `app/credits/page.tsx` no longer references it (Task 3 removes credits' last two usages).

In the `"checkout"` object of EACH of `messages/en.json`, `messages/ru.json`, `messages/am.json`, delete these five keys (and their values):
- `"destination"`
- `"destination_help"`
- `"select_country"` (the one inside `"checkout"` only — NOT the separate top-level/other-section `select_country` at line ~329)
- `"billing_country"`
- `"polar_unavailable"`

Keep `"country"`, `"region"`, `"city"`, `"create_order"`, and `"select_destination"`. Ensure no trailing-comma JSON errors after removal.

Before deleting, confirm zero remaining references (run from repo root): `git grep -n "checkout\.polar_unavailable\|checkout\.billing_country\|checkout\.destination\|checkout\.select_country" -- app components`. Expected: no output. If anything remains, stop and report — do not delete the key out from under a live reference.

- [ ] **Step 2: Validate JSON and locale parity**

Run: `pnpm smoke:i18n`
Expected: PASS — reports the three locales as key-aligned with no missing/extra keys.

If `smoke:i18n` reports a mismatch, ensure the exact same five keys were removed from all three files (no more, no less).

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/ru.json messages/am.json
git commit -m "chore(i18n): remove dead checkout country/billing message keys"
```

---

### Task 5: Regenerate the graph and full verification

**Files:**
- Modify: `graphify-out/**` (generated)

**Interfaces:**
- Consumes: the completed code changes from Tasks 1–4.
- Produces: an updated knowledge graph and a verified working checkout + credits flow.

- [ ] **Step 1: Update the knowledge graph**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` files updated.

- [ ] **Step 2: Confirm no dangling references to removed symbols**

Run these searches; each must return NO matches:

```bash
git grep -n "BillingCountryField" -- app components
git grep -n "CountrySwitcherClient" -- app/checkout
git grep -n "polar_unavailable" -- app components messages
git grep -n "checkout.destination\|checkout.billing_country\|checkout.select_country" -- app components
git grep -n "isPolarEnabled" -- app/credits app/checkout
```

Expected: empty output for all five. (`CountrySwitcherClient` may still exist as its own component file `components/country-switcher-client.tsx`; that is fine — it is simply no longer used by checkout. Leave the file in place. `isPolarEnabled` may still exist in `lib/payments/polar.ts` itself — the grep above only checks the two page/action directories that used to call it.)

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: build succeeds with no type errors and no unresolved-import errors.

- [ ] **Step 4: Manual browser verification**

Start the app (`pnpm dev`), sign in, add an item to the cart, and open `/checkout`. Confirm:
- No "Shipping destination" aside and no country switcher.
- The delivery address form shows a disabled **Country** field reading "Armenia", positioned below Address line 2 and above City.
- **City** and **State / province (optional)** each occupy their own full-width row.
- No "International payments are temporarily unavailable" banner.
- Subtotal / Shipping / Total all render with amounts (Armenia market resolved).
- The submit button is enabled (no cart issues) and, on submit, creates an order and redirects into the Polar checkout flow.

Then open `/credits`. Confirm:
- No billing-country dropdown and no Polar-unavailable banner on any credit pack.
- Each pack's "Buy" button submits directly and redirects into the Polar checkout flow.

- [ ] **Step 5: Commit the graph update**

```bash
git add graphify-out
git commit -m "chore(graph): refresh knowledge graph after checkout refactor"
```

---

## Notes / Assumptions

- `resolveMarket({ checkoutCountryCode: 'AM' })` throws `"Choose a supported destination country."` if `AM` is inactive in the `countries` table. `AM` is the home market and is expected active; if a future config deactivates it, checkout would error — acceptable and out of scope here.
- The checkout server action still parses a `billingCountryCode` form field; with the dropdown gone it is always empty and falls back to the `AM` shipping country inside `createOrderFromCart`. Under the current (Ameria-disabled) flag config this routes every order to Polar. The flag-gated Ameria path is intentionally preserved.
- The credits server action now hardcodes `billingCountryCode = 'AM'` directly (Task 3) rather than reading it from form input, since there is no shipping-country concept on that page to fall back to. Same routing behavior: Polar under the current Ameria-disabled config, with the flag-gated path preserved for the future.
- `requestManualCreditPackAction` (admin manual credit grants) is untouched — it never used `billingCountryCode` or the Polar-unavailable guard.
