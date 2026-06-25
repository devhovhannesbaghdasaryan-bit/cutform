'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin, requireAdminPermission } from '@/lib/admin';
import { getCatalogMediaKind } from '@/lib/catalog-media';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n';
import { TOY_DECORATION_SIZE_PRESETS } from '@/lib/marketplace-constants';
import { generateSeoMetadataDraft, type SeoMetadataDraft } from '@/lib/seo-ai';
import { adjustCredits } from '@/lib/credits';
import { writeAdminAuditLog } from '@/lib/transactions';

export type AdminFormState = { error: string | null };
export type SeoGenerationState = {
  error: string | null;
  draft: (SeoMetadataDraft & { socialImagePath?: string | null; seoSlug?: string | null }) | null;
  locale: AppLocale;
};

const localeSchema = z.enum(APP_LOCALES);
const CATALOG_ASSET_MAX_BYTES = 50 * 1024 * 1024;
const CATALOG_ASSET_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const seoLocaleSchema = z.object({
  seoTitle: z.string().trim().max(70, 'SEO title must be 70 characters or fewer.').optional(),
  seoDescription: z.string().trim().max(170, 'Meta description must be 170 characters or fewer.').optional(),
  seoKeywords: z.string().trim().refine(
    (value) => parseKeywords(value).length <= 10,
    'Use 10 SEO keywords or fewer.',
  ).optional(),
  ogTitle: z.string().trim().max(90, 'Open Graph title must be 90 characters or fewer.').optional(),
  ogDescription: z.string().trim().max(220, 'Open Graph description must be 220 characters or fewer.').optional(),
  socialImagePath: z.string().trim().optional(),
});

const itemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  slug: z.string().trim().min(1, 'Slug is required.').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a URL-safe slug.'),
  categoryId: z.string().uuid('Choose a category.'),
  subcategoryId: z.union([z.string().uuid(), z.literal('')]),
  itemType: z.enum(['standard', 'toy', 'decoration', 'night_light', 'personalized_night_light', 'banner']),
  description: z.string().trim().optional(),
  priceCents: z.coerce.number().int().min(0, 'Price cannot be negative.'),
  status: z.enum(['draft', 'published', 'archived']),
  isPopular: z.boolean(),
  isCustomizable: z.boolean(),
  thumbnailPath: z.string().trim().optional(),
  manufacturingNotes: z.string().trim().optional(),
  sizesJson: z.string().trim().optional(),
  characteristics: z.string().trim().optional(),
  seo: z.object({
    en: seoLocaleSchema,
    ru: seoLocaleSchema,
    am: seoLocaleSchema,
  }),
});

const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    'draft',
    'pending_payment',
    'paid',
    'review_required',
    'approved_for_production',
    'in_production',
    'ready_to_ship',
    'shipped',
    'cancelled',
    'refunded',
  ]),
  paymentStatus: z.enum(['unpaid', 'paid', 'refunded', 'failed']),
});

const userProfileSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'suspended', 'disabled']),
  preferredLocale: z.union([z.enum(['en', 'ru', 'am']), z.literal('')]),
  internalNotes: z.string().trim().optional(),
});

const creditAdjustmentSchema = z.object({
  userId: z.string().uuid(),
  direction: z.enum(['credit', 'debit']),
  amount: z.coerce.number().int().positive('Amount must be positive.'),
  reason: z.string().trim().min(3, 'Reason is required.'),
});

const toyDecorationGenerationSchema = z.object({
  targetCategory: z.enum(['toys', 'decorations']),
  prompt: z.string().trim().max(1000).optional(),
});

const seoGenerationSchema = z.object({
  catalogItemId: z.string().uuid(),
  locale: localeSchema,
  fields: z.array(z.enum([
    'seoTitle',
    'seoDescription',
    'keywords',
    'ogTitle',
    'ogDescription',
    'socialImagePath',
  ])).default([]),
});

const seoDraftSaveSchema = z.object({
  catalogItemId: z.string().uuid(),
  locale: localeSchema,
  seoSlug: z.string().trim().optional(),
  seoTitle: z.string().trim().optional(),
  seoDescription: z.string().trim().optional(),
  seoKeywords: z.string().trim().optional(),
  ogTitle: z.string().trim().optional(),
  ogDescription: z.string().trim().optional(),
  socialImagePath: z.string().trim().optional(),
});

function readSeoLocale(formData: FormData, locale: AppLocale): z.infer<typeof seoLocaleSchema> {
  return {
    seoTitle: String(formData.get(`seoTitle_${locale}`) ?? '').trim() || undefined,
    seoDescription: String(formData.get(`seoDescription_${locale}`) ?? '').trim() || undefined,
    seoKeywords: String(formData.get(`seoKeywords_${locale}`) ?? '').trim() || undefined,
    ogTitle: String(formData.get(`ogTitle_${locale}`) ?? '').trim() || undefined,
    ogDescription: String(formData.get(`ogDescription_${locale}`) ?? '').trim() || undefined,
    socialImagePath: String(formData.get(`socialImagePath_${locale}`) ?? '').trim() || undefined,
  };
}

function parseItemForm(formData: FormData) {
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
    seo: {
      en: readSeoLocale(formData, 'en'),
      ru: readSeoLocale(formData, 'ru'),
      am: readSeoLocale(formData, 'am'),
    },
  });
}

function parseSizesJson(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('Sizes must be valid JSON array.');
  }
}

function parseKeywords(value: string | undefined) {
  return value
    ? value.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    : [];
}

function getOptionalFile(formData: FormData, name: string) {
  const value = formData.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

function getOptionalFiles(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    || `draft-${crypto.randomUUID().slice(0, 8)}`;
}

function titleFromPrompt(prompt: string | undefined, fallback: string) {
  if (!prompt) return fallback;
  return prompt
    .split(/[.!?]/)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    || fallback;
}

function buildToyDecorationDraftMetadata(input: {
  categorySlug: 'toys' | 'decorations';
  prompt?: string;
  imagePath: string;
  referenceFileName?: string;
}) {
  const categoryLabel = input.categorySlug === 'toys' ? 'Toy' : 'Decoration';
  const title = titleFromPrompt(input.prompt, `${categoryLabel} draft from image`);
  const finish = input.categorySlug === 'toys' ? 'smooth child-safe finish pending review' : 'decorative finish pending review';
  const sizes = TOY_DECORATION_SIZE_PRESETS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    maxWidthMm: preset.maxWidthMm,
    maxHeightMm: preset.maxHeightMm,
    status: 'review_required',
  }));
  const description = input.prompt
    ? `Draft ${categoryLabel.toLowerCase()} candidate generated from admin prompt: ${input.prompt}`
    : `Draft ${categoryLabel.toLowerCase()} candidate generated from uploaded image metadata.`;
  const characteristics = [
    `Materials: unknown, review required. Suggested starting assumption is plywood, acrylic, or approved craft material based on final product intent.`,
    `Specifications: generated draft from ${input.imagePath}. Verify scale, part count, edge treatment, and hardware before publishing.`,
    `Dimensions: size presets are proposed only; exact width, height, depth, and tolerances are unknown until admin review.`,
    `Finish: ${finish}.`,
    `Construction details: review joints, small detachable parts, hanging holes, bases, slots, and assembly sequence.`,
    `Production assumptions: laser-cut or CNC-compatible flat parts may be possible, but tooling must be confirmed from final artwork.`,
    `Unknowns: material thickness, compliance constraints, finishing chemistry, package contents, and manufacturing time.`,
    `Reference file: ${input.referenceFileName ?? 'generated placeholder artwork'}.`,
  ].join('\n');

  return { title, description, sizes, characteristics };
}

async function uploadGeneratedCatalogSvg(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  userId: string,
  title: string,
  categorySlug: 'toys' | 'decorations',
) {
  const safeTitle = title.replace(/[<>&]/g, '').slice(0, 90);
  const accent = categorySlug === 'toys' ? '#2563eb' : '#be123c';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#f8fafc"/><rect x="120" y="120" width="960" height="660" rx="36" fill="${accent}"/><circle cx="420" cy="410" r="120" fill="#ffffff" opacity="0.9"/><rect x="560" y="300" width="260" height="220" rx="28" fill="#ffffff" opacity="0.9"/><text x="600" y="690" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">${safeTitle}</text></svg>`;
  const path = `${userId}/generated-catalog/${crypto.randomUUID()}.svg`;
  const { error } = await supabase.storage
    .from('catalog-assets')
    .upload(path, new TextEncoder().encode(svg), { contentType: 'image/svg+xml', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function uploadAdminCatalogAsset(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  userId: string,
  file: File | null,
  folder: string,
) {
  if (!file) return null;
  const extension = CATALOG_ASSET_EXTENSIONS[file.type];
  if (!extension) throw new Error('Upload PNG, JPG, WEBP, SVG, MP4, or WEBM files only.');
  if (file.size > CATALOG_ASSET_MAX_BYTES) throw new Error('Catalog media must be 50 MB or smaller.');

  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from('catalog-assets')
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return path;
}

async function syncCatalogItemMedia(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
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
    const path = await uploadAdminCatalogAsset(supabase, userId, file, `items/${catalogItemId}/media`);
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

  if (thumbnailPath && !(currentMedia ?? []).some((media) => media.storage_path === thumbnailPath)) {
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

async function uploadCatalogFormAssets(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  userId: string,
  formData: FormData,
  item: z.infer<typeof itemSchema>,
) {
  const thumbnailPath = await uploadAdminCatalogAsset(
    supabase,
    userId,
    getOptionalFile(formData, 'thumbnailFile'),
    'thumbnails',
  );

  for (const locale of APP_LOCALES) {
    const socialImagePath = await uploadAdminCatalogAsset(
      supabase,
      userId,
      getOptionalFile(formData, `socialImageFile_${locale}`),
      `seo/${locale}`,
    );
    if (socialImagePath) item.seo[locale].socialImagePath = socialImagePath;
  }

  return { thumbnailPath };
}

async function ensureCatalogSlugIsAvailable(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  slug: string,
  currentId?: string,
) {
  let query = supabase.from('catalog_items').select('id').eq('slug', slug).limit(1);
  if (currentId) query = query.neq('id', currentId);
  const { data, error } = await query.maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  return !data;
}

async function upsertSeoMetadata(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  catalogItemId: string,
  item: z.infer<typeof itemSchema>,
  userId: string,
) {
  const rows = APP_LOCALES.flatMap((locale) => {
    const seo = item.seo[locale];
    const hasSeo =
      seo.seoTitle
      || seo.seoDescription
      || seo.seoKeywords
      || seo.ogTitle
      || seo.ogDescription
      || seo.socialImagePath;

    if (!hasSeo) return [];

    return [{
      catalog_item_id: catalogItemId,
      locale,
      seo_title: seo.seoTitle ?? null,
      seo_description: seo.seoDescription ?? null,
      seo_slug: item.slug,
      keywords: parseKeywords(seo.seoKeywords),
      og_title: seo.ogTitle ?? null,
      og_description: seo.ogDescription ?? null,
      social_image_path: seo.socialImagePath ?? null,
      generated_by_ai: false,
      reviewed_by_admin: true,
      updated_by: userId,
    }];
  });

  if (!rows.length) return;

  const { error } = await supabase
    .from('catalog_item_seo_metadata')
    .upsert(rows, { onConflict: 'catalog_item_id,locale' });
  if (error) throw new Error(error.message);
}

async function validateSubcategoryBelongsToCategory(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  subcategoryId: string,
  categoryId: string,
) {
  if (!subcategoryId) return true;
  const { data, error } = await supabase
    .from('subcategories')
    .select('id')
    .eq('id', subcategoryId)
    .eq('category_id', categoryId)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function validateCategoryExists(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  categoryId: string,
) {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function createCatalogItemAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const parsed = parseItemForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid item.' };

  const { supabase, user } = await requireAdmin();
  const item = parsed.data;
  const validCategory = await validateCategoryExists(supabase, item.categoryId);
  if (!validCategory) return { error: 'Selected category does not exist.' };
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug);
  if (!slugAvailable) return { error: 'Slug is already used by another item.' };
  const validSubcategory = await validateSubcategoryBelongsToCategory(
    supabase,
    item.subcategoryId,
    item.categoryId,
  );
  if (!validSubcategory) return { error: 'Selected subcategory does not belong to category.' };
  let sizes: unknown[];
  try {
    sizes = parseSizesJson(item.sizesJson);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid sizes.' };
  }
  let uploadedAssets: { thumbnailPath: string | null };
  try {
    uploadedAssets = await uploadCatalogFormAssets(supabase, user.id, formData, item);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to upload catalog assets.' };
  }

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      title: item.title,
      slug: item.slug,
      category_id: item.categoryId,
      subcategory_id: item.subcategoryId || null,
      item_type: item.itemType,
      description: item.description ?? null,
      price_cents: item.priceCents,
      status: item.status,
      is_popular: item.isPopular,
      is_customizable: item.isCustomizable,
      thumbnail_path: uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
      manufacturing_notes: item.manufacturingNotes ?? null,
      sizes,
      characteristics: item.characteristics ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) return { error: error?.message ?? 'Failed to create item.' };
  await syncCatalogItemMedia(
    supabase,
    user.id,
    data.id,
    formData,
    uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
  );
  await upsertSeoMetadata(supabase, data.id, item, user.id);

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  redirect(`/admin/items/${data.id}`);
}

export async function generateToyDecorationDraftAction(formData: FormData) {
  const parsed = toyDecorationGenerationSchema.safeParse({
    targetCategory: formData.get('targetCategory'),
    prompt: formData.get('prompt') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid generation request.');

  const referenceFile = getOptionalFile(formData, 'referenceFile');
  if (!parsed.data.prompt && !referenceFile) {
    throw new Error('Enter a prompt or upload a reference image.');
  }

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', parsed.data.targetCategory)
    .maybeSingle<{ id: string }>();
  if (categoryError || !category) throw new Error(categoryError?.message ?? 'Target category was not found.');

  const uploadedReference = await uploadAdminCatalogAsset(
    supabase,
    user.id,
    referenceFile,
    `generated-catalog/${parsed.data.targetCategory}/references`,
  );
  const metadata = buildToyDecorationDraftMetadata({
    categorySlug: parsed.data.targetCategory,
    prompt: parsed.data.prompt,
    imagePath: uploadedReference ?? 'generated placeholder',
    referenceFileName: referenceFile?.name,
  });
  const generatedImagePath = parsed.data.prompt
    ? await uploadGeneratedCatalogSvg(supabase, user.id, metadata.title, parsed.data.targetCategory)
    : uploadedReference;

  if (!generatedImagePath) throw new Error('Unable to create a draft image.');

  let slug = slugify(metadata.title);
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, slug);
  if (!slugAvailable) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      title: metadata.title,
      slug,
      category_id: category.id,
      item_type: parsed.data.targetCategory === 'toys' ? 'toy' : 'decoration',
      description: metadata.description,
      price_cents: 0,
      status: 'draft',
      is_popular: false,
      is_customizable: false,
      thumbnail_path: generatedImagePath,
      manufacturing_notes: [
        'AI-assisted draft. Admin must review before publishing.',
        uploadedReference ? `Reference image: ${uploadedReference}` : null,
        parsed.data.prompt ? `Prompt: ${parsed.data.prompt}` : null,
      ].filter(Boolean).join('\n'),
      sizes: metadata.sizes,
      characteristics: metadata.characteristics,
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) throw new Error(error?.message ?? 'Unable to create generated draft.');
  await syncCatalogItemMedia(supabase, user.id, data.id, new FormData(), generatedImagePath);

  revalidatePath('/admin/items');
  revalidatePath('/admin/create');
  redirect(`/admin/items/${data.id}`);
}

export async function updateCatalogItemAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const id = String(formData.get('id') ?? '');
  const idParse = z.string().uuid().safeParse(id);
  if (!idParse.success) return { error: 'Invalid item id.' };

  const parsed = parseItemForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid item.' };

  const { supabase, user } = await requireAdmin();
  const item = parsed.data;
  const validCategory = await validateCategoryExists(supabase, item.categoryId);
  if (!validCategory) return { error: 'Selected category does not exist.' };
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug, id);
  if (!slugAvailable) return { error: 'Slug is already used by another item.' };
  const validSubcategory = await validateSubcategoryBelongsToCategory(
    supabase,
    item.subcategoryId,
    item.categoryId,
  );
  if (!validSubcategory) return { error: 'Selected subcategory does not belong to category.' };
  let sizes: unknown[];
  try {
    sizes = parseSizesJson(item.sizesJson);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid sizes.' };
  }
  let uploadedAssets: { thumbnailPath: string | null };
  try {
    uploadedAssets = await uploadCatalogFormAssets(supabase, user.id, formData, item);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to upload catalog assets.' };
  }

  const { error } = await supabase
    .from('catalog_items')
    .update({
      title: item.title,
      slug: item.slug,
      category_id: item.categoryId,
      subcategory_id: item.subcategoryId || null,
      item_type: item.itemType,
      description: item.description ?? null,
      price_cents: item.priceCents,
      status: item.status,
      is_popular: item.isPopular,
      is_customizable: item.isCustomizable,
      thumbnail_path: uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
      manufacturing_notes: item.manufacturingNotes ?? null,
      sizes,
      characteristics: item.characteristics ?? null,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  await syncCatalogItemMedia(
    supabase,
    user.id,
    id,
    formData,
    uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
  );
  await upsertSeoMetadata(supabase, id, item, user.id);

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  revalidatePath(`/admin/items/${id}`);
  return { error: null };
}

export async function generateCatalogItemSeoDraftAction(
  _prev: SeoGenerationState,
  formData: FormData,
): Promise<SeoGenerationState> {
  const fields = formData.getAll('fields').map(String);
  const parsed = seoGenerationSchema.safeParse({
    catalogItemId: formData.get('catalogItemId'),
    locale: formData.get('locale') || 'en',
    fields,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid SEO generation request.', draft: null, locale: 'en' };
  }

  const { supabase } = await requireAdminPermission('seo_manage');
  const { catalogItemId, locale } = parsed.data;
  const [{ data: item, error }, { data: existingSeo }] = await Promise.all([
    supabase
      .from('catalog_items')
      .select('id, title, slug, description, thumbnail_path, manufacturing_notes, characteristics, categories(name)')
      .eq('id', catalogItemId)
      .maybeSingle<{
        id: string;
        title: string;
        slug: string;
        description: string | null;
        thumbnail_path: string | null;
        manufacturing_notes: string | null;
        characteristics: string | null;
        categories: { name: string } | null;
      }>(),
    supabase
      .from('catalog_item_seo_metadata')
      .select('seo_title, seo_description, keywords, og_title, og_description, social_image_path, seo_slug')
      .eq('catalog_item_id', catalogItemId)
      .eq('locale', locale)
      .maybeSingle<{
        seo_title: string | null;
        seo_description: string | null;
        keywords: string[] | null;
        og_title: string | null;
        og_description: string | null;
        social_image_path: string | null;
        seo_slug: string | null;
      }>(),
  ]);

  if (error || !item) {
    return { error: error?.message ?? 'Item not found.', draft: null, locale };
  }

  const draft = await generateSeoMetadataDraft({
    title: item.title,
    description: item.description,
    categoryName: item.categories?.name ?? null,
    images: item.thumbnail_path ? [item.thumbnail_path] : [],
    productionNotes: item.manufacturing_notes,
    characteristics: item.characteristics,
    locale,
  });

  const selectedFields = parsed.data.fields.length
    ? new Set(parsed.data.fields)
    : new Set(['seoTitle', 'seoDescription', 'keywords', 'ogTitle', 'ogDescription', 'socialImagePath']);

  return {
    error: null,
    locale,
    draft: {
      seoTitle: selectedFields.has('seoTitle') ? draft.seoTitle : existingSeo?.seo_title ?? '',
      seoDescription: selectedFields.has('seoDescription') ? draft.seoDescription : existingSeo?.seo_description ?? '',
      keywords: selectedFields.has('keywords') ? draft.keywords : existingSeo?.keywords ?? [],
      ogTitle: selectedFields.has('ogTitle') ? draft.ogTitle : existingSeo?.og_title ?? '',
      ogDescription: selectedFields.has('ogDescription') ? draft.ogDescription : existingSeo?.og_description ?? '',
      socialImagePath: selectedFields.has('socialImagePath') ? item.thumbnail_path : existingSeo?.social_image_path ?? item.thumbnail_path,
      seoSlug: existingSeo?.seo_slug ?? item.slug,
    },
  };
}

export async function saveGeneratedCatalogItemSeoDraftAction(formData: FormData) {
  const parsed = seoDraftSaveSchema.safeParse({
    catalogItemId: formData.get('catalogItemId'),
    locale: formData.get('locale') || 'en',
    seoSlug: formData.get('seoSlug') || undefined,
    seoTitle: formData.get('seoTitle') || undefined,
    seoDescription: formData.get('seoDescription') || undefined,
    seoKeywords: formData.get('seoKeywords') || undefined,
    ogTitle: formData.get('ogTitle') || undefined,
    ogDescription: formData.get('ogDescription') || undefined,
    socialImagePath: formData.get('socialImagePath') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid SEO draft.');

  const { supabase, user } = await requireAdminPermission('seo_manage');
  const draft = parsed.data;
  const { data: item } = await supabase
    .from('catalog_items')
    .select('slug')
    .eq('id', draft.catalogItemId)
    .maybeSingle<{ slug: string }>();

  const { error } = await supabase.from('catalog_item_seo_metadata').upsert(
    {
      catalog_item_id: draft.catalogItemId,
      locale: draft.locale,
      seo_title: draft.seoTitle ?? null,
      seo_description: draft.seoDescription ?? null,
      seo_slug: draft.seoSlug || item?.slug || null,
      keywords: parseKeywords(draft.seoKeywords),
      og_title: draft.ogTitle ?? null,
      og_description: draft.ogDescription ?? null,
      social_image_path: draft.socialImagePath ?? null,
      generated_by_ai: true,
      reviewed_by_admin: true,
      updated_by: user.id,
    },
    { onConflict: 'catalog_item_id,locale' },
  );

  if (error) throw new Error(error.message);

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  revalidatePath(`/admin/items/${draft.catalogItemId}`);
}

export async function updateOrderStatusAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const parsed = orderStatusSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
    paymentStatus: formData.get('paymentStatus'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid order status.' };

  const { supabase } = await requireAdmin();
  const { orderId, status, paymentStatus } = parsed.data;
  const { error } = await supabase
    .from('orders')
    .update({ status, payment_status: paymentStatus })
    .eq('id', orderId);

  if (error) return { error: error.message };

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { error: null };
}

export async function updateAdminUserProfileAction(formData: FormData) {
  const parsed = userProfileSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
    status: formData.get('status'),
    preferredLocale: formData.get('preferredLocale'),
    internalNotes: formData.get('internalNotes') ?? undefined,
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid user update.');

  const { supabase, user } = await requireAdminPermission('users_manage');
  const values = parsed.data;

  const { data: before } = await supabase
    .from('profiles')
    .select('role, status, preferred_locale, internal_notes')
    .eq('user_id', values.userId)
    .maybeSingle<{
      role: string;
      status: string;
      preferred_locale: string | null;
      internal_notes: string | null;
    }>();

  const { error } = await supabase
    .from('profiles')
    .update({
      role: values.role,
      status: values.status,
      preferred_locale: values.preferredLocale || null,
      internal_notes: values.internalNotes ?? null,
    })
    .eq('user_id', values.userId);

  if (error) throw new Error(error.message);

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    targetUserId: values.userId,
    action: 'admin_user_profile_updated',
    entityType: 'profile',
    entityId: values.userId,
    reason: 'Admin profile update',
    metadata: { before, after: values },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${values.userId}`);
}

export async function adjustAdminUserCreditsAction(formData: FormData) {
  const parsed = creditAdjustmentSchema.safeParse({
    userId: formData.get('userId'),
    direction: formData.get('direction'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid credit adjustment.');
  }

  const { supabase, user } = await requireAdminPermission('balances_adjust');
  const values = parsed.data;
  const delta = values.direction === 'credit' ? values.amount : -values.amount;

  const result = await adjustCredits(supabase, {
    userId: values.userId,
    delta,
    reason: 'admin_adjustment',
    createdBy: user.id,
    transactionType: 'manual_adjustment',
    transactionStatus: 'succeeded',
    metadata: {
      adminReason: values.reason,
      direction: values.direction,
      balanceType: 'credits',
    },
  });

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    targetUserId: values.userId,
    action: 'admin_credit_balance_adjusted',
    entityType: 'credit_account',
    entityId: values.userId,
    reason: values.reason,
    metadata: {
      delta,
      balanceType: 'credits',
      balance: result.balance,
      ledgerId: result.ledgerId,
    },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${values.userId}`);
  revalidatePath('/admin/transactions');
}
