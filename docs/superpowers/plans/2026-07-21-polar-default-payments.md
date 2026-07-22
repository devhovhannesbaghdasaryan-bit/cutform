# Polar Default Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Polar the default payment provider for every buyer, disable Ameriabank reversibly, drop RUB, charge in the buyer's original currency (AMD/EUR/USD), and switch exchange rates to ExchangeRate-API v6 with an admin refresh button.

**Architecture:** Mirror the existing Ameriabank provider pattern — a Polar provider module (`initiatePolarCheckout`) plus a `settlePolarPayment` that reuses the already-provider-agnostic `fulfillOrderPayment`/`fulfillCreditPurchase`. Two entry points (a Polar webhook and a server-side return-verify route) both call the same idempotent settle. Routing flips to Polar via a reversible `AMERIA_ENABLED` flag.

**Tech Stack:** Next.js App Router (server actions + route handlers, `runtime = 'nodejs'`), TypeScript, Supabase (`@supabase/supabase-js`), Zod, Vitest, `@polar-sh/sdk`, ExchangeRate-API v6.

## Global Constraints

- Node runtime for all payment route handlers: `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
- Feature flags are exact-string `'true'` only (mirror existing `isPolarEnabled`): any other value = disabled.
- Secrets (`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `EXCHANGE_RATE_API_KEY`) live in `.env.local` (gitignored) and Vercel env — never hardcoded, never committed. The ExchangeRate-API key was supplied privately by the user; set it as `EXCHANGE_RATE_API_KEY` in `.env.local` only — never write the literal key into any tracked file.
- Browser redirect params carry no authority — payment outcome is always decided by a server-side check (webhook signature / Polar API fetch), matching the Ameria design.
- App currencies after this work: `AMD`, `EUR`, `USD` (RUB removed). Default currency stays `AMD`.
- Money is stored/passed as integer minor units (`amountCents`). Polar amounts are also minor units.
- Follow existing file conventions: pure logic in `*-core.ts` (no env/Next imports, unit-tested), env/SDK/DB in the sibling module.
- Run the full test suite with `npm test` (Vitest). Type-check with `npm run build` or `npx tsc --noEmit` if available.

---

## File Structure

**Created:**
- `lib/payments/flags.ts` — `isPolarEnabled()` + `isAmeriaEnabled()` (single home for provider flags).
- `lib/payments/polar-core.ts` — pure: `decidePolarOutcome(...)`, currency normalization. No env/Next imports.
- `app/api/payments/polar/webhook/route.ts` — Polar webhook receiver (authoritative settle).
- `app/api/payments/polar/return/route.ts` — success-redirect target; server-verifies + settles.
- `tests/payments/polar-core.test.ts` — unit tests for `decidePolarOutcome`.
- `tests/lib/rate-provider-url.test.ts` — unit tests for `buildRateProviderUrl`.
- `supabase/migrations/00XX_drop_rub_currency.sql` — disable RUB + purge RUB rates.

**Modified:**
- `lib/payments/polar.ts` — re-export `isPolarEnabled`; add `getPolarClient`, `getPolarProductId`, `initiatePolarCheckout`, `fetchPolarCheckout`.
- `lib/payments/router.ts` — `resolvePaymentRoute` honors `isAmeriaEnabled()`.
- `lib/payments/fulfillment.ts` — export shared `claimTransactionSuccess`; add `settlePolarPayment`.
- `lib/currency.ts` — drop RUB; add `{apiKey}` URL substitution via `buildRateProviderUrl`; add `refreshExchangeRate`.
- `lib/env.ts` — add Polar + `AMERIA_ENABLED` env keys.
- `app/checkout/actions.ts` — route to Polar; widen `payment_provider_route` union.
- `app/credits/actions.ts` — route to Polar.
- `app/admin/currencies/page.tsx` — "Refresh rates" button; add `polar` to route dropdown.
- `app/admin/currencies/actions.ts` — `refreshExchangeRatesAction`.
- `tests/payments/routing.test.ts` — updated for the flag.
- `tests/lib/domain-helpers.test.ts` — remove RUB cases.
- `.env.local.example` — document new env keys.
- `package.json` — add `@polar-sh/sdk`.

---

## Task 1: Drop RUB from supported currencies

**Files:**
- Modify: `lib/currency.ts:11` (`APP_CURRENCIES`), `lib/currency.ts:65-74` (comment + helper)
- Modify: `tests/lib/domain-helpers.test.ts:62-65`
- Create: `supabase/migrations/00XX_drop_rub_currency.sql` (use the next sequential migration number — check the highest existing file in `supabase/migrations/`)

**Interfaces:**
- Produces: `APP_CURRENCIES = ['AMD','EUR','USD']`, `AppCurrency` narrowed to those three.

- [ ] **Step 1: Update the failing test first**

In `tests/lib/domain-helpers.test.ts`, replace the RUB assertions (lines ~62-65) so no removed currency is referenced:

```typescript
    expect(getPaymentRouteForCurrency('USD')).toBe('ameria');
    expect(getPaymentRouteForCurrency('EUR')).toBe('ameria');
    expect(getPaymentRouteForCurrency('AMD')).toBe('bank_manual');
```

Also check the whole file for any other `'RUB'` literal and remove it.

- [ ] **Step 2: Run it to see the type/compile error**

Run: `npm test -- tests/lib/domain-helpers.test.ts`
Expected: FAIL or type error because `AppCurrency` still includes `'RUB'` elsewhere, or (if it passes) proceed — the real change is Step 3.

- [ ] **Step 3: Remove RUB from the source**

In `lib/currency.ts` line 11:

```typescript
export const APP_CURRENCIES = ['AMD', 'EUR', 'USD'] as const;
```

Update the comment at lines 65-67 to drop the RUB mention:

```typescript
// Card currencies (USD/EUR) route to Ameriabank vPOS; AMD falls back to the
// manual/bank route. Live routing is DB-driven via getPaymentRoute() in
// lib/payments/router.ts; this pure currency→route helper backs unit tests.
```

Search the whole repo for other `'RUB'` references in `.ts`/`.tsx` (e.g. `lib/payments/ameria-core.ts:17` has an `AMD/USD/EUR/RUB` map — **leave that one**; Ameria's ISO map may still receive historical RUB values and removing it is out of scope). Only remove RUB from app-currency selection lists.

- [ ] **Step 4: Write the migration**

`supabase/migrations/00XX_drop_rub_currency.sql`:

```sql
-- Drop RUB from the storefront: disable the row and purge cached RUB rates.
-- Historical transactions keep their stored currency string untouched.
update public.currencies set is_enabled = false where code = 'RUB';

delete from public.exchange_rates
where base_currency = 'RUB' or target_currency = 'RUB';
```

- [ ] **Step 5: Run tests + type-check**

Run: `npm test -- tests/lib/domain-helpers.test.ts` and `npx tsc --noEmit`
Expected: PASS; no type errors referencing `'RUB'` as an `AppCurrency`.

- [ ] **Step 6: Commit**

```bash
git add lib/currency.ts tests/lib/domain-helpers.test.ts supabase/migrations
git commit -m "feat(currency): drop RUB from supported currencies"
```

---

## Task 2: ExchangeRate-API v6 provider URL

**Files:**
- Modify: `lib/currency.ts:215-246` (`fetchProviderRate`), add exported `buildRateProviderUrl`
- Modify: `lib/env.ts` (defaults documented in `.env.local.example`, no schema change needed — keys already exist)
- Create: `tests/lib/rate-provider-url.test.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `buildRateProviderUrl(template: string, apiKey: string | undefined, base: string, target: string): string`

- [ ] **Step 1: Write the failing test**

`tests/lib/rate-provider-url.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildRateProviderUrl } from '@/lib/currency';

describe('buildRateProviderUrl', () => {
  it('substitutes apiKey and base for the ExchangeRate-API v6 template', () => {
    const url = buildRateProviderUrl(
      'https://v6.exchangerate-api.com/v6/{apiKey}/latest/{base}',
      'secret-key',
      'AMD',
      'USD',
    );
    expect(url).toBe('https://v6.exchangerate-api.com/v6/secret-key/latest/AMD');
  });

  it('substitutes {target} for legacy templates and tolerates a missing key', () => {
    const url = buildRateProviderUrl('https://open.er-api.com/v6/latest/{base}', undefined, 'AMD', 'USD');
    expect(url).toBe('https://open.er-api.com/v6/latest/AMD');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/lib/rate-provider-url.test.ts`
Expected: FAIL with `buildRateProviderUrl is not a function` (not exported yet).

- [ ] **Step 3: Implement `buildRateProviderUrl` and use it in `fetchProviderRate`**

In `lib/currency.ts`, add above `fetchProviderRate`:

```typescript
export function buildRateProviderUrl(
  template: string,
  apiKey: string | undefined,
  base: string,
  target: string,
): string {
  return template
    .replace('{apiKey}', encodeURIComponent(apiKey ?? ''))
    .replace('{base}', encodeURIComponent(base))
    .replace('{target}', encodeURIComponent(target));
}
```

Replace the URL construction inside `fetchProviderRate` (currently lines ~217-221) with:

```typescript
  const env = getServerEnv();
  const provider = env.EXCHANGE_RATE_PROVIDER ?? 'exchangerate-api';
  const template =
    env.EXCHANGE_RATE_API_URL ?? 'https://v6.exchangerate-api.com/v6/{apiKey}/latest/{base}';
  const url = buildRateProviderUrl(template, env.EXCHANGE_RATE_API_KEY, baseCurrency, targetCurrency);
```

Then change the `fetch` call so the API key is not also sent as a Bearer header when it is already in the URL path:

```typescript
  const usesApiKeyInUrl = template.includes('{apiKey}');
  const response = await fetch(url, {
    headers:
      env.EXCHANGE_RATE_API_KEY && !usesApiKeyInUrl
        ? { authorization: `Bearer ${env.EXCHANGE_RATE_API_KEY}` }
        : undefined,
    cache: 'no-store',
  });
```

The existing response parsing (`payload.rates ?? payload.conversion_rates`, `payload.result`) already matches ExchangeRate-API's `conversion_rates`/`result` shape — leave it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/rate-provider-url.test.ts`
Expected: PASS.

- [ ] **Step 5: Document env**

Append to `.env.local.example`:

```bash
# Exchange rates (ExchangeRate-API v6). Key goes in the URL path via {apiKey}.
EXCHANGE_RATE_PROVIDER=exchangerate-api
EXCHANGE_RATE_API_URL=https://v6.exchangerate-api.com/v6/{apiKey}/latest/{base}
EXCHANGE_RATE_API_KEY=your-exchangerate-api-key
```

Set the real key (supplied privately by the user) in `.env.local` (not the example file, not any tracked file): `EXCHANGE_RATE_API_KEY=<the-key>`.

- [ ] **Step 6: Commit**

```bash
git add lib/currency.ts tests/lib/rate-provider-url.test.ts .env.local.example
git commit -m "feat(currency): switch exchange rates to ExchangeRate-API v6"
```

---

## Task 3: Admin refresh-rates action + Polar route option

**Files:**
- Modify: `lib/currency.ts` (add `refreshExchangeRate`)
- Modify: `app/admin/currencies/actions.ts` (add `refreshExchangeRatesAction`)
- Modify: `app/admin/currencies/page.tsx` (button + `polar` dropdown option)

**Interfaces:**
- Consumes: `buildRateProviderUrl`/`fetchProviderRate` (Task 2), `listEnabledCurrencies`, `insertRate`, `rowToContext`, `DEFAULT_CURRENCY` (all in `lib/currency.ts`), `requireAdminPermission` (`lib/admin.ts`), `writeAdminAuditLog` (`lib/transactions.ts`).
- Produces: `refreshExchangeRate(base: AppCurrency, target: AppCurrency, supabase?: SupabaseClient): Promise<ExchangeRateContext>`; server action `refreshExchangeRatesAction(): Promise<void>`.

- [ ] **Step 1: Add `refreshExchangeRate` to `lib/currency.ts`**

Add after `getExchangeRate`:

```typescript
// Force-fetches a fresh provider rate, bypassing the same-day cache short-circuit
// in getExchangeRate. insertRate upserts on (base,target,rate_date) so a same-day
// refresh overwrites the cached value.
export async function refreshExchangeRate(
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ExchangeRateContext> {
  if (baseCurrency === targetCurrency) {
    const row = await insertRate(supabase, baseCurrency, targetCurrency, 1, 'identity', false, {
      source: 'identity',
    });
    return rowToContext(row, 'identity');
  }
  const fetched = await fetchProviderRate(baseCurrency, targetCurrency);
  const row = await insertRate(
    supabase,
    baseCurrency,
    targetCurrency,
    fetched.rate,
    fetched.provider,
    false,
    { source: 'provider', refreshed: true },
  );
  return rowToContext(row, 'provider');
}
```

- [ ] **Step 2: Add the server action**

In `app/admin/currencies/actions.ts`, add imports at the top:

```typescript
import { DEFAULT_CURRENCY, listEnabledCurrencies, refreshExchangeRate } from '@/lib/currency';
```

Add the action:

```typescript
export async function refreshExchangeRatesAction() {
  const { supabase, user } = await requireAdminPermission('transactions_manage');
  const enabled = await listEnabledCurrencies(supabase);
  const targets = enabled.map((c) => c.code).filter((code) => code !== DEFAULT_CURRENCY);

  const results: Array<{ target: string; ok: boolean; error?: string }> = [];
  for (const target of targets) {
    try {
      await refreshExchangeRate(DEFAULT_CURRENCY, target, supabase);
      results.push({ target, ok: true });
    } catch (error) {
      results.push({ target, ok: false, error: error instanceof Error ? error.message : 'unknown' });
    }
  }

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: 'admin_exchange_rates_refreshed',
    entityType: 'exchange_rates',
    reason: 'Manual exchange-rate refresh from admin currencies page.',
    metadata: { base: DEFAULT_CURRENCY, results },
  });

  revalidatePath('/admin/currencies');
  revalidatePath('/');
  revalidatePath('/catalog');
}
```

- [ ] **Step 3: Add the button and `polar` dropdown option to the page**

In `app/admin/currencies/page.tsx`, import the action:

```typescript
import { refreshExchangeRatesAction, updateCurrencySettingsAction } from '@/app/admin/currencies/actions';
```

Add a `polar` option inside the `<select>` (after the `bank_manual` option, ~line 117):

```tsx
                          <option value="ameria">Ameriabank</option>
                          <option value="polar">Polar</option>
                          <option value="bank_manual">Bank / manual</option>
```

Add a refresh form directly above the closing `</main>` (a separate `<form>` — it must NOT nest inside the settings `<form>`):

```tsx
      <form action={refreshExchangeRatesAction} className="flex items-center justify-between rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          Pull the latest AMD→currency rates from the exchange-rate provider now.
        </p>
        <Button type="submit" variant="outline">
          Refresh rates
        </Button>
      </form>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/currency.ts app/admin/currencies/actions.ts app/admin/currencies/page.tsx
git commit -m "feat(admin): manual exchange-rate refresh + polar route option"
```

---

## Task 4: Reversible Ameriabank disable (routing flip)

**Files:**
- Create: `lib/payments/flags.ts`
- Modify: `lib/payments/polar.ts` (re-export `isPolarEnabled` from flags)
- Modify: `lib/payments/router.ts:26-30` (`resolvePaymentRoute`)
- Modify: `lib/env.ts:32` (add `AMERIA_ENABLED`)
- Modify: `tests/payments/routing.test.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `isPolarEnabled(): boolean`, `isAmeriaEnabled(): boolean` (from `lib/payments/flags.ts`); `resolvePaymentRoute` now returns `'ameria'` only when Ameria is enabled and country is `AM`.

- [ ] **Step 1: Rewrite the routing test for the flag**

Replace `tests/payments/routing.test.ts` with:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete process.env.AMERIA_ENABLED;
  vi.resetModules();
});

async function importRouter() {
  vi.resetModules();
  return import('@/lib/payments/router');
}

describe('resolvePaymentRoute', () => {
  it('routes everyone to polar when Ameria is disabled (default)', async () => {
    const { resolvePaymentRoute } = await importRouter();
    expect(resolvePaymentRoute('AM')).toBe('polar');
    expect(resolvePaymentRoute('am')).toBe('polar');
    expect(resolvePaymentRoute('US')).toBe('polar');
    expect(resolvePaymentRoute(null)).toBe('polar');
  });

  it('routes Armenia to ameria only when Ameria is enabled', async () => {
    process.env.AMERIA_ENABLED = 'true';
    const { resolvePaymentRoute } = await importRouter();
    expect(resolvePaymentRoute('AM')).toBe('ameria');
    expect(resolvePaymentRoute(' am ')).toBe('ameria');
    expect(resolvePaymentRoute('US')).toBe('polar');
    expect(resolvePaymentRoute('DE')).toBe('polar');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/payments/routing.test.ts`
Expected: FAIL — current `resolvePaymentRoute` still routes `AM` to `ameria` unconditionally.

- [ ] **Step 3: Create the flags module**

`lib/payments/flags.ts`:

```typescript
import 'server-only';

import { getServerEnv } from '@/lib/env';

// Feature flags are exact-string 'true' only; any other value = disabled.
export function isPolarEnabled(): boolean {
  return getServerEnv().POLAR_ENABLED === 'true';
}

export function isAmeriaEnabled(): boolean {
  return getServerEnv().AMERIA_ENABLED === 'true';
}
```

- [ ] **Step 4: Re-point `polar.ts` and update the router**

Replace the body of `lib/payments/polar.ts` with a re-export plus (later) provider functions. For now:

```typescript
import 'server-only';

export { isPolarEnabled } from '@/lib/payments/flags';
```

(Task 6 adds the provider functions to this file.)

Update `resolvePaymentRoute` in `lib/payments/router.ts`:

```typescript
import { isAmeriaEnabled } from '@/lib/payments/flags';

// Country-based routing: while Ameria is enabled, Armenia settles via Ameriabank;
// everyone else — and everyone when Ameria is disabled — goes to Polar.
export function resolvePaymentRoute(
  billingCountryCode: string | null | undefined,
): 'ameria' | 'polar' {
  if (isAmeriaEnabled() && normalizeCountryCode(billingCountryCode) === 'AM') return 'ameria';
  return 'polar';
}
```

Add `AMERIA_ENABLED: optionalNonEmpty,` to `serverShape` in `lib/env.ts` (next to `POLAR_ENABLED`).

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/payments/routing.test.ts tests/payments/polar-flag.test.ts`
Expected: PASS (both files).

- [ ] **Step 6: Document env + commit**

Append to `.env.local.example`:

```bash
# Payment provider switches (exact string 'true' enables).
POLAR_ENABLED=true
AMERIA_ENABLED=false
```

```bash
git add lib/payments/flags.ts lib/payments/polar.ts lib/payments/router.ts lib/env.ts tests/payments/routing.test.ts .env.local.example
git commit -m "feat(payments): route to Polar by default, disable Ameria via flag"
```

---

## Task 5: Shared settle helper + `settlePolarPayment`

**Files:**
- Create: `lib/payments/polar-core.ts`
- Create: `tests/payments/polar-core.test.ts`
- Modify: `lib/payments/fulfillment.ts` (export `claimTransactionSuccess`; add `settlePolarPayment`)

**Interfaces:**
- Consumes: `SettleTransaction`, `SettleResult`, `redirectBase`, `fulfillOrderPayment`, `fulfillCreditPurchase`, `claimTransactionSuccess` (all in `lib/payments/fulfillment.ts`).
- Produces:
  - `decidePolarOutcome(paid: { amountCents: number; currency: string; paid: boolean }, expected: { amountCents: number; currency: string }): { outcome: 'succeeded' | 'failed' | 'pending'; amountMatches: boolean }`
  - `settlePolarPayment(service: SupabaseClient, args: { transactionId: string; paidAmountCents: number; paidCurrency: string; paid: boolean; providerReference?: string | null }): Promise<SettleResult>`

- [ ] **Step 1: Write the failing pure-core test**

`tests/payments/polar-core.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { decidePolarOutcome } from '@/lib/payments/polar-core';

describe('decidePolarOutcome', () => {
  const expected = { amountCents: 5000, currency: 'USD' };

  it('succeeds when paid and amount+currency match (case-insensitive currency)', () => {
    expect(decidePolarOutcome({ amountCents: 5000, currency: 'usd', paid: true }, expected)).toEqual({
      outcome: 'succeeded',
      amountMatches: true,
    });
  });

  it('is pending when Polar has not confirmed payment', () => {
    expect(decidePolarOutcome({ amountCents: 5000, currency: 'USD', paid: false }, expected)).toEqual({
      outcome: 'pending',
      amountMatches: true,
    });
  });

  it('fails a paid event whose amount does not match', () => {
    expect(decidePolarOutcome({ amountCents: 4200, currency: 'USD', paid: true }, expected)).toEqual({
      outcome: 'failed',
      amountMatches: false,
    });
  });

  it('fails a paid event whose currency does not match', () => {
    expect(decidePolarOutcome({ amountCents: 5000, currency: 'EUR', paid: true }, expected)).toEqual({
      outcome: 'failed',
      amountMatches: false,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/payments/polar-core.test.ts`
Expected: FAIL with `decidePolarOutcome is not a function`.

- [ ] **Step 3: Implement `polar-core.ts`**

`lib/payments/polar-core.ts`:

```typescript
// Pure Polar settlement decision logic. No env or Next imports — unit-tested
// outside the Next runtime.
export function decidePolarOutcome(
  paid: { amountCents: number; currency: string; paid: boolean },
  expected: { amountCents: number; currency: string },
): { outcome: 'succeeded' | 'failed' | 'pending'; amountMatches: boolean } {
  const amountMatches =
    Number.isFinite(paid.amountCents) &&
    Math.round(paid.amountCents) === Math.round(expected.amountCents) &&
    paid.currency.toUpperCase() === expected.currency.toUpperCase();

  if (!paid.paid) return { outcome: 'pending', amountMatches };
  return { outcome: amountMatches ? 'succeeded' : 'failed', amountMatches };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/payments/polar-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Export the shared claim helper and add `settlePolarPayment`**

In `lib/payments/fulfillment.ts`, change `async function claimTransactionSuccess` to `export async function claimTransactionSuccess` (line ~93). Add imports at the top:

```typescript
import { decidePolarOutcome } from '@/lib/payments/polar-core';
```

Add at the end of the file:

```typescript
export async function settlePolarPayment(
  service: SupabaseClient,
  args: {
    transactionId: string;
    paidAmountCents: number;
    paidCurrency: string;
    paid: boolean;
    providerReference?: string | null;
  },
): Promise<SettleResult> {
  const { data: transaction, error } = await service
    .from('transactions')
    .select('id, user_id, order_id, type, status, amount_cents, currency, metadata')
    .eq('id', args.transactionId)
    .maybeSingle<SettleTransaction>();
  if (error) throw new Error(error.message);
  if (!transaction) return { outcome: 'not_found', redirectPath: '/?checkout=invalid' };

  const base = redirectBase(transaction);
  if (transaction.status === 'succeeded') {
    return { outcome: 'already_succeeded', redirectPath: `${base}?checkout=success` };
  }

  const { outcome, amountMatches } = decidePolarOutcome(
    { amountCents: args.paidAmountCents, currency: args.paidCurrency, paid: args.paid },
    { amountCents: transaction.amount_cents, currency: transaction.currency },
  );

  if (outcome === 'succeeded') {
    const claimed = await claimTransactionSuccess(service, transaction.id);
    if (!claimed) {
      const { data: current, error: statusError } = await service
        .from('transactions')
        .select('status')
        .eq('id', transaction.id)
        .maybeSingle<{ status: string }>();
      if (statusError) throw new Error(statusError.message);
      if (current?.status === 'succeeded') {
        return { outcome: 'already_succeeded', redirectPath: `${base}?checkout=success` };
      }
      return { outcome: 'needs_attention', redirectPath: `${base}?checkout=pending` };
    }
    try {
      if (transaction.type === 'credit_purchase') {
        await fulfillCreditPurchase(service, transaction);
      } else {
        await fulfillOrderPayment(service, transaction);
      }
    } catch (fulfillError) {
      const { error: rollbackError } = await service
        .from('transactions')
        .update({ status: 'pending' })
        .eq('id', transaction.id)
        .eq('status', 'succeeded');
      if (rollbackError) {
        console.error('[polar-settle] failed to roll back claim', transaction.id, rollbackError.message);
      }
      throw fulfillError;
    }
    return { outcome: 'succeeded', redirectPath: `${base}?checkout=success` };
  }

  if (outcome === 'pending') {
    return { outcome: 'pending', redirectPath: `${base}?checkout=pending` };
  }

  const { error: updateError } = await service
    .from('transactions')
    .update({
      status: 'failed',
      metadata: {
        ...(transaction.metadata ?? {}),
        polarAmountMatches: amountMatches,
        polarProviderReference: args.providerReference ?? null,
      },
    })
    .eq('id', transaction.id);
  if (updateError) throw new Error(updateError.message);

  return { outcome: 'failed', redirectPath: `${base}?checkout=failed` };
}
```

- [ ] **Step 6: Run the payments suite + type-check**

Run: `npm test -- tests/payments` and `npx tsc --noEmit`
Expected: PASS; Ameria tests still green (the `export` on `claimTransactionSuccess` is additive).

- [ ] **Step 7: Commit**

```bash
git add lib/payments/polar-core.ts tests/payments/polar-core.test.ts lib/payments/fulfillment.ts
git commit -m "feat(payments): add settlePolarPayment reusing shared fulfillment"
```

---

## Task 6: Polar provider — checkout session creation

**Files:**
- Modify: `package.json` (add `@polar-sh/sdk`)
- Modify: `lib/payments/polar.ts` (client + product resolver + `initiatePolarCheckout` + `fetchPolarCheckout`)
- Modify: `lib/env.ts` (Polar env keys)
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `InitiatePaymentInput`, `InitiatePaymentResult` (`lib/payments/types.ts`), `getServerEnv`.
- Produces:
  - `getPolarClient(): Polar`
  - `getPolarProductId(currency: string): string`
  - `initiatePolarCheckout(service: SupabaseClient, input: InitiatePaymentInput): Promise<InitiatePaymentResult>`
  - `fetchPolarCheckout(checkoutId: string)` → Polar checkout object (`{ id, status, amount, currency, metadata }`)

- [ ] **Step 1: Install the SDK**

Run: `npm install @polar-sh/sdk`
Expected: `@polar-sh/sdk` added to `package.json` dependencies.

- [ ] **Step 2: Add Polar env keys**

In `lib/env.ts` `serverShape`, add next to `POLAR_ENABLED`:

```typescript
  POLAR_ACCESS_TOKEN: optionalNonEmpty,
  POLAR_WEBHOOK_SECRET: optionalNonEmpty,
  POLAR_SERVER: optionalNonEmpty,
  POLAR_PRODUCT_ID_AMD: optionalNonEmpty,
  POLAR_PRODUCT_ID_EUR: optionalNonEmpty,
  POLAR_PRODUCT_ID_USD: optionalNonEmpty,
```

> **Currency note:** each app currency maps to its own Polar product priced in that currency (created with "pay what you want"/custom pricing so the amount is dynamic). This is how we charge the buyer's original currency (AMD/EUR/USD). See provisioning notes in the spec.

- [ ] **Step 3: Implement the provider in `lib/payments/polar.ts`**

Replace `lib/payments/polar.ts` with:

```typescript
import 'server-only';

import { Polar } from '@polar-sh/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import type { InitiatePaymentInput, InitiatePaymentResult } from '@/lib/payments/types';

export { isPolarEnabled } from '@/lib/payments/flags';

export function getPolarClient(): Polar {
  const env = getServerEnv();
  if (!env.POLAR_ACCESS_TOKEN) {
    throw new Error('POLAR_ACCESS_TOKEN is required for Polar payments.');
  }
  return new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER === 'production' ? 'production' : 'sandbox',
  });
}

// Each currency has its own Polar product (priced in that currency, pay-what-you-want)
// so we can charge the buyer's original currency with a dynamic amount.
export function getPolarProductId(currency: string): string {
  const env = getServerEnv();
  const map: Record<string, string | undefined> = {
    AMD: env.POLAR_PRODUCT_ID_AMD,
    EUR: env.POLAR_PRODUCT_ID_EUR,
    USD: env.POLAR_PRODUCT_ID_USD,
  };
  const productId = map[currency.toUpperCase()];
  if (!productId) {
    throw new Error(`No Polar product configured for currency ${currency}.`);
  }
  return productId;
}

export async function initiatePolarCheckout(
  service: SupabaseClient,
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  const env = getServerEnv();
  const polar = getPolarClient();
  const successUrl = `${env.NEXT_PUBLIC_SITE_URL}/api/payments/polar/return?checkout_id={CHECKOUT_ID}`;

  // NOTE: confirm the exact field for a dynamic amount against @polar-sh/sdk types
  // during implementation — `amount` on a pay-what-you-want product is the expected
  // shape. Metadata propagates from the checkout to the resulting order.
  const checkout = await polar.checkouts.create({
    products: [getPolarProductId(input.currency)],
    amount: input.amountCents,
    metadata: { transactionId: input.transactionId },
    successUrl,
  });

  const { error } = await service
    .from('transactions')
    .update({ provider_reference: checkout.id })
    .eq('id', input.transactionId);
  if (error) throw new Error(error.message);

  return { redirectUrl: checkout.url, providerReference: checkout.id };
}

export async function fetchPolarCheckout(checkoutId: string) {
  const polar = getPolarClient();
  return polar.checkouts.get({ id: checkoutId });
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If the SDK's `checkouts.create` argument names differ (e.g. `successUrl` vs `success_url`, or the amount field), adjust to the installed `@polar-sh/sdk` types — the shape above is the contract the rest of the plan depends on (`checkout.id`, `checkout.url`, `checkout.status`, `checkout.amount`, `checkout.currency`, `checkout.metadata`).

- [ ] **Step 5: Document env + commit**

Append to `.env.local.example`:

```bash
# Polar (polar.sh) — Merchant of Record checkout.
POLAR_ACCESS_TOKEN=your-polar-org-access-token
POLAR_WEBHOOK_SECRET=your-polar-webhook-secret
POLAR_SERVER=sandbox
POLAR_PRODUCT_ID_AMD=prod_...
POLAR_PRODUCT_ID_EUR=prod_...
POLAR_PRODUCT_ID_USD=prod_...
```

```bash
git add package.json package-lock.json lib/payments/polar.ts lib/env.ts .env.local.example
git commit -m "feat(payments): Polar checkout session provider"
```

---

## Task 7: Polar webhook route (authoritative settle)

**Files:**
- Create: `app/api/payments/polar/webhook/route.ts`

**Interfaces:**
- Consumes: `settlePolarPayment` (Task 5), `getServiceSupabase`, `getServerEnv`, `@polar-sh/sdk/webhooks` `validateEvent`.

- [ ] **Step 1: Implement the webhook handler**

`app/api/payments/polar/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { getServerEnv } from '@/lib/env';
import { settlePolarPayment } from '@/lib/payments/fulfillment';
import { getServiceSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Polar posts signed webhook events here. The signature — not the body content —
// is the trust boundary; order.paid is authoritative for fulfillment.
export async function POST(req: Request) {
  const secret = getServerEnv().POLAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[polar-webhook] POLAR_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const body = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(body, headers, secret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
    }
    throw error;
  }

  // Fulfill only on a confirmed paid order. `data` carries the metadata we set on
  // the checkout plus the paid amount/currency. Confirm field names against the SDK.
  if (event.type === 'order.paid') {
    const data = event.data as {
      metadata?: Record<string, unknown> | null;
      amount?: number;
      currency?: string;
      id?: string;
    };
    const transactionId = typeof data.metadata?.transactionId === 'string' ? data.metadata.transactionId : null;
    if (!transactionId) {
      console.error('[polar-webhook] order.paid without transactionId metadata', data.id);
      return NextResponse.json({ received: true });
    }
    try {
      await settlePolarPayment(getServiceSupabase(), {
        transactionId,
        paidAmountCents: Number(data.amount ?? Number.NaN),
        paidCurrency: String(data.currency ?? ''),
        paid: true,
        providerReference: data.id ?? null,
      });
    } catch (error) {
      // 5xx makes Polar retry the delivery.
      console.error('[polar-webhook] settle failed', transactionId, error);
      return NextResponse.json({ error: 'settle failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Confirm `@polar-sh/sdk/webhooks` exports `validateEvent` and `WebhookVerificationError` in the installed version; if the import path differs, adjust to the SDK's documented webhook helper (the contract: verify signature, return the parsed event with `.type` and `.data`).

- [ ] **Step 3: Commit**

```bash
git add app/api/payments/polar/webhook/route.ts
git commit -m "feat(payments): Polar webhook settle route"
```

---

## Task 8: Polar return-verify route

**Files:**
- Create: `app/api/payments/polar/return/route.ts`

**Interfaces:**
- Consumes: `fetchPolarCheckout` (Task 6), `settlePolarPayment` (Task 5), `getServiceSupabase`, `getServerEnv`.

- [ ] **Step 1: Implement the return handler**

`app/api/payments/polar/return/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { settlePolarPayment } from '@/lib/payments/fulfillment';
import { fetchPolarCheckout } from '@/lib/payments/polar';
import { getServiceSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Polar redirects the buyer's browser here after checkout. Query params carry no
// authority: we re-fetch the checkout from Polar (server truth) and settle. This
// closes the gap before the async webhook lands; both call the same idempotent settle.
export async function GET(req: Request) {
  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const checkoutId = new URL(req.url).searchParams.get('checkout_id');
  if (!checkoutId) {
    return NextResponse.redirect(new URL('/?checkout=invalid', siteUrl));
  }

  try {
    const checkout = (await fetchPolarCheckout(checkoutId)) as {
      status?: string;
      amount?: number;
      currency?: string;
      metadata?: Record<string, unknown> | null;
    };
    const transactionId = typeof checkout.metadata?.transactionId === 'string' ? checkout.metadata.transactionId : null;
    if (!transactionId) {
      return NextResponse.redirect(new URL('/?checkout=invalid', siteUrl));
    }

    // Polar checkout is 'confirmed'/'succeeded' once paid; anything else is not-yet-paid.
    const paid = checkout.status === 'succeeded' || checkout.status === 'confirmed';
    const result = await settlePolarPayment(getServiceSupabase(), {
      transactionId,
      paidAmountCents: Number(checkout.amount ?? Number.NaN),
      paidCurrency: String(checkout.currency ?? ''),
      paid,
      providerReference: checkoutId,
    });
    return NextResponse.redirect(new URL(result.redirectPath, siteUrl));
  } catch (error) {
    console.error('[polar-return]', checkoutId, error);
    return NextResponse.redirect(new URL('/?checkout=error', siteUrl));
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Confirm the paid `status` values against `@polar-sh/sdk` (`confirmed`/`succeeded`); adjust the `paid` predicate if the SDK uses different literals.

- [ ] **Step 3: Commit**

```bash
git add app/api/payments/polar/return/route.ts
git commit -m "feat(payments): Polar return-verify settle route"
```

---

## Task 9: Wire checkout + credits to Polar

**Files:**
- Modify: `app/checkout/actions.ts:89-138`
- Modify: `app/credits/actions.ts:119-131`

**Interfaces:**
- Consumes: `initiatePolarCheckout` (Task 6), `initiateAmeriaPayment`, `resolvePaymentRoute` (Task 4), `isPolarEnabled`.

- [ ] **Step 1: Update the checkout action**

In `app/checkout/actions.ts`, add the import:

```typescript
import { initiatePolarCheckout, isPolarEnabled } from '@/lib/payments/polar';
```

Widen the order-totals typed union (line ~89) to include `'polar'`:

```typescript
      payment_provider_route: 'ameria' | 'bank_manual' | 'polar' | null;
```

Replace the tail branch (lines ~127-138, the `if (orderTotals.payment_provider_route !== 'ameria')` block through the Ameria redirect) with:

```typescript
  const route = orderTotals.payment_provider_route ?? 'bank_manual';

  if (route === 'polar') {
    const { redirectUrl } = await initiatePolarCheckout(service, {
      transactionId: transaction.id,
      amountCents: orderTotals.total_cents,
      currency: orderTotals.currency,
      description: `Uniqraft order ${order.id.slice(0, 8)}`,
      locale: parsed.data.locale || null,
    });
    redirect(redirectUrl);
  }

  if (route === 'ameria') {
    const { redirectUrl } = await initiateAmeriaPayment(service, {
      transactionId: transaction.id,
      amountCents: orderTotals.total_cents,
      currency: orderTotals.currency,
      description: `Uniqraft order ${order.id.slice(0, 8)}`,
      locale: parsed.data.locale || null,
    });
    redirect(redirectUrl);
  }

  redirect(`/orders/${order.id}?checkout=bank_pending`);
```

Keep the existing `isPolarEnabled()` guard near the top (lines ~56-58) — it already blocks a Polar route when the flag is off. Since `POLAR_ENABLED=true` in production this is now a safety net.

- [ ] **Step 2: Update the credits action**

In `app/credits/actions.ts`, add to the existing polar import:

```typescript
import { initiatePolarCheckout, isPolarEnabled } from '@/lib/payments/polar';
```

Replace the tail branch (lines ~119-131, from `if (paymentRoute !== 'ameria')` through the Ameria redirect) with:

```typescript
  if (paymentRoute === 'polar') {
    const { redirectUrl } = await initiatePolarCheckout(service, {
      transactionId: transaction.id,
      amountCents: converted.amountCents,
      currency: converted.currency,
      description: pack.name,
      locale: null,
    });
    redirect(redirectUrl);
  }

  if (paymentRoute === 'ameria') {
    const { redirectUrl } = await initiateAmeriaPayment(service, {
      transactionId: transaction.id,
      amountCents: converted.amountCents,
      currency: converted.currency,
      description: pack.name,
      locale: null,
    });
    redirect(redirectUrl);
  }

  revalidatePath('/credits');
  redirect('/credits?checkout=bank_pending');
```

- [ ] **Step 3: Type-check + full test suite**

Run: `npx tsc --noEmit` then `npm test`
Expected: no type errors; all tests pass.

> Note: `redirect()` throws a Next.js control-flow signal, so the sequential `if` blocks never fall through after a matched route. Do not wrap these `redirect()` calls in `try/catch`.

- [ ] **Step 4: Commit**

```bash
git add app/checkout/actions.ts app/credits/actions.ts
git commit -m "feat(payments): route checkout and credits through Polar"
```

---

## Task 10: Manual sandbox verification (no automated test)

**Files:** none (manual QA).

This flow crosses the network to Polar and cannot be meaningfully unit-tested; verify it against Polar **sandbox** before production.

- [ ] **Step 1: Provision Polar sandbox**
  1. Create a Polar sandbox organization.
  2. Create three "pay what you want" products (AMD, EUR, USD); copy their ids into `POLAR_PRODUCT_ID_AMD/EUR/USD` in `.env.local`.
  3. Create an org access token → `POLAR_ACCESS_TOKEN`; set `POLAR_SERVER=sandbox`, `POLAR_ENABLED=true`, `AMERIA_ENABLED=false`.
  4. Register a webhook to `${NEXT_PUBLIC_SITE_URL}/api/payments/polar/webhook` (use a tunnel for local), copy the signing secret → `POLAR_WEBHOOK_SECRET`.

- [ ] **Step 2: Run a card checkout**

Run: `npm run dev`, add a catalog item to cart, check out. Confirm you are redirected to Polar, pay with a sandbox test card, and land back on `/orders/{id}?checkout=success` with the order marked `paid` / `review_required`.

- [ ] **Step 3: Run a credit-pack checkout**

Buy a credit pack; confirm redirect to Polar, payment, and that credits are granted exactly once (check `credit_ledger` has a single row for the transaction).

- [ ] **Step 4: Verify idempotency**

Confirm the webhook and the return route both firing does not double-grant credits or double-mark the order (the shared `claimTransactionSuccess` guarantees single fulfillment).

- [ ] **Step 5: Verify the admin refresh button**

Open `/admin/currencies`, click "Refresh rates", confirm the AMD→EUR/USD rows update their `fetched_at` and provider shows `exchangerate-api`.

---

## Self-Review Notes (coverage vs. spec)

- Routing / disable Ameria → **Task 4**. Polar provider → **Task 6**. Two settle entry points → **Tasks 7 & 8**. Shared fulfillment reuse → **Task 5**. Checkout/credits wiring → **Task 9**. RUB removal → **Task 1**. Original-currency charging → **Task 6** (per-currency products). ExchangeRate-API v6 → **Task 2**. Admin refresh button + polar dropdown → **Task 3**. Testing → per-task TDD + **Task 10** sandbox QA. Env/deps/provisioning → **Tasks 2, 4, 6, 10**.
- Deferred to implementation (flagged inline, not placeholders): exact `@polar-sh/sdk` field names for `checkouts.create` (amount/successUrl), the webhook helper import, and the paid `status` literals — each has concrete best-known code plus a one-line "confirm against SDK" instruction.
- Risk carried from the spec: Polar is a Merchant of Record for **digital** goods; physical fulfillment must be confirmed with Polar before production go-live (go-live gate, not a code task).
