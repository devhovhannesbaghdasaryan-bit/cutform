import type { CatalogItemMedia } from '@/lib/marketplace';

export const CATALOG_MEDIA_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;
export const CATALOG_MEDIA_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

export type CatalogMediaKind = 'image' | 'video';

type SortableCatalogMedia = Pick<CatalogItemMedia, 'id' | 'sort_order' | 'is_primary'>;

export function getCatalogMediaKind(mimeType: string): CatalogMediaKind | null {
  if ((CATALOG_MEDIA_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'image';
  if ((CATALOG_MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return 'video';
  return null;
}

// Generic over the row shape so callers holding raw Supabase rows (whose
// media_type widens to string) can sort without casting to CatalogItemMedia.
export function sortCatalogMedia<T extends SortableCatalogMedia>(media: T[] = []): T[] {
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

// next/image can't rasterize SVG markup, and admin-uploaded catalog media is
// occasionally SVG (see app/admin/items/item-form-parsing.ts), so those still
// need a plain <img>. Everything else (the common case: PNG/JPG/WEBP product
// photos) goes through next/image for resizing, format negotiation, and lazy
// loading instead of shipping the full-resolution original to every card.
export function isSvgPath(path: string) {
  return /\.svg$/i.test(path);
}

// The image an item is represented by outside its own page: its thumbnail if it
// has one, otherwise the first gallery image. Videos are skipped rather than
// falling back to their poster, so a preview is always a real product image.
export function getCatalogPreviewPath(item: {
  thumbnail_path?: string | null;
  media?: (SortableCatalogMedia & { media_type: string; storage_path: string })[];
}) {
  if (item.thumbnail_path) return item.thumbnail_path;
  const image = sortCatalogMedia(item.media ?? []).find((entry) => entry.media_type === 'image');
  return image?.storage_path ?? null;
}
