import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/catalog-items/upload-from-url', () => ({ fetchAndStoreCatalogImage: vi.fn() }));
vi.mock('@/lib/catalog-items/core', () => ({ updateCatalogItemCore: vi.fn() }));
vi.mock('@/lib/mcp/tools/get-catalog-item', () => ({ handleGetCatalogItem: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { updateCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';
import { handleUpdateCatalogItem } from '@/lib/mcp/tools/update-catalog-item';
import { getServiceSupabase } from '@/lib/supabase/server';

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
  tags: ['personal_photo'],
  is_popular: true,
  is_customizable: true,
  system_prompt: 'Existing system prompt',
  skill_id: 'skill-1',
  laser_contour_enabled: true,
  laser_solid_enabled: true,
  laser_solid_price_cents: 500,
  laser_solid_prompt: 'Existing solid prompt',
  sizes: [{ key: 'small', label: 'Small' }],
};

function fakeSupabase(boilerplateIds: string[] = []) {
  const eqCalls: Array<[string, unknown]> = [];
  return {
    from: (table: string) => {
      if (table === 'catalog_item_boilerplates') {
        return {
          select: () => ({
            eq: async (column: string, value: unknown) => {
              eqCalls.push([column, value]);
              return {
                data: boilerplateIds.map((boilerplate_id) => ({ boilerplate_id })),
                error: null,
              };
            },
          }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
    eqCalls,
  };
}

describe('handleUpdateCatalogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleGetCatalogItem).mockResolvedValue(EXISTING);
    vi.mocked(getServiceSupabase).mockReturnValue(fakeSupabase() as never);
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(
      handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1'),
    ).rejects.toThrow(/not authorized/i);
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
      undefined,
      { syncAssociations: false },
    );
  });

  it('preserves fields it has no way to set (tags, personalization, engraving, sizes) instead of wiping them, and skips re-syncing associations', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);

    await handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1');

    const [, , , itemArg, , , optionsArg] = vi.mocked(updateCatalogItemCore).mock.calls[0];
    expect(itemArg).toMatchObject({
      tags: ['personal_photo'],
      isPopular: true,
      isCustomizable: true,
      systemPrompt: 'Existing system prompt',
      skillId: 'skill-1',
      laserContourEnabled: true,
      laserSolidEnabled: true,
      laserSolidPriceCents: 500,
      laserSolidPrompt: 'Existing solid prompt',
      sizesJson: JSON.stringify(EXISTING.sizes),
    });
    expect(optionsArg).toEqual({ syncAssociations: false });
  });

  it('fetches and preserves the existing boilerplate ids for validation, without re-syncing them', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);
    const supabase = fakeSupabase(['boilerplate-1', 'boilerplate-2']);
    vi.mocked(getServiceSupabase).mockReturnValue(supabase as never);

    await handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1');

    expect(supabase.eqCalls).toEqual([['catalog_item_id', ITEM_ID]]);
    const [, , , itemArg] = vi.mocked(updateCatalogItemCore).mock.calls[0];
    expect(itemArg).toMatchObject({ boilerplateIds: ['boilerplate-1', 'boilerplate-2'] });
  });

  it('passes the fetched boilerplateIds through for a boilerplate-only-personalization item', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);
    vi.mocked(handleGetCatalogItem).mockResolvedValue({
      ...EXISTING,
      system_prompt: null,
      skill_id: null,
      laser_solid_enabled: false,
    });
    vi.mocked(getServiceSupabase).mockReturnValue(fakeSupabase(['boilerplate-only']) as never);

    await handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1');

    // isCustomizable stays true (preserved) and boilerplateIds carries the
    // fetched id rather than an empty array — updateCatalogItemCore is
    // mocked here, so this only proves the data is threaded correctly; see
    // core.test.ts for proof that this combination actually satisfies
    // validatePersonalizationConfig instead of throwing.
    const [, , , itemArg] = vi.mocked(updateCatalogItemCore).mock.calls[0];
    expect(itemArg).toMatchObject({
      isCustomizable: true,
      systemPrompt: undefined,
      skillId: undefined,
      boilerplateIds: ['boilerplate-only'],
    });
  });

  it('re-fetches the thumbnail when imageUrl is given', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(fetchAndStoreCatalogImage).mockResolvedValue('user-1/mcp-images/new.jpg');
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);

    await handleUpdateCatalogItem(
      { id: ITEM_ID, imageUrl: 'https://example.test/new.jpg' },
      'user-1',
    );

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
