import type { TypedSupabaseClient } from '@/lib/supabase/types';

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

/**
 * Structural client type so both the SSR client (`await getServerSupabase()`)
 * and the service client (`getServiceSupabase()`) fit.
 */
type SupabaseStorageClient = Pick<TypedSupabaseClient, 'storage'>;

/** File extension by MIME type for the image formats accepted across upload forms. */
export const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface UploadToBucketOptions {
  bucket: string;
  path: string;
  body: ArrayBuffer | Uint8Array | Blob;
  contentType: string;
  upsert?: boolean;
}

/** Uploads to a storage bucket, throwing on failure. Returns the storage path. */
export async function uploadToBucket(
  client: SupabaseStorageClient,
  { bucket, path, body, contentType, upsert = false }: UploadToBucketOptions,
) {
  const { error } = await client.storage.from(bucket).upload(path, body, { contentType, upsert });
  if (error) throw new Error(error.message);
  return path;
}

/** Downloads from a storage bucket, throwing on error or missing data. Returns the Blob. */
export async function downloadFromBucket(
  client: SupabaseStorageClient,
  bucket: string,
  path: string,
  missingDataMessage = `Unable to download ${path}.`,
) {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) throw new Error(error?.message ?? missingDataMessage);
  return data;
}

export function resolvePublicStorageUrl(
  bucket: 'catalog-assets' | 'banner-assets',
  path: string | null | undefined,
) {
  if (!path) return null;
  if (ABSOLUTE_URL_PATTERN.test(path) || path.startsWith('/')) return path;

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!baseUrl) return path;

  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

export function normalizePersonalizationMockPath(path: string | null | undefined) {
  if (!path || path.startsWith('/mock/night-lights/')) return null;
  return path;
}
