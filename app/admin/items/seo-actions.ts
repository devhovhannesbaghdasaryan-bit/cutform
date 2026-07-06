'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import type { AppLocale } from '@/lib/i18n';
import { generateSeoMetadataDraft, type SeoMetadataDraft } from '@/lib/seo-ai';
import { localeSchema, parseKeywords } from './item-form-parsing';

// Sanctioned exception to the ActionState convention (lib/action-state.ts):
// error states must still carry the submitted locale — the locale <select> in
// app/admin/seo-metadata-manager.tsx resets to `state.locale` after each action.
export type SeoGenerationState = {
  error: string | null;
  draft: (SeoMetadataDraft & { socialImagePath?: string | null; seoSlug?: string | null }) | null;
  locale: AppLocale;
};

const seoGenerationSchema = z.object({
  catalogItemId: z.uuid(),
  locale: localeSchema,
  fields: z
    .array(
      z.enum([
        'seoTitle',
        'seoDescription',
        'keywords',
        'ogTitle',
        'ogDescription',
        'socialImagePath',
      ]),
    )
    .default([]),
});

const seoDraftSaveSchema = z.object({
  catalogItemId: z.uuid(),
  locale: localeSchema,
  seoSlug: z.string().trim().optional(),
  seoTitle: z.string().trim().optional(),
  seoDescription: z.string().trim().optional(),
  seoKeywords: z.string().trim().optional(),
  ogTitle: z.string().trim().optional(),
  ogDescription: z.string().trim().optional(),
  socialImagePath: z.string().trim().optional(),
});

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
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid SEO generation request.',
      draft: null,
      locale: 'en',
    };
  }

  const { supabase } = await requireAdminPermission('seo_manage');
  const { catalogItemId, locale } = parsed.data;
  const [{ data: item, error }, { data: existingSeo }] = await Promise.all([
    supabase
      .from('catalog_items')
      .select(
        'id, title, slug, description, thumbnail_path, manufacturing_notes, characteristics, categories(name)',
      )
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
      .select(
        'seo_title, seo_description, keywords, og_title, og_description, social_image_path, seo_slug',
      )
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
    : new Set([
        'seoTitle',
        'seoDescription',
        'keywords',
        'ogTitle',
        'ogDescription',
        'socialImagePath',
      ]);

  return {
    error: null,
    locale,
    draft: {
      seoTitle: selectedFields.has('seoTitle') ? draft.seoTitle : (existingSeo?.seo_title ?? ''),
      seoDescription: selectedFields.has('seoDescription')
        ? draft.seoDescription
        : (existingSeo?.seo_description ?? ''),
      keywords: selectedFields.has('keywords') ? draft.keywords : (existingSeo?.keywords ?? []),
      ogTitle: selectedFields.has('ogTitle') ? draft.ogTitle : (existingSeo?.og_title ?? ''),
      ogDescription: selectedFields.has('ogDescription')
        ? draft.ogDescription
        : (existingSeo?.og_description ?? ''),
      socialImagePath: selectedFields.has('socialImagePath')
        ? item.thumbnail_path
        : (existingSeo?.social_image_path ?? item.thumbnail_path),
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
