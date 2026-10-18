import { unstable_cache, unstable_noStore as noStore } from 'next/cache';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { retryTransient } from '@/lib/supabase/retry';
import type { AppLocale } from '@/lib/i18n';
import type { CatalogSeoMetadata } from '@/lib/seo';
import { resolveCatalogMarkets, resolveMarket } from '@/lib/market';
import type { MarketplaceCategorySlug } from '@/lib/marketplace-constants';

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
  system_prompt: string | null;
  skill_id: string | null;
  tags: string[];
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

const CATALOG_SELECT = `
  id,
  title,
  slug,
  description,
  price_cents,
  currency,
  is_popular,
  is_customizable,
  system_prompt,
  skill_id,
  tags,
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

// Categories/subcategories are admin-managed (via migrations, not a runtime
// admin UI) and change rarely, so a long revalidate window is fine. They use
// the service client (not getServerSupabase()) because unstable_cache
// callbacks cannot call the cookie-dependent dynamic APIs the request-scoped
// client relies on.
const getCachedCategories = unstable_cache(
  async () =>
    retryTransient(async () => {
      const supabase = getServiceSupabase();
      const { data, error } = await supabase
        .from('categories')
        .select('id, slug, name, description, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .returns<MarketplaceCategory[]>();

      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  ['catalog-categories'],
  { revalidate: 3600, tags: ['categories'] },
);

export async function listCategories() {
  return getCachedCategories();
}

// One published item's thumbnail per category, so category tiles can show a
// real product photo. Popular items win; categories without a photo are
// simply absent from the map.
const getCachedCategoryCovers = unstable_cache(
  async () =>
    retryTransient(async () => {
      const supabase = getServiceSupabase();
      const { data, error } = await supabase
        .from('catalog_items')
        .select('category_id, thumbnail_path, title')
        .eq('status', 'published')
        .not('thumbnail_path', 'is', null)
        .order('is_popular', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)
        .returns<{ category_id: string; thumbnail_path: string; title: string }[]>();
      if (error) throw new Error(error.message);
      const covers: Record<string, { path: string; title: string }> = {};
      for (const row of data ?? []) {
        if (!covers[row.category_id]) {
          covers[row.category_id] = { path: row.thumbnail_path, title: row.title };
        }
      }
      return covers;
    }),
  ['catalog-category-covers'],
  { revalidate: 300, tags: ['catalog-items'] },
);

/** Map of category id → a published item's thumbnail, for category tiles. */
export async function listCategoryCovers() {
  return getCachedCategoryCovers();
}

const getCachedSubcategories = unstable_cache(
  async (categorySlug: string | undefined) =>
    retryTransient(async () => {
      const supabase = getServiceSupabase();
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
    }),
  ['catalog-subcategories'],
  { revalidate: 3600, tags: ['subcategories'] },
);

export async function listSubcategories(categorySlug?: string) {
  return getCachedSubcategories(categorySlug);
}

export const CATALOG_PAGE_SIZE = 24;

// Cached, market-agnostic page of published items. Deliberately filters by
// category_id/subcategory_id (plain columns, using the existing
// catalog_items_published_category_idx / catalog_items_subcategory_idx
// indexes) rather than the embedded category/subcategory slug — PostgREST
// only applies a filter on an embedded resource to the parent rows with an
// `!inner` join, which the previous version didn't use, so that filter was
// silently a no-op and the whole (unfiltered, unpaginated) published catalog
// was fetched and filtered in JS on every request instead.
export type CatalogPersonalizationFilter = 'photo' | 'text' | 'none';
export type CatalogSort = 'popular' | 'newest' | 'price_asc' | 'price_desc';

export interface CatalogListOptions {
  search?: string;
  personalization?: CatalogPersonalizationFilter;
  sort?: CatalogSort;
}

const getCachedPublishedCatalogItemsPage = unstable_cache(
  async (
    categoryId: string | undefined,
    subcategoryId: string | undefined,
    offset: number,
    search: string | undefined,
    personalization: CatalogPersonalizationFilter | undefined,
    sort: CatalogSort,
  ) =>
    retryTransient(async () => {
      const supabase = getServiceSupabase();
      let query = supabase.from('catalog_items').select(CATALOG_SELECT).eq('status', 'published');

      if (sort === 'price_asc') query = query.order('price_cents', { ascending: true });
      else if (sort === 'price_desc') query = query.order('price_cents', { ascending: false });
      else if (sort === 'popular') query = query.order('is_popular', { ascending: false });
      query = query
        .order('created_at', { ascending: false })
        // Fetch one extra row so the caller can tell whether another page
        // exists without a separate COUNT(*) query.
        .range(offset, offset + CATALOG_PAGE_SIZE);

      if (categoryId) query = query.eq('category_id', categoryId);
      if (subcategoryId) query = query.eq('subcategory_id', subcategoryId);
      if (personalization === 'photo') query = query.contains('tags', ['personal_photo']);
      else if (personalization === 'text') query = query.contains('tags', ['personal_text']);
      else if (personalization === 'none') query = query.eq('is_customizable', false);
      if (search) {
        // Header search box: a plain title/description match is enough for a
        // catalog this size; PostgREST escapes the pattern itself.
        const pattern = `%${search.replace(/[%_]/g, '')}%`;
        query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
      }

      const { data, error } = await query.returns<CatalogItem[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  ['catalog-items-page'],
  { revalidate: 300, tags: ['catalog-items'] },
);

/**
 * A page of published catalog items, filtered by category/subcategory id and
 * the visitor's resolved market (country/region availability + shipping).
 * The DB fetch is cached and shared across visitors; market resolution reads
 * cookies so it stays per-request and runs after the cached fetch.
 */
export async function listPublishedCatalogItems(
  categoryId?: string,
  subcategoryId?: string,
  page = 1,
  options: CatalogListOptions = {},
) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * CATALOG_PAGE_SIZE;
  const normalizedSearch = options.search?.trim().slice(0, 80) || undefined;

  const rows = await getCachedPublishedCatalogItemsPage(
    categoryId,
    subcategoryId,
    offset,
    normalizedSearch,
    options.personalization,
    options.sort ?? 'popular',
  );
  const hasMore = rows.length > CATALOG_PAGE_SIZE;
  const pageItems = hasMore ? rows.slice(0, CATALOG_PAGE_SIZE) : rows;

  const market = await resolveMarket();
  const resolutions = await resolveCatalogMarkets(
    pageItems.map((item) => item.id),
    market,
  );
  const items = pageItems.filter(
    (item) => resolutions.get(item.id)?.availability.available ?? true,
  );

  return { items, page: safePage, hasMore };
}

const getCachedPublishedCatalogSlugs = unstable_cache(
  async () => {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('catalog_items')
      .select('slug')
      .eq('status', 'published')
      .returns<{ slug: string }[]>();
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['catalog-item-slugs'],
  { revalidate: 300, tags: ['catalog-items'] },
);

/** Every published item's slug, unpaginated — for the sitemap, not for rendering a page. */
export async function listPublishedCatalogItemSlugs() {
  return getCachedPublishedCatalogSlugs();
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
  const resolutions = await resolveCatalogMarkets(
    items.map((item) => item.id),
    market,
  );
  return items
    .filter((item) => resolutions.get(item.id)?.availability.available ?? true)
    .slice(0, limit);
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
