import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(async () => ({ auth: { verifyOtp } })),
  getServiceSupabase: vi.fn(() => ({})),
}));
vi.mock('@/lib/cart', () => ({ mergeSessionCartIntoUserCart: vi.fn() }));
vi.mock('@/lib/cart-session', () => ({
  getCartSessionId: vi.fn(async () => null),
  clearCartSessionId: vi.fn(),
}));

import { GET } from '@/app/auth/confirm/route';

function confirm(query: string) {
  return GET(new NextRequest(`https://uniqraft.test/auth/confirm?${query}`));
}

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('verifies the token hash and redirects to the dashboard', async () => {
    const res = await confirm('token_hash=pkce_abc&type=email');
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'pkce_abc', type: 'email' });
    expect(res.headers.get('location')).toBe('https://uniqraft.test/dashboard');
  });

  it('honours a local next path but not an external one', async () => {
    const local = await confirm('token_hash=abc&type=email&next=/cart');
    expect(local.headers.get('location')).toBe('https://uniqraft.test/cart');

    const external = await confirm('token_hash=abc&type=email&next=//evil.test');
    expect(external.headers.get('location')).toBe('https://uniqraft.test/dashboard');
  });

  it('sends a missing or unknown token type to login without verifying', async () => {
    const res = await confirm('token_hash=abc&type=bogus');
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe('https://uniqraft.test/login?error=missing_token');
  });

  it('surfaces an expired link as a login error', async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email link is invalid or has expired' },
    });
    const res = await confirm('token_hash=abc&type=email');
    expect(res.headers.get('location')).toBe(
      'https://uniqraft.test/login?error=Email%20link%20is%20invalid%20or%20has%20expired',
    );
  });
});
