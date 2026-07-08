'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { requireAdminPermission } from '@/lib/admin';
import { APP_LOCALES } from '@/lib/i18n';
import type { Json } from '@/lib/supabase/types';
import {
  type AdminSupabase,
  getOptionalFile,
  type itemSchema,
  parseItemForm,
  parseKeywords,
  parseSizesJson,
  ensureCatalogSlugIsAvailable,
  syncCatalogItemBoilerplates,
  syncCatalogItemMedia,
  uploadAdminCatalogAsset,
  validatePersonalizationConfig,
} from './item-form-parsing';

async function uploadCatalogFormAssets(
  supabase: AdminSupabase,
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

async function upsertSeoMetadata(
  supabase: AdminSupabase,
  catalogItemId: string,
  item: z.infer<typeof itemSchema>,
  userId: string,
) {
  const rows = APP_LOCALES.flatMap((locale) => {
    const seo = item.seo[locale];
    const hasSeo =
      seo.seoTitle ||
      seo.seoDescription ||
      seo.seoKeywords ||
      seo.ogTitle ||
      seo.ogDescription ||
      seo.socialImagePath;

    if (!hasSeo) return [];

    return [
      {
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
      },
    ];
  });

  if (!rows.length) return;

  const { error } = await supabase
    .from('catalog_item_seo_metadata')
    .upsert(rows, { onConflict: 'catalog_item_id,locale' });
  if (error) throw new Error(error.message);
}

async function validateSubcategoryBelongsToCategory(
  supabase: AdminSupabase,
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

async function validateCategoryExists(supabase: AdminSupabase, categoryId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function syncCatalogItemMarketRules(
  supabase: AdminSupabase,
  catalogItemId: string,
  formData: FormData,
) {
  const rows: Array<{
    catalog_item_id: string;
    region_id: string | null;
    country_code: string | null;
    visibility_override: boolean | null;
    shipping_rate_cents: number | null;
  }> = [];
  const targets = new Set<string>();
  for (const key of formData.keys()) {
    const match = /^market_(region|country)_([^_]+)_(visibility|shipping)$/.exec(key);
    if (match) targets.add(`${match[1]}:${match[2]}`);
  }
  for (const target of targets) {
    const [kind, id] = target.split(':') as ['region' | 'country', string];
    const visibilityValue = String(formData.get(`market_${kind}_${id}_visibility`) ?? '');
    const shippingValue = String(formData.get(`market_${kind}_${id}_shipping`) ?? '').trim();
    const visibility =
      visibilityValue === 'show' ? true : visibilityValue === 'hide' ? false : null;
    const shipping = shippingValue === '' ? null : Number(shippingValue);
    if (shipping != null && (!Number.isInteger(shipping) || shipping < 0)) {
      throw new Error('Shipping rates must be non-negative AMD minor-unit amounts.');
    }
    if (visibility == null && shipping == null) continue;
    rows.push({
      catalog_item_id: catalogItemId,
      region_id: kind === 'region' ? id : null,
      country_code: kind === 'country' ? id : null,
      visibility_override: visibility,
      shipping_rate_cents: shipping,
    });
  }
  const { error: deleteError } = await supabase
    .from('catalog_item_market_rules')
    .delete()
    .eq('catalog_item_id', catalogItemId);
  if (deleteError) throw new Error(deleteError.message);
  if (rows.length) {
    const { error } = await supabase.from('catalog_item_market_rules').insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function createCatalogItemAction(
  _prev: ActionState<null>,
  formData: FormData,
): Promise<ActionState<null>> {
  const parsed = parseItemForm(formData);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'Invalid item.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const item = parsed.data;
  const validCategory = await validateCategoryExists(supabase, item.categoryId);
  if (!validCategory) return actionError('Selected category does not exist.');
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug);
  if (!slugAvailable) return actionError('Slug is already used by another item.');
  const validSubcategory = await validateSubcategoryBelongsToCategory(
    supabase,
    item.subcategoryId,
    item.categoryId,
  );
  if (!validSubcategory) return actionError('Selected subcategory does not belong to category.');
  if (!validatePersonalizationConfig(item)) {
    return actionError(
      'Customizable items need a System Prompt, a Skill ID, or at least one boilerplate.',
    );
  }
  let sizes: Json[];
  try {
    sizes = parseSizesJson(item.sizesJson);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Invalid sizes.');
  }
  let uploadedAssets: { thumbnailPath: string | null };
  try {
    uploadedAssets = await uploadCatalogFormAssets(supabase, user.id, formData, item);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload catalog assets.');
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
      system_prompt: item.systemPrompt ?? null,
      skill_id: item.skillId ?? null,
      tags: item.tags,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) return actionError(error?.message ?? 'Failed to create item.');
  await syncCatalogItemMedia(
    supabase,
    user.id,
    data.id,
    formData,
    uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
  );
  await syncCatalogItemBoilerplates(supabase, data.id, item.boilerplateIds);
  await upsertSeoMetadata(supabase, data.id, item, user.id);
  await syncCatalogItemMarketRules(supabase, data.id, formData);

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  redirect(`/admin/items/${data.id}`);
}

export async function updateCatalogItemAction(
  _prev: ActionState<null>,
  formData: FormData,
): Promise<ActionState<null>> {
  const id = String(formData.get('id') ?? '');
  const idParse = z.uuid().safeParse(id);
  if (!idParse.success) return actionError('Invalid item id.');

  const parsed = parseItemForm(formData);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'Invalid item.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const item = parsed.data;
  const validCategory = await validateCategoryExists(supabase, item.categoryId);
  if (!validCategory) return actionError('Selected category does not exist.');
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug, id);
  if (!slugAvailable) return actionError('Slug is already used by another item.');
  const validSubcategory = await validateSubcategoryBelongsToCategory(
    supabase,
    item.subcategoryId,
    item.categoryId,
  );
  if (!validSubcategory) return actionError('Selected subcategory does not belong to category.');
  if (!validatePersonalizationConfig(item)) {
    return actionError(
      'Customizable items need a System Prompt, a Skill ID, or at least one boilerplate.',
    );
  }
  let sizes: Json[];
  try {
    sizes = parseSizesJson(item.sizesJson);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Invalid sizes.');
  }
  let uploadedAssets: { thumbnailPath: string | null };
  try {
    uploadedAssets = await uploadCatalogFormAssets(supabase, user.id, formData, item);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload catalog assets.');
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
      system_prompt: item.systemPrompt ?? null,
      skill_id: item.skillId ?? null,
      tags: item.tags,
    })
    .eq('id', id);

  if (error) return actionError(error.message);
  await syncCatalogItemMedia(
    supabase,
    user.id,
    id,
    formData,
    uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
  );
  await syncCatalogItemBoilerplates(supabase, id, item.boilerplateIds);
  await upsertSeoMetadata(supabase, id, item, user.id);
  await syncCatalogItemMarketRules(supabase, id, formData);

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  revalidatePath(`/admin/items/${id}`);
  return actionSuccess(null);
}
