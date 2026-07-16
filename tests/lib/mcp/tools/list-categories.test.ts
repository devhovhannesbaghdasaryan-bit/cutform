import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import { handleListCategories } from '@/lib/mcp/tools/list-categories';

describe('handleListCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the user is not an admin with catalog_manage', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleListCategories('user-1')).rejects.toThrow(/not authorized/i);
  });

  it('returns active categories ordered by sort_order', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              returns: async () => ({
                data: [{ id: 'cat-1', name: 'Toys', slug: 'toys' }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await handleListCategories('user-1');

    expect(result).toEqual([{ id: 'cat-1', name: 'Toys', slug: 'toys' }]);
  });
});
