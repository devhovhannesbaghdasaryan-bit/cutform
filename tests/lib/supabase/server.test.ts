import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ from: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('getServiceSupabase', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
  });

  it('authenticates with the secret key, not the public publishable key', async () => {
    const { getServiceSupabase } = await import('@/lib/supabase/server');
    getServiceSupabase();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [, apiKey] = createClientMock.mock.calls[0];
    expect(apiKey).toBe('test-secret-key');
    expect(apiKey).not.toBe(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  });
});
