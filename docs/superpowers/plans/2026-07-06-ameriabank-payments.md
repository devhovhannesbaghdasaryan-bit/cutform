# Ameriabank Payment Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Stripe with Ameriabank vPOS 3.0 as the online payment gateway for all four currencies (AMD, USD, EUR, RUB) across order checkout and credit packs, behind a provider abstraction with DB-driven per-currency routing.

**Architecture:** New `lib/payments/` module: pure vPOS request/response logic (`ameria-core.ts`, unit-tested), server wiring (`ameria.ts`), provider-agnostic fulfillment + settlement (`fulfillment.ts`), and a DB-driven route resolver (`router.ts`). A `GET /api/payments/ameria/callback` route verifies every payment server-side via `GetPaymentDetails` (vPOS has no webhooks). Stripe code is deleted at the end.

**Tech Stack:** Next.js 16 App Router (server actions + route handlers), Supabase (Postgres + RLS, service-role client for mutations), Zod, Vitest (new devDependency), pnpm.

**Spec:** `docs/superpowers/specs/2026-07-06-ameriabank-payments-design.md`

## Global Constraints

- Package manager is `pnpm` (v9.12.3). Run all commands with `pnpm`.
- All server-side payment mutations use the service-role client from `getServiceSupabase()` (`lib/supabase/server.ts`), matching existing code.
- Amounts are stored as integer cents in the DB; Ameriabank vPOS takes major units (e.g. `100.50`). Convert only at the provider boundary.
- vPOS currency codes are ISO-4217 numeric strings: AMD=`051`, USD=`840`, EUR=`978`, RUB=`643`.
- Callback query parameters are never trusted for payment outcome; only the `GetPaymentDetails` response decides.
- Historical rows with `provider = 'stripe'` / `payment_provider_route = 'stripe'` must remain valid — keep `'stripe'` in DB check constraints; never write it again.
- Transaction statuses are `pending | succeeded | failed | cancelled | reversed` (existing `TRANSACTION_STATUSES` in `lib/transactions.ts`). Do not invent new ones.
- Files under `lib/payments/types.ts` and `lib/payments/ameria-core.ts` must NOT import `'server-only'`, `next/*`, or `@/lib/env` — they are loaded by Vitest outside Next.
- Env vars: `AMERIA_API_BASE_URL`, `AMERIA_CLIENT_ID`, `AMERIA_USERNAME`, `AMERIA_PASSWORD`, `AMERIA_ORDER_ID_BASE` (all optional in schema so builds don't break, validated at call time).
- Every task ends with `pnpm typecheck` passing and a commit.

---

### Task 1: Database migration + currency smoke update

**Files:**
- Create: `supabase/migrations/20260706100000_ameriabank_payment_provider.sql`
- Modify: `scripts/smoke/currency.mjs:49-52`

**Interfaces:**
- Consumes: existing tables `orders`, `transactions`, `currencies` (constraint names come from `supabase/migrations/20260619094333_multi_currency_support.sql`).
- Produces: sequence `public.ameria_order_ids`; RPC `public.next_ameria_order_id() returns bigint` (service_role only) — called in Task 3 via `service.rpc('next_ameria_order_id')`; `'ameria'` accepted by all three route check constraints; all four `currencies.payment_route` rows set to `'ameria'`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260706100000_ameriabank_payment_provider.sql`:

```sql
-- Ameriabank vPOS payment provider support.
-- Numeric OrderID source (vPOS requires unique integer order ids within a
-- bank-assigned range; the env-level AMERIA_ORDER_ID_BASE offset aligns this
-- sequence to that range per environment).

create sequence if not exists public.ameria_order_ids;

create or replace function public.next_ameria_order_id()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.ameria_order_ids');
$$;

revoke all on function public.next_ameria_order_id() from public;
revoke all on function public.next_ameria_order_id() from anon;
revoke all on function public.next_ameria_order_id() from authenticated;
grant execute on function public.next_ameria_order_id() to service_role;

-- Allow the new route value. Keep 'stripe' so historical rows stay valid.
alter table public.orders
  drop constraint if exists orders_payment_provider_route_check;
alter table public.orders
  add constraint orders_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'ameria'));

alter table public.transactions
  drop constraint if exists transactions_payment_provider_route_check;
alter table public.transactions
  add constraint transactions_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'manual', 'ameria'));

alter table public.currencies
  drop constraint if exists currencies_payment_route_check;
alter table public.currencies
  add constraint currencies_payment_route_check
    check (payment_route in ('stripe', 'bank_manual', 'ameria'));

-- Route all currencies to Ameriabank by default; admins can flip individual
-- currencies back to bank_manual from /admin/currencies.
update public.currencies
set payment_route = 'ameria'
where code in ('AMD', 'USD', 'EUR', 'RUB');
```

- [ ] **Step 2: Apply the migration**

If the local Supabase stack is running: `pnpm exec supabase migration up --local`. Otherwise apply to the linked project: `pnpm exec supabase db push`.
Expected: migration applies without error.

- [ ] **Step 3: Verify**

Run against the same database (e.g. `pnpm exec supabase db psql` locally, or the SQL editor):

```sql
select code, payment_route from public.currencies order by sort_order;
select public.next_ameria_order_id();
```

Expected: all four currencies show `ameria`; the function returns `1` (then `2` on a second call).

- [ ] **Step 4: Update the currency smoke assertions**

In `scripts/smoke/currency.mjs`, replace lines 49–52:

```js
assert(currencies.find((currency) => currency.code === 'USD')?.payment_route === 'stripe', 'USD should route to Stripe');
assert(currencies.find((currency) => currency.code === 'EUR')?.payment_route === 'stripe', 'EUR should route to Stripe');
assert(currencies.find((currency) => currency.code === 'AMD')?.payment_route === 'bank_manual', 'AMD should route to bank/manual');
assert(currencies.find((currency) => currency.code === 'RUB')?.payment_route === 'bank_manual', 'RUB should route to bank/manual');
```

with:

```js
for (const code of ['AMD', 'EUR', 'USD', 'RUB']) {
  const route = currencies.find((currency) => currency.code === code)?.payment_route;
  assert(
    route === 'ameria' || route === 'bank_manual',
    `${code} must route to ameria or bank_manual, got ${route}`,
  );
}
```

- [ ] **Step 5: Run the smoke**

Run: `pnpm smoke:currency`
Expected: PASS (exit 0).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260706100000_ameriabank_payment_provider.sql scripts/smoke/currency.mjs
git commit -m "feat(payments): add ameria payment route, order-id sequence, and RPC"
```

---

### Task 2: Vitest setup + payment types + Ameriabank pure core (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/payments/types.ts`
- Create: `lib/payments/ameria-core.ts`
- Create: `tests/payments/ameria-core.test.ts`
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Consumes: nothing from the app (pure module — no `server-only`, no `@/lib/env`).
- Produces (used by Tasks 3–7):
  - `types.ts`: `type PaymentRoute = 'ameria' | 'bank_manual'`; `type PaymentOutcome = 'succeeded' | 'failed' | 'cancelled' | 'pending'`; `interface InitiatePaymentInput { transactionId: string; amountCents: number; currency: string; description: string; locale?: string | null }`; `interface InitiatePaymentResult { redirectUrl: string; providerReference: string }`
  - `ameria-core.ts`: `interface AmeriaConfig { baseUrl: string; clientId: string; username: string; password: string }`; `AMERIA_CURRENCY_CODES: Record<string, string>`; `toMajorUnits(amountCents: number): number`; `buildInitPaymentBody(config, input): Record<string, unknown>`; `parseInitPaymentResponse(json: unknown): { paymentId: string }`; `buildPaymentPageUrl(baseUrl: string, paymentId: string, locale?: string | null): string`; `buildPaymentDetailsBody(config, paymentId): Record<string, unknown>`; `interface AmeriaPaymentDetails { responseCode: string; paymentState: string; amount: number; currencyCode: string; opaque: string | null; orderId: number | null }`; `parsePaymentDetailsResponse(json: unknown): AmeriaPaymentDetails`; `decideOutcome(details, expected: { amountCents: number; currency: string }): { outcome: PaymentOutcome; amountMatches: boolean }`

- [ ] **Step 1: Verify the vPOS API contract against Ameriabank documentation**

Before writing code, check the current vPOS 3.0 docs — field names below are from prior knowledge and MUST be confirmed:
- Swagger for the test environment: `https://servicestest.ameriabank.am/VPOS/swagger` (also try `https://services.ameriabank.am/VPOS/swagger`).
- Ameriabank vPOS integration guide (developer PDF from the bank / guides.ameriabank.am).

Confirm: request/response field names for `InitPayment` (`ClientID`, `Username`, `Password`, `OrderID`, `Amount`, `Currency`, `Description`, `BackURL`, `Opaque`; response `ResponseCode === 1`, `PaymentID`), `GetPaymentDetails` (response `ResponseCode === '00'`, `PaymentState`, `Amount`, `Currency`, `Opaque`, `OrderID`), the hosted page URL format `{base}/Payments/Pay?id={PaymentID}&lang={am|ru|en}`, the callback query parameter name (`paymentID`), and the `PaymentState` vocabulary (`payment_started`, `payment_approved`, `payment_deposited`, `payment_declined`, `payment_void`, `payment_refunded`). Also confirm the merchant test account is **single-stage** (auto-capture, state goes straight to `payment_deposited`) — this plan assumes single-stage and does not call `ConfirmPayment`. Adjust the constants/parsers in the steps below if the docs disagree, and update `docs/superpowers/specs/2026-07-06-ameriabank-payments-design.md` if anything material changes.

- [ ] **Step 2: Install Vitest and add config**

Run: `pnpm add -D vitest`

Create `vitest.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

Add to `package.json` scripts: `"test": "vitest run",`

- [ ] **Step 3: Write `lib/payments/types.ts`**

```ts
export const PAYMENT_ROUTES = ['ameria', 'bank_manual'] as const;
export type PaymentRoute = (typeof PAYMENT_ROUTES)[number];

export type PaymentOutcome = 'succeeded' | 'failed' | 'cancelled' | 'pending';

export interface InitiatePaymentInput {
  transactionId: string;
  amountCents: number;
  currency: string;
  description: string;
  locale?: string | null;
}

export interface InitiatePaymentResult {
  redirectUrl: string;
  providerReference: string;
}
```

- [ ] **Step 4: Write the failing tests**

Create `tests/payments/ameria-core.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AMERIA_CURRENCY_CODES,
  buildInitPaymentBody,
  buildPaymentDetailsBody,
  buildPaymentPageUrl,
  decideOutcome,
  parseInitPaymentResponse,
  parsePaymentDetailsResponse,
  toMajorUnits,
  type AmeriaConfig,
} from '@/lib/payments/ameria-core';

const config: AmeriaConfig = {
  baseUrl: 'https://servicestest.ameriabank.am/VPOS',
  clientId: 'client-1',
  username: 'user-1',
  password: 'pass-1',
};

describe('toMajorUnits', () => {
  it('converts cents to major units', () => {
    expect(toMajorUnits(250050)).toBe(2500.5);
    expect(toMajorUnits(1000)).toBe(10);
  });
});

describe('buildInitPaymentBody', () => {
  it('builds a vPOS InitPayment body with ISO numeric currency', () => {
    const body = buildInitPaymentBody(config, {
      orderId: 3550001,
      amountCents: 1000,
      currency: 'AMD',
      description: 'Uniqraft order abc12345',
      backUrl: 'https://example.com/api/payments/ameria/callback',
      opaque: 'txn-uuid',
    });
    expect(body).toEqual({
      ClientID: 'client-1',
      Username: 'user-1',
      Password: 'pass-1',
      OrderID: 3550001,
      Amount: 10,
      Currency: '051',
      Description: 'Uniqraft order abc12345',
      BackURL: 'https://example.com/api/payments/ameria/callback',
      Opaque: 'txn-uuid',
    });
  });

  it('rejects unsupported currencies', () => {
    expect(() =>
      buildInitPaymentBody(config, {
        orderId: 1,
        amountCents: 1000,
        currency: 'GBP',
        description: 'x',
        backUrl: 'https://example.com/cb',
        opaque: 'txn',
      }),
    ).toThrow(/GBP/);
  });
});

describe('parseInitPaymentResponse', () => {
  it('returns the PaymentID on success', () => {
    expect(parseInitPaymentResponse({ ResponseCode: 1, PaymentID: 'pay-123' })).toEqual({
      paymentId: 'pay-123',
    });
  });

  it('throws with the bank message on failure', () => {
    expect(() =>
      parseInitPaymentResponse({ ResponseCode: 550, ResponseMessage: 'Invalid client' }),
    ).toThrow(/Invalid client/);
  });

  it('throws when PaymentID is missing', () => {
    expect(() => parseInitPaymentResponse({ ResponseCode: 1 })).toThrow();
  });
});

describe('buildPaymentPageUrl', () => {
  it('builds the hosted page URL with a supported lang', () => {
    expect(buildPaymentPageUrl(config.baseUrl, 'pay-123', 'ru')).toBe(
      'https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=pay-123&lang=ru',
    );
  });

  it('falls back to en for unknown locales', () => {
    expect(buildPaymentPageUrl(config.baseUrl, 'pay-123', null)).toContain('lang=en');
    expect(buildPaymentPageUrl(config.baseUrl, 'pay-123', 'fr')).toContain('lang=en');
  });
});

describe('buildPaymentDetailsBody', () => {
  it('includes credentials and PaymentID', () => {
    expect(buildPaymentDetailsBody(config, 'pay-123')).toEqual({
      PaymentID: 'pay-123',
      Username: 'user-1',
      Password: 'pass-1',
    });
  });
});

describe('parsePaymentDetailsResponse', () => {
  it('normalizes the bank response', () => {
    const details = parsePaymentDetailsResponse({
      ResponseCode: '00',
      PaymentState: 'payment_deposited',
      Amount: 10,
      Currency: '051',
      Opaque: 'txn-uuid',
      OrderID: 3550001,
    });
    expect(details).toEqual({
      responseCode: '00',
      paymentState: 'payment_deposited',
      amount: 10,
      currencyCode: '051',
      opaque: 'txn-uuid',
      orderId: 3550001,
    });
  });

  it('tolerates missing fields', () => {
    const details = parsePaymentDetailsResponse({});
    expect(details.opaque).toBeNull();
    expect(details.orderId).toBeNull();
    expect(Number.isNaN(details.amount)).toBe(true);
  });
});

describe('decideOutcome', () => {
  const expected = { amountCents: 1000, currency: 'AMD' };
  const paid = {
    responseCode: '00',
    paymentState: 'payment_deposited',
    amount: 10,
    currencyCode: '051',
    opaque: 'txn',
    orderId: 1,
  };

  it('succeeds for a deposited payment with matching amount and currency', () => {
    expect(decideOutcome(paid, expected)).toEqual({ outcome: 'succeeded', amountMatches: true });
  });

  it('fails when the amount does not match', () => {
    expect(decideOutcome({ ...paid, amount: 99 }, expected)).toEqual({
      outcome: 'failed',
      amountMatches: false,
    });
  });

  it('fails when the currency does not match', () => {
    expect(decideOutcome({ ...paid, currencyCode: '840' }, expected).outcome).toBe('failed');
  });

  it('stays pending while the payment is only started', () => {
    expect(
      decideOutcome({ ...paid, responseCode: '', paymentState: 'payment_started' }, expected).outcome,
    ).toBe('pending');
  });

  it('is cancelled for voided payments', () => {
    expect(
      decideOutcome({ ...paid, responseCode: '', paymentState: 'payment_void' }, expected).outcome,
    ).toBe('cancelled');
  });

  it('fails for declined payments', () => {
    expect(
      decideOutcome({ ...paid, responseCode: '01', paymentState: 'payment_declined' }, expected).outcome,
    ).toBe('failed');
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/lib/payments/ameria-core`.

- [ ] **Step 6: Write `lib/payments/ameria-core.ts`**

```ts
// Pure Ameriabank vPOS 3.0 request/response logic. No Next.js or env imports —
// this module is unit-tested outside the Next runtime.
import type { PaymentOutcome } from '@/lib/payments/types';

export interface AmeriaConfig {
  baseUrl: string;
  clientId: string;
  username: string;
  password: string;
}

// ISO-4217 numeric codes accepted by vPOS.
export const AMERIA_CURRENCY_CODES: Record<string, string> = {
  AMD: '051',
  USD: '840',
  EUR: '978',
  RUB: '643',
};

export function toMajorUnits(amountCents: number): number {
  return Math.round(amountCents) / 100;
}

export interface InitPaymentFields {
  orderId: number;
  amountCents: number;
  currency: string;
  description: string;
  backUrl: string;
  opaque: string;
}

export function buildInitPaymentBody(config: AmeriaConfig, input: InitPaymentFields) {
  const currencyCode = AMERIA_CURRENCY_CODES[input.currency];
  if (!currencyCode) {
    throw new Error(`Currency ${input.currency} is not supported by Ameriabank vPOS.`);
  }
  return {
    ClientID: config.clientId,
    Username: config.username,
    Password: config.password,
    OrderID: input.orderId,
    Amount: toMajorUnits(input.amountCents),
    Currency: currencyCode,
    Description: input.description,
    BackURL: input.backUrl,
    Opaque: input.opaque,
  };
}

export function parseInitPaymentResponse(json: unknown): { paymentId: string } {
  const record = (json ?? {}) as Record<string, unknown>;
  const responseCode = Number(record.ResponseCode);
  const paymentId = typeof record.PaymentID === 'string' && record.PaymentID.length > 0
    ? record.PaymentID
    : null;
  if (responseCode !== 1 || !paymentId) {
    const message = typeof record.ResponseMessage === 'string'
      ? record.ResponseMessage
      : `response code ${String(record.ResponseCode)}`;
    throw new Error(`Ameriabank InitPayment rejected: ${message}`);
  }
  return { paymentId };
}

export function buildPaymentPageUrl(baseUrl: string, paymentId: string, locale?: string | null) {
  const lang = locale === 'am' || locale === 'ru' ? locale : 'en';
  return `${baseUrl.replace(/\/$/, '')}/Payments/Pay?id=${encodeURIComponent(paymentId)}&lang=${lang}`;
}

export function buildPaymentDetailsBody(config: AmeriaConfig, paymentId: string) {
  return {
    PaymentID: paymentId,
    Username: config.username,
    Password: config.password,
  };
}

export interface AmeriaPaymentDetails {
  responseCode: string;
  paymentState: string;
  amount: number;
  currencyCode: string;
  opaque: string | null;
  orderId: number | null;
}

export function parsePaymentDetailsResponse(json: unknown): AmeriaPaymentDetails {
  const record = (json ?? {}) as Record<string, unknown>;
  return {
    responseCode: String(record.ResponseCode ?? ''),
    paymentState: String(record.PaymentState ?? '').toLowerCase(),
    amount: Number(record.Amount ?? Number.NaN),
    currencyCode: String(record.Currency ?? ''),
    opaque: typeof record.Opaque === 'string' && record.Opaque.length > 0 ? record.Opaque : null,
    orderId: record.OrderID == null ? null : Number(record.OrderID),
  };
}

export function decideOutcome(
  details: AmeriaPaymentDetails,
  expected: { amountCents: number; currency: string },
): { outcome: PaymentOutcome; amountMatches: boolean } {
  const expectedCode = AMERIA_CURRENCY_CODES[expected.currency];
  const amountMatches =
    Number.isFinite(details.amount)
    && Math.round(details.amount * 100) === Math.round(expected.amountCents)
    && (details.currencyCode === expectedCode || details.currencyCode === expected.currency);

  const state = details.paymentState;
  if (details.responseCode === '00' && (state.includes('deposited') || state.includes('approved'))) {
    return { outcome: amountMatches ? 'succeeded' : 'failed', amountMatches };
  }
  if (state.includes('void') || state.includes('cancel')) {
    return { outcome: 'cancelled', amountMatches };
  }
  if (state === '' || state.includes('started')) {
    return { outcome: 'pending', amountMatches };
  }
  return { outcome: 'failed', amountMatches };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — all tests green.

- [ ] **Step 8: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add vitest.config.ts lib/payments/types.ts lib/payments/ameria-core.ts tests/payments/ameria-core.test.ts package.json pnpm-lock.yaml
git commit -m "feat(payments): add Ameriabank vPOS pure core with unit tests"
```

---

### Task 3: Env vars + server-side Ameriabank client

**Files:**
- Modify: `lib/env.ts` (add five `AMERIA_*` vars to schema and `getServerEnv` parse call; do NOT touch Stripe vars yet)
- Create: `lib/payments/ameria.ts`

**Interfaces:**
- Consumes: `buildInitPaymentBody`, `parseInitPaymentResponse`, `buildPaymentPageUrl`, `buildPaymentDetailsBody`, `parsePaymentDetailsResponse`, `AmeriaConfig`, `AmeriaPaymentDetails` from `@/lib/payments/ameria-core`; `InitiatePaymentInput`, `InitiatePaymentResult` from `@/lib/payments/types`; RPC `next_ameria_order_id` from Task 1.
- Produces (used by Tasks 4 and 6):
  - `getAmeriaConfig(): AmeriaConfig` — throws if any env var is missing.
  - `initiateAmeriaPayment(service: SupabaseClient, input: InitiatePaymentInput): Promise<InitiatePaymentResult>` — allocates OrderID, calls `InitPayment`, stores `provider_reference` (PaymentID) + `metadata.ameriaOrderId` on the transaction, marks it `failed` and rethrows on error.
  - `fetchAmeriaPaymentDetails(paymentId: string): Promise<AmeriaPaymentDetails>`

- [ ] **Step 1: Add env vars**

In `lib/env.ts`, inside `envSchema` after the Stripe entries (line 21), add:

```ts
  AMERIA_API_BASE_URL: optionalNonEmpty,
  AMERIA_CLIENT_ID: optionalNonEmpty,
  AMERIA_USERNAME: optionalNonEmpty,
  AMERIA_PASSWORD: optionalNonEmpty,
  AMERIA_ORDER_ID_BASE: optionalNonEmpty,
```

In `getServerEnv()`'s parse object (after line 63), add:

```ts
    AMERIA_API_BASE_URL: process.env.AMERIA_API_BASE_URL,
    AMERIA_CLIENT_ID: process.env.AMERIA_CLIENT_ID,
    AMERIA_USERNAME: process.env.AMERIA_USERNAME,
    AMERIA_PASSWORD: process.env.AMERIA_PASSWORD,
    AMERIA_ORDER_ID_BASE: process.env.AMERIA_ORDER_ID_BASE,
```

- [ ] **Step 2: Write `lib/payments/ameria.ts`**

```ts
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import {
  buildInitPaymentBody,
  buildPaymentDetailsBody,
  buildPaymentPageUrl,
  parseInitPaymentResponse,
  parsePaymentDetailsResponse,
  type AmeriaConfig,
  type AmeriaPaymentDetails,
} from '@/lib/payments/ameria-core';
import type { InitiatePaymentInput, InitiatePaymentResult } from '@/lib/payments/types';

export function getAmeriaConfig(): AmeriaConfig {
  const env = getServerEnv();
  if (!env.AMERIA_API_BASE_URL || !env.AMERIA_CLIENT_ID || !env.AMERIA_USERNAME || !env.AMERIA_PASSWORD) {
    throw new Error(
      'AMERIA_API_BASE_URL, AMERIA_CLIENT_ID, AMERIA_USERNAME and AMERIA_PASSWORD are required for Ameriabank payments.',
    );
  }
  return {
    baseUrl: env.AMERIA_API_BASE_URL.replace(/\/$/, ''),
    clientId: env.AMERIA_CLIENT_ID,
    username: env.AMERIA_USERNAME,
    password: env.AMERIA_PASSWORD,
  };
}

export async function nextAmeriaOrderId(service: SupabaseClient): Promise<number> {
  const { data, error } = await service.rpc('next_ameria_order_id');
  if (error || data == null) {
    throw new Error(error?.message ?? 'Unable to allocate an Ameriabank order id.');
  }
  const base = Number(getServerEnv().AMERIA_ORDER_ID_BASE ?? '0');
  return base + Number(data);
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Ameriabank request failed: HTTP ${response.status}.`);
  }
  return response.json();
}

export async function initiateAmeriaPayment(
  service: SupabaseClient,
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  const config = getAmeriaConfig();
  const orderId = await nextAmeriaOrderId(service);
  const backUrl = `${getServerEnv().NEXT_PUBLIC_SITE_URL}/api/payments/ameria/callback`;

  const { data: existing, error: readError } = await service
    .from('transactions')
    .select('metadata')
    .eq('id', input.transactionId)
    .single<{ metadata: Record<string, unknown> }>();
  if (readError || !existing) throw new Error(readError?.message ?? 'Transaction not found.');

  let paymentId: string;
  try {
    const json = await postJson(
      `${config.baseUrl}/api/VPOS/InitPayment`,
      buildInitPaymentBody(config, {
        orderId,
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        backUrl,
        opaque: input.transactionId,
      }),
    );
    paymentId = parseInitPaymentResponse(json).paymentId;
  } catch (error) {
    await service
      .from('transactions')
      .update({
        status: 'failed',
        metadata: {
          ...existing.metadata,
          ameriaOrderId: orderId,
          ameriaInitError: error instanceof Error ? error.message : 'Unknown InitPayment error.',
        },
      })
      .eq('id', input.transactionId);
    throw error;
  }

  const { error: updateError } = await service
    .from('transactions')
    .update({
      provider_reference: paymentId,
      metadata: { ...existing.metadata, ameriaOrderId: orderId },
    })
    .eq('id', input.transactionId);
  if (updateError) throw new Error(updateError.message);

  return {
    redirectUrl: buildPaymentPageUrl(config.baseUrl, paymentId, input.locale),
    providerReference: paymentId,
  };
}

export async function fetchAmeriaPaymentDetails(paymentId: string): Promise<AmeriaPaymentDetails> {
  const config = getAmeriaConfig();
  const json = await postJson(
    `${config.baseUrl}/api/VPOS/GetPaymentDetails`,
    buildPaymentDetailsBody(config, paymentId),
  );
  return parsePaymentDetailsResponse(json);
}
```

- [ ] **Step 3: Add env vars to `.env.local`**

Append to `.env.local` (test environment values; ClientID/username/password come from Ameriabank's test-merchant documentation):

```
AMERIA_API_BASE_URL=https://servicestest.ameriabank.am/VPOS
AMERIA_CLIENT_ID=<test client id>
AMERIA_USERNAME=<test username>
AMERIA_PASSWORD=<test password>
AMERIA_ORDER_ID_BASE=<start of bank-assigned test OrderID range>
```

- [ ] **Step 4: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add lib/env.ts lib/payments/ameria.ts
git commit -m "feat(payments): add Ameriabank server client and env config"
```

---

### Task 4: Fulfillment + settlement module

**Files:**
- Create: `lib/payments/fulfillment.ts`

**Interfaces:**
- Consumes: `fetchAmeriaPaymentDetails` (Task 3), `decideOutcome` (Task 2), `adjustCredits` from `@/lib/credits`, `PaymentOutcome` (Task 2).
- Produces (used by Tasks 5 and 7):
  - `interface SettleResult { outcome: PaymentOutcome | 'not_found' | 'already_succeeded'; redirectPath: string }`
  - `settleAmeriaPayment(service: SupabaseClient, paymentId: string): Promise<SettleResult>` — the single verify-and-fulfill path used by both the callback route and admin reconciliation. Idempotent.
  - `fulfillOrderPayment` / `fulfillCreditPurchase` (exported for reuse, called internally by `settleAmeriaPayment`).

- [ ] **Step 1: Write `lib/payments/fulfillment.ts`**

```ts
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { adjustCredits } from '@/lib/credits';
import { decideOutcome } from '@/lib/payments/ameria-core';
import { fetchAmeriaPaymentDetails } from '@/lib/payments/ameria';
import type { PaymentOutcome } from '@/lib/payments/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SettleTransaction {
  id: string;
  user_id: string | null;
  order_id: string | null;
  type: string;
  status: string;
  amount_cents: number;
  currency: string;
  metadata: Record<string, unknown>;
}

export interface SettleResult {
  outcome: PaymentOutcome | 'not_found' | 'already_succeeded';
  redirectPath: string;
}

function redirectBase(transaction: SettleTransaction) {
  return transaction.type === 'payment' && transaction.order_id
    ? `/orders/${transaction.order_id}`
    : '/credits';
}

export async function fulfillOrderPayment(service: SupabaseClient, transaction: SettleTransaction) {
  if (!transaction.order_id) throw new Error('Payment transaction has no linked order.');

  const { error: orderError } = await service
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'review_required',
      transaction_id: transaction.id,
    })
    .eq('id', transaction.order_id);
  if (orderError) throw new Error(orderError.message);

  const { error } = await service
    .from('transactions')
    .update({ status: 'succeeded' })
    .eq('id', transaction.id);
  if (error) throw new Error(error.message);
}

export async function fulfillCreditPurchase(service: SupabaseClient, transaction: SettleTransaction) {
  const creditAmount = Number(transaction.metadata?.creditAmount ?? 0);
  if (!transaction.user_id || !Number.isInteger(creditAmount) || creditAmount <= 0) {
    throw new Error('Credit purchase transaction is missing fulfillment metadata.');
  }

  const ledger = await adjustCredits(service, {
    userId: transaction.user_id,
    delta: creditAmount,
    reason: 'purchase',
    referenceType: 'payment_transaction',
    referenceId: transaction.id,
    metadata: {
      transactionId: transaction.id,
      packKey: transaction.metadata?.packKey ?? null,
    },
  });

  const { error } = await service
    .from('transactions')
    .update({ status: 'succeeded', credit_ledger_id: ledger.ledgerId })
    .eq('id', transaction.id);
  if (error) throw new Error(error.message);
}

export async function settleAmeriaPayment(
  service: SupabaseClient,
  paymentId: string,
): Promise<SettleResult> {
  const details = await fetchAmeriaPaymentDetails(paymentId);

  const transactionId = details.opaque;
  if (!transactionId || !UUID_RE.test(transactionId)) {
    return { outcome: 'not_found', redirectPath: '/?checkout=invalid' };
  }

  const { data: transaction, error } = await service
    .from('transactions')
    .select('id, user_id, order_id, type, status, amount_cents, currency, metadata')
    .eq('id', transactionId)
    .maybeSingle<SettleTransaction>();
  if (error) throw new Error(error.message);
  if (!transaction) return { outcome: 'not_found', redirectPath: '/?checkout=invalid' };

  const base = redirectBase(transaction);
  if (transaction.status === 'succeeded') {
    return { outcome: 'already_succeeded', redirectPath: `${base}?checkout=success` };
  }

  const { outcome, amountMatches } = decideOutcome(details, {
    amountCents: transaction.amount_cents,
    currency: transaction.currency,
  });

  if (outcome === 'succeeded') {
    if (transaction.type === 'credit_purchase') {
      await fulfillCreditPurchase(service, transaction);
    } else {
      await fulfillOrderPayment(service, transaction);
    }
    return { outcome, redirectPath: `${base}?checkout=success` };
  }

  if (outcome === 'pending') {
    return { outcome, redirectPath: `${base}?checkout=pending` };
  }

  const { error: updateError } = await service
    .from('transactions')
    .update({
      status: outcome === 'cancelled' ? 'cancelled' : 'failed',
      metadata: {
        ...(transaction.metadata ?? {}),
        ameriaPaymentState: details.paymentState,
        ameriaResponseCode: details.responseCode,
        ameriaAmountMatches: amountMatches,
      },
    })
    .eq('id', transaction.id);
  if (updateError) throw new Error(updateError.message);

  return { outcome, redirectPath: `${base}?checkout=${outcome}` };
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add lib/payments/fulfillment.ts
git commit -m "feat(payments): add provider-agnostic fulfillment and Ameriabank settlement"
```

---

### Task 5: Callback route

**Files:**
- Create: `app/api/payments/ameria/callback/route.ts`

**Interfaces:**
- Consumes: `settleAmeriaPayment` (Task 4), `getServerEnv`, `getServiceSupabase`.
- Produces: `GET /api/payments/ameria/callback?paymentID=...` — verifies and settles, then 307-redirects the browser to `SettleResult.redirectPath`. This exact path is the `BackURL` built in Task 3.

- [ ] **Step 1: Write the route**

Create `app/api/payments/ameria/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { settleAmeriaPayment } from '@/lib/payments/fulfillment';
import { getServiceSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ameriabank vPOS redirects the customer's browser here after the hosted
// payment page. Query params carry no authority: the outcome is decided by a
// server-side GetPaymentDetails call inside settleAmeriaPayment.
export async function GET(req: Request) {
  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const paymentId = new URL(req.url).searchParams.get('paymentID');
  if (!paymentId) {
    return NextResponse.redirect(new URL('/?checkout=invalid', siteUrl));
  }

  try {
    const result = await settleAmeriaPayment(getServiceSupabase(), paymentId);
    return NextResponse.redirect(new URL(result.redirectPath, siteUrl));
  } catch (error) {
    console.error('[ameria-callback]', error);
    return NextResponse.redirect(new URL('/?checkout=error', siteUrl));
  }
}
```

- [ ] **Step 2: Verify the route responds**

Run the dev server (`pnpm dev`) and then: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000/api/payments/ameria/callback"`
Expected: `307 http://localhost:3000/?checkout=invalid` (missing paymentID → invalid redirect, nothing mutated).

- [ ] **Step 3: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add app/api/payments/ameria/callback/route.ts
git commit -m "feat(payments): add Ameriabank callback route with server-side verification"
```

---

### Task 6: Routing cutover — router, currency, orders, checkout, credits

This is the behavior-flip commit: both purchase flows start using Ameriabank. Tasks 3–5 must be complete first.

**Files:**
- Create: `lib/payments/router.ts`
- Modify: `lib/currency.ts:15,60-66` (drop old `PaymentRoute`, `isStripeCurrency`, `getPaymentRouteForCurrency`; re-export new type)
- Modify: `lib/orders.ts:3,106`
- Modify: `app/checkout/actions.ts` (replace Stripe branch)
- Modify: `app/credits/actions.ts` (replace Stripe branch, both actions)

**Interfaces:**
- Consumes: `PaymentRoute` (Task 2), `initiateAmeriaPayment` (Task 3).
- Produces: `getPaymentRoute(currency: AppCurrency, supabase?: SupabaseClient): Promise<PaymentRoute>` — reads `currencies.payment_route`; anything other than `'ameria'` (including legacy `'stripe'`) resolves to `'bank_manual'` as the safe fallback.

- [ ] **Step 1: Write `lib/payments/router.ts`**

```ts
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppCurrency } from '@/lib/currency';
import type { PaymentRoute } from '@/lib/payments/types';
import { getServiceSupabase } from '@/lib/supabase/server';

// DB-driven routing: the admin currencies page controls which provider each
// currency uses. Unknown or legacy values fall back to the manual route.
export async function getPaymentRoute(
  currency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<PaymentRoute> {
  const { data, error } = await supabase
    .from('currencies')
    .select('payment_route')
    .eq('code', currency)
    .maybeSingle<{ payment_route: string }>();
  if (error) throw new Error(error.message);
  return data?.payment_route === 'ameria' ? 'ameria' : 'bank_manual';
}
```

- [ ] **Step 2: Update `lib/currency.ts`**

Replace line 15 (`export type PaymentRoute = 'stripe' | 'bank_manual';`) with:

```ts
import type { PaymentRoute } from '@/lib/payments/types';
export type { PaymentRoute };
```

(Put the `import type` line with the other imports at the top of the file; keep the `export type` where line 15 was.)

Delete lines 60–66 entirely (`isStripeCurrency` and `getPaymentRouteForCurrency`).

- [ ] **Step 3: Update `lib/orders.ts`**

Line 3: change

```ts
import { getPaymentRouteForCurrency, normalizeCurrency } from '@/lib/currency';
```

to

```ts
import { normalizeCurrency } from '@/lib/currency';
import { getPaymentRoute } from '@/lib/payments/router';
```

Line 106: change

```ts
  const paymentProviderRoute = getPaymentRouteForCurrency(orderCurrency);
```

to

```ts
  const paymentProviderRoute = await getPaymentRoute(orderCurrency);
```

- [ ] **Step 4: Update `app/checkout/actions.ts`**

Change the imports: remove `import { getStripe } from '@/lib/stripe';` and `import { getServerEnv } from '@/lib/env';`; add `import { initiateAmeriaPayment } from '@/lib/payments/ameria';`.

Update the inline order-totals type (line 72): `payment_provider_route: 'stripe' | 'bank_manual' | null;` becomes `payment_provider_route: 'ameria' | 'bank_manual' | null;`.

Replace everything from `if (orderTotals.payment_provider_route !== 'stripe') {` (line 109) to the end of the function with:

```ts
  if (orderTotals.payment_provider_route !== 'ameria') {
    redirect(`/orders/${order.id}?checkout=bank_pending`);
  }

  const { redirectUrl } = await initiateAmeriaPayment(service, {
    transactionId: transaction.id,
    amountCents: orderTotals.total_cents,
    currency: orderTotals.currency,
    description: `Uniqraft order ${order.id.slice(0, 8)}`,
    locale: parsed.data.locale || null,
  });
  redirect(redirectUrl);
}
```

(`initiateAmeriaPayment` stores the PaymentID in `provider_reference` itself, so the old `session.id` update block is gone.)

- [ ] **Step 5: Update `app/credits/actions.ts`**

Change the imports: remove `getStripe` and `getServerEnv` imports; change the currency import to `import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';`; add:

```ts
import { initiateAmeriaPayment } from '@/lib/payments/ameria';
import { getPaymentRoute } from '@/lib/payments/router';
```

In `requestManualCreditPackAction`, replace the two `getPaymentRouteForCurrency(converted.currency)` calls (lines 45–46) — compute once above the transaction call:

```ts
  const paymentRoute = await getPaymentRoute(converted.currency);
```

then use `provider: paymentRoute, paymentProviderRoute: paymentRoute,`.

In `createCreditPackCheckoutAction`, replace line 86 (`const paymentRoute = getPaymentRouteForCurrency(converted.currency);`) with:

```ts
  const paymentRoute = await getPaymentRoute(converted.currency, service);
```

Replace everything from `if (paymentRoute !== 'stripe') {` (line 107) to the end of the function with:

```ts
  if (paymentRoute !== 'ameria') {
    revalidatePath('/credits');
    redirect('/credits?checkout=bank_pending');
  }

  const { redirectUrl } = await initiateAmeriaPayment(service, {
    transactionId: transaction.id,
    amountCents: converted.amountCents,
    currency: converted.currency,
    description: pack.name,
    locale: null,
  });
  redirect(redirectUrl);
}
```

- [ ] **Step 6: Typecheck, lint, unit tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. If typecheck reports other files still importing `isStripeCurrency`/`getPaymentRouteForCurrency`, update them the same way as Steps 3–5 (route lookups become `await getPaymentRoute(...)`).

- [ ] **Step 7: Manual smoke of the cutover**

With `pnpm dev` running and Ameriabank test credentials in `.env.local`: log in, add an item to the cart, submit checkout. Expected: browser lands on `servicestest.ameriabank.am/VPOS/Payments/Pay?id=...`, and the pending transaction row has `provider_reference` set and `metadata.ameriaOrderId` populated. (Completing the payment with a test card exercises Task 5's callback.)

- [ ] **Step 8: Commit**

```bash
git add lib/payments/router.ts lib/currency.ts lib/orders.ts app/checkout/actions.ts app/credits/actions.ts
git commit -m "feat(payments): route checkout and credit packs through Ameriabank"
```

---

### Task 7: Admin — "Check with Ameriabank" reconciliation

**Files:**
- Modify: `app/admin/transactions/actions.ts` (new `ameria_check` action type)
- Modify: `app/admin/transactions/[id]/page.tsx:158-162` (new select option)

**Interfaces:**
- Consumes: `settleAmeriaPayment` (Task 4), `getServiceSupabase`, existing `writeAdminAuditLog`.
- Produces: admin form action `ameria_check` — re-verifies a pending Ameriabank transaction and fulfills it if the bank reports it paid (covers customers who paid but never returned to the callback).

- [ ] **Step 1: Extend the action schema**

In `app/admin/transactions/actions.ts` line 10, change:

```ts
  actionType: z.enum(['note', 'manual_refund', 'reversal', 'reconcile']),
```

to:

```ts
  actionType: z.enum(['note', 'manual_refund', 'reversal', 'reconcile', 'ameria_check']),
```

Add imports:

```ts
import { settleAmeriaPayment } from '@/lib/payments/fulfillment';
import { getServiceSupabase } from '@/lib/supabase/server';
```

- [ ] **Step 2: Add the action branch**

In `adminTransactionAction`, after the `reconcile` block (line 122) and before the `revalidatePath` calls, add:

```ts
  if (values.actionType === 'ameria_check') {
    if (transaction.provider !== 'ameria' && transaction.payment_provider_route !== 'ameria') {
      throw new Error('This transaction did not go through Ameriabank.');
    }
    if (!transaction.provider_reference) {
      throw new Error('Transaction has no Ameriabank PaymentID to check.');
    }

    const result = await settleAmeriaPayment(getServiceSupabase(), transaction.provider_reference);

    await writeAdminAuditLog(supabase, {
      actorUserId: user.id,
      targetUserId: transaction.user_id,
      action: 'transaction_ameria_checked',
      entityType: 'transaction',
      entityId: transaction.id,
      reason: values.note,
      metadata: { before: transaction.status, outcome: result.outcome },
    });
  }
```

- [ ] **Step 3: Add the select option**

In `app/admin/transactions/[id]/page.tsx`, inside the `actionType` select (after line 161, `<option value="reconcile">Reconcile status</option>`), add:

```tsx
                <option value="ameria_check">Check with Ameriabank</option>
```

- [ ] **Step 4: Typecheck and verify**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Manual check: open a pending Ameriabank transaction in `/admin/transactions`, choose "Check with Ameriabank", enter a note, submit. Expected: no error; an audit row `transaction_ameria_checked` appears; if the bank reports the payment deposited, the transaction flips to `succeeded` and the order/credits are fulfilled.

- [ ] **Step 5: Commit**

```bash
git add app/admin/transactions/actions.ts "app/admin/transactions/[id]/page.tsx"
git commit -m "feat(admin): reconcile pending Ameriabank payments from transaction detail"
```

---

### Task 8: Admin — per-currency payment-route editor

The spec requires each currency to be flippable between `ameria` and `bank_manual` from the admin currencies page (today the page only toggles `is_enabled` and shows the route read-only).

**Files:**
- Modify: `app/admin/currencies/actions.ts`
- Modify: `app/admin/currencies/page.tsx:106` (route cell becomes a select)

**Interfaces:**
- Consumes: `PAYMENT_ROUTES`, `PaymentRoute` (Task 2), existing `requireAdmin`, `writeAdminAuditLog`, `APP_CURRENCIES`.
- Produces: extended `updateCurrencySettingsAction` that also persists `payment_route` per currency from form fields named `paymentRoute:<CODE>`.

- [ ] **Step 1: Extend the action**

In `app/admin/currencies/actions.ts`, add the import:

```ts
import { PAYMENT_ROUTES, type PaymentRoute } from '@/lib/payments/types';
```

Extend the schema (line 9):

```ts
const currencySettingsSchema = z.object({
  enabledCurrencies: z.array(z.enum(APP_CURRENCIES)).min(1, 'At least one currency must remain enabled.'),
  paymentRoutes: z.record(z.enum(APP_CURRENCIES), z.enum(PAYMENT_ROUTES)),
});
```

In `updateCurrencySettingsAction`, collect routes before parsing:

```ts
  const paymentRoutes: Record<string, string> = {};
  for (const currency of APP_CURRENCIES) {
    const value = formData.get(`paymentRoute:${currency}`);
    if (typeof value === 'string' && value) paymentRoutes[currency] = value;
  }

  const parsed = currencySettingsSchema.safeParse({ enabledCurrencies, paymentRoutes });
```

Extend the per-currency update loop (line 24):

```ts
  for (const currency of APP_CURRENCIES) {
    const route: PaymentRoute | undefined = parsed.data.paymentRoutes[currency];
    const { error } = await supabase
      .from('currencies')
      .update({
        is_enabled: parsed.data.enabledCurrencies.includes(currency),
        ...(route ? { payment_route: route } : {}),
      })
      .eq('code', currency);
    if (error) throw new Error(error.message);
  }
```

Include the routes in the audit log metadata:

```ts
    metadata: {
      enabledCurrencies: parsed.data.enabledCurrencies,
      paymentRoutes: parsed.data.paymentRoutes,
    },
```

- [ ] **Step 2: Make the route cell editable**

In `app/admin/currencies/page.tsx`, the table row currently renders `<td className="px-4 py-3">{currency.payment_route}</td>` (line 106). This cell is inside the same `<form>` as the enable checkboxes (verify — if not, move the table inside the form). Replace it with:

```tsx
                      <td className="px-4 py-3">
                        <select
                          name={`paymentRoute:${currency.code}`}
                          defaultValue={currency.payment_route === 'ameria' ? 'ameria' : 'bank_manual'}
                          className="h-9 rounded-md border border-input bg-background px-2"
                        >
                          <option value="ameria">Ameriabank</option>
                          <option value="bank_manual">Bank / manual</option>
                        </select>
                      </td>
```

- [ ] **Step 3: Typecheck and verify**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Manual check: in `/admin/currencies`, flip RUB to "Bank / manual", save, reload. Expected: RUB shows `bank_manual`; a RUB credit-pack checkout now lands on `?checkout=bank_pending` instead of redirecting to Ameriabank.

- [ ] **Step 4: Commit**

```bash
git add app/admin/currencies/actions.ts app/admin/currencies/page.tsx
git commit -m "feat(admin): make per-currency payment route editable"
```

---

### Task 9: Remove Stripe

Only after Task 6 is committed (nothing references Stripe at runtime anymore except the webhook).

**Files:**
- Delete: `lib/stripe.ts`
- Delete: `app/api/webhooks/stripe/route.ts` (remove the whole `app/api/webhooks/stripe/` directory; remove `app/api/webhooks/` too if it becomes empty)
- Modify: `lib/env.ts` (drop the three Stripe vars from schema and parse call)
- Modify: `package.json` (drop `stripe` dependency)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — pure removal. Historical DB rows with `provider = 'stripe'` are untouched and keep rendering in admin (they display as plain text).

- [ ] **Step 1: Confirm nothing else imports Stripe**

Run: `pnpm exec rg -l "from 'stripe'|@/lib/stripe|STRIPE_" --glob '!node_modules'` (or use your editor's search).
Expected: only `lib/stripe.ts`, `app/api/webhooks/stripe/route.ts`, `lib/env.ts`, and lockfile/docs hits. If any other source file matches, migrate it first (it should have been handled in Task 6).

- [ ] **Step 2: Delete the files and dependency**

```bash
git rm lib/stripe.ts
git rm -r app/api/webhooks/stripe
pnpm remove stripe
```

- [ ] **Step 3: Remove Stripe env vars**

In `lib/env.ts`, delete these three lines from `envSchema` (lines 19–21):

```ts
  STRIPE_SECRET_KEY: optionalNonEmpty,
  STRIPE_WEBHOOK_SECRET: optionalNonEmpty,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalNonEmpty,
```

and the matching three lines from the `getServerEnv()` parse object (lines 61–63).

- [ ] **Step 4: Verify the app builds without Stripe**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass with no reference to Stripe.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(payments): remove Stripe integration"
```

---

### Task 10: Ameriabank smoke script + env example + final verification

**Files:**
- Create: `scripts/smoke/payments-ameria.mjs`
- Modify: `package.json` (script `"smoke:payments": "node scripts/smoke/payments-ameria.mjs"`; append `&& pnpm smoke:payments` is NOT added to the `smoke` chain — it needs bank credentials, keep it opt-in)
- Modify: `.env.local.example` (document the `AMERIA_*` vars)

**Interfaces:**
- Consumes: Ameriabank test environment REST API directly (contract check — validates our request/response assumptions independent of the app).
- Produces: `pnpm smoke:payments`.

- [ ] **Step 1: Write the smoke script**

Create `scripts/smoke/payments-ameria.mjs`:

```js
// Contract smoke against the Ameriabank vPOS test environment:
// InitPayment must return a PaymentID, and GetPaymentDetails on the fresh
// payment must report a started (unpaid) state. Requires AMERIA_* env vars.
import { existsSync, readFileSync } from 'node:fs';

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const baseUrl = (process.env.AMERIA_API_BASE_URL ?? '').replace(/\/$/, '');
const clientId = process.env.AMERIA_CLIENT_ID;
const username = process.env.AMERIA_USERNAME;
const password = process.env.AMERIA_PASSWORD;

if (!baseUrl || !clientId || !username || !password) {
  throw new Error('AMERIA_API_BASE_URL, AMERIA_CLIENT_ID, AMERIA_USERNAME and AMERIA_PASSWORD are required.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(response.ok, `HTTP ${response.status} from ${path}`);
  return response.json();
}

// Unique-enough OrderID inside the bank-assigned test range for a smoke run.
const orderIdBase = Number(process.env.AMERIA_ORDER_ID_BASE ?? '0');
const orderId = orderIdBase + (Date.now() % 100_000);

const init = await postJson('/api/VPOS/InitPayment', {
  ClientID: clientId,
  Username: username,
  Password: password,
  OrderID: orderId,
  Amount: 10,
  Currency: '051',
  Description: 'Uniqraft payments smoke',
  BackURL: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/payments/ameria/callback`,
  Opaque: `smoke-${orderId}`,
});

assert(Number(init.ResponseCode) === 1, `InitPayment rejected: ${init.ResponseMessage ?? init.ResponseCode}`);
assert(typeof init.PaymentID === 'string' && init.PaymentID.length > 0, 'InitPayment returned no PaymentID');
console.log(`InitPayment OK — PaymentID ${init.PaymentID}, hosted page ${baseUrl}/Payments/Pay?id=${init.PaymentID}&lang=en`);

const details = await postJson('/api/VPOS/GetPaymentDetails', {
  PaymentID: init.PaymentID,
  Username: username,
  Password: password,
});

const state = String(details.PaymentState ?? '').toLowerCase();
assert(state === '' || state.includes('started'), `Fresh payment should be in a started state, got "${state}"`);
assert(String(details.Opaque ?? '') === `smoke-${orderId}`, 'Opaque did not round-trip');
console.log(`GetPaymentDetails OK — state "${state}", Opaque round-tripped`);
console.log('payments-ameria smoke passed');
```

- [ ] **Step 2: Wire the npm script**

In `package.json` scripts, add:

```json
    "smoke:payments": "node scripts/smoke/payments-ameria.mjs",
```

(Do not add it to the combined `smoke` chain — it requires bank credentials and network access to the test environment.)

- [ ] **Step 3: Run it**

Run: `pnpm smoke:payments`
Expected: `InitPayment OK ...`, `GetPaymentDetails OK ...`, `payments-ameria smoke passed`, exit 0. If the field names differ from the bank's current API, fix `lib/payments/ameria-core.ts` and the smoke together (see Task 2 Step 1).

- [ ] **Step 4: Document env vars**

Append to `.env.local.example`:

```
# Ameriabank vPOS (server-only). Test host: https://servicestest.ameriabank.am/VPOS
# Production host: https://services.ameriabank.am/VPOS
# ClientID/username/password and the OrderID range come from your Ameriabank
# merchant agreement (test values are in the bank's vPOS testing guide).
AMERIA_API_BASE_URL=https://servicestest.ameriabank.am/VPOS
AMERIA_CLIENT_ID=
AMERIA_USERNAME=
AMERIA_PASSWORD=
AMERIA_ORDER_ID_BASE=0
```

- [ ] **Step 5: Full verification pass**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke:currency && pnpm smoke:credits`
Expected: everything passes.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke/payments-ameria.mjs package.json .env.local.example
git commit -m "test(payments): add Ameriabank contract smoke and env documentation"
```

---

## Manual test checklist (test environment, after all tasks)

Use Ameriabank's published test card (see their vPOS testing guide; test env is AMD-only with fixed amounts, typically 10 AMD).

1. **Successful order payment:** cart → checkout → hosted page → pay with test card → redirected to `/orders/{id}?checkout=success`; order `payment_status = paid`, `status = review_required`; transaction `succeeded` with `provider_reference` and `metadata.ameriaOrderId`.
2. **Successful credit pack:** `/credits` → buy pack → pay → redirected to `/credits?checkout=success`; credit balance increased; transaction `succeeded` with `credit_ledger_id` set.
3. **Declined card:** pay with the declining test card → redirected with `?checkout=failed`; transaction `failed`; order still `pending_payment`; retrying checkout creates a new transaction.
4. **Cancel on hosted page:** use the cancel/back control → transaction `cancelled` (or `pending` if the bank keeps it started — then covered by case 5).
5. **Abandon + reconcile:** start a payment, close the tab, pay nothing → transaction stays `pending`; in `/admin/transactions/{id}` run "Check with Ameriabank" → stays `pending` with an audit row. Repeat but complete the payment in a second tab before closing → "Check with Ameriabank" flips it to `succeeded` and fulfills.
6. **Manual route fallback:** flip a currency to "Bank / manual" in `/admin/currencies` → checkout in that currency lands on `?checkout=bank_pending` without contacting Ameriabank.
7. **Callback tampering:** hit `/api/payments/ameria/callback?paymentID=<unpaid PaymentID>` directly → redirect shows `?checkout=pending`; nothing fulfilled.
