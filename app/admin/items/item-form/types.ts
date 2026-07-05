import type { AppLocale } from '@/lib/i18n';
import type { MarketCountry, MarketRegion } from '@/lib/market';
import type { CatalogItemMedia, MarketplaceCategory, MarketplaceSubcategory } from '@/lib/marketplace';
import type { CatalogSeoMetadata } from '@/lib/seo';
import type { Tables } from '@/lib/supabase/types';

export type CategoryOption = Pick<MarketplaceCategory, 'id' | 'name'>;

export type SubcategoryOption = Pick<MarketplaceSubcategory, 'id' | 'name' | 'category_id'>;

export type SeoFormValue = Partial<CatalogSeoMetadata> &
  Partial<Pick<Tables<'catalog_item_seo_metadata'>, 'generated_by_ai' | 'reviewed_by_admin'>> & {
    locale?: AppLocale;
  };

export type ItemFormValue = Partial<
  Pick<
    Tables<'catalog_items'>,
    | 'id'
    | 'title'
    | 'slug'
    | 'category_id'
    | 'subcategory_id'
    | 'item_type'
    | 'description'
    | 'price_cents'
    | 'status'
    | 'is_popular'
    | 'is_customizable'
    | 'thumbnail_path'
    | 'manufacturing_notes'
    | 'sizes'
    | 'characteristics'
  >
>;

export type CatalogMediaFormValue = Omit<CatalogItemMedia, 'poster_path'>;

export type MarketRegionFormValue = Pick<MarketRegion, 'id' | 'name' | 'is_active'>;

export type MarketCountryFormValue = Pick<MarketCountry, 'code' | 'region_id' | 'is_active'> & {
  label: string;
};

export type MarketRuleFormValue = Pick<
  Tables<'catalog_item_market_rules'>,
  'id' | 'region_id' | 'country_code' | 'visibility_override' | 'shipping_rate_cents'
>;
