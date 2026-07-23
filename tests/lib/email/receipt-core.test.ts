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
