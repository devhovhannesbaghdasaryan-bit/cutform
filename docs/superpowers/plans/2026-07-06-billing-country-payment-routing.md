# Billing-Country Payment Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect a billing country at checkout and on credit purchases, and route payment by it — Armenia → Ameriabank (existing), everywhere else → Polar (deferred; blocked with a "temporarily unavailable" notice for now).

**Architecture:** Add a pure `resolvePaymentRoute(billingCountryCode)` that supersedes the currency-based route at the two purchase call sites, a `POLAR_ENABLED` feature flag, and a `'polar'` enum value + `orders.billing_country_code` column. The UI collects a billing country (a selector defaulting to the shipping/market country); while Polar is off, a non-Armenia billing country disables the purchase button and shows a notice, backed by a server-side guard that refuses to create an order/transaction. No Polar SDK, checkout session, or webhook is built here.

**Tech Stack:** Next.js 16 App Router (server actions), Supabase (Postgres + generated types), Zod, Vitest, Biome, next-intl.

**Spec:** `docs/superpowers/specs/2026-07-06-billing-address-country-payment-routing-design.md`

## Global Constraints

- Routing key: `resolvePaymentRoute(billingCountryCode)` → `AM` (any casing) ⇒ `'ameria'`; everything else (incl. unknown/blank/null) ⇒ `'polar'`. Verbatim from spec.
- `POLAR_ENABLED` env flag; **default `false`**. While `false`, a `'polar'` route is blocked with a "temporarily unavailable" notice and no order/transaction is created.
- Polar charge currency is **USD** — documented contract only; **no** Polar code, USD conversion, SDK, session, or webhook ships in this plan.
- Skeleton collects **country only**. No full billing address fields and no `billing_address jsonb` column in this work.
- Formatting: Biome, **single quotes**, 2-space indent (see `biome.json`). Match existing file style.
- Historical enum values (`'stripe'`, `'bank_manual'`, `'manual'`) stay in DB check constraints so old rows remain valid; new rows only ever write `'ameria'` or `'polar'`.

---

### Task 1: Migration — add `polar` route value and `orders.billing_country_code`

**Files:**
- Create: `supabase/migrations/20260706153000_billing_country_routing.sql`
- Modify (generated): `lib/supabase/database.types.ts` (via `pnpm db:types`)

**Interfaces:**
- Produces: DB accepts `payment_provider_route = 'polar'` on `orders` and `transactions`; `orders.billing_country_code text` column exists. `Tables<'orders'>` gains `billing_country_code: string | null`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260706153000_billing_country_routing.sql`:

```sql
-- Billing-country-based payment routing: AM -> ameria, else -> polar.
-- Adds the 'polar' route value and a billing_country_code on orders.
-- 'stripe'/'bank_manual'/'manual' are kept so historical rows stay valid.

alter table public.orders
  drop constraint if exists orders_payment_provider_route_check;
alter table public.orders
  add constraint orders_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'ameria', 'polar'));

alter table public.transactions
  drop constraint if exists transactions_payment_provider_route_check;
alter table public.transactions
  add constraint transactions_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'manual', 'ameria', 'polar'));

alter table public.orders
  add column if not exists billing_country_code text;
```

- [ ] **Step 2: Apply the migration to local Supabase**

Run: `supabase migration up`
Expected: applies `20260706153000_billing_country_routing.sql` with no error. (If local Supabase is not running, `supabase start` first.)

- [ ] **Step 3: Regenerate types**

Run: `pnpm db:types`
Expected: `lib/supabase/database.types.ts` changes so `orders.Row` includes `billing_country_code: string | null`. Confirm with `git diff --stat lib/supabase/database.types.ts` (non-empty).

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260706153000_billing_country_routing.sql lib/supabase/database.types.ts
git commit -m "feat(payments): add polar route value and orders.billing_country_code"
```

---

### Task 2: `resolvePaymentRoute` + `polar` in the route type (TDD)

**Files:**
- Modify: `lib/payments/types.ts:1` (extend `PAYMENT_ROUTES`)
- Modify: `lib/payments/router.ts` (add `resolvePaymentRoute`)
- Test: `tests/payments/routing.test.ts`

**Interfaces:**
- Consumes: `normalizeCountryCode` from `@/lib/market` (pure; `(value: unknown) => string | null`, uppercases + validates 2-letter).
- Produces: `resolvePaymentRoute(billingCountryCode: string | null | undefined): 'ameria' | 'polar'`; `PaymentRoute` now includes `'polar'`.

- [ ] **Step 1: Write the failing test**

Create `tests/payments/routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolvePaymentRoute } from '@/lib/payments/router';

describe('resolvePaymentRoute', () => {
  it('routes Armenia to ameria (any casing / whitespace)', () => {
    expect(resolvePaymentRoute('AM')).toBe('ameria');
    expect(resolvePaymentRoute('am')).toBe('ameria');
    expect(resolvePaymentRoute(' am ')).toBe('ameria');
  });

  it('routes every other country to polar', () => {
    expect(resolvePaymentRoute('US')).toBe('polar');
    expect(resolvePaymentRoute('RU')).toBe('polar');
    expect(resolvePaymentRoute('DE')).toBe('polar');
  });

  it('routes unknown / blank / null to polar', () => {
    expect(resolvePaymentRoute('ZZ')).toBe('polar');
    expect(resolvePaymentRoute('')).toBe('polar');
    expect(resolvePaymentRoute(null)).toBe('polar');
    expect(resolvePaymentRoute(undefined)).toBe('polar');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/payments/routing.test.ts`
Expected: FAIL — `resolvePaymentRoute` is not exported by `@/lib/payments/router`.

- [ ] **Step 3: Add `'polar'` to the route type**

In `lib/payments/types.ts`, change line 1:

```ts
export const PAYMENT_ROUTES = ['ameria', 'bank_manual', 'polar'] as const;
```

- [ ] **Step 4: Implement `resolvePaymentRoute`**

Append to `lib/payments/router.ts` (add the `normalizeCountryCode` import to the existing import block at the top):

```ts
import { normalizeCountryCode } from '@/lib/market';

// Country-based routing: Armenia settles via Ameriabank; every other billing
// country goes to Polar (Merchant of Record). Unknown/blank -> polar.
export function resolvePaymentRoute(
  billingCountryCode: string | null | undefined,
): 'ameria' | 'polar' {
  return normalizeCountryCode(billingCountryCode) === 'AM' ? 'ameria' : 'polar';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- tests/payments/routing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/payments/types.ts lib/payments/router.ts tests/payments/routing.test.ts
git commit -m "feat(payments): add resolvePaymentRoute (AM->ameria, else->polar)"
```

---

### Task 3: `POLAR_ENABLED` flag + `isPolarEnabled()` (TDD)

**Files:**
- Modify: `lib/env.ts:20-34` (add `POLAR_ENABLED` to `serverShape`)
- Create: `lib/payments/polar.ts`
- Modify: `.env.local.example`
- Test: `tests/payments/polar-flag.test.ts`

**Interfaces:**
- Produces: `isPolarEnabled(): boolean` from `@/lib/payments/polar` — `true` only when `process.env.POLAR_ENABLED === 'true'`.

- [ ] **Step 1: Write the failing test**

Create `tests/payments/polar-flag.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete process.env.POLAR_ENABLED;
  vi.resetModules();
});

describe('isPolarEnabled', () => {
  it('defaults to false when unset', async () => {
    vi.resetModules();
    const { isPolarEnabled } = await import('@/lib/payments/polar');
    expect(isPolarEnabled()).toBe(false);
  });

  it('is true only for the exact string "true"', async () => {
    process.env.POLAR_ENABLED = 'true';
    vi.resetModules();
    const { isPolarEnabled } = await import('@/lib/payments/polar');
    expect(isPolarEnabled()).toBe(true);
  });

  it('treats other truthy-looking values as false', async () => {
    process.env.POLAR_ENABLED = '1';
    vi.resetModules();
    const { isPolarEnabled } = await import('@/lib/payments/polar');
    expect(isPolarEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/payments/polar-flag.test.ts`
Expected: FAIL — cannot resolve `@/lib/payments/polar`.

- [ ] **Step 3: Add the env key**

In `lib/env.ts`, inside `serverShape` (after `AMERIA_ORDER_ID_BASE: optionalNonEmpty,` on line 30), add:

```ts
  POLAR_ENABLED: optionalNonEmpty,
```

- [ ] **Step 4: Create the helper**

Create `lib/payments/polar.ts`:

```ts
import 'server-only';

import { getServerEnv } from '@/lib/env';

// Master switch for the Polar route. While false, non-Armenia billing is
// blocked with a "temporarily unavailable" notice and no order is created.
// Polar itself is not integrated yet — see the follow-up spec.
export function isPolarEnabled(): boolean {
  return getServerEnv().POLAR_ENABLED === 'true';
}
```

- [ ] **Step 5: Document the env var**

In `.env.local.example`, add a line near the `AMERIA_*` keys:

```
# Enables the Polar (international) payment route. Leave unset/false until Polar is integrated.
POLAR_ENABLED=false
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test -- tests/payments/polar-flag.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/env.ts lib/payments/polar.ts .env.local.example tests/payments/polar-flag.test.ts
git commit -m "feat(payments): add POLAR_ENABLED flag and isPolarEnabled()"
```

---

### Task 4: Route checkout by billing country (server side)

**Files:**
- Modify: `lib/orders.ts:233-305` (`createOrderFromCart`)
- Modify: `app/checkout/actions.ts`
- Test: manual + `pnpm typecheck`

**Interfaces:**
- Consumes: `resolvePaymentRoute` (Task 2), `isPolarEnabled` (Task 3).
- Produces: `createOrderFromCart(supabase, userId, { contactEmail, locale, shippingAddress, billingCountryCode })` stores `billing_country_code` and sets `payment_provider_route = resolvePaymentRoute(billingCountryCode ?? shippingAddress.countryCode)`. `createCheckoutOrderAction` refuses `polar`-routed checkout while `!isPolarEnabled()`.

- [ ] **Step 1: Update `createOrderFromCart` to route by billing country**

In `lib/orders.ts`:

Replace the import on line 4 (`import { getPaymentRoute } from '@/lib/payments/router';`) with:

```ts
import { resolvePaymentRoute } from '@/lib/payments/router';
```

Extend the options type on line 236:

```ts
  options: {
    contactEmail?: string | null;
    locale?: string | null;
    shippingAddress?: ShippingAddress;
    billingCountryCode?: string | null;
  } = {},
```

Replace line 269 (`const paymentProviderRoute = await getPaymentRoute(orderCurrency);`) with:

```ts
  const billingCountryCode = options.billingCountryCode ?? address.countryCode;
  const paymentProviderRoute = resolvePaymentRoute(billingCountryCode);
```

In the `orders` insert object (around line 294), add `billing_country_code` next to `payment_provider_route`:

```ts
      payment_provider_route: paymentProviderRoute,
      billing_country_code: billingCountryCode,
```

- [ ] **Step 2: Add billing country + guard to the checkout action**

In `app/checkout/actions.ts`:

Add imports:

```ts
import { resolvePaymentRoute } from '@/lib/payments/router';
import { isPolarEnabled } from '@/lib/payments/polar';
```

Add `billingCountryCode` to `checkoutSchema` (after the `countryCode` field, ~line 21):

```ts
  billingCountryCode: z.string().trim().regex(/^[A-Z]{2}$/).optional().or(z.literal('')),
```

Add it to the `safeParse` input object (after `countryCode`, ~line 35):

```ts
    billingCountryCode: formData.get('billingCountryCode') || '',
```

Immediately after the `redirect('/login?next=/checkout')` guard (after line 41), add the route guard — before any order is created:

```ts
  const billingCountryCode = parsed.data.billingCountryCode || parsed.data.countryCode;
  if (resolvePaymentRoute(billingCountryCode) === 'polar' && !isPolarEnabled()) {
    redirect('/checkout?checkout=polar_unavailable');
  }
```

Pass `billingCountryCode` into `createOrderFromCart` (in the options object, ~line 44):

```ts
  const order = await createOrderFromCart(supabase, user.id, {
    contactEmail: parsed.data.contactEmail || user.email,
    locale: parsed.data.locale || null,
    billingCountryCode,
    shippingAddress: {
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full unit suite (regression)**

Run: `pnpm test`
Expected: all pass (routing + polar-flag + existing).

- [ ] **Step 5: Commit**

```bash
git add lib/orders.ts app/checkout/actions.ts
git commit -m "feat(checkout): route order payment by billing country, guard polar while disabled"
```

---

### Task 5: Checkout UI — billing-country field, notice, disabled submit

**Files:**
- Create: `components/checkout/billing-country-field.tsx`
- Modify: `app/checkout/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`, `messages/am.json`
- Test: manual (dev server) + `pnpm typecheck` + `pnpm lint`

**Interfaces:**
- Consumes: `isPolarEnabled` (Task 3); the `countries` list and `market.countryCode` already computed in `app/checkout/page.tsx`.
- Produces: a client component `BillingCountryField` that renders the billing `<select name="billingCountryCode">`, a conditional "temporarily unavailable" notice, and the form's submit button (disabled when blocked or `baseDisabled`).

- [ ] **Step 1: Create the client component**

Create `components/checkout/billing-country-field.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function BillingCountryField({
  countries,
  defaultCountry,
  polarEnabled,
  baseDisabled,
  billingLabel,
  unavailableLabel,
  submitLabel,
}: {
  countries: { code: string; label: string }[];
  defaultCountry: string;
  polarEnabled: boolean;
  baseDisabled: boolean;
  billingLabel: string;
  unavailableLabel: string;
  submitLabel: string;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const blocked = !polarEnabled && country !== 'AM';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="billingCountryCode">{billingLabel}</Label>
        <select
          id="billingCountryCode"
          name="billingCountryCode"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          {countries.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {blocked ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {unavailableLabel}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={baseDisabled || blocked}>
        {submitLabel}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the checkout page**

In `app/checkout/page.tsx`:

Add imports:

```ts
import { BillingCountryField } from '@/components/checkout/billing-country-field';
import { isPolarEnabled } from '@/lib/payments/polar';
```

Change the page signature to read the status param (line 21):

```ts
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout: checkoutStatus } = await searchParams;
```

Just inside `<main ...>` (before the heading block, ~line 58), render the notice when redirected back blocked:

```tsx
        {checkoutStatus === 'polar_unavailable' ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t('checkout.polar_unavailable')}
          </div>
        ) : null}
```

Replace the existing submit `<Button>` block (lines 177-179) with the client component:

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

- [ ] **Step 3: Add i18n keys**

In `messages/en.json`, under the `checkout` object, add:

```json
"billing_country": "Billing country",
"polar_unavailable": "International payments are temporarily unavailable. Choose Armenia as the billing country or contact support."
```

In `messages/ru.json`, under `checkout`:

```json
"billing_country": "Страна оплаты",
"polar_unavailable": "Международные платежи временно недоступны. Выберите Армению как страну оплаты или свяжитесь с поддержкой."
```

In `messages/am.json`, under `checkout`:

```json
"billing_country": "Վճարման երկիր",
"polar_unavailable": "Միջազգային վճարումները ժամանակավորապես անհասանելի են։ Ընտրեք Հայաստանը որպես վճարման երկիր կամ դիմեք աջակցմանը։"
```

(Provisional translations — flag for the `docs/translation-review-checklist.md` pass.)

- [ ] **Step 4: Typecheck + lint + i18n smoke**

Run: `pnpm typecheck && pnpm lint && pnpm smoke:i18n`
Expected: no errors; the i18n smoke confirms all three locales have the new keys.

- [ ] **Step 5: Manual verification (dev server)**

Run: `pnpm dev`, add an item to the cart, go to `/checkout`.
Expected:
- Destination = Armenia → billing country defaults to `AM`, submit enabled, "Create order" starts the normal Ameria flow.
- Change the billing country selector to a non-`AM` country → the "temporarily unavailable" notice appears and the submit button is disabled.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/billing-country-field.tsx app/checkout/page.tsx messages/en.json messages/ru.json messages/am.json
git commit -m "feat(checkout): billing-country selector with temporarily-unavailable Polar notice"
```

---

### Task 6: Credits — billing country selector + routing

**Files:**
- Create: `components/credits/credit-purchase-form.tsx`
- Modify: `app/credits/actions.ts:65-119` (`createCreditPackCheckoutAction`)
- Modify: `app/credits/page.tsx`
- Test: manual (dev server) + `pnpm typecheck` + `pnpm lint`

**Interfaces:**
- Consumes: `resolvePaymentRoute` (Task 2), `isPolarEnabled` (Task 3), `resolveMarket` + `listMarketGeography` + `getCountryDisplayName` from `@/lib/market`.
- Produces: `createCreditPackCheckoutAction` reads `billingCountryCode`, routes by it, guards `polar` while disabled, and stores `billingCountryCode` in transaction metadata. Each pack renders a billing-country selector.

- [ ] **Step 1: Update the credits checkout action**

In `app/credits/actions.ts`:

Add imports:

```ts
import { resolvePaymentRoute } from '@/lib/payments/router';
import { isPolarEnabled } from '@/lib/payments/polar';
```

Extend `creditPackRequestSchema` (line 13) — note this schema is shared with `requestManualCreditPackAction`, so make the new field optional there and required at the checkout call site via the parsed value:

```ts
const creditPackRequestSchema = z.object({
  packKey: z.string().trim().min(1),
  billingCountryCode: z.string().trim().regex(/^[A-Z]{2}$/).optional().or(z.literal('')),
});
```

In `createCreditPackCheckoutAction`, update the parse (line 66) to include the field:

```ts
  const parsed = creditPackRequestSchema.safeParse({
    packKey: formData.get('packKey'),
    billingCountryCode: formData.get('billingCountryCode') || '',
  });
```

Replace the route resolution on line 85 (`const paymentRoute = await getPaymentRoute(converted.currency, service);`) with:

```ts
  const billingCountryCode = parsed.data.billingCountryCode || '';
  const paymentRoute = resolvePaymentRoute(billingCountryCode);
  if (paymentRoute === 'polar' && !isPolarEnabled()) {
    redirect('/credits?checkout=polar_unavailable');
  }
```

Add `billingCountryCode` to the transaction `metadata` object (in the `createCreditPurchaseTransaction` call, ~line 95):

```ts
    metadata: {
      packKey: pack.key,
      packName: pack.name,
      creditAmount: pack.creditAmount,
      sourcePriceCents: pack.priceCents,
      sourceCurrency: pack.currency,
      requestedByEmail: user.email ?? null,
      billingCountryCode,
    },
```

Leave `requestManualCreditPackAction` otherwise unchanged (manual admin-credit path — spec open item, out of scope). Because `billingCountryCode` is now optional in the shared schema, that action still parses fine.

- [ ] **Step 2: Create the credit purchase form component**

Create `components/credits/credit-purchase-form.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { createCreditPackCheckoutAction } from '@/app/credits/actions';
import { Button } from '@/components/ui/button';

export function CreditPurchaseForm({
  packKey,
  countries,
  defaultCountry,
  polarEnabled,
  billingLabel,
  unavailableLabel,
  buyLabel,
  children,
}: {
  packKey: string;
  countries: { code: string; label: string }[];
  defaultCountry: string;
  polarEnabled: boolean;
  billingLabel: string;
  unavailableLabel: string;
  buyLabel: string;
  children: ReactNode;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const blocked = !polarEnabled && country !== 'AM';

  return (
    <form action={createCreditPackCheckoutAction} className="space-y-4 rounded-md border p-4">
      <input type="hidden" name="packKey" value={packKey} />
      {children}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor={`billing-${packKey}`}>
          {billingLabel}
        </label>
        <select
          id={`billing-${packKey}`}
          name="billingCountryCode"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          {countries.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {blocked ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {unavailableLabel}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={blocked}>
        {buyLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Wire it into the credits page**

In `app/credits/page.tsx`:

Add imports:

```ts
import { CreditPurchaseForm } from '@/components/credits/credit-purchase-form';
import { isPolarEnabled } from '@/lib/payments/polar';
import { getCountryDisplayName, listMarketGeography, resolveMarket } from '@/lib/market';
```

After the `activeCurrency` line (line 59), resolve the market + country list:

```ts
  const [market, geography] = await Promise.all([resolveMarket(), listMarketGeography(supabase)]);
  const countries = geography.countries
    .filter((country) => country.is_active)
    .map((country) => ({ code: country.code, label: getCountryDisplayName(country.code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  const defaultBillingCountry = market.countryCode ?? 'AM';
  const polarEnabled = isPolarEnabled();
```

Remove the now-unused `getPaymentRoute` usage inside `displayPacks` (lines 67 and 72 — the `paymentRoute` field is no longer displayed) and drop the `getPaymentRoute` import (line 11); keep the price conversion. The mapped pack object becomes:

```ts
      return {
        ...pack,
        displayPriceCents: converted.amountCents,
        displayCurrency: converted.currency,
      };
```

Replace the inline pack `<form>` (lines 135-149) with the component, moving the pack details into `children` and dropping the old route label:

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
                <div>
                  <h3 className="font-medium">{pack.name}</h3>
                  <p className="text-2xl font-bold">{pack.creditAmount} {t('credits.unit')}</p>
                  <p className="text-sm text-muted-foreground">{formatLocalizedCurrency(locale, pack.displayPriceCents, pack.displayCurrency)}</p>
                </div>
                <p className="min-h-10 text-xs text-muted-foreground">{pack.description}</p>
              </CreditPurchaseForm>
```

- [ ] **Step 4: Add the credits "unavailable" status notice**

In `app/credits/page.tsx`, change the signature to read the status param and render a notice (mirroring checkout). Update the component signature (line 16):

```ts
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout: checkoutStatus } = await searchParams;
```

Inside `<main ...>` (before the title block, ~line 80), add:

```tsx
        {checkoutStatus === 'polar_unavailable' ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {t('checkout.polar_unavailable')}
          </div>
        ) : null}
```

- [ ] **Step 5: Typecheck + lint + i18n smoke**

Run: `pnpm typecheck && pnpm lint && pnpm smoke:i18n`
Expected: no errors (reuses `checkout.billing_country` / `checkout.polar_unavailable` from Task 5, so no new keys needed).

- [ ] **Step 6: Manual verification (dev server)**

Run: `pnpm dev`, open `/credits`.
Expected:
- Billing country defaults to the market country (or `AM`). With `AM`, "Buy" is enabled and starts the Ameria flow.
- Selecting a non-`AM` country shows the "temporarily unavailable" notice and disables "Buy".

- [ ] **Step 7: Commit**

```bash
git add components/credits/credit-purchase-form.tsx app/credits/actions.ts app/credits/page.tsx
git commit -m "feat(credits): route credit purchases by billing country with Polar-unavailable notice"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 2: Lint + format check**

Run: `pnpm lint && pnpm format:check`
Expected: no errors. (If `format:check` flags files, run `pnpm format` and amend.)

- [ ] **Step 3: Unit tests**

Run: `pnpm test`
Expected: all pass, including `tests/payments/routing.test.ts` and `tests/payments/polar-flag.test.ts`.

- [ ] **Step 4: i18n smoke**

Run: `pnpm smoke:i18n`
Expected: passes for en/ru/am with the new keys present.

- [ ] **Step 5: Manual end-to-end checklist**

With `POLAR_ENABLED` unset (default off), on `pnpm dev`:
- Checkout, billing country `AM` → order created, Ameria redirect. ✅
- Checkout, billing country non-`AM` → submit disabled + notice; forcing submit (e.g. via edited request) hits the server guard → redirected to `/checkout?checkout=polar_unavailable`, **no order created** (verify no new `orders` row). ✅
- Credits, billing country `AM` → Ameria flow. ✅
- Credits, billing country non-`AM` → "Buy" disabled + notice; server guard yields `/credits?checkout=polar_unavailable`, **no transaction created**. ✅

> **Coverage boundary (conscious):** the pure pieces (`resolvePaymentRoute`, `isPolarEnabled`) are unit-tested, but the server guard's core behavior — "polar + disabled ⇒ no order/transaction created" — is verified **manually only** (a DB-backed integration test is out of proportion for a skeleton). A future refactor could silently reopen the international path with no failing test; the Polar follow-up should add that integration coverage.

- [ ] **Step 6: Final commit (if any format/lint fixups)**

```bash
git add -A
git commit -m "chore(payments): verification fixups for billing-country routing"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Routing (`resolvePaymentRoute`, AM→ameria else→polar) → Task 2. ✅
- `'polar'` enum + `orders.billing_country_code` migration → Task 1. ✅
- `POLAR_ENABLED` flag + unavailable-while-off → Task 3 (flag), Tasks 4/6 (server guard), Tasks 5/6 (UI notice + disabled). ✅
- Billing country at checkout, default same-as-shipping (market country) → Task 5. ✅
- Credits too (billing country selector + routing) → Task 6. ✅
- i18n keys → Task 5 (defined), reused in Task 6. ✅
- Always-USD currency contract → deferred by spec; no task (correct — out of scope). ✅
- Testing (unit + typecheck + manual) → Tasks 2, 3, 7. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. Provisional ru/am translations are explicitly flagged for the translation-review pass (a real value, not a placeholder). ✅

**Type consistency:** `resolvePaymentRoute(billingCountryCode: string | null | undefined) → 'ameria' | 'polar'` and `isPolarEnabled(): boolean` are used with matching signatures across Tasks 4, 5, 6. The form field name `billingCountryCode` is consistent across component, action schema, and maps to the DB column `billing_country_code`. ✅

## Notes for the executor

- Task 1 needs local Supabase running (`supabase start`) before `supabase migration up` / `pnpm db:types`. See the project memory for the full local-Supabase gate command.
- Line numbers are from the current `main`; if a file has shifted, match on the quoted surrounding code, not the line number.
- Do not add Polar SDK, credentials, session creation, or webhooks — that is the separate follow-up spec.
- **Latent trap for the Polar follow-up:** the post-order branch `if (payment_provider_route !== 'ameria') → redirect('…bank_pending')` in `app/checkout/actions.ts` (and its equivalent in the credits action) is dead while `POLAR_ENABLED` is off, but the moment the flag flips true a `polar` order/transaction will fall into it and be shunted to `bank_pending` instead of a Polar redirect. The Polar follow-up MUST rewrite this branch to initiate the Polar checkout session — do not leave it as-is.
