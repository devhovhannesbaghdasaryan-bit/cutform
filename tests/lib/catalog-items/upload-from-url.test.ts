import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';

function fakeSupabase() {
  const uploaded: { path?: string; contentType?: string } = {};
  return {
    client: {
      storage: {
        from: () => ({
          upload: async (path: string, _body: unknown, options: { contentType: string }) => {
            uploaded.path = path;
            uploaded.contentType = options.contentType;
            return { error: null };
          },
        }),
      },
    } as unknown as Parameters<typeof fetchAndStoreCatalogImage>[0],
    uploaded,
  };
}

function jpegResponse(body = new Uint8Array([1, 2, 3])) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
}

describe('fetchAndStoreCatalogImage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-https URLs before ever calling fetch', async () => {
    const { client } = fakeSupabase();
    await expect(fetchAndStoreCatalogImage(client, 'user-1', 'http://example.com/a.jpg')).rejects.toThrow(
      /https/i,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a URL resolving to a private IP', async () => {
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://127.0.0.1/a.jpg'),
    ).rejects.toThrow(/private|loopback/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a URL resolving to a link-local/metadata address', async () => {
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://169.254.169.254/a.jpg'),
    ).rejects.toThrow(/private|loopback/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-image content type', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/a.jpg'),
    ).rejects.toThrow(/image/i);
  });

  it('rejects a response over the size cap', async () => {
    const oversized = new Uint8Array(51 * 1024 * 1024);
    vi.mocked(fetch).mockResolvedValue(jpegResponse(oversized));
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/a.jpg'),
    ).rejects.toThrow(/50 ?MB|size/i);
  });

  it('uploads a valid https image and returns the storage path', async () => {
    vi.mocked(fetch).mockResolvedValue(jpegResponse());
    const { client, uploaded } = fakeSupabase();
    const path = await fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/a.jpg');
    expect(path).toMatch(/^user-1\/mcp-images\/.+\.jpg$/);
    expect(uploaded.path).toBe(path);
    expect(uploaded.contentType).toBe('image/jpeg');
  });

  it('propagates a fetch failure as an error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/missing.jpg'),
    ).rejects.toThrow(/404|fetch/i);
  });
});
