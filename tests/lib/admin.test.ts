import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: vi.fn(),
  getServerSupabase: vi.fn(),
}));

import { hasAdminPermission } from '@/lib/admin';
import { getServerSupabase } from '@/lib/supabase/server';

function fakeSupabase(options: { role?: string; hasPermission?: boolean }) {
  const { role = 'admin', hasPermission = true } = options;
  return {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { role }, error: null }) }),
          }),
        };
      }
      if (table === 'admin_permissions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: hasPermission ? { permission: 'catalog_manage' } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  } as never;
}

describe('hasAdminPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the cookie-bound client from getServerSupabase() when no override is given', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(fakeSupabase({ role: 'admin', hasPermission: true }));

    const allowed = await hasAdminPermission('user-1', 'catalog_manage');

    expect(allowed).toBe(true);
    expect(getServerSupabase).toHaveBeenCalledTimes(1);
  });

  it('uses the provided override client instead of calling getServerSupabase()', async () => {
    const override = fakeSupabase({ role: 'admin', hasPermission: true });

    const allowed = await hasAdminPermission('user-1', 'catalog_manage', override);

    expect(allowed).toBe(true);
    expect(getServerSupabase).not.toHaveBeenCalled();
  });

  it('returns false via the override client when the user is not an admin', async () => {
    const override = fakeSupabase({ role: 'user' });

    expect(await hasAdminPermission('user-1', 'catalog_manage', override)).toBe(false);
  });

  it('returns false via the override client when the admin lacks the specific permission', async () => {
    const override = fakeSupabase({ role: 'admin', hasPermission: false });

    expect(await hasAdminPermission('user-1', 'catalog_manage', override)).toBe(false);
  });
});
