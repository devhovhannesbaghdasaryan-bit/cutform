import { z } from 'zod';
import type { requireAdmin } from '@/lib/admin';
import { getCatalogMediaKind } from '@/lib/catalog-media';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';
import type { Json } from '@/lib/supabase/types';

export type AdminSupabase = Awaited<ReturnType<typeof requireAdmin>>['supabase'];

export const localeSchema = z.enum(APP_LOCALES);

const CATALOG_ASSET_MAX_BYTES = 50 * 1024 * 1024;
const CATALOG_ASSET_EXTENSIONS: Record<string, string> = {
  ...IMAGE_EXTENSION_BY_MIME,
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const seoLocaleSchema = z.object({
  seoTitle: z.string().trim().max(70, 'SEO title must be 70 characters or fewer.').optional(),
  seoDescription: z
    .string()
    .trim()
    .max(170, 'Meta description must be 170 characters or fewer.')
    .optional(),
  seoKeywords: z
    .string()
    .trim()
    .refine((value) => parseKeywords(value).length <= 10, 'Use 10 SEO keywords or fewer.')
    .optional(),
  ogTitle: z.string().trim().max(90, 'Open Graph title must be 90 characters or fewer.').optional(),
  ogDescription: z
    .string()
    .trim()
    .max(220, 'Open Graph description must be 220 characters or fewer.')
    .optional(),
  socialImagePath: z.string().trim().optional(),
});

export const itemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a URL-safe slug.'),
  categoryId: z.uuid('Choose a category.'),
  subcategoryId: z.union([z.uuid(), z.literal('')]),
  itemType: z.enum([
    'standard',
    'toy',
    'decoration',
    'night_light',
    'personalized_night_light',
    'banner',
  ]),
  description: z.string().trim().optional(),
  priceCents: z.coerce.number().int().min(0, 'Price cannot be negative.'),
  status: z.enum(['draft', 'published', 'archived']),
  isPopular: z.boolean(),
  isCustomizable: z.boolean(),
  thumbnailPath: z.string().trim().optional(),
  manufacturingNotes: z.string().trim().optional(),
  sizesJson: z.string().trim().optional(),
  characteristics: z.string().trim().optional(),
  systemPrompt: z.string().trim().optional(),
  skillId: z.string().trim().optional(),
  tags: z.array(z.enum(['personal_color', 'personal_text', 'personal_photo'])),
  boilerplateIds: z.array(z.uuid()),
  laserContourEnabled: z.boolean(),
  laserSolidEnabled: z.boolean(),
  laserSolidPriceCents: z.coerce.number().int().min(0, 'Solid price cannot be negative.').optional(),
  laserSolidPrompt: z.string().trim().optional(),
  seo: z.object({
    en: seoLocaleSchema,
    ru: seoLocaleSchema,
    am: seoLocaleSchema,
  }),
});

export function readSeoLocale(
  formData: FormData,
  locale: AppLocale,
): z.infer<typeof seoLocaleSchema> {
  return {
    seoTitle: String(formData.get(`seoTitle_${locale}`) ?? '').trim() || undefined,
    seoDescription: String(formData.get(`seoDescription_${locale}`) ?? '').trim() || undefined,
    seoKeywords: String(formData.get(`seoKeywords_${locale}`) ?? '').trim() || undefined,
    ogTitle: String(formData.get(`ogTitle_${locale}`) ?? '').trim() || undefined,
    ogDescription: String(formData.get(`ogDescription_${locale}`) ?? '').trim() || undefined,
    socialImagePath: String(formData.get(`socialImagePath_${locale}`) ?? '').trim() || undefined,
  };
}

export function parseItemForm(formData: FormData) {
  return itemSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    categoryId: formData.get('categoryId'),
    subcategoryId: formData.get('subcategoryId') || '',
    itemType: formData.get('itemType') || 'standard',
    description: formData.get('description') || undefined,
    priceCents: formData.get('priceCents'),
    status: formData.get('status'),
    isPopular: formData.get('isPopular') === 'on',
    isCustomizable: formData.get('isCustomizable') === 'on',
    thumbnailPath: formData.get('thumbnailPath') || undefined,
    manufacturingNotes: formData.get('manufacturingNotes') || undefined,
    sizesJson: formData.get('sizesJson') || undefined,
    characteristics: formData.get('characteristics') || undefined,
    systemPrompt: formData.get('systemPrompt') || undefined,
    skillId: formData.get('skillId') || undefined,
    tags: formData.getAll('tags').map(String),
    boilerplateIds: formData.getAll('boilerplateIds').map(String),
    laserContourEnabled: formData.get('laserContourEnabled') === 'on',
    laserSolidEnabled: formData.get('laserSolidEnabled') === 'on',
    laserSolidPriceCents: formData.get('laserSolidPriceCents') || undefined,
    laserSolidPrompt: formData.get('laserSolidPrompt') || undefined,
    seo: {
      en: readSeoLocale(formData, 'en'),
      ru: readSeoLocale(formData, 'ru'),
      am: readSeoLocale(formData, 'am'),
    },
  });
}

export function parseSizesJson(value: string | undefined): Json[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('Sizes must be valid JSON array.');
  }
}

export function parseKeywords(value: string | undefined) {
  return value
    ? value
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [];
}

export function getOptionalFile(formData: FormData, name: string) {
  const value = formData.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

export function getOptionalFiles(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function uploadAdminCatalogAsset(
  supabase: AdminSupabase,
  userId: string,
  file: File | null,
  folder: string,
) {
  if (!file) return null;
  const extension = CATALOG_ASSET_EXTENSIONS[file.type];
  if (!extension) throw new Error('Upload PNG, JPG, WEBP, SVG, MP4, or WEBM files only.');
  if (file.size > CATALOG_ASSET_MAX_BYTES)
    throw new Error('Catalog media must be 50 MB or smaller.');

  return uploadToBucket(supabase, {
    bucket: 'catalog-assets',
    path: `${userId}/${folder}/${crypto.randomUUID()}.${extension}`,
    body: await file.arrayBuffer(),
    contentType: file.type,
  });
}

export async function ensureCatalogSlugIsAvailable(
  supabase: AdminSupabase,
  slug: string,
  currentId?: string,
) {
  let query = supabase.from('catalog_items').select('id').eq('slug', slug).limit(1);
  if (currentId) query = query.neq('id', currentId);
  const { data, error } = await query.maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  return !data;
}

export async function syncCatalogItemMedia(
  supabase: AdminSupabase,
  userId: string,
  catalogItemId: string,
  formData: FormData,
  thumbnailPath: string | null,
) {
  const { data: currentMedia, error: currentError } = await supabase
    .from('catalog_item_media')
    .select('id, storage_path, sort_order')
    .eq('catalog_item_id', catalogItemId)
    .returns<{ id: string; storage_path: string; sort_order: number }[]>();
  if (currentError) throw new Error(currentError.message);

  const removed = new Set(formData.getAll('mediaRemove').map(String));
  if (removed.size) {
    const { error } = await supabase
      .from('catalog_item_media')
      .delete()
      .eq('catalog_item_id', catalogItemId)
      .in('id', [...removed]);
    if (error) throw new Error(error.message);
  }

  const remainingMedia = (currentMedia ?? []).filter((media) => !removed.has(media.id));
  for (const media of remainingMedia) {
    const sortOrder = Number(formData.get(`mediaSort_${media.id}`) ?? media.sort_order);
    const altText = String(formData.get(`mediaAlt_${media.id}`) ?? '').trim() || null;
    const { error } = await supabase
      .from('catalog_item_media')
      .update({
        sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : media.sort_order,
        alt_text: altText,
        is_primary: false,
      })
      .eq('id', media.id)
      .eq('catalog_item_id', catalogItemId);
    if (error) throw new Error(error.message);
  }

  const uploadedRows = [];
  let nextSortOrder = Math.max(-1, ...remainingMedia.map((media) => media.sort_order)) + 1;
  for (const file of getOptionalFiles(formData, 'mediaFiles')) {
    const mediaType = getCatalogMediaKind(file.type);
    if (!mediaType) throw new Error('Upload PNG, JPG, WEBP, SVG, MP4, or WEBM files only.');
    const path = await uploadAdminCatalogAsset(
      supabase,
      userId,
      file,
      `items/${catalogItemId}/media`,
    );
    if (!path) continue;
    uploadedRows.push({
      catalog_item_id: catalogItemId,
      media_type: mediaType,
      storage_path: path,
      alt_text: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || null,
      sort_order: nextSortOrder++,
      is_primary: false,
      created_by: userId,
      metadata: {
        originalFileName: file.name,
        contentType: file.type,
        size: file.size,
      },
    });
  }

  if (
    thumbnailPath &&
    !(currentMedia ?? []).some((media) => media.storage_path === thumbnailPath)
  ) {
    uploadedRows.unshift({
      catalog_item_id: catalogItemId,
      media_type: 'image',
      storage_path: thumbnailPath,
      alt_text: null,
      sort_order: 0,
      is_primary: false,
      created_by: userId,
      metadata: { source: 'thumbnail' },
    });
  }

  if (uploadedRows.length) {
    const { error } = await supabase.from('catalog_item_media').insert(uploadedRows);
    if (error) throw new Error(error.message);
  }

  const { data: finalMedia, error: finalError } = await supabase
    .from('catalog_item_media')
    .select('id, sort_order')
    .eq('catalog_item_id', catalogItemId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<{ id: string; sort_order: number }[]>();
  if (finalError) throw new Error(finalError.message);

  const requestedPrimary = String(formData.get('mediaPrimary') ?? '');
  const primaryId = finalMedia?.some((media) => media.id === requestedPrimary)
    ? requestedPrimary
    : finalMedia?.[0]?.id;
  if (primaryId) {
    const { error: clearPrimaryError } = await supabase
      .from('catalog_item_media')
      .update({ is_primary: false })
      .eq('catalog_item_id', catalogItemId);
    if (clearPrimaryError) throw new Error(clearPrimaryError.message);

    const { error: primaryError } = await supabase
      .from('catalog_item_media')
      .update({ is_primary: true })
      .eq('id', primaryId)
      .eq('catalog_item_id', catalogItemId);
    if (primaryError) throw new Error(primaryError.message);
  }
}

/**
 * True unless the item is customizable with no usable generation source — a
 * System Prompt, Skill ID, a selected boilerplate, or the Solid engraving style
 * (which carries its own prompt).
 */
export function validatePersonalizationConfig(item: {
  isCustomizable: boolean;
  systemPrompt?: string;
  skillId?: string;
  boilerplateIds: string[];
  laserSolidEnabled?: boolean;
}) {
  if (!item.isCustomizable) return true;
  return (
    Boolean(item.systemPrompt) ||
    Boolean(item.skillId) ||
    item.boilerplateIds.length > 0 ||
    Boolean(item.laserSolidEnabled)
  );
}

/**
 * Validates the laser engraving configuration. Solid is opt-in and, when
 * enabled, requires its own price and prompt and always includes the base
 * Contour style. Returns an error message, or null when the config is valid.
 */
export function validateEngravingConfig(item: {
  laserContourEnabled: boolean;
  laserSolidEnabled: boolean;
  laserSolidPriceCents?: number;
  laserSolidPrompt?: string;
}): string | null {
  if (!item.laserSolidEnabled) return null;
  if (!item.laserContourEnabled) {
    return 'The Contour style is required whenever Solid scratching is offered.';
  }
  if (item.laserSolidPriceCents === undefined) {
    return 'Enter a price for the Solid scratching style.';
  }
  if (!item.laserSolidPrompt) {
    return 'Enter a generation prompt for the Solid scratching style.';
  }
  return null;
}

export async function syncCatalogItemBoilerplates(
  supabase: AdminSupabase,
  catalogItemId: string,
  boilerplateIds: string[],
) {
  const { error: deleteError } = await supabase
    .from('catalog_item_boilerplates')
    .delete()
    .eq('catalog_item_id', catalogItemId);
  if (deleteError) throw new Error(deleteError.message);
  if (!boilerplateIds.length) return;
  const { error } = await supabase.from('catalog_item_boilerplates').insert(
    boilerplateIds.map((boilerplateId, index) => ({
      catalog_item_id: catalogItemId,
      boilerplate_id: boilerplateId,
      sort_order: index,
    })),
  );
  if (error) throw new Error(error.message);
}
