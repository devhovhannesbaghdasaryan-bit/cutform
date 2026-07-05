import { notFound } from 'next/navigation';
import { ItemForm } from '@/app/admin/items/item-form';
import { SeoMetadataManager } from '@/app/admin/seo-metadata-manager';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import type { AppLocale } from '@/lib/i18n';
import { getCountryDisplayName, listMarketGeography } from '@/lib/market';
import type { CatalogItemMedia } from '@/lib/marketplace';
import type { CatalogSeoMetadata } from '@/lib/seo';
import type { Tables } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type SeoMetadata = CatalogSeoMetadata &
  Pick<Tables<'catalog_item_seo_metadata'>, 'generated_by_ai' | 'reviewed_by_admin'> & {
    locale: AppLocale;
  };

type CatalogMedia = Omit<CatalogItemMedia, 'poster_path'>;

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
      .maybeSingle(),
    supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('subcategories')
      .select('id, name, category_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
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
      .eq('catalog_item_id', id),
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
