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
  validatePersonalizationConfig,
  validateSubcategoryBelongsToCategory,
} from '@/app/admin/items/item-form-parsing';
import { getOpenAiClient } from '@/lib/openai-client';
import { deleteSkillArtifact } from '@/lib/openai-skills';
import { removeFromBucket } from '@/lib/storage';

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
      'Customizable items need a System Prompt, a skill file, or at least one boilerplate.',
    );
  }

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
    skill_path: item.skillPath ?? null,
    tags: item.tags,
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

export interface UpdateCatalogItemCoreOptions {
  /**
   * Boilerplates and market rules are association tables this function
   * unconditionally re-syncs from `item.boilerplateIds`/`formData` — correct
   * for the admin form, which always submits the item's complete current
   * state. A caller that only has a partial patch (e.g. an MCP tool) must
   * pass `false` here, or every update would delete those associations by
   * re-syncing to an empty set. Defaults to `true` to preserve the admin
   * form's existing behavior unchanged.
   */
  syncAssociations?: boolean;
}

/** Shared update path for a catalog item — see createCatalogItemCore for the formData default. */
export async function updateCatalogItemCore(
  supabase: AdminSupabase,
  id: string,
  user: { id: string },
  item: z.infer<typeof itemSchema>,
  thumbnailPath: string | null,
  formData: FormData = new FormData(),
  options: UpdateCatalogItemCoreOptions = {},
): Promise<void> {
  const syncAssociations = options.syncAssociations ?? true;
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
  if (syncAssociations) {
    await syncCatalogItemBoilerplates(supabase, id, item.boilerplateIds);
    await syncCatalogItemMarketRules(supabase, id, formData);
  }
  await upsertSeoMetadata(supabase, id, item, user.id);
}

export interface CatalogItemDeleteRow {
  id: string;
  title: string;
  thumbnail_path: string | null;
  gallery_paths: string[] | null;
  skill_id: string | null;
}

export interface DeleteCatalogItemsResult {
  deleted: number;
  /** Items kept because an order references them, in the order they were selected. */
  blocked: { id: string; title: string }[];
}

/** Storage paths are only removable when they are bucket-relative, not already public URLs. */
function collectStoragePaths(
  items: CatalogItemDeleteRow[],
  media: { storage_path: string | null }[],
) {
  const paths = [
    ...items.flatMap((item) => [item.thumbnail_path, ...(item.gallery_paths ?? [])]),
    ...media.map((entry) => entry.storage_path),
  ];

  return [
    ...new Set(
      paths.filter(
        (path): path is string => Boolean(path) && !/^(https?:\/\/|\/)/i.test(path as string),
      ),
    ),
  ];
}

/**
 * Hard-deletes catalog items, skipping any that an order references.
 *
 * `order_items.catalog_item_id` carries no `ON DELETE` clause, so it defaults
 * to NO ACTION: including a referenced id in the single `.in()` delete would
 * raise 23503 and roll back the whole batch. Hence the pre-check — the
 * unreferenced items still go, and the caller reports the rest back.
 *
 * Child rows (media, translations, SEO, market rules, boilerplates) cascade;
 * cart and generated-item references are set to NULL by the schema.
 */
export async function deleteCatalogItemsCore(
  supabase: AdminSupabase,
  ids: string[],
): Promise<DeleteCatalogItemsResult> {
  if (ids.length === 0) return { deleted: 0, blocked: [] };

  const { data: items, error: itemsError } = await supabase
    .from('catalog_items')
    .select('id, title, thumbnail_path, gallery_paths, skill_id')
    .in('id', ids);
  if (itemsError) throw new Error(itemsError.message);

  // Postgres does not promise a row order for `.in()`, so re-order by the
  // caller's selection to keep the reported "kept" list stable.
  const byId = new Map(((items ?? []) as CatalogItemDeleteRow[]).map((item) => [item.id, item]));
  const found = ids
    .map((id) => byId.get(id))
    .filter((item): item is CatalogItemDeleteRow => item !== undefined);
  if (found.length === 0) return { deleted: 0, blocked: [] };
  const foundIds = found.map((item) => item.id);

  const { data: orderRefs, error: orderError } = await supabase
    .from('order_items')
    .select('catalog_item_id')
    .in('catalog_item_id', foundIds);
  if (orderError) throw new Error(orderError.message);

  const blockedIds = new Set((orderRefs ?? []).map((ref) => ref.catalog_item_id as string));
  const deletable = found.filter((item) => !blockedIds.has(item.id));
  const blocked = found
    .filter((item) => blockedIds.has(item.id))
    .map((item) => ({ id: item.id, title: item.title }));

  if (deletable.length === 0) return { deleted: 0, blocked };
  const deletableIds = deletable.map((item) => item.id);

  // Media rows cascade away with the item, so their paths must be read first.
  const { data: media } = await supabase
    .from('catalog_item_media')
    .select('catalog_item_id, storage_path')
    .in('catalog_item_id', deletableIds);

  const { error: deleteError } = await supabase
    .from('catalog_items')
    .delete()
    .in('id', deletableIds);
  if (deleteError) throw new Error(deleteError.message);

  // Cleanup is best-effort and runs only after the delete has committed.
  try {
    const paths = collectStoragePaths(
      deletable,
      (media ?? []) as { storage_path: string | null }[],
    );
    await removeFromBucket(supabase, 'catalog-assets', paths);

    for (const item of deletable) {
      if (item.skill_id) await deleteSkillArtifact(getOpenAiClient(), item.skill_id);
    }
  } catch (error) {
    console.error('[catalog-items] cleanup after delete failed', error);
  }

  return { deleted: deletable.length, blocked };
}
