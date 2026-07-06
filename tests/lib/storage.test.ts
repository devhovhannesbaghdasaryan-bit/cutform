import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_EXTENSION_BY_MIME,
  downloadFromBucket,
  normalizePersonalizationMockPath,
  resolvePublicStorageUrl,
  uploadToBucket,
} from '@/lib/storage';

type StorageClient = Parameters<typeof uploadToBucket>[0];

function fakeStorageClient(calls: {
  upload?: { error: { message: string } | null };
  download?: { data: Blob | null; error: { message: string } | null };
}) {
  const recorded: { bucket?: string; path?: string; body?: unknown; options?: unknown } = {};
  const client = {
    storage: {
      from(bucket: string) {
        recorded.bucket = bucket;
        return {
          async upload(path: string, body: unknown, options: unknown) {
            recorded.path = path;
            recorded.body = body;
            recorded.options = options;
            return calls.upload ?? { error: null };
          },
          async download(path: string) {
            recorded.path = path;
            return calls.download ?? { data: null, error: null };
          },
        };
      },
    },
  } as unknown as StorageClient;
  return { client, recorded };
}

describe('IMAGE_EXTENSION_BY_MIME', () => {
  it('maps the accepted image MIME types to extensions', () => {
    expect(IMAGE_EXTENSION_BY_MIME).toEqual({
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    });
  });

  it('has no entry for unsupported types', () => {
    expect(IMAGE_EXTENSION_BY_MIME['image/gif']).toBeUndefined();
    expect(IMAGE_EXTENSION_BY_MIME['application/pdf']).toBeUndefined();
  });
});

describe('uploadToBucket', () => {
  it('returns the path and defaults upsert to false', async () => {
    const { client, recorded } = fakeStorageClient({ upload: { error: null } });
    const body = new Uint8Array([1, 2, 3]);
    const path = await uploadToBucket(client, {
      bucket: 'generated-assets',
      path: 'user/previews/file.png',
      body,
      contentType: 'image/png',
    });
    expect(path).toBe('user/previews/file.png');
    expect(recorded.bucket).toBe('generated-assets');
    expect(recorded.body).toBe(body);
    expect(recorded.options).toEqual({ contentType: 'image/png', upsert: false });
  });

  it('throws the storage error message on failure', async () => {
    const { client } = fakeStorageClient({
      upload: { error: { message: 'bucket quota exceeded' } },
    });
    await expect(
      uploadToBucket(client, {
        bucket: 'user-uploads',
        path: 'a/b.png',
        body: new Uint8Array(),
        contentType: 'image/png',
      }),
    ).rejects.toThrow('bucket quota exceeded');
  });
});

describe('downloadFromBucket', () => {
  it('returns the blob on success', async () => {
    const blob = new Blob(['hello']);
    const { client, recorded } = fakeStorageClient({ download: { data: blob, error: null } });
    await expect(downloadFromBucket(client, 'catalog-assets', 'a/b.svg')).resolves.toBe(blob);
    expect(recorded.bucket).toBe('catalog-assets');
    expect(recorded.path).toBe('a/b.svg');
  });

  it('throws the storage error message on failure', async () => {
    const { client } = fakeStorageClient({
      download: { data: null, error: { message: 'Object not found' } },
    });
    await expect(downloadFromBucket(client, 'catalog-assets', 'a/b.svg')).rejects.toThrow(
      'Object not found',
    );
  });

  it('throws the provided fallback message when data is missing without an error', async () => {
    const { client } = fakeStorageClient({ download: { data: null, error: null } });
    await expect(
      downloadFromBucket(client, 'catalog-assets', 'a/b.svg', 'Unable to load boilerplate image.'),
    ).rejects.toThrow('Unable to load boilerplate image.');
  });

  it('defaults the fallback message to the path', async () => {
    const { client } = fakeStorageClient({ download: { data: null, error: null } });
    await expect(downloadFromBucket(client, 'catalog-assets', 'a/b.svg')).rejects.toThrow(
      'Unable to download a/b.svg.',
    );
  });
});

describe('resolvePublicStorageUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null for empty paths', () => {
    expect(resolvePublicStorageUrl('catalog-assets', null)).toBeNull();
    expect(resolvePublicStorageUrl('catalog-assets', undefined)).toBeNull();
    expect(resolvePublicStorageUrl('catalog-assets', '')).toBeNull();
  });

  it('passes through absolute and root-relative paths', () => {
    expect(resolvePublicStorageUrl('catalog-assets', 'https://cdn.example.com/x.png')).toBe(
      'https://cdn.example.com/x.png',
    );
    expect(resolvePublicStorageUrl('banner-assets', '/mock/banner.png')).toBe('/mock/banner.png');
  });

  it('builds a public storage URL with encoded segments', () => {
    expect(resolvePublicStorageUrl('catalog-assets', 'user id/img 1.png')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/catalog-assets/user%20id/img%201.png',
    );
  });

  it('returns the raw path when the Supabase URL is not configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(resolvePublicStorageUrl('catalog-assets', 'a/b.png')).toBe('a/b.png');
  });
});

describe('normalizePersonalizationMockPath', () => {
  it('drops legacy mock paths and empty values', () => {
    expect(normalizePersonalizationMockPath('/mock/night-lights/foo.png')).toBeNull();
    expect(normalizePersonalizationMockPath(null)).toBeNull();
    expect(normalizePersonalizationMockPath(undefined)).toBeNull();
  });

  it('keeps real storage paths', () => {
    expect(normalizePersonalizationMockPath('user/personalization-models/mock-1.png')).toBe(
      'user/personalization-models/mock-1.png',
    );
  });
});
