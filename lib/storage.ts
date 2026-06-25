const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

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
