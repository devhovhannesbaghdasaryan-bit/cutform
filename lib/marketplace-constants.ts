export const MARKETPLACE_CATEGORIES = [
  { slug: 'toys', name: 'Toys' },
  { slug: 'constructors', name: 'Constructors' },
  { slug: 'decorations', name: 'Decorations' },
  { slug: 'night-lights', name: 'Night lights' },
  { slug: 'banners', name: 'Banners' },
] as const;

export type MarketplaceCategorySlug = (typeof MARKETPLACE_CATEGORIES)[number]['slug'];

export const PRODUCT_TYPES = [
  'night_light',
  'personalized_night_light',
  'laser_cut_2d_toy',
  'laser_cut_2d_decoration',
  'laser_cut_2d_constructor',
  'banner',
  'standard',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

const ITEM_TYPE_TO_PRODUCT_TYPE: Record<string, ProductType> = {
  standard: 'standard',
  toy: 'laser_cut_2d_toy',
  decoration: 'laser_cut_2d_decoration',
  night_light: 'night_light',
  personalized_night_light: 'personalized_night_light',
  banner: 'banner',
};

/** Maps a `catalog_items.item_type` value to the `generated_items.product_type` it should carry. */
export function mapCatalogItemTypeToProductType(itemType: string): ProductType {
  return ITEM_TYPE_TO_PRODUCT_TYPE[itemType] ?? 'standard';
}

export const BANNER_PRESETS = [
  {
    key: 'store-window-small',
    name: 'Store window small',
    widthMm: 600,
    heightMm: 300,
    material: 'vinyl',
    finish: 'matte',
  },
  {
    key: 'store-front-medium',
    name: 'Store front medium',
    widthMm: 1200,
    heightMm: 500,
    material: 'vinyl',
    finish: 'matte',
  },
  {
    key: 'promo-wide',
    name: 'Promo wide',
    widthMm: 2000,
    heightMm: 800,
    material: 'vinyl',
    finish: 'matte',
  },
] as const;

export const BANNER_CREDIT_COSTS = {
  customizeSample: 0,
  advancedGeneration: 5,
  adminSampleGeneration: 0,
} as const;

export const TOY_DECORATION_SIZE_PRESETS = [
  { key: 'small', label: 'Small', maxWidthMm: 150, maxHeightMm: 150 },
  { key: 'medium', label: 'Medium', maxWidthMm: 300, maxHeightMm: 300 },
  { key: 'large', label: 'Large', maxWidthMm: 600, maxHeightMm: 600 },
] as const;
