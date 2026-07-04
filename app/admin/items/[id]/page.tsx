import { notFound } from 'next/navigation';
import { ItemForm } from '@/app/admin/item-form';
import { SeoMetadataManager } from '@/app/admin/seo-metadata-manager';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import type { AppLocale } from '@/lib/i18n';
import { getCountryDisplayName, listMarketGeography } from '@/lib/market';

export const dynamic = 'force-dynamic';

interface EditableCatalogItem {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  subcategory_id: string | null;
  item_type: string;
  description: string | null;
  price_cents: number;
  status: string;
  is_popular: boolean;
  is_customizable: boolean;
  thumbnail_path: string | null;
  manufacturing_notes: string | null;
  sizes: unknown;
  characteristics: string | null;
}

interface SeoMetadata {
  locale: AppLocale;
  seo_slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  social_image_path: string | null;
  noindex: boolean;
  generated_by_ai: boolean;
  reviewed_by_admin: boolean;
}

interface CatalogMedia {
  id: string;
  media_type: 'image' | 'video';
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

export default async function EditAdminItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [
    { data: item, error },
    { data: categories },
    { data: subcategories },
    { data: seoRecords },
    { data: media },
    geography,
    { data: marketRules },
  ] = await Promise.all([
    supabase
      .from('catalog_items')
      .select(
        'id, title, slug, category_id, subcategory_id, item_type, description, price_cents, status, is_popular, is_customizable, thumbnail_path, manufacturing_notes, sizes, characteristics',
      )
      .eq('id', id)
      .maybeSingle<EditableCatalogItem>(),
    supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from('subcategories')
      .select('id, name, category_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<{ id: string; name: string; category_id: string }[]>(),
    supabase
      .from('catalog_item_seo_metadata')
      .select('locale, seo_slug, seo_title, seo_description, keywords, og_title, og_description, social_image_path, noindex, generated_by_ai, reviewed_by_admin')
      .eq('catalog_item_id', id)
      .order('locale', { ascending: true })
      .returns<SeoMetadata[]>(),
    supabase
      .from('catalog_item_media')
      .select('id, media_type, storage_path, alt_text, sort_order, is_primary')
      .eq('catalog_item_id', id)
      .order('sort_order', { ascending: true })
      .returns<CatalogMedia[]>(),
    listMarketGeography(supabase),
    supabase
      .from('catalog_item_market_rules')
      .select('id, region_id, country_code, visibility_override, shipping_rate_cents')
      .eq('catalog_item_id', id)
      .returns<{
        id: string;
        region_id: string | null;
        country_code: string | null;
        visibility_override: boolean | null;
        shipping_rate_cents: number | null;
      }[]>(),
  ]);

  if (error || !item) notFound();

  return (
    <main className="container max-w-4xl space-y-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit item</h1>
          <p className="text-muted-foreground">{item.title}</p>
        </div>
        {item.status === 'published' && (
          <Button asChild variant="outline">
            <a href={`/items/${item.slug}`} target="_blank" rel="noreferrer">
              View storefront page
            </a>
          </Button>
        )}
      </div>
      <ItemForm
        categories={categories ?? []}
        subcategories={subcategories ?? []}
        item={item}
        media={media ?? []}
        seoRecords={seoRecords ?? []}
        marketRegions={geography.regions}
        marketCountries={geography.countries.map((country) => ({ ...country, label: getCountryDisplayName(country.code) }))}
        marketRules={marketRules ?? []}
      />
      <SeoMetadataManager catalogItemId={item.id} />
    </main>
  );
}
