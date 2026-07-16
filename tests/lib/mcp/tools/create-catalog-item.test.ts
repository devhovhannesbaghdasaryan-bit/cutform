import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn(() => ({})) }));
vi.mock('@/lib/catalog-items/upload-from-url', () => ({ fetchAndStoreCatalogImage: vi.fn() }));
vi.mock('@/lib/catalog-items/core', () => ({ createCatalogItemCore: vi.fn() }));
vi.mock('@/app/admin/items/item-form-parsing', () => ({ ensureCatalogSlugIsAvailable: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { ensureCatalogSlugIsAvailable } from '@/app/admin/items/item-form-parsing';
import { createCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { handleCreateCatalogItem } from '@/lib/mcp/tools/create-catalog-item';

const VALID_INPUT = {
  title: 'Wooden Puzzle',
  description: 'A laser-cut wooden puzzle for kids.',
  imageUrl: 'https://example.test/puzzle.jpg',
  priceCents: 5000,
  categoryId: '550e8400-e29b-41d4-a716-446655440000',
  seo: { en: { seoTitle: 'Wooden Puzzle' }, ru: {}, am: {} },
};

describe('handleCreateCatalogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed input before checking permission', async () => {
    await expect(handleCreateCatalogItem({ title: '' }, 'user-1')).rejects.toThrow();
    expect(hasAdminPermission).not.toHaveBeenCalled();
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleCreateCatalogItem(VALID_INPUT, 'user-1')).rejects.toThrow(/not authorized/i);
    expect(fetchAndStoreCatalogImage).not.toHaveBeenCalled();
  });

  it('fetches the image, resolves a unique slug, creates the item as a draft, and returns its id/slug/adminUrl', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(fetchAndStoreCatalogImage).mockResolvedValue('user-1/mcp-images/abc.jpg');
    vi.mocked(ensureCatalogSlugIsAvailable).mockResolvedValue(true);
    vi.mocked(createCatalogItemCore).mockResolvedValue({ id: 'item-1', slug: 'wooden-puzzle' });

    const result = await handleCreateCatalogItem(VALID_INPUT, 'user-1');

    expect(fetchAndStoreCatalogImage).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      VALID_INPUT.imageUrl,
    );
    expect(createCatalogItemCore).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'user-1' },
      expect.objectContaining({
        title: 'Wooden Puzzle',
        slug: 'wooden-puzzle',
        status: 'draft',
        priceCents: 5000,
        categoryId: VALID_INPUT.categoryId,
        seo: expect.objectContaining({
          en: expect.objectContaining({ seoTitle: 'Wooden Puzzle' }),
        }),
      }),
      'user-1/mcp-images/abc.jpg',
    );
    expect(result).toEqual({
      id: 'item-1',
      slug: 'wooden-puzzle',
      adminUrl: expect.stringContaining('/admin/items/item-1'),
    });
  });

  it('appends a random suffix to the slug when the slugified title is taken', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(fetchAndStoreCatalogImage).mockResolvedValue('user-1/mcp-images/abc.jpg');
    vi.mocked(ensureCatalogSlugIsAvailable).mockResolvedValue(false);
    vi.mocked(createCatalogItemCore).mockResolvedValue({
      id: 'item-1',
      slug: 'wooden-puzzle-abcd1234',
    });

    await handleCreateCatalogItem(VALID_INPUT, 'user-1');

    const [, , itemArg] = vi.mocked(createCatalogItemCore).mock.calls[0];
    expect(itemArg.slug).toMatch(/^wooden-puzzle-[a-f0-9]{8}$/);
  });
});
