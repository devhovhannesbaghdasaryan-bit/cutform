import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import { handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';

const ITEM_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('handleGetCatalogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleGetCatalogItem({ id: ITEM_ID }, 'user-1')).rejects.toThrow(
      /not authorized/i,
    );
  });

  it('throws a not-found error when the item does not exist', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    } as never);

    await expect(handleGetCatalogItem({ id: ITEM_ID }, 'user-1')).rejects.toThrow(/not found/i);
  });

  it('returns the item when found', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    const row = {
      id: ITEM_ID,
      title: 'Test',
      slug: 'test',
      status: 'draft',
      price_cents: 1000,
      description: 'desc',
      category_id: 'cat-1',
      subcategory_id: null,
      thumbnail_path: 'a/b.jpg',
      manufacturing_notes: null,
      characteristics: null,
    };
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      }),
    } as never);

    const result = await handleGetCatalogItem({ id: ITEM_ID }, 'user-1');

    expect(result).toEqual(row);
  });
});
