import { beforeEach, describe, expect, it, vi } from 'vitest';

// Partial mock: item-form-parsing (pulled in transitively by core.ts) imports
// IMAGE_EXTENSION_BY_MIME from this module, so the rest of it must stay real.
vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage')>()),
  removeFromBucket: vi.fn(),
}));
vi.mock('@/lib/openai-skills', () => ({ deleteSkillArtifact: vi.fn() }));
vi.mock('@/lib/openai-client', () => ({ getOpenAiClient: vi.fn(() => ({ marker: 'openai' })) }));

import { deleteSkillArtifact } from '@/lib/openai-skills';
import { removeFromBucket } from '@/lib/storage';
import { type CatalogItemDeleteRow, deleteCatalogItemsCore } from '@/lib/catalog-items/core';

const MUG = '550e8400-e29b-41d4-a716-446655440001';
const HAT = '550e8400-e29b-41d4-a716-446655440002';
const PIN = '550e8400-e29b-41d4-a716-446655440003';

function row(overrides: Partial<CatalogItemDeleteRow> & { id: string }): CatalogItemDeleteRow {
  return {
    title: `Item ${overrides.id.slice(-2)}`,
    thumbnail_path: null,
    gallery_paths: [],
    skill_id: null,
    ...overrides,
  };
}

interface FakeOptions {
  items: CatalogItemDeleteRow[];
  /** Item ids referenced by at least one `order_items` row. */
  orderedIds?: string[];
  media?: { catalog_item_id: string; storage_path: string }[];
  deleteError?: string;
}

function fakeSupabase({ items, orderedIds = [], media = [], deleteError }: FakeOptions) {
  const deletedIdBatches: string[][] = [];

  const client = {
    from(table: string) {
      if (table === 'catalog_items') {
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => ({
              data: items.filter((item) => ids.includes(item.id)),
              error: null,
            }),
          }),
          delete: () => ({
            in: async (_column: string, ids: string[]) => {
              deletedIdBatches.push(ids);
              return { error: deleteError ? { message: deleteError } : null };
            },
          }),
        };
      }
      if (table === 'order_items') {
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => ({
              data: orderedIds
                .filter((id) => ids.includes(id))
                .map((id) => ({ catalog_item_id: id })),
              error: null,
            }),
          }),
        };
      }
      if (table === 'catalog_item_media') {
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => ({
              data: media.filter((entry) => ids.includes(entry.catalog_item_id)),
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { client: client as never, deletedIdBatches };
}

describe('deleteCatalogItemsCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes only the items no order references, and reports the rest as blocked', async () => {
    const { client, deletedIdBatches } = fakeSupabase({
      items: [row({ id: MUG, title: 'Blue Mug' }), row({ id: HAT }), row({ id: PIN })],
      orderedIds: [MUG],
    });

    const result = await deleteCatalogItemsCore(client, [MUG, HAT, PIN]);

    // order_items.catalog_item_id has no ON DELETE clause, so including MUG in
    // the .in() would abort the whole statement with a 23503 and delete nothing.
    expect(deletedIdBatches).toEqual([[HAT, PIN]]);
    expect(result.deleted).toBe(2);
    expect(result.blocked).toEqual([{ id: MUG, title: 'Blue Mug' }]);
  });

  it('issues no delete at all when every selected item is referenced by an order', async () => {
    const { client, deletedIdBatches } = fakeSupabase({
      items: [row({ id: MUG, title: 'Blue Mug' }), row({ id: HAT, title: 'Wool Hat' })],
      orderedIds: [MUG, HAT],
    });

    const result = await deleteCatalogItemsCore(client, [MUG, HAT]);

    expect(deletedIdBatches).toEqual([]);
    expect(result.deleted).toBe(0);
    expect(result.blocked).toEqual([
      { id: MUG, title: 'Blue Mug' },
      { id: HAT, title: 'Wool Hat' },
    ]);
  });

  it('reports blocked items in selection order regardless of the row order Postgres returns', async () => {
    const { client } = fakeSupabase({
      // `.in()` guarantees no ordering, so hand the rows back reversed.
      items: [row({ id: PIN, title: 'Enamel Pin' }), row({ id: MUG, title: 'Blue Mug' })],
      orderedIds: [MUG, PIN],
    });

    const result = await deleteCatalogItemsCore(client, [MUG, PIN]);

    expect(result.blocked).toEqual([
      { id: MUG, title: 'Blue Mug' },
      { id: PIN, title: 'Enamel Pin' },
    ]);
  });

  it('cleans up storage objects and skill artifacts for deleted items only', async () => {
    const { client } = fakeSupabase({
      items: [
        row({ id: MUG, thumbnail_path: 'thumbnails/mug.png', skill_id: 'skill_mug' }),
        row({
          id: HAT,
          thumbnail_path: 'thumbnails/hat.png',
          gallery_paths: ['gallery/hat-1.png', 'gallery/hat-2.png'],
          skill_id: 'file-hat',
        }),
      ],
      orderedIds: [MUG],
      media: [
        { catalog_item_id: MUG, storage_path: 'media/mug-clip.mp4' },
        { catalog_item_id: HAT, storage_path: 'media/hat-clip.mp4' },
      ],
    });

    await deleteCatalogItemsCore(client, [MUG, HAT]);

    expect(removeFromBucket).toHaveBeenCalledTimes(1);
    const [, bucket, paths] = vi.mocked(removeFromBucket).mock.calls[0];
    expect(bucket).toBe('catalog-assets');
    expect([...paths].sort()).toEqual([
      'gallery/hat-1.png',
      'gallery/hat-2.png',
      'media/hat-clip.mp4',
      'thumbnails/hat.png',
    ]);

    // MUG was blocked, so neither its files nor its skill artifact may be touched.
    expect(deleteSkillArtifact).toHaveBeenCalledTimes(1);
    expect(deleteSkillArtifact).toHaveBeenCalledWith(expect.anything(), 'file-hat');
  });

  it('still reports success when storage cleanup fails', async () => {
    vi.mocked(removeFromBucket).mockRejectedValueOnce(new Error('bucket unreachable'));
    const { client } = fakeSupabase({
      items: [row({ id: HAT, thumbnail_path: 'thumbnails/hat.png' })],
    });

    const result = await deleteCatalogItemsCore(client, [HAT]);

    expect(result).toEqual({ deleted: 1, blocked: [] });
  });

  it('throws when the delete statement itself fails', async () => {
    const { client } = fakeSupabase({
      items: [row({ id: HAT })],
      deleteError: 'permission denied',
    });

    await expect(deleteCatalogItemsCore(client, [HAT])).rejects.toThrow('permission denied');
  });

  it('skips storage cleanup entirely when nothing was deleted', async () => {
    const { client } = fakeSupabase({
      items: [row({ id: MUG, thumbnail_path: 'thumbnails/mug.png' })],
      orderedIds: [MUG],
    });

    await deleteCatalogItemsCore(client, [MUG]);

    expect(removeFromBucket).not.toHaveBeenCalled();
    expect(deleteSkillArtifact).not.toHaveBeenCalled();
  });
});
