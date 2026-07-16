import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import { ensureCatalogSlugIsAvailable, type itemSchema } from '@/app/admin/items/item-form-parsing';
import { createCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { getServerEnv } from '@/lib/env';
import { getServiceSupabase } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

const seoLocaleInputShape = {
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
  seoKeywords: z.string().trim().optional(),
  ogTitle: z.string().trim().max(90).optional(),
  ogDescription: z.string().trim().max(220).optional(),
};

export const createCatalogItemInputShape = {
  title: z.string().trim().min(1).describe('Short marketing product title. Write this yourself.'),
  description: z.string().trim().min(1).describe("The admin's source brief for the item."),
  imageUrl: z
    .string()
    .url()
    .describe('URL of a product photo. The server downloads and stores it as the thumbnail.'),
  priceCents: z.number().int().min(0).describe('Price in the smallest currency unit.'),
  categoryId: z.string().uuid().describe('A category id from list_categories.'),
  subcategoryId: z.string().uuid().optional().describe('A subcategory id from list_subcategories, if applicable.'),
  manufacturingNotes: z
    .string()
    .trim()
    .optional()
    .describe('Production-facing notes: materials, assembly, finish. Write this yourself.'),
  characteristics: z
    .string()
    .trim()
    .optional()
    .describe('Admin-only technical specs. Write this yourself.'),
  seo: z.object({
    en: z.object(seoLocaleInputShape).describe('English SEO metadata. Write this yourself.'),
    ru: z.object(seoLocaleInputShape).describe('Russian SEO metadata, adapted (not transliterated). Write this yourself.'),
    am: z.object(seoLocaleInputShape).describe('Armenian SEO metadata, adapted (not transliterated). Write this yourself.'),
  }),
};

const createCatalogItemInputSchema = z.object(createCatalogItemInputShape);

export interface CreateCatalogItemToolResult {
  id: string;
  slug: string;
  adminUrl: string;
}

export async function handleCreateCatalogItem(
  rawInput: unknown,
  userId: string,
): Promise<CreateCatalogItemToolResult> {
  const input = createCatalogItemInputSchema.parse(rawInput);

  const supabase = getServiceSupabase();
  const allowed = await hasAdminPermission(userId, 'catalog_manage', supabase);
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const thumbnailPath = await fetchAndStoreCatalogImage(supabase, userId, input.imageUrl);

  let slug = slugify(input.title);
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, slug);
  if (!slugAvailable) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

  const item: z.infer<typeof itemSchema> = {
    title: input.title,
    slug,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId ?? '',
    itemType: 'standard',
    description: input.description,
    priceCents: input.priceCents,
    status: 'draft',
    isPopular: false,
    isCustomizable: false,
    thumbnailPath: undefined,
    manufacturingNotes: input.manufacturingNotes,
    sizesJson: undefined,
    characteristics: input.characteristics,
    systemPrompt: undefined,
    skillId: undefined,
    tags: [],
    boilerplateIds: [],
    laserContourEnabled: false,
    laserSolidEnabled: false,
    laserSolidPriceCents: undefined,
    laserSolidPrompt: undefined,
    seo: {
      en: { ...input.seo.en, socialImagePath: undefined },
      ru: { ...input.seo.ru, socialImagePath: undefined },
      am: { ...input.seo.am, socialImagePath: undefined },
    },
  };

  const created = await createCatalogItemCore(supabase, { id: userId }, item, thumbnailPath);

  return {
    id: created.id,
    slug: created.slug,
    adminUrl: `${getServerEnv().NEXT_PUBLIC_SITE_URL}/admin/items/${created.id}`,
  };
}
