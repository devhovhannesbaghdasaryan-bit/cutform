import { unstable_noStore as noStore } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import type { AppLocale } from '@/lib/i18n';
import type { CatalogSeoMetadata } from '@/lib/seo';
import { resolveCatalogMarkets, resolveMarket } from '@/lib/market';

export const MARKETPLACE_CATEGORIES = [
  { slug: 'toys', name: 'Toys' },
  { slug: 'constructors', name: 'Constructors' },
  { slug: 'decorations', name: 'Decorations' },
  { slug: 'night-lights', name: 'Night lights' },
  { slug: 'banners', name: 'Banners' },
] as const;

export type MarketplaceCategorySlug = (typeof MARKETPLACE_CATEGORIES)[number]['slug'];

export interface MarketplaceCategory {
  id: string;
  slug: MarketplaceCategorySlug | string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface MarketplaceSubcategory {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  category: {
    slug: string;
    name: string;
  } | null;
}

export interface CatalogItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  is_popular: boolean;
  is_customizable: boolean;
  thumbnail_path: string | null;
  manufacturing_notes: string | null;
  created_at: string;
  subcategory_id?: string | null;
  item_type?: string;
  category: {
    slug: string;
    name: string;
  } | null;
  subcategory?: {
    slug: string;
    name: string;
  } | null;
  media?: CatalogItemMedia[];
}

export interface CatalogItemMedia {
  id: string;
  media_type: 'image' | 'video';
  storage_path: string;
  alt_text: string | null;
  poster_path: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface PersonalizationModel {
  id: string;
  title: string;
  slug: string;
  mock_image_path: string | null;
  boilerplate_image_path: string | null;
  form_schema: Record<string, unknown>;
  status: string;
  sort_order: number;
  category: {
    slug: string;
    name: string;
  } | null;
  subcategory: {
    slug: string;
    name: string;
  } | null;
}

export interface AdminCatalogFilters {
  status?: string;
  categorySlug?: string;
  query?: string;
}

const CATALOG_SELECT = `
  id,
  title,
  slug,
  description,
  price_cents,
  currency,
  is_popular,
  is_customizable,
  thumbnail_path,
  manufacturing_notes,
  created_at,
  subcategory_id,
  item_type,
  category:categories (
    slug,
    name
  ),
  subcategory:subcategories (
    slug,
    name
  ),
  media:catalog_item_media (
    id,
    media_type,
    storage_path,
    alt_text,
    poster_path,
    sort_order,
    is_primary
  )
`;

export async function listCategories() {
  noStore();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, description, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<MarketplaceCategory[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSubcategories(categorySlug?: string) {
  noStore();
  const supabase = await getServerSupabase();

  let query = supabase
    .from('subcategories')
    .select(
      `
        id,
        category_id,
        slug,
        name,
        description,
        sort_order,
        category:categories (
          slug,
          name
        )
      `,
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }

  const { data, error } = await query.returns<MarketplaceSubcategory[]>();
  if (error) throw new Error(error.message);

  return (data ?? []).filter((item) => !categorySlug || item.category?.slug === categorySlug);
}

export async function listPublishedCatalogItems(categorySlug?: string, subcategorySlug?: string) {
  noStore();
  const supabase = await getServerSupabase();

  let query = supabase
    .from('catalog_items')
    .select(CATALOG_SELECT)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }

  if (subcategorySlug) {
    query = query.eq('subcategories.slug', subcategorySlug);
  }

  const { data, error } = await query.returns<CatalogItem[]>();
  if (error) throw new Error(error.message);

  const categoryMatches = (data ?? []).filter((item) => {
    const matchesCategory = !categorySlug || item.category?.slug === categorySlug;
    const matchesSubcategory = !subcategorySlug || item.subcategory?.slug === subcategorySlug;
    return matchesCategory && matchesSubcategory;
  });
  const market = await resolveMarket();
  const resolutions = await resolveCatalogMarkets(categoryMatches.map((item) => item.id), market);
  return categoryMatches.filter((item) => resolutions.get(item.id)?.availability.available ?? true);
}

export async function listPopularCatalogItems(limit = 4) {
  noStore();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('catalog_items')
    .select(CATALOG_SELECT)
    .eq('status', 'published')
    .eq('is_popular', true)
    .order('created_at', { ascending: false })
    .returns<CatalogItem[]>();

  if (error) throw new Error(error.message);
  const items = data ?? [];
  const market = await resolveMarket();
  const resolutions = await resolveCatalogMarkets(items.map((item) => item.id), market);
  return items.filter((item) => resolutions.get(item.id)?.availability.available ?? true).slice(0, limit);
}

export async function getCatalogItem(slug: string) {
  noStore();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('catalog_items')
    .select(CATALOG_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle<CatalogItem>();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const market = await resolveMarket();
  const resolution = await resolveCatalogMarkets([data.id], market);
  return resolution.get(data.id)?.availability.available === false ? null : data;
}

export async function getCatalogItemById(id: string) {
  noStore();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('catalog_items')
    .select(CATALOG_SELECT)
    .eq('id', id)
    .maybeSingle<CatalogItem>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCatalogItemSeoMetadata(catalogItemId: string, locale: AppLocale) {
  noStore();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('catalog_item_seo_metadata')
    .select(
      'seo_title, seo_description, seo_slug, keywords, og_title, og_description, social_image_path, noindex',
    )
    .eq('catalog_item_id', catalogItemId)
    .eq('locale', locale)
    .maybeSingle<CatalogSeoMetadata>();

  if (error) throw new Error(error.message);
  return data;
}

export async function listPublishedPersonalizationModels({
  categorySlug,
  subcategorySlug,
}: {
  categorySlug?: string;
  subcategorySlug?: string;
} = {}) {
  noStore();
  const supabase = await getServerSupabase();

  let query = supabase
    .from('personalization_models')
    .select(
      `
        id,
        title,
        slug,
        mock_image_path,
        boilerplate_image_path,
        form_schema,
        status,
        sort_order,
        category:categories (
          slug,
          name
        ),
        subcategory:subcategories (
          slug,
          name
        )
      `,
    )
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (categorySlug) query = query.eq('categories.slug', categorySlug);
  if (subcategorySlug) query = query.eq('subcategories.slug', subcategorySlug);

  const { data, error } = await query.returns<PersonalizationModel[]>();
  if (error) throw new Error(error.message);

  return (data ?? []).filter((item) => {
    const matchesCategory = !categorySlug || item.category?.slug === categorySlug;
    const matchesSubcategory = !subcategorySlug || item.subcategory?.slug === subcategorySlug;
    return matchesCategory && matchesSubcategory;
  });
}

export async function getPublishedPersonalizationModel(slug: string) {
  noStore();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('personalization_models')
    .select(
      `
        id,
        title,
        slug,
        mock_image_path,
        boilerplate_image_path,
        form_schema,
        status,
        sort_order,
        category:categories (
          slug,
          name
        ),
        subcategory:subcategories (
          slug,
          name
        )
      `,
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle<PersonalizationModel>();

  if (error) throw new Error(error.message);
  return data;
}

export async function listAdminCatalogItems(filters: AdminCatalogFilters = {}) {
  noStore();
  const supabase = await getServerSupabase();

  let query = supabase
    .from('catalog_items')
    .select(CATALOG_SELECT)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.categorySlug) query = query.eq('categories.slug', filters.categorySlug);
  if (filters.query) query = query.ilike('title', `%${filters.query}%`);

  const { data, error } = await query.returns<CatalogItem[]>();
  if (error) throw new Error(error.message);

  return (data ?? []).filter(
    (item) => !filters.categorySlug || item.category?.slug === filters.categorySlug,
  );
}
