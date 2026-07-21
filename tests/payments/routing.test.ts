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
