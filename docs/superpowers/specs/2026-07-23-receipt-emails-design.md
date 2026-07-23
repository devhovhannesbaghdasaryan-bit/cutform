# Receipt Emails via Resend — Design

**Date:** 2026-07-23
**Status:** Approved for planning

## Problem

When a buyer completes a purchase (a physical-item order or a credit-pack top-up), the app
records and fulfills the payment but never sends a receipt. Buyers get no email confirmation
of what they paid for.

## Goals

- Send an itemized receipt email after every successfully settled online payment:
  - **Orders** (`transactions.type = 'payment'`): line items, subtotal, shipping, total.
  - **Credit purchases** (`transactions.type = 'credit_purchase'`): pack name, credits added,
    total charged.
- Cover both payment providers (Polar and flag-gated Ameria) with a single hook point.
- Localize the email (en/ru/am) using `order.locale → profiles.preferred_locale → 'en'`.
- Use Resend + React Email templates.
- Never let email failures affect payment settlement or fulfillment.

## Non-Goals

- No receipt for the admin manual `bank_manual` "mark as paid" flow
  (`app/admin/orders/[id]/actions.ts`) — out of scope for now.
- No retry queue, dead-letter table, or admin "resend receipt" button (the idempotency key
  makes one easy to add later).
- No PDF attachment; the email body is the receipt.
- No marketing/broadcast infrastructure — transactional sends only.
- No react-email preview-server script wiring (`email dev`) in this pass.

## Prerequisites (already satisfied)

The user already has a Resend account with an API key and a verified sending domain.
Deployment needs two new env vars (below); no other provisioning.

## Architecture

### Hook point: `lib/payments/fulfillment.ts`

Both `settleAmeriaPayment` and `settlePolarPayment` funnel every successful settlement
through the same block:

```ts
if (transaction.type === 'credit_purchase') {
  await fulfillCreditPurchase(service, transaction);
} else {
  await fulfillOrderPayment(service, transaction);
}
```

The receipt send is added immediately after that block succeeds, inside both settle
functions, wrapped in its own `try/catch`:

```ts
try {
  await sendReceiptEmail(service, transaction);
} catch (emailError) {
  console.error('[receipt-email] send failed', transaction.id, emailError);
}
```

The inner `try/catch` is belt-and-suspenders (the module also never throws by contract) so a
bug in the email path can never trigger the existing settle-rollback logic that flips a
genuinely-paid transaction back to `pending`.

**Duplicate-send safety:** `claimTransactionSuccess` already guarantees the fulfillment block
runs at most once per transaction (webhook retries short-circuit to `already_succeeded`
before reaching it). The Resend idempotency key `receipt/<transactionId>` (24 h window) is
defense-in-depth for raw HTTP-level retries mid-request.

### New module: `lib/email/`

```
lib/email/
  resend.ts          getResendClient() + isResendEnabled()   (mirrors lib/payments/polar.ts)
  receipt.tsx        sendReceiptEmail(service, transaction)  orchestrator (server-only; .tsx — it passes JSX to resend)
  receipt-core.ts    buildOrderReceiptModel() / buildCreditsReceiptModel()  (pure, unit-tested)
  translations.ts    RECEIPT_STRINGS for en/ru/am            (pure, unit-tested)
emails/
  order-receipt.tsx    OrderReceiptEmail
  credits-receipt.tsx  CreditsReceiptEmail
```

`sendReceiptEmail(service, transaction)` flow:

1. If `!isResendEnabled()`, log one line and return.
2. Branch on `transaction.type`:
   - **`payment`**: fetch the order via `transaction.order_id`
     (`contact_email, locale, subtotal_cents, shipping_cents, total_cents, currency`) and its
     `order_items` (`title, quantity, total_price_cents, currency`). Recipient =
     `order.contact_email`; locale = `order.locale`.
   - **`credit_purchase`**: read `transaction.metadata` (`packName`, `creditAmount` — already
     stored today) and `transaction.amount_cents`/`currency`. Recipient = email from
     `service.auth.admin.getUserById(transaction.user_id)`. Locale = null (credits don't
     capture one).
3. Resolve locale: captured locale → `profiles.preferred_locale` → `'en'`. Clamp to
   `en | ru | am`; anything else falls to `'en'`.
4. Build the template model via the pure `receipt-core.ts` builders — **all money values are
   pre-formatted strings** (via `formatLocalizedCurrency(locale, cents, currency)` from
   `lib/i18n.ts`); templates receive no raw cents.
5. Render the matching React Email component and send:

```ts
const { data, error } = await resend.emails.send(
  {
    from: env.RESEND_FROM,
    to: [recipient],
    subject: strings.subject,           // localized; orders append “ — #<order id first 8>”
    react: <OrderReceiptEmail {...model} />,
  },
  { idempotencyKey: `receipt/${transaction.id}` },
);
if (error) console.error('[receipt-email] resend error', transaction.id, error.message);
```

The Resend Node SDK returns `{ data, error }` and does not throw — `error` is checked
explicitly. Every other failure path (missing recipient, DB error, render error) logs
`[receipt-email] <reason>` with the transaction id and returns. **The function never throws.**

### Templates

- React Email with `<Tailwind config={{ presets: [pixelBasedPreset] }}>`; `<Head />` inside
  `<Tailwind>`; `<Preview>` first inside `<Body>`; single `<Container>` (~600 px).
- `<Html lang={locale}>`; one `<Heading as="h1">`; brand accent `#efe000`
  (≈ `hsl(57 100% 47%)`, the app's `--primary`).
- Logo: `<Img src={`${siteUrl}/brand/uniqraft-logo-light.png`} alt="Uniqraft">` with fixed
  width/height (PNG already in `public/brand/`; absolute URL from `NEXT_PUBLIC_SITE_URL`).
- Layout via `Section`/`Row`/`Column` only — no flexbox/grid, no media queries; borders always
  `border-solid`; buttons include `box-border`.
- Footer `<Button>`: “View order” → `${siteUrl}/orders/{orderId}`; “View credits” →
  `${siteUrl}/credits` (localized labels, descriptive link text).
- Templates are dumb: props are pre-formatted strings plus a `strings` table; no i18n or
  currency logic inside. `PreviewProps` set on both for future preview-server use.

### Localization: `lib/email/translations.ts`

Plain object, no next-intl (its request-scoped `getTranslations` doesn't fit webhook
contexts):

```ts
export type ReceiptLocale = 'en' | 'ru' | 'am';
export const RECEIPT_STRINGS: Record<ReceiptLocale, {
  orderSubject: string;      // “Your Uniqraft order receipt”
  creditsSubject: string;    // “Your Uniqraft credits receipt”
  thanks: string; item: string; qty: string; subtotal: string;
  shipping: string; total: string; creditsAdded: string;
  viewOrder: string; viewCredits: string; preview: string; footerNote: string;
}> = { en: {...}, ru: {...}, am: {...} };
```

`messages/*.json` stays untouched — those are UI bundles; this table keeps templates
renderable outside the Next request lifecycle.

### Config

- **Dependencies:** `resend` (≥ 6.14.0), `react-email` (latest).
- **Env** (added to `serverShape` in `lib/env.ts`, both `optionalNonEmpty`):
  - `RESEND_API_KEY`
  - `RESEND_FROM` — full from-header, e.g. `Uniqraft <receipts@example.com>`; the domain must
    exactly match the verified Resend domain.
- `isResendEnabled()` = both set. When disabled, sends are skipped with a single log line —
  local dev and preview deployments work without keys.

## Error Handling Summary

| Failure | Behavior |
| --- | --- |
| Resend env vars unset | Log + skip (expected in dev/preview) |
| No recipient resolvable | Log + skip |
| Order/profile fetch error | Log + skip |
| Render throws | Caught, log + skip |
| Resend returns `error` (incl. 429/5xx) | Log + skip; no in-process retry |
| Any unexpected throw | Outer `try/catch` at call site logs; settlement unaffected |

## Testing

Matches repo norms (vitest for pure logic; no component-test harness):

- `tests/lib/email/receipt-core.test.ts` — model builders: locale fallback chain
  (`order.locale → preferred_locale → 'en'`, invalid → `'en'`), pre-formatted currency
  strings, item mapping, credits metadata mapping (missing `packName` → fallback label).
- `tests/lib/email/translations.test.ts` — key parity across en/ru/am (same key set,
  non-empty values).
- One render smoke test: `render(<OrderReceiptEmail {...fixture}/>)` (and credits) produces
  HTML containing the total string and recipient-visible labels — React Email components are
  plain server-renderable functions, so this stays a unit test.
- Manual QA: real send to `delivered@resend.dev` (never fake addresses at real providers),
  verify layout in an email client, confirm idempotency key blocks a duplicate re-send.
- `pnpm typecheck`, `pnpm lint`, full `pnpm test` suite.

## Rollout

- Branch `receipt-emails` (off `main`; independent of PR #28).
- Set `RESEND_API_KEY` + `RESEND_FROM` in Vercel env before/with deploy; until set, the code
  no-ops safely.
- Domain warm-up limits (~150/day on a new domain) are far above expected receipt volume.

## Rollback

No schema changes. Unset the env vars to disable sends instantly, or revert the commit.
