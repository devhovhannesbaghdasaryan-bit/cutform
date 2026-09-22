import { describe, expect, it } from 'vitest';
import { createCatalogItemCore, updateCatalogItemCore } from '@/lib/catalog-items/core';
import type { itemSchema } from '@/app/admin/items/item-form-parsing';
import type { z } from 'zod';

function baseItem(overrides: Partial<z.infer<typeof itemSchema>> = {}): z.infer<typeof itemSchema> {
  return {
    title: 'Test Item',
    slug: 'test-item',
    categoryId: '00000000-0000-0000-0000-000000000001',
    subcategoryId: '',
    itemType: 'standard',
    description: 'A description.',
    priceCents: 1000,
    status: 'draft',
    isPopular: false,
    isCustomizable: false,
    thumbnailPath: undefined,
    manufacturingNotes: undefined,
    sizesJson: undefined,
    characteristics: undefined,
    systemPrompt: undefined,
    skillId: undefined,
    tags: [],
    boilerplateIds: [],
    seo: { en: {}, ru: {}, am: {} },
    ...overrides,
  };
}

function fakeSupabase(
  options: {
    categoryExists?: boolean;
    slugTaken?: boolean;
    previousThumbnail?: string | null;
  } = {},
) {
  const { categoryExists = true, slugTaken = false, previousThumbnail = null } = options;
  const inserted: Record<string, unknown>[] = [];
  const mediaInserted: Record<string, unknown>[] = [];
  const touchedTables = new Set<string>();
  const client = {
    from(table: string) {
      if (table === 'catalog_item_boilerplates' || table === 'catalog_item_market_rules') {
        touchedTables.add(table);
      }
      if (table === 'categories') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: categoryExists ? { id: 'cat-1' } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'catalog_items') {
        return {
          select: (columns: string) => {
            if (columns === 'id') {
              return {
                eq: () => ({
                  limit: () => {
                    // ensureCatalogSlugIsAvailable conditionally chains .neq() before
                    // .maybeSingle() when updating (currentId is passed); support both
                    // "create" (no neq) and "update" (with neq) call shapes.
                    const afterLimit = {
                      neq: () => afterLimit,
                      maybeSingle: async () => ({
                        data: slugTaken ? { id: 'other-id' } : null,
                        error: null,
                      }),
                    };
                    return afterLimit;
                  },
                }),
              };
            }
            if (columns === 'thumbnail_path') {
              return {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { thumbnail_path: previousThumbnail },
                    error: null,
                  }),
                }),
              };
            }
            return { single: async () => ({ data: { id: 'new-id' }, error: null }) };
          },
          insert: (values: Record<string, unknown>) => {
            inserted.push(values);
            return {
              select: () => ({ single: async () => ({ data: { id: 'new-id' }, error: null }) }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'catalog_item_boilerplates') {
        return {
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === 'catalog_item_seo_metadata') {
        return { upsert: async () => ({ error: null }) };
      }
      if (table === 'catalog_item_media') {
        return {
          // syncCatalogItemMedia issues two different .select() queries: one
          // for current media (.eq().returns()) and one for the final
          // ordering check (.eq().order().order().returns()); support both.
          select: () => ({
            eq: () => {
              const afterEq = {
                order: () => afterEq,
                returns: async () => ({ data: [], error: null }),
              };
              return afterEq;
            },
          }),
          delete: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
          insert: async (rows: Record<string, unknown>[]) => {
            mediaInserted.push(...rows);
            return { error: null };
          },
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        };
      }
      if (table === 'catalog_item_market_rules') {
        return {
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: async () => ({ error: null }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  };
  return { client: client as never, inserted, mediaInserted, touchedTables };
}

describe('createCatalogItemCore', () => {
  it('inserts the item and returns its id and slug', async () => {
    const { client, inserted } = fakeSupabase();
    const result = await createCatalogItemCore(
      client,
      { id: 'user-1' },
      baseItem(),
      'user-1/thumb.jpg',
    );
    expect(result).toEqual({ id: 'new-id', slug: 'test-item' });
    expect(inserted[0]).toMatchObject({
      title: 'Test Item',
      slug: 'test-item',
      thumbnail_path: 'user-1/thumb.jpg',
      status: 'draft',
      created_by: 'user-1',
    });
  });

  it('writes the currency only when the item states one', async () => {
    const withCurrency = fakeSupabase();
    await createCatalogItemCore(
      withCurrency.client,
      { id: 'user-1' },
      baseItem({ currency: 'AMD' }),
      null,
    );
    expect(withCurrency.inserted[0]).toMatchObject({ price_cents: 1000, currency: 'AMD' });

    const withoutCurrency = fakeSupabase();
    await createCatalogItemCore(withoutCurrency.client, { id: 'user-1' }, baseItem(), null);
    expect(withoutCurrency.inserted[0]).not.toHaveProperty('currency');
  });

  it('rejects an unknown category', async () => {
    const { client } = fakeSupabase({ categoryExists: false });
    await expect(createCatalogItemCore(client, { id: 'user-1' }, baseItem(), null)).rejects.toThrow(
      'Selected category does not exist.',
    );
  });

  it('rejects a slug already used by another item', async () => {
    const { client } = fakeSupabase({ slugTaken: true });
    await expect(createCatalogItemCore(client, { id: 'user-1' }, baseItem(), null)).rejects.toThrow(
      'Slug is already used by another item.',
    );
  });

  it('rejects a customizable item with no generation source', async () => {
    const { client } = fakeSupabase();
    await expect(
      createCatalogItemCore(client, { id: 'user-1' }, baseItem({ isCustomizable: true }), null),
    ).rejects.toThrow(/System Prompt|Skill ID|boilerplate/);
  });

  it('falls back to null thumbnail when none is given or on the item', async () => {
    const { client, inserted } = fakeSupabase();
    await createCatalogItemCore(client, { id: 'user-1' }, baseItem(), null);
    expect(inserted[0]).toMatchObject({ thumbnail_path: null });
  });
});

describe('updateCatalogItemCore', () => {
  it('updates without throwing for a valid item', async () => {
    const { client } = fakeSupabase();
    await expect(
      updateCatalogItemCore(
        client,
        'existing-id',
        { id: 'user-1' },
        baseItem(),
        'user-1/thumb.jpg',
      ),
    ).resolves.toBeUndefined();
  });

  it('adds a changed thumbnail to the gallery', async () => {
    const { client, mediaInserted } = fakeSupabase({ previousThumbnail: 'user-1/old.jpg' });
    await updateCatalogItemCore(
      client,
      'existing-id',
      { id: 'user-1' },
      baseItem(),
      'user-1/new.jpg',
    );
    expect(mediaInserted).toEqual([
      expect.objectContaining({
        storage_path: 'user-1/new.jpg',
        metadata: { source: 'thumbnail' },
      }),
    ]);
  });

  it('does not re-add an unchanged thumbnail the admin removed from the gallery', async () => {
    const { client, mediaInserted } = fakeSupabase({ previousThumbnail: 'user-1/thumb.jpg' });
    await updateCatalogItemCore(
      client,
      'existing-id',
      { id: 'user-1' },
      baseItem(),
      'user-1/thumb.jpg',
    );
    expect(mediaInserted).toEqual([]);
  });

  it('re-syncs boilerplates and market rules by default (syncAssociations unset)', async () => {
    const { client, touchedTables } = fakeSupabase();
    await updateCatalogItemCore(
      client,
      'existing-id',
      { id: 'user-1' },
      baseItem(),
      'user-1/thumb.jpg',
    );
    expect(touchedTables.has('catalog_item_boilerplates')).toBe(true);
    expect(touchedTables.has('catalog_item_market_rules')).toBe(true);
  });

  it('accepts a customizable item whose only generation source is a preserved boilerplate id, even with syncAssociations false', async () => {
    const { client } = fakeSupabase();
    await expect(
      updateCatalogItemCore(
        client,
        'existing-id',
        { id: 'user-1' },
        baseItem({ isCustomizable: true, boilerplateIds: ['existing-boilerplate'] }),
        'user-1/thumb.jpg',
        undefined,
        { syncAssociations: false },
      ),
    ).resolves.toBeUndefined();
  });

  it('skips re-syncing boilerplates and market rules when syncAssociations is false, so a partial patch cannot wipe them', async () => {
    const { client, touchedTables } = fakeSupabase();
    await updateCatalogItemCore(
      client,
      'existing-id',
      { id: 'user-1' },
      baseItem(),
      'user-1/thumb.jpg',
      undefined,
      { syncAssociations: false },
    );
    expect(touchedTables.has('catalog_item_boilerplates')).toBe(false);
    expect(touchedTables.has('catalog_item_market_rules')).toBe(false);
  });
});
