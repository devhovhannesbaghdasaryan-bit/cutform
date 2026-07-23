# Receipt Emails via Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an itemized, localized receipt email (via Resend + React Email) after every successfully settled online payment — physical-item orders and credit-pack purchases — without ever letting email failures affect settlement.

**Architecture:** One new module `lib/email/` (Resend client wrapper, orchestrator, pure model builders, en/ru/am string table) plus two React Email templates in `emails/`. Hooked in at the single settlement choke point in `lib/payments/fulfillment.ts`, right after fulfillment succeeds in both `settleAmeriaPayment` and `settlePolarPayment`. Duplicate-send safety comes from the existing `claimTransactionSuccess` once-only guard plus a Resend idempotency key `receipt/<transactionId>`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Resend Node SDK (≥ 6.14.0), react-email, vitest (pure logic only — repo norm), Biome, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-23-receipt-emails-design.md`

## Global Constraints

- `sendReceiptEmail` must NEVER throw — every failure path logs `[receipt-email] <reason>` with the transaction id and returns. The call site in `fulfillment.ts` is additionally wrapped in its own `try/catch` so the existing settle-rollback logic (which flips a paid transaction back to `pending`) can never be triggered by the email path.
- The Resend Node SDK returns `{ data, error }` and does not throw — check `error` explicitly, never rely on try/catch for API errors.
- Idempotency key format: `receipt/${transaction.id}` on every send.
- Locale resolution: captured locale (`order.locale`) → `profiles.preferred_locale` → `'en'`; clamp to `en | ru | am` via `normalizeLocale`/`isAppLocale` from `@/lib/i18n` — never feed raw `'am'` to Intl (the existing `formatLocalizedCurrency` handles the `hy-AM` mapping).
- Templates receive only pre-formatted strings (no raw cents) plus a `strings` table — no i18n or currency logic inside templates.
- New env vars `RESEND_API_KEY` and `RESEND_FROM` are `optionalNonEmpty` in `lib/env.ts`; when either is unset, `sendReceiptEmail` logs one line and returns (dev/preview no-op).
- Do NOT modify `messages/*.json`, `claimTransactionSuccess`, `fulfillOrderPayment`, `fulfillCreditPurchase`, or any payment-routing logic.
- Vitest `include` is `tests/**/*.test.ts` (`.ts` only) — test files use `createElement` from `react` instead of JSX so the vitest config stays untouched.
- Package manager is `pnpm`. Commit after each task. After all code changes, run `graphify update .`.

---

### Task 1: Dependencies, env vars, and Resend client wrapper

**Files:**
- Modify: `package.json` (via `pnpm add`)
- Modify: `lib/env.ts:39-43` (serverShape additions)
- Create: `lib/email/resend.ts`
- Test: `tests/lib/email/resend.test.ts`

**Interfaces:**
- Consumes: `getServerEnv()` from `@/lib/env`; `Resend` from `resend`.
- Produces: `getResendClient(): Resend` (throws if key missing — only called behind the enabled check), `isResendEnabled(): boolean` (true only when BOTH `RESEND_API_KEY` and `RESEND_FROM` are set). Later tasks rely on exactly these two named exports.

- [ ] **Step 1: Install dependencies**

```bash
pnpm add resend react-email
```

Then verify the resend version floor:

```bash
node -e "console.log(require('./node_modules/resend/package.json').version)"
```

Expected: `>= 6.14.0`. If lower, run `pnpm add resend@latest`.

- [ ] **Step 2: Add env vars to `lib/env.ts`**

In the `serverShape` object (after the `EXCHANGE_RATE_PROVIDER` line), add:

```ts
  RESEND_API_KEY: optionalNonEmpty,
  RESEND_FROM: optionalNonEmpty,
```

- [ ] **Step 3: Write the failing test**

Create `tests/lib/email/resend.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

async function importResend() {
  vi.resetModules();
  return import('@/lib/email/resend');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isResendEnabled', () => {
  it('is false when RESEND_API_KEY is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESEND_FROM', 'Uniqraft <receipts@example.com>');
    const { isResendEnabled } = await importResend();
    expect(isResendEnabled()).toBe(false);
  });

  it('is false when RESEND_FROM is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('RESEND_FROM', '');
    const { isResendEnabled } = await importResend();
    expect(isResendEnabled()).toBe(false);
  });

  it('is true when both are set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('RESEND_FROM', 'Uniqraft <receipts@example.com>');
    const { isResendEnabled } = await importResend();
    expect(isResendEnabled()).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/email/resend.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/resend`.

- [ ] **Step 5: Create `lib/email/resend.ts`**

```ts
import 'server-only';

import { Resend } from 'resend';
import { getServerEnv } from '@/lib/env';

// Mirrors lib/payments/polar.ts: enabled = fully configured; the client
// getter throws only if called without checking isResendEnabled() first.
export function isResendEnabled(): boolean {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM);
}

export function getResendClient(): Resend {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send email.');
  }
  return new Resend(env.RESEND_API_KEY);
}
```

(`server-only` is aliased to a stub in vitest, so the test imports work.)

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/email/resend.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 7: Typecheck, lint, commit**

Run: `pnpm typecheck` — expected: PASS (the only permitted failure is the known pre-existing `tests/lib/supabase/server.test.ts` tuple error; nothing new).
Run: `pnpm lint` — expected: no new warnings/errors.

```bash
git add package.json pnpm-lock.yaml lib/env.ts lib/email/resend.ts tests/lib/email/resend.test.ts
git commit -m "feat(email): add resend dependency, env vars, and client wrapper"
```

---

### Task 2: Receipt string table (en/ru/am)

**Files:**
- Create: `lib/email/translations.ts`
- Test: `tests/lib/email/translations.test.ts`

**Interfaces:**
- Consumes: nothing (pure constant module, no imports).
- Produces: `type ReceiptLocale = 'en' | 'ru' | 'am'`; `interface ReceiptStrings` with EXACTLY these keys, all `string`: `orderSubject`, `creditsSubject`, `preview`, `thanks`, `item`, `qty`, `subtotal`, `shipping`, `total`, `creditsAdded`, `viewOrder`, `viewCredits`, `footerNote`; `const RECEIPT_STRINGS: Record<ReceiptLocale, ReceiptStrings>`. Templates and the orchestrator consume `RECEIPT_STRINGS[locale]`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/email/translations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RECEIPT_STRINGS } from '@/lib/email/translations';

const LOCALES = ['en', 'ru', 'am'] as const;

describe('RECEIPT_STRINGS', () => {
  it('has the same key set for every locale', () => {
    const enKeys = Object.keys(RECEIPT_STRINGS.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(RECEIPT_STRINGS[locale]).sort()).toEqual(enKeys);
    }
  });

  it('has non-empty values everywhere', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(RECEIPT_STRINGS[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/email/translations.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/translations`.

- [ ] **Step 3: Create `lib/email/translations.ts`**

```ts
// Receipt email strings. Deliberately NOT next-intl: these render outside the
// Next request lifecycle (webhooks), and messages/*.json are UI bundles.
export type ReceiptLocale = 'en' | 'ru' | 'am';

export interface ReceiptStrings {
  orderSubject: string;
  creditsSubject: string;
  preview: string;
  thanks: string;
  item: string;
  qty: string;
  subtotal: string;
  shipping: string;
  total: string;
  creditsAdded: string;
  viewOrder: string;
  viewCredits: string;
  footerNote: string;
}

export const RECEIPT_STRINGS: Record<ReceiptLocale, ReceiptStrings> = {
  en: {
    orderSubject: 'Your Uniqraft order receipt',
    creditsSubject: 'Your Uniqraft credits receipt',
    preview: 'Thanks for your purchase — your receipt is inside.',
    thanks: 'Thanks for your purchase!',
    item: 'Item',
    qty: 'Qty',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    total: 'Total',
    creditsAdded: 'Credits added',
    viewOrder: 'View your order',
    viewCredits: 'View your credits',
    footerNote: 'You are receiving this email because you made a purchase on Uniqraft.',
  },
  ru: {
    orderSubject: 'Ваш чек заказа Uniqraft',
    creditsSubject: 'Ваш чек за кредиты Uniqraft',
    preview: 'Спасибо за покупку — ваш чек внутри.',
    thanks: 'Спасибо за покупку!',
    item: 'Товар',
    qty: 'Кол-во',
    subtotal: 'Подытог',
    shipping: 'Доставка',
    total: 'Итого',
    creditsAdded: 'Начислено кредитов',
    viewOrder: 'Посмотреть заказ',
    viewCredits: 'Посмотреть кредиты',
    footerNote: 'Вы получили это письмо, потому что совершили покупку на Uniqraft.',
  },
  am: {
    orderSubject: 'Ձեր Uniqraft պատվերի անդորրագիրը',
    creditsSubject: 'Ձեր Uniqraft կրեդիտների անդորրագիրը',
    preview: 'Շնորհակալություն գնումի համար — անդորրագիրը ներսում է։',
    thanks: 'Շնորհակալություն գնումի համար։',
    item: 'Ապրանք',
    qty: 'Քանակ',
    subtotal: 'Ենթագումար',
    shipping: 'Առաքում',
    total: 'Ընդամենը',
    creditsAdded: 'Ավելացված կրեդիտներ',
    viewOrder: 'Դիտել պատվերը',
    viewCredits: 'Դիտել կրեդիտները',
    footerNote: 'Դուք ստացել եք այս նամակը, քանի որ գնում եք կատարել Uniqraft-ում։',
  },
};
```

(Flag AM/RU copy for native proofread in the final report — same convention as prior payment copy work.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/email/translations.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email/translations.ts tests/lib/email/translations.test.ts
git commit -m "feat(email): receipt string table for en/ru/am"
```

---

### Task 3: Pure receipt model builders

**Files:**
- Create: `lib/email/receipt-core.ts`
- Test: `tests/lib/email/receipt-core.test.ts`

**Interfaces:**
- Consumes: `formatLocalizedCurrency`, `normalizeLocale`, `isAppLocale`, `DEFAULT_LOCALE`, `type AppLocale` from `@/lib/i18n` (pure module, safe in vitest).
- Produces (consumed by templates in Task 4 and the orchestrator in Task 5):

```ts
export function resolveReceiptLocale(
  captured: string | null | undefined,
  preferred: string | null | undefined,
): AppLocale;

export interface OrderReceiptModel {
  locale: AppLocale;
  orderIdShort: string;                                        // first 8 chars
  items: { title: string; quantity: number; total: string }[]; // total pre-formatted
  subtotal: string;
  shipping: string;
  total: string;
  orderUrl: string;
  logoUrl: string;
}

export interface CreditsReceiptModel {
  locale: AppLocale;
  packName: string;        // falls back to 'Credits' when metadata is missing
  creditAmount: number;
  total: string;           // pre-formatted
  creditsUrl: string;
  logoUrl: string;
}

export function buildOrderReceiptModel(input: {
  locale: AppLocale;
  orderId: string;
  items: { title: string; quantity: number; total_price_cents: number; currency: string }[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  siteUrl: string;
}): OrderReceiptModel;

export function buildCreditsReceiptModel(input: {
  locale: AppLocale;
  metadata: Record<string, unknown>;
  amountCents: number;
  currency: string;
  siteUrl: string;
}): CreditsReceiptModel;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/email/receipt-core.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCreditsReceiptModel,
  buildOrderReceiptModel,
  resolveReceiptLocale,
} from '@/lib/email/receipt-core';

describe('resolveReceiptLocale', () => {
  it('uses the captured locale when valid', () => {
    expect(resolveReceiptLocale('ru', 'am')).toBe('ru');
  });
  it('falls back to the preferred locale when captured is missing', () => {
    expect(resolveReceiptLocale(null, 'am')).toBe('am');
  });
  it('falls back to en when both are missing', () => {
    expect(resolveReceiptLocale(null, null)).toBe('en');
  });
  it('clamps invalid values to en', () => {
    expect(resolveReceiptLocale('fr', 'de')).toBe('en');
  });
});

describe('buildOrderReceiptModel', () => {
  const input = {
    locale: 'en' as const,
    orderId: 'abcd1234-0000-0000-0000-000000000000',
    items: [
      { title: 'Neon sign', quantity: 2, total_price_cents: 5000000, currency: 'AMD' },
    ],
    subtotalCents: 5000000,
    shippingCents: 200000,
    totalCents: 5200000,
    currency: 'AMD',
    siteUrl: 'https://uniqraft.example',
  };

  it('shortens the order id and builds URLs', () => {
    const model = buildOrderReceiptModel(input);
    expect(model.orderIdShort).toBe('abcd1234');
    expect(model.orderUrl).toBe(
      'https://uniqraft.example/orders/abcd1234-0000-0000-0000-000000000000',
    );
    expect(model.logoUrl).toBe('https://uniqraft.example/brand/uniqraft-logo-light.png');
  });

  it('pre-formats all money as localized strings containing no raw cents', () => {
    const model = buildOrderReceiptModel(input);
    // 5,200,000 cents = 52,000.00 AMD — the formatted total must contain the
    // major-unit digits, and every money field must be a string.
    expect(model.total).toContain('52,000');
    expect(typeof model.subtotal).toBe('string');
    expect(typeof model.shipping).toBe('string');
    expect(model.items[0]?.total).toContain('50,000');
  });
});

describe('buildCreditsReceiptModel', () => {
  it('maps pack metadata', () => {
    const model = buildCreditsReceiptModel({
      locale: 'en',
      metadata: { packName: 'Starter pack', creditAmount: 100 },
      amountCents: 500000,
      currency: 'AMD',
      siteUrl: 'https://uniqraft.example',
    });
    expect(model.packName).toBe('Starter pack');
    expect(model.creditAmount).toBe(100);
    expect(model.total).toContain('5,000');
    expect(model.creditsUrl).toBe('https://uniqraft.example/credits');
  });

  it('falls back when metadata is missing', () => {
    const model = buildCreditsReceiptModel({
      locale: 'en',
      metadata: {},
      amountCents: 500000,
      currency: 'AMD',
      siteUrl: 'https://uniqraft.example',
    });
    expect(model.packName).toBe('Credits');
    expect(model.creditAmount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/email/receipt-core.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/receipt-core`.

- [ ] **Step 3: Create `lib/email/receipt-core.ts`**

```ts
// Pure receipt model builders. No env, Next, or Supabase imports — unit-tested
// outside the runtime (same convention as lib/payments/polar-core.ts).
import {
  DEFAULT_LOCALE,
  formatLocalizedCurrency,
  isAppLocale,
  normalizeLocale,
  type AppLocale,
} from '@/lib/i18n';

export function resolveReceiptLocale(
  captured: string | null | undefined,
  preferred: string | null | undefined,
): AppLocale {
  const capturedLocale = normalizeLocale(captured);
  if (capturedLocale && isAppLocale(capturedLocale)) return capturedLocale;
  const preferredLocale = normalizeLocale(preferred);
  if (preferredLocale && isAppLocale(preferredLocale)) return preferredLocale;
  return DEFAULT_LOCALE;
}

export interface OrderReceiptModel {
  locale: AppLocale;
  orderIdShort: string;
  items: { title: string; quantity: number; total: string }[];
  subtotal: string;
  shipping: string;
  total: string;
  orderUrl: string;
  logoUrl: string;
}

export interface CreditsReceiptModel {
  locale: AppLocale;
  packName: string;
  creditAmount: number;
  total: string;
  creditsUrl: string;
  logoUrl: string;
}

function logoUrl(siteUrl: string) {
  return `${siteUrl}/brand/uniqraft-logo-light.png`;
}

export function buildOrderReceiptModel(input: {
  locale: AppLocale;
  orderId: string;
  items: { title: string; quantity: number; total_price_cents: number; currency: string }[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  siteUrl: string;
}): OrderReceiptModel {
  const { locale, currency } = input;
  return {
    locale,
    orderIdShort: input.orderId.slice(0, 8),
    items: input.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      total: formatLocalizedCurrency(locale, item.total_price_cents, item.currency),
    })),
    subtotal: formatLocalizedCurrency(locale, input.subtotalCents, currency),
    shipping: formatLocalizedCurrency(locale, input.shippingCents, currency),
    total: formatLocalizedCurrency(locale, input.totalCents, currency),
    orderUrl: `${input.siteUrl}/orders/${input.orderId}`,
    logoUrl: logoUrl(input.siteUrl),
  };
}

export function buildCreditsReceiptModel(input: {
  locale: AppLocale;
  metadata: Record<string, unknown>;
  amountCents: number;
  currency: string;
  siteUrl: string;
}): CreditsReceiptModel {
  const packName =
    typeof input.metadata.packName === 'string' && input.metadata.packName.trim()
      ? input.metadata.packName
      : 'Credits';
  const rawCredits = Number(input.metadata.creditAmount ?? 0);
  return {
    locale: input.locale,
    packName,
    creditAmount: Number.isFinite(rawCredits) ? rawCredits : 0,
    total: formatLocalizedCurrency(input.locale, input.amountCents, input.currency),
    creditsUrl: `${input.siteUrl}/credits`,
    logoUrl: logoUrl(input.siteUrl),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/email/receipt-core.test.ts`
Expected: all PASS. If the `toContain('52,000')` assertions fail on separator differences, inspect the actual `Intl` output for `en-US` + AMD and adjust the expected substring to the real grouping (keep asserting on major-unit digits, never on raw cents).

- [ ] **Step 5: Commit**

```bash
git add lib/email/receipt-core.ts tests/lib/email/receipt-core.test.ts
git commit -m "feat(email): pure receipt model builders with locale fallback"
```

---

### Task 4: React Email templates

**Files:**
- Create: `emails/order-receipt.tsx`
- Create: `emails/credits-receipt.tsx`
- Test: `tests/lib/email/templates.test.ts`

**Interfaces:**
- Consumes: `OrderReceiptModel` / `CreditsReceiptModel` from `@/lib/email/receipt-core`; `ReceiptStrings` from `@/lib/email/translations`; components from `react-email`.
- Produces: `OrderReceiptEmail({ model, strings })` and `CreditsReceiptEmail({ model, strings })` — named exports, both taking exactly `{ model, strings }`. The orchestrator (Task 5) imports them by these names.

- [ ] **Step 1: Write the failing render test**

Create `tests/lib/email/templates.test.ts` (`.ts`, so `createElement` instead of JSX — the vitest `include` pattern only picks up `.test.ts`):

```ts
import { createElement } from 'react';
import { render } from 'react-email';
import { describe, expect, it } from 'vitest';
import type { CreditsReceiptModel, OrderReceiptModel } from '@/lib/email/receipt-core';
import { RECEIPT_STRINGS } from '@/lib/email/translations';
import { CreditsReceiptEmail } from '@/emails/credits-receipt';
import { OrderReceiptEmail } from '@/emails/order-receipt';

const orderModel: OrderReceiptModel = {
  locale: 'en',
  orderIdShort: 'abcd1234',
  items: [{ title: 'Neon sign', quantity: 2, total: 'AMD 50,000.00' }],
  subtotal: 'AMD 50,000.00',
  shipping: 'AMD 2,000.00',
  total: 'AMD 52,000.00',
  orderUrl: 'https://uniqraft.example/orders/abcd1234-full-id',
  logoUrl: 'https://uniqraft.example/brand/uniqraft-logo-light.png',
};

const creditsModel: CreditsReceiptModel = {
  locale: 'en',
  packName: 'Starter pack',
  creditAmount: 100,
  total: 'AMD 5,000.00',
  creditsUrl: 'https://uniqraft.example/credits',
  logoUrl: 'https://uniqraft.example/brand/uniqraft-logo-light.png',
};

describe('receipt templates', () => {
  it('order receipt renders totals, items, and the order link', async () => {
    const html = await render(
      createElement(OrderReceiptEmail, { model: orderModel, strings: RECEIPT_STRINGS.en }),
    );
    expect(html).toContain('AMD 52,000.00');
    expect(html).toContain('Neon sign');
    expect(html).toContain('https://uniqraft.example/orders/abcd1234-full-id');
    expect(html).toContain('lang="en"');
  });

  it('credits receipt renders pack, amount, and the credits link', async () => {
    const html = await render(
      createElement(CreditsReceiptEmail, { model: creditsModel, strings: RECEIPT_STRINGS.en }),
    );
    expect(html).toContain('Starter pack');
    expect(html).toContain('AMD 5,000.00');
    expect(html).toContain('https://uniqraft.example/credits');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/email/templates.test.ts`
Expected: FAIL — cannot resolve `@/emails/order-receipt`.

- [ ] **Step 3: Create `emails/order-receipt.tsx`**

```tsx
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from 'react-email';
import type { OrderReceiptModel } from '@/lib/email/receipt-core';
import type { ReceiptStrings } from '@/lib/email/translations';

export function OrderReceiptEmail({
  model,
  strings,
}: {
  model: OrderReceiptModel;
  strings: ReceiptStrings;
}) {
  return (
    <Html lang={model.locale}>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Body className="bg-gray-100 font-sans">
          <Preview>{strings.preview}</Preview>
          <Container className="mx-auto my-8 max-w-[600px] rounded bg-white p-8">
            <Img src={model.logoUrl} alt="Uniqraft" width="132" height="32" />
            <Heading as="h1" className="mt-6 text-2xl text-gray-900">
              {strings.thanks}
            </Heading>
            <Text className="text-sm text-gray-500">
              {strings.orderSubject} — #{model.orderIdShort}
            </Text>
            <Hr className="my-4 border-solid border-gray-200" />
            <Row>
              <Column className="text-xs font-bold uppercase text-gray-500">
                {strings.item}
              </Column>
              <Column align="center" className="w-16 text-xs font-bold uppercase text-gray-500">
                {strings.qty}
              </Column>
              <Column align="right" className="w-32 text-xs font-bold uppercase text-gray-500">
                {strings.total}
              </Column>
            </Row>
            {model.items.map((item, index) => (
              <Row key={`${item.title}-${index}`} className="py-1">
                <Column className="text-sm text-gray-900">{item.title}</Column>
                <Column align="center" className="w-16 text-sm text-gray-900">
                  {item.quantity}
                </Column>
                <Column align="right" className="w-32 text-sm text-gray-900">
                  {item.total}
                </Column>
              </Row>
            ))}
            <Hr className="my-4 border-solid border-gray-200" />
            <Row>
              <Column className="text-sm text-gray-500">{strings.subtotal}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.subtotal}
              </Column>
            </Row>
            <Row>
              <Column className="text-sm text-gray-500">{strings.shipping}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.shipping}
              </Column>
            </Row>
            <Row className="mt-2">
              <Column className="text-base font-bold text-gray-900">{strings.total}</Column>
              <Column align="right" className="text-base font-bold text-gray-900">
                {model.total}
              </Column>
            </Row>
            <Section className="mt-8">
              <Button
                href={model.orderUrl}
                className="box-border rounded bg-[#efe000] px-5 py-3 text-center text-sm font-medium text-gray-900 no-underline"
              >
                {strings.viewOrder}
              </Button>
            </Section>
            <Hr className="my-6 border-solid border-gray-200" />
            <Text className="text-xs text-gray-400">{strings.footerNote}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

OrderReceiptEmail.PreviewProps = {
  model: {
    locale: 'en',
    orderIdShort: 'abcd1234',
    items: [{ title: 'Neon sign', quantity: 2, total: 'AMD 50,000.00' }],
    subtotal: 'AMD 50,000.00',
    shipping: 'AMD 2,000.00',
    total: 'AMD 52,000.00',
    orderUrl: 'https://example.com/orders/abcd1234',
    logoUrl: 'https://example.com/brand/uniqraft-logo-light.png',
  },
  strings: {
    orderSubject: 'Your Uniqraft order receipt',
    creditsSubject: 'Your Uniqraft credits receipt',
    preview: 'Thanks for your purchase — your receipt is inside.',
    thanks: 'Thanks for your purchase!',
    item: 'Item',
    qty: 'Qty',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    total: 'Total',
    creditsAdded: 'Credits added',
    viewOrder: 'View your order',
    viewCredits: 'View your credits',
    footerNote: 'You are receiving this email because you made a purchase on Uniqraft.',
  },
};
```

- [ ] **Step 4: Create `emails/credits-receipt.tsx`**

```tsx
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from 'react-email';
import type { CreditsReceiptModel } from '@/lib/email/receipt-core';
import type { ReceiptStrings } from '@/lib/email/translations';

export function CreditsReceiptEmail({
  model,
  strings,
}: {
  model: CreditsReceiptModel;
  strings: ReceiptStrings;
}) {
  return (
    <Html lang={model.locale}>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Body className="bg-gray-100 font-sans">
          <Preview>{strings.preview}</Preview>
          <Container className="mx-auto my-8 max-w-[600px] rounded bg-white p-8">
            <Img src={model.logoUrl} alt="Uniqraft" width="132" height="32" />
            <Heading as="h1" className="mt-6 text-2xl text-gray-900">
              {strings.thanks}
            </Heading>
            <Hr className="my-4 border-solid border-gray-200" />
            <Row>
              <Column className="text-sm text-gray-500">{strings.item}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.packName}
              </Column>
            </Row>
            <Row>
              <Column className="text-sm text-gray-500">{strings.creditsAdded}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.creditAmount}
              </Column>
            </Row>
            <Row className="mt-2">
              <Column className="text-base font-bold text-gray-900">{strings.total}</Column>
              <Column align="right" className="text-base font-bold text-gray-900">
                {model.total}
              </Column>
            </Row>
            <Section className="mt-8">
              <Button
                href={model.creditsUrl}
                className="box-border rounded bg-[#efe000] px-5 py-3 text-center text-sm font-medium text-gray-900 no-underline"
              >
                {strings.viewCredits}
              </Button>
            </Section>
            <Hr className="my-6 border-solid border-gray-200" />
            <Text className="text-xs text-gray-400">{strings.footerNote}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

CreditsReceiptEmail.PreviewProps = {
  model: {
    locale: 'en',
    packName: 'Starter pack',
    creditAmount: 100,
    total: 'AMD 5,000.00',
    creditsUrl: 'https://example.com/credits',
    logoUrl: 'https://example.com/brand/uniqraft-logo-light.png',
  },
  strings: {
    orderSubject: 'Your Uniqraft order receipt',
    creditsSubject: 'Your Uniqraft credits receipt',
    preview: 'Thanks for your purchase — your receipt is inside.',
    thanks: 'Thanks for your purchase!',
    item: 'Item',
    qty: 'Qty',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    total: 'Total',
    creditsAdded: 'Credits added',
    viewOrder: 'View your order',
    viewCredits: 'View your credits',
    footerNote: 'You are receiving this email because you made a purchase on Uniqraft.',
  },
};
```

(PreviewProps are dev-preview fixtures; each template file keeps its own literal copy of the en strings so the files stay self-contained.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/email/templates.test.ts`
Expected: 2/2 PASS. If `import { render } from 'react-email'` fails to resolve, check the installed package's exports (`node -e "console.log(Object.keys(require('react-email')))"`) — on older layouts render lives in `@react-email/render`/`@react-email/components`; install and import from whichever module the installed version actually exports, and note the substitution in the report.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `pnpm typecheck` and `pnpm lint` — expected: PASS / no new issues.

```bash
git add emails/order-receipt.tsx emails/credits-receipt.tsx tests/lib/email/templates.test.ts
git commit -m "feat(email): order and credits receipt templates (react-email)"
```

---

### Task 5: Orchestrator + fulfillment hook

**Files:**
- Create: `lib/email/receipt.tsx`
- Modify: `lib/payments/fulfillment.ts` (two insertion points, ~line 178 and ~line 261)
- Test: `tests/lib/email/receipt.test.ts`

**Interfaces:**
- Consumes: `isResendEnabled`/`getResendClient` (Task 1), `RECEIPT_STRINGS` (Task 2), builders (Task 3), templates (Task 4), `getServerEnv` from `@/lib/env`.
- Produces: `sendReceiptEmail(service: SupabaseClient, transaction: ReceiptTransaction): Promise<void>` where `ReceiptTransaction` is a locally-defined structural interface (`{ id, user_id, order_id, type, amount_cents, currency, metadata }`) — deliberately NOT imported from `fulfillment.ts`, so there is no import cycle. `SettleTransaction` satisfies it structurally.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/email/receipt.test.ts`. Mock `@/lib/email/resend` (module-level mock keeps the real Resend SDK out of tests):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('@/lib/email/resend', () => ({
  isResendEnabled: vi.fn(() => true),
  getResendClient: vi.fn(() => ({ emails: { send: sendMock } })),
}));

import { getResendClient, isResendEnabled } from '@/lib/email/resend';
import { sendReceiptEmail } from '@/lib/email/receipt';

// Minimal supabase stub: from(table) returns a chain whose maybeSingle()/eq()
// resolve to canned rows; auth.admin.getUserById returns a canned user.
function makeService(rows: {
  order?: Record<string, unknown> | null;
  items?: Record<string, unknown>[];
  profile?: Record<string, unknown> | null;
  user?: { email: string | null } | null;
}) {
  return {
    from(table: string) {
      const result =
        table === 'orders'
          ? { data: rows.order ?? null, error: null }
          : table === 'order_items'
            ? { data: rows.items ?? [], error: null }
            : { data: rows.profile ?? null, error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => resolve(result),
      };
      return chain;
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: rows.user ?? null }, error: null }),
      },
    },
  } as never;
}

const orderTransaction = {
  id: 'tx-1',
  user_id: 'user-1',
  order_id: 'order-1',
  type: 'payment',
  amount_cents: 5200000,
  currency: 'AMD',
  metadata: {},
};

const orderRow = {
  id: 'order-1',
  contact_email: 'buyer@example.com',
  locale: 'en',
  subtotal_cents: 5000000,
  shipping_cents: 200000,
  total_cents: 5200000,
  currency: 'AMD',
};

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('RESEND_FROM', 'Uniqraft <receipts@example.com>');
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  vi.mocked(isResendEnabled).mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sendReceiptEmail', () => {
  it('skips silently when resend is not configured', async () => {
    vi.mocked(isResendEnabled).mockReturnValue(false);
    await expect(
      sendReceiptEmail(makeService({}), orderTransaction),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends an order receipt with the receipt/<id> idempotency key', async () => {
    const service = makeService({
      order: orderRow,
      items: [{ title: 'Neon sign', quantity: 2, total_price_cents: 5000000, currency: 'AMD' }],
    });
    await sendReceiptEmail(service, orderTransaction);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0] ?? [];
    expect(payload.to).toEqual(['buyer@example.com']);
    expect(payload.subject).toContain('order-1'.slice(0, 8));
    expect(options).toEqual({ idempotencyKey: 'receipt/tx-1' });
  });

  it('never throws when resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    const service = makeService({ order: orderRow, items: [] });
    await expect(sendReceiptEmail(service, orderTransaction)).resolves.toBeUndefined();
  });

  it('never throws when the order fetch fails', async () => {
    const service = makeService({ order: null });
    await expect(sendReceiptEmail(service, orderTransaction)).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends a credits receipt using the auth email', async () => {
    const service = makeService({ user: { email: 'buyer@example.com' }, profile: null });
    await sendReceiptEmail(service, {
      ...orderTransaction,
      id: 'tx-2',
      order_id: null,
      type: 'credit_purchase',
      amount_cents: 500000,
      metadata: { packName: 'Starter pack', creditAmount: 100 },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0] ?? [];
    expect(payload.to).toEqual(['buyer@example.com']);
    expect(options).toEqual({ idempotencyKey: 'receipt/tx-2' });
  });
});
```

(If the `then`-based await stub proves awkward for the `order_items` list query, have the implementation await `.eq('order_id', ...)` results via an explicit terminal method and adjust the stub accordingly — the stub shape may be adapted, the assertions may not.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/email/receipt.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/receipt`.

- [ ] **Step 3: Create `lib/email/receipt.tsx`**

```tsx
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { CreditsReceiptEmail } from '@/emails/credits-receipt';
import { OrderReceiptEmail } from '@/emails/order-receipt';
import { getServerEnv } from '@/lib/env';
import {
  buildCreditsReceiptModel,
  buildOrderReceiptModel,
  resolveReceiptLocale,
} from '@/lib/email/receipt-core';
import { getResendClient, isResendEnabled } from '@/lib/email/resend';
import { RECEIPT_STRINGS } from '@/lib/email/translations';

// Structural twin of fulfillment.ts's SettleTransaction — declared locally so
// there is no lib/email -> lib/payments import (fulfillment imports us).
export interface ReceiptTransaction {
  id: string;
  user_id: string | null;
  order_id: string | null;
  type: string;
  amount_cents: number;
  currency: string;
  metadata: Record<string, unknown>;
}

interface ReceiptOrderRow {
  id: string;
  contact_email: string | null;
  locale: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
}

interface ReceiptOrderItemRow {
  title: string;
  quantity: number;
  total_price_cents: number;
  currency: string;
}

function logSkip(transactionId: string, reason: string) {
  console.error('[receipt-email]', reason, transactionId);
}

async function fetchPreferredLocale(service: SupabaseClient, userId: string | null) {
  if (!userId) return null;
  const { data } = await service
    .from('profiles')
    .select('preferred_locale')
    .eq('user_id', userId)
    .maybeSingle<{ preferred_locale: string | null }>();
  return data?.preferred_locale ?? null;
}

// Fire-once, never-throwing receipt send. Every failure logs and returns; a
// missing receipt must never affect settlement (see the callers' own guards).
export async function sendReceiptEmail(
  service: SupabaseClient,
  transaction: ReceiptTransaction,
): Promise<void> {
  try {
    if (!isResendEnabled()) {
      console.log('[receipt-email] resend not configured; skipping', transaction.id);
      return;
    }

    const env = getServerEnv();
    const siteUrl = env.NEXT_PUBLIC_SITE_URL;
    const resend = getResendClient();
    const idempotencyKey = `receipt/${transaction.id}`;

    if (transaction.type === 'payment') {
      if (!transaction.order_id) return logSkip(transaction.id, 'payment without order_id');

      const { data: order, error: orderError } = await service
        .from('orders')
        .select(
          'id, contact_email, locale, subtotal_cents, shipping_cents, total_cents, currency',
        )
        .eq('id', transaction.order_id)
        .maybeSingle<ReceiptOrderRow>();
      if (orderError || !order) {
        return logSkip(transaction.id, `order fetch failed: ${orderError?.message ?? 'missing'}`);
      }
      if (!order.contact_email) return logSkip(transaction.id, 'order has no contact email');

      const { data: items, error: itemsError } = await service
        .from('order_items')
        .select('title, quantity, total_price_cents, currency')
        .eq('order_id', order.id)
        .returns<ReceiptOrderItemRow[]>();
      if (itemsError) {
        return logSkip(transaction.id, `order items fetch failed: ${itemsError.message}`);
      }

      // Always fetch the profile fallback: if order.locale is set but invalid,
      // the chain must still be captured -> preferred -> 'en' (spec). One extra
      // read per receipt is negligible.
      const locale = resolveReceiptLocale(
        order.locale,
        await fetchPreferredLocale(service, transaction.user_id),
      );
      const strings = RECEIPT_STRINGS[locale];
      const model = buildOrderReceiptModel({
        locale,
        orderId: order.id,
        items: items ?? [],
        subtotalCents: order.subtotal_cents,
        shippingCents: order.shipping_cents,
        totalCents: order.total_cents,
        currency: order.currency,
        siteUrl,
      });

      const { error } = await resend.emails.send(
        {
          from: env.RESEND_FROM as string,
          to: [order.contact_email],
          subject: `${strings.orderSubject} — #${model.orderIdShort}`,
          react: <OrderReceiptEmail model={model} strings={strings} />,
        },
        { idempotencyKey },
      );
      if (error) logSkip(transaction.id, `resend error: ${error.message}`);
      return;
    }

    if (transaction.type === 'credit_purchase') {
      if (!transaction.user_id) return logSkip(transaction.id, 'credit purchase without user');

      const { data: userData, error: userError } = await service.auth.admin.getUserById(
        transaction.user_id,
      );
      const recipient = userData?.user?.email ?? null;
      if (userError || !recipient) {
        return logSkip(transaction.id, `no recipient email: ${userError?.message ?? 'missing'}`);
      }

      const locale = resolveReceiptLocale(
        null,
        await fetchPreferredLocale(service, transaction.user_id),
      );
      const strings = RECEIPT_STRINGS[locale];
      const model = buildCreditsReceiptModel({
        locale,
        metadata: transaction.metadata ?? {},
        amountCents: transaction.amount_cents,
        currency: transaction.currency,
        siteUrl,
      });

      const { error } = await resend.emails.send(
        {
          from: env.RESEND_FROM as string,
          to: [recipient],
          subject: strings.creditsSubject,
          react: <CreditsReceiptEmail model={model} strings={strings} />,
        },
        { idempotencyKey },
      );
      if (error) logSkip(transaction.id, `resend error: ${error.message}`);
      return;
    }

    // Other transaction types (refunds, manual adjustments) get no receipt.
  } catch (error) {
    console.error('[receipt-email] unexpected failure', transaction.id, error);
  }
}
```

(Note: the `.returns<...>()` call matches this repo's established Supabase typing idiom; if the test stub doesn't implement `.returns`, add it to the chain object as `returns: () => chain`.)

- [ ] **Step 4: Hook into `lib/payments/fulfillment.ts`**

Add the import at the top (with the other `@/lib` imports):

```ts
import { sendReceiptEmail } from '@/lib/email/receipt';
```

In `settleAmeriaPayment`, the success path currently ends:

```ts
      throw error;
    }
    return { outcome, redirectPath: `${base}?checkout=success` };
```

Insert the send between the closing `}` of the fulfill `try/catch` and the `return`:

```ts
      throw error;
    }
    try {
      await sendReceiptEmail(service, transaction);
    } catch (emailError) {
      console.error('[receipt-email] send failed', transaction.id, emailError);
    }
    return { outcome, redirectPath: `${base}?checkout=success` };
```

In `settlePolarPayment`, the success path currently ends:

```ts
      throw fulfillError;
    }
    return { outcome: 'succeeded', redirectPath: `${base}?checkout=success` };
```

Insert identically:

```ts
      throw fulfillError;
    }
    try {
      await sendReceiptEmail(service, transaction);
    } catch (emailError) {
      console.error('[receipt-email] send failed', transaction.id, emailError);
    }
    return { outcome: 'succeeded', redirectPath: `${base}?checkout=success` };
```

Do not touch the `already_succeeded`, `pending`, or failure branches — a receipt goes out only on the transition into `succeeded`, which `claimTransactionSuccess` guarantees happens once.

- [ ] **Step 5: Run the new tests, then the full suite**

Run: `pnpm vitest run tests/lib/email/receipt.test.ts`
Expected: 5/5 PASS.

Run: `pnpm test`
Expected: all pass (205 pre-existing + the new email tests), no new failures.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `pnpm typecheck` — expected: PASS (only the known pre-existing `tests/lib/supabase/server.test.ts` error).
Run: `pnpm lint` — expected: no new issues.

```bash
git add lib/email/receipt.tsx lib/payments/fulfillment.ts tests/lib/email/receipt.test.ts
git commit -m "feat(email): send receipt emails on payment settlement"
```

---

### Task 6: Graph refresh and full verification

**Files:**
- Modify: `graphify-out/**` (generated)

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: refreshed knowledge graph, verified build.

- [ ] **Step 1: Update the knowledge graph**

Run: `graphify update .`
Expected: completes without error.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: succeeds — no type errors, no unresolved imports (catches any `react-email` export-shape surprises under the Next compiler).

- [ ] **Step 3: Full suite one more time**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 4: Commit the graph**

```bash
git add graphify-out
git commit -m "chore(graph): refresh knowledge graph after receipt emails"
```

- [ ] **Step 5: Manual QA checklist (report as outstanding — needs real env vars)**

Not automatable in this environment; list in the final report for the human:

1. Set `RESEND_API_KEY` + `RESEND_FROM` locally; place a real (sandbox-Polar) order with contact email `delivered@resend.dev`; confirm the order receipt arrives, itemized, in the checkout locale.
2. Buy a credit pack the same way; confirm the credits receipt.
3. Re-trigger the Polar webhook for the same transaction (Polar dashboard → redeliver); confirm NO duplicate email (settle short-circuits on `already_succeeded`; idempotency key is the backstop).
4. Check layout in Gmail (light + dark).
5. Native proofread of the AM/RU strings in `lib/email/translations.ts`.

---

## Notes / Assumptions

- `transactions.metadata` for credit purchases already carries `packName` and `creditAmount` (set by `createCreditPackCheckoutAction`); the builder tolerates their absence.
- `orders.contact_email` is effectively always set (`createOrderFromCart` defaults it to the user's auth email) — the no-recipient skip path is a safety net, not an expected flow.
- `service` at every call site is the service-role client (`getServiceSupabase()`), so `auth.admin.getUserById` and cross-user `profiles` reads are authorized.
- The admin manual `bank_manual` "mark as paid" flow intentionally sends nothing (spec non-goal).
- Env vars must be added to Vercel before receipts send in production; until then every send is a logged no-op.
