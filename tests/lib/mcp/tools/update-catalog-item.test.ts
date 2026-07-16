import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn(() => ({})) }));
vi.mock('@/lib/catalog-items/upload-from-url', () => ({ fetchAndStoreCatalogImage: vi.fn() }));
vi.mock('@/lib/catalog-items/core', () => ({ updateCatalogItemCore: vi.fn() }));
vi.mock('@/lib/mcp/tools/get-catalog-item', () => ({ handleGetCatalogItem: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { updateCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';
import { handleUpdateCatalogItem } from '@/lib/mcp/tools/update-catalog-item';

const ITEM_ID = '550e8400-e29b-41d4-a716-446655440001';
const EXISTING = {
  id: ITEM_ID,
  title: 'Old Title',
  slug: 'old-title',
  status: 'draft',
  price_cents: 1000,
  description: 'old desc',
  category_id: 'cat-1',
  subcategory_id: null,
  thumbnail_path: 'old/path.jpg',
  manufacturing_notes: null,
  characteristics: null,
};

describe('handleUpdateCatalogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleGetCatalogItem).mockResolvedValue(EXISTING);
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1')).rejects.toThrow(
      /not authorized/i,
    );
  });

  it('merges a partial patch onto the existing item and keeps the existing thumbnail when imageUrl is omitted', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);

    await handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1');

    expect(fetchAndStoreCatalogImage).not.toHaveBeenCalled();
    expect(updateCatalogItemCore).toHaveBeenCalledWith(
      expect.anything(),
      ITEM_ID,
      { id: 'user-1' },
      expect.objectContaining({ title: 'Old Title', priceCents: 2000, description: 'old desc' }),
      'old/path.jpg',
    );
  });

  it('re-fetches the thumbnail when imageUrl is given', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(fetchAndStoreCatalogImage).mockResolvedValue('user-1/mcp-images/new.jpg');
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);

    await handleUpdateCatalogItem({ id: ITEM_ID, imageUrl: 'https://example.test/new.jpg' }, 'user-1');

    expect(fetchAndStoreCatalogImage).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'https://example.test/new.jpg',
    );
    const [, , , , thumbnailArg] = vi.mocked(updateCatalogItemCore).mock.calls[0];
    expect(thumbnailArg).toBe('user-1/mcp-images/new.jpg');
  });

  it('returns the item id', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);
    const result = await handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 3000 }, 'user-1');
    expect(result).toEqual({ id: ITEM_ID });
  });
});
