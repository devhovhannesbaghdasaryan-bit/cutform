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
