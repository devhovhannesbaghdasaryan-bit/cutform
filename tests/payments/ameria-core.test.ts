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

  it('stays pending for an approved (authorized-only) payment until capture mode is confirmed', () => {
    expect(
      decideOutcome({ ...paid, responseCode: '00', paymentState: 'payment_approved' }, expected).outcome,
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
