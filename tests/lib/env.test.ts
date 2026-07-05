import { afterEach, describe, expect, it, vi } from 'vitest';

async function importEnv() {
  vi.resetModules();
  return import('@/lib/env');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getServerEnv', () => {
  it('falls back to the anon key when no publishable key is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    const { getServerEnv } = await importEnv();
    expect(getServerEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('anon-key');
  });

  it('falls back to the legacy service-role key for the secret key', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
    const { getServerEnv } = await importEnv();
    expect(getServerEnv().SUPABASE_SECRET_KEY).toBe('service-role');
  });

  it('treats empty strings as missing values', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { getServerEnv } = await importEnv();
    expect(getServerEnv().OPENAI_API_KEY).toBeUndefined();
  });

  it('throws when no Supabase key is configured at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    await expect(importEnv()).rejects.toThrow();
  });
});
