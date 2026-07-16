import 'server-only';
import type { z } from 'zod';
import type { Json } from '@/lib/supabase/types';
import {
  type AdminSupabase,
  type itemSchema,
  ensureCatalogSlugIsAvailable,
  parseSizesJson,
  syncCatalogItemBoilerplates,
  syncCatalogItemMarketRules,
  syncCatalogItemMedia,
  upsertSeoMetadata,
  validateCategoryExists,
  validateEngravingConfig,
  validatePersonalizationConfig,
  validateSubcategoryBelongsToCategory,
} from '@/app/admin/items/item-form-parsing';

async function validateItemAndParseSizes(
  supabase: AdminSupabase,
  item: z.infer<typeof itemSchema>,
): Promise<Json[]> {
  const validCategory = await validateCategoryExists(supabase, item.categoryId);
  if (!validCategory) throw new Error('Selected category does not exist.');

  const validSubcategory = await validateSubcategoryBelongsToCategory(
    supabase,
    item.subcategoryId,
    item.categoryId,
  );
  if (!validSubcategory) throw new Error('Selected subcategory does not belong to category.');

  if (!validatePersonalizationConfig(item)) {
    throw new Error(
      'Customizable items need a System Prompt, a Skill ID, or at least one boilerplate.',
    );
  }

  const engravingError = validateEngravingConfig(item);
  if (engravingError) throw new Error(engravingError);

  try {
    return parseSizesJson(item.sizesJson);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid sizes.');
  }
}

function toCatalogItemRow(
  item: z.infer<typeof itemSchema>,
  sizes: Json[],
  thumbnailPath: string | null,
) {
  return {
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
    thumbnail_path: thumbnailPath ?? item.thumbnailPath ?? null,
    manufacturing_notes: item.manufacturingNotes ?? null,
    sizes,
    characteristics: item.characteristics ?? null,
    system_prompt: item.systemPrompt ?? null,
    skill_id: item.skillId ?? null,
    tags: item.tags,
    laser_contour_enabled: item.laserContourEnabled,
    laser_solid_enabled: item.laserSolidEnabled,
    laser_solid_price_cents: item.laserSolidEnabled ? (item.laserSolidPriceCents ?? null) : null,
    laser_solid_prompt: item.laserSolidEnabled ? (item.laserSolidPrompt ?? null) : null,
  };
}

export interface CreateCatalogItemCoreResult {
  id: string;
  slug: string;
}

/**
 * Shared insert path for a catalog item, used by both the admin form's
 * Server Action (real FormData for media/market-rules) and the MCP create
 * tool (omitted formData — an empty FormData means "no media edits beyond
 * the thumbnail, no market rules").
 */
export async function createCatalogItemCore(
  supabase: AdminSupabase,
  user: { id: string },
  item: z.infer<typeof itemSchema>,
  thumbnailPath: string | null,
  formData: FormData = new FormData(),
): Promise<CreateCatalogItemCoreResult> {
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug);
  if (!slugAvailable) throw new Error('Slug is already used by another item.');
  const sizes = await validateItemAndParseSizes(supabase, item);

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({ ...toCatalogItemRow(item, sizes, thumbnailPath), created_by: user.id })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create item.');

  await syncCatalogItemMedia(
    supabase,
    user.id,
    data.id,
    formData,
    thumbnailPath ?? item.thumbnailPath ?? null,
  );
  await syncCatalogItemBoilerplates(supabase, data.id, item.boilerplateIds);
  await upsertSeoMetadata(supabase, data.id, item, user.id);
  await syncCatalogItemMarketRules(supabase, data.id, formData);

  return { id: data.id, slug: item.slug };
}

/** Shared update path for a catalog item — see createCatalogItemCore for the formData default. */
export async function updateCatalogItemCore(
  supabase: AdminSupabase,
  id: string,
  user: { id: string },
  item: z.infer<typeof itemSchema>,
  thumbnailPath: string | null,
  formData: FormData = new FormData(),
): Promise<void> {
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug, id);
  if (!slugAvailable) throw new Error('Slug is already used by another item.');
  const sizes = await validateItemAndParseSizes(supabase, item);

  const { error } = await supabase
    .from('catalog_items')
    .update(toCatalogItemRow(item, sizes, thumbnailPath))
    .eq('id', id);
  if (error) throw new Error(error.message);

  await syncCatalogItemMedia(
    supabase,
    user.id,
    id,
    formData,
    thumbnailPath ?? item.thumbnailPath ?? null,
  );
  await syncCatalogItemBoilerplates(supabase, id, item.boilerplateIds);
  await upsertSeoMetadata(supabase, id, item, user.id);
  await syncCatalogItemMarketRules(supabase, id, formData);
}
