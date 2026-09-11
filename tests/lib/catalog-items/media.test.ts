import { describe, expect, it } from 'vitest';
import {
  attachCatalogMedia,
  createCatalogMediaUploads,
  removeCatalogMedia,
  replaceCatalogMedia,
} from '@/lib/catalog-items/media';

const USER = 'user-1';
const ITEM = 'item-1';
const FOLDER = `${USER}/items/${ITEM}/media/`;
const UUID = '123e4567-e89b-42d3-a456-426614174000';

interface Call {
  op: 'select' | 'insert' | 'update' | 'delete';
  values?: unknown;
  filters: [string, unknown][];
}

type MediaRow = { id: string; is_primary: boolean; sort_order: number };

/**
 * Minimal chainable stand-in for the Supabase query builder: every chain is
 * recorded, and awaiting it resolves against the in-memory `media` rows.
 */
function fakeClient(options: { media?: MediaRow[]; affectedRows?: number } = {}) {
  const media = options.media ?? [];
  const affectedRows = options.affectedRows ?? 1;
  const calls: Call[] = [];
  const signedPaths: string[] = [];

  function query() {
    const call: Call = { op: 'select', filters: [] };
    calls.push(call);
    const result = () => {
      if (call.op === 'update' || call.op === 'delete') {
        return { data: Array.from({ length: affectedRows }, () => ({ id: 'row' })), error: null };
      }
      if (call.op === 'insert') return { data: null, error: null };
      return { data: media, error: null };
    };
    const builder = {
      select: () => builder,
      insert: (values: unknown) => {
        call.op = 'insert';
        call.values = values;
        return builder;
      },
      update: (values: unknown) => {
        call.op = 'update';
        call.values = values;
        return builder;
      },
      delete: () => {
        call.op = 'delete';
        return builder;
      },
      eq: (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      returns: async () => result(),
      maybeSingle: async () => ({
        data: [...media].sort((a, b) => b.sort_order - a.sort_order)[0] ?? null,
        error: null,
      }),
      // biome-ignore lint/suspicious/noThenProperty: mirrors the awaitable PostgREST builder
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: () => query(),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          signedPaths.push(path);
          return { data: { token: `token-${signedPaths.length}` }, error: null };
        },
      }),
    },
  };
  return { client: client as never, calls, signedPaths };
}

const png = { name: 'front.png', type: 'image/png', size: 1024 };

describe('createCatalogMediaUploads', () => {
  it("mints one signed upload per file under the admin's item media folder", async () => {
    const { client, signedPaths } = fakeClient();
    const tickets = await createCatalogMediaUploads(client, USER, ITEM, [
      png,
      { name: 'clip.mp4', type: 'video/mp4', size: 2048 },
    ]);

    expect(tickets).toEqual([
      { path: signedPaths[0], token: 'token-1' },
      { path: signedPaths[1], token: 'token-2' },
    ]);
    expect(signedPaths[0]).toMatch(new RegExp(`^${FOLDER}[0-9a-f-]{36}\\.png$`));
    expect(signedPaths[1]).toMatch(new RegExp(`^${FOLDER}[0-9a-f-]{36}\\.mp4$`));
  });

  it('rejects unsupported and oversized files before signing anything', async () => {
    const { client, signedPaths } = fakeClient();
    await expect(
      createCatalogMediaUploads(client, USER, ITEM, [
        { name: 'doc.pdf', type: 'application/pdf', size: 10 },
      ]),
    ).rejects.toThrow('Upload PNG, JPG, WEBP, SVG, MP4, or WEBM files only.');
    await expect(
      createCatalogMediaUploads(client, USER, ITEM, [{ ...png, size: 51 * 1024 * 1024 }]),
    ).rejects.toThrow('50 MB or smaller');
    expect(signedPaths).toEqual([]);
  });
});

describe('attachCatalogMedia', () => {
  it('appends uploads after the last media and keeps the existing primary', async () => {
    const { client, calls } = fakeClient({
      media: [
        { id: 'a', is_primary: true, sort_order: 0 },
        { id: 'b', is_primary: false, sort_order: 4 },
      ],
    });
    await attachCatalogMedia(client, USER, ITEM, [{ ...png, path: `${FOLDER}${UUID}.png` }]);

    const insert = calls.find((call) => call.op === 'insert');
    expect(insert?.values).toEqual([
      expect.objectContaining({
        catalog_item_id: ITEM,
        media_type: 'image',
        storage_path: `${FOLDER}${UUID}.png`,
        alt_text: 'front',
        sort_order: 5,
        is_primary: false,
      }),
    ]);
    expect(calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('makes the first media primary when the gallery had none', async () => {
    const { client, calls } = fakeClient({
      media: [{ id: 'a', is_primary: false, sort_order: 0 }],
    });
    await attachCatalogMedia(client, USER, ITEM, [{ ...png, path: `${FOLDER}${UUID}.png` }]);

    expect(calls.find((call) => call.op === 'update')).toMatchObject({
      values: { is_primary: true },
      filters: [
        ['id', 'a'],
        ['catalog_item_id', ITEM],
      ],
    });
  });

  it.each([
    ['another item', `${USER}/items/item-2/media/${UUID}.png`],
    ['another admin', `user-2/items/${ITEM}/media/${UUID}.png`],
    ['a nested path', `${FOLDER}../${UUID}.png`],
    ['a mismatched extension', `${FOLDER}${UUID}.svg`],
  ])('refuses a path from %s', async (_label, path) => {
    const { client, calls } = fakeClient();
    await expect(attachCatalogMedia(client, USER, ITEM, [{ ...png, path }])).rejects.toThrow(
      'Invalid upload path.',
    );
    expect(calls).toEqual([]);
  });
});

describe('replaceCatalogMedia', () => {
  it('points the existing row at the new file and drops the stale poster', async () => {
    const { client, calls } = fakeClient();
    await replaceCatalogMedia(client, USER, ITEM, 'media-1', {
      name: 'clip.webm',
      type: 'video/webm',
      size: 99,
      path: `${FOLDER}${UUID}.webm`,
    });

    expect(calls[0]).toMatchObject({
      op: 'update',
      values: {
        media_type: 'video',
        storage_path: `${FOLDER}${UUID}.webm`,
        poster_path: null,
        metadata: { originalFileName: 'clip.webm', contentType: 'video/webm', size: 99 },
      },
      filters: [
        ['id', 'media-1'],
        ['catalog_item_id', ITEM],
      ],
    });
  });

  it('reports a row that does not belong to the item', async () => {
    const { client } = fakeClient({ affectedRows: 0 });
    await expect(
      replaceCatalogMedia(client, USER, ITEM, 'media-1', { ...png, path: `${FOLDER}${UUID}.png` }),
    ).rejects.toThrow('Gallery media not found.');
  });
});

describe('removeCatalogMedia', () => {
  it('deletes the row scoped to the item and promotes a new primary', async () => {
    const { client, calls } = fakeClient({
      media: [{ id: 'b', is_primary: false, sort_order: 1 }],
    });
    await removeCatalogMedia(client, ITEM, 'a');

    expect(calls[0]).toMatchObject({
      op: 'delete',
      filters: [
        ['id', 'a'],
        ['catalog_item_id', ITEM],
      ],
    });
    expect(calls.find((call) => call.op === 'update')).toMatchObject({
      values: { is_primary: true },
      filters: [
        ['id', 'b'],
        ['catalog_item_id', ITEM],
      ],
    });
  });

  it('reports nothing deleted instead of succeeding silently', async () => {
    const { client } = fakeClient({ affectedRows: 0 });
    await expect(removeCatalogMedia(client, ITEM, 'a')).rejects.toThrow('Gallery media not found.');
  });
});
