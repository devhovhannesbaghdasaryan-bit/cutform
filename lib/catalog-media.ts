import type { CatalogItemMedia } from '@/lib/marketplace';

export const CATALOG_MEDIA_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;
export const CATALOG_MEDIA_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

export type CatalogMediaKind = 'image' | 'video';

export function getCatalogMediaKind(mimeType: string): CatalogMediaKind | null {
  if ((CATALOG_MEDIA_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'image';
  if ((CATALOG_MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return 'video';
  return null;
}

export function sortCatalogMedia(media: CatalogItemMedia[] = []) {
  return [...media].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function getPrimaryCatalogMedia(media: CatalogItemMedia[] = []) {
  const sorted = sortCatalogMedia(media);
  return sorted.find((item) => item.is_primary) ?? sorted[0] ?? null;
}
