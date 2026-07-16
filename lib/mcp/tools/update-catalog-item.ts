import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import type { itemSchema } from '@/app/admin/items/item-form-parsing';
import { updateCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';
import { getServiceSupabase } from '@/lib/supabase/server';

const seoLocaleInputShape = {
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
  seoKeywords: z.string().trim().optional(),
  ogTitle: z.string().trim().max(90).optional(),
  ogDescription: z.string().trim().max(220).optional(),
};

export const updateCatalogItemInputShape = {
  id: z.string().uuid().describe('The catalog item id returned by create_catalog_item.'),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  imageUrl: z.string().url().optional().describe('If given, replaces the thumbnail.'),
  priceCents: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  manufacturingNotes: z.string().trim().optional(),
  characteristics: z.string().trim().optional(),
  seo: z
    .object({
      en: z.object(seoLocaleInputShape),
      ru: z.object(seoLocaleInputShape),
      am: z.object(seoLocaleInputShape),
    })
    .optional(),
};

const updateCatalogItemInputSchema = z.object(updateCatalogItemInputShape);

export async function handleUpdateCatalogItem(
  rawInput: unknown,
  userId: string,
): Promise<{ id: string }> {
  const input = updateCatalogItemInputSchema.parse(rawInput);

  const supabase = getServiceSupabase();
  const allowed = await hasAdminPermission(userId, 'catalog_manage', supabase);
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const existing = await handleGetCatalogItem({ id: input.id }, userId);

  const thumbnailPath = input.imageUrl
    ? await fetchAndStoreCatalogImage(supabase, userId, input.imageUrl)
    : existing.thumbnail_path;

  const item: z.infer<typeof itemSchema> = {
    title: input.title ?? existing.title,
    slug: existing.slug,
    categoryId: input.categoryId ?? existing.category_id,
    subcategoryId: input.subcategoryId ?? existing.subcategory_id ?? '',
    itemType: 'standard',
    description: input.description ?? existing.description ?? undefined,
    priceCents: input.priceCents ?? existing.price_cents,
    status: existing.status as z.infer<typeof itemSchema>['status'],
    isPopular: false,
    isCustomizable: false,
    thumbnailPath: thumbnailPath ?? undefined,
    manufacturingNotes: input.manufacturingNotes ?? existing.manufacturing_notes ?? undefined,
    sizesJson: undefined,
    characteristics: input.characteristics ?? existing.characteristics ?? undefined,
    systemPrompt: undefined,
    skillId: undefined,
    tags: [],
    boilerplateIds: [],
    laserContourEnabled: false,
    laserSolidEnabled: false,
    laserSolidPriceCents: undefined,
    laserSolidPrompt: undefined,
    seo: {
      en: { ...(input.seo?.en ?? {}), socialImagePath: undefined },
      ru: { ...(input.seo?.ru ?? {}), socialImagePath: undefined },
      am: { ...(input.seo?.am ?? {}), socialImagePath: undefined },
    },
  };

  await updateCatalogItemCore(supabase, input.id, { id: userId }, item, thumbnailPath);

  return { id: input.id };
}
