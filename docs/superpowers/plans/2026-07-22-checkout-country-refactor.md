# Checkout Country Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the checkout shipping country to a disabled "Armenia" field inside the delivery address form, remove the header-style country switcher and billing-country/Polar-unavailable logic (all payments route via Polar), and put State/province on its own line.

**Architecture:** Pure UI/logic refactor of the checkout route. Pin the resolved market to Armenia so shipping totals always compute, delete the `BillingCountryField` client component, drop the Polar-unavailable server-action guard, and prune dead i18n keys. No schema or payment-architecture changes.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), next-intl, TypeScript, Biome (lint/format), Zod. No component-test framework in this repo — verification is `pnpm typecheck`, `pnpm lint`, `pnpm smoke:i18n`, `pnpm build`, and a manual browser check. This is the established pattern in this codebase; do not add a new test harness.

## Global Constraints

- Shipping country is always Armenia (`AM`); the visible country field is disabled and the submitted value comes from a hidden `<input name="countryCode" value="AM">`.
- All orders route to Polar under current config; do NOT delete the flag-gated Ameria path in `lib/payments/router.ts` or `createOrderFromCart`. Billing defaults to the shipping country inside `createOrderFromCart`.
- Message files `messages/en.json`, `messages/ru.json`, `messages/am.json` must remain valid JSON and stay key-aligned across all three locales.
- Package manager is `pnpm`. Commit after each task.
- After code changes are complete, run `graphify update .` (AST-only, no API cost) per project convention.

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

### Task 3: Remove dead checkout i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ru.json`
- Modify: `messages/am.json`

**Interfaces:**
- Consumes: nothing (leaf change).
- Produces: three locale files with the dead `checkout.*` keys removed and still key-aligned.

- [ ] **Step 1: Remove the keys from each locale's `checkout` object**

In the `"checkout"` object of EACH of `messages/en.json`, `messages/ru.json`, `messages/am.json`, delete these five keys (and their values):
- `"destination"`
- `"destination_help"`
- `"select_country"` (the one inside `"checkout"` only — NOT the separate top-level/other-section `select_country` at line ~329)
- `"billing_country"`
- `"polar_unavailable"`

Keep `"country"`, `"region"`, `"city"`, `"create_order"`, and `"select_destination"`. Ensure no trailing-comma JSON errors after removal.

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

### Task 4: Regenerate the graph and full verification

**Files:**
- Modify: `graphify-out/**` (generated)

**Interfaces:**
- Consumes: the completed code changes from Tasks 1–3.
- Produces: an updated knowledge graph and a verified working checkout.

- [ ] **Step 1: Update the knowledge graph**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` files updated.

- [ ] **Step 2: Confirm no dangling references to removed symbols**

Run these searches; each must return NO matches in `app/`, `components/`, or `messages/`:

```bash
git grep -n "BillingCountryField" -- app components
git grep -n "CountrySwitcherClient" -- app/checkout
git grep -n "polar_unavailable" -- app components messages
git grep -n "checkout.destination\|checkout.billing_country\|checkout.select_country" -- app components
```

Expected: empty output for all four. (`CountrySwitcherClient` may still exist as its own component file `components/country-switcher-client.tsx`; that is fine — it is simply no longer used by checkout. Leave the file in place.)

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

- [ ] **Step 5: Commit the graph update**

```bash
git add graphify-out
git commit -m "chore(graph): refresh knowledge graph after checkout refactor"
```

---

## Notes / Assumptions

- `resolveMarket({ checkoutCountryCode: 'AM' })` throws `"Choose a supported destination country."` if `AM` is inactive in the `countries` table. `AM` is the home market and is expected active; if a future config deactivates it, checkout would error — acceptable and out of scope here.
- The server action still parses a `billingCountryCode` form field; with the dropdown gone it is always empty and falls back to the `AM` shipping country inside `createOrderFromCart`. Under the current (Ameria-disabled) flag config this routes every order to Polar. The flag-gated Ameria path is intentionally preserved.
