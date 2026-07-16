import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import { handleListSubcategories } from '@/lib/mcp/tools/list-subcategories';

describe('handleListSubcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(
      handleListSubcategories({ categoryId: '550e8400-e29b-41d4-a716-446655440000' }, 'user-1'),
    ).rejects.toThrow(/not authorized/i);
  });

  it('returns active subcategories for the given category', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                returns: async () => ({
                  data: [{ id: 'sub-1', name: 'Puzzles', slug: 'puzzles' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await handleListSubcategories(
      { categoryId: '550e8400-e29b-41d4-a716-446655440000' },
      'user-1',
    );

    expect(result).toEqual([{ id: 'sub-1', name: 'Puzzles', slug: 'puzzles' }]);
  });
});
