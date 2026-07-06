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
