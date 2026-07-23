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
