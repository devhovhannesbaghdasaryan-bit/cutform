export const CATEGORY_SLUGS = {
  toys: 'toys',
  constructors: 'constructors',
  decorations: 'decorations',
  nightLights: 'night-lights',
  banners: 'banners',
} as const;

export const SUBCATEGORY_SLUGS = {
  personalized: 'personalized',
} as const;

export const CATALOG_ITEM_STATUSES = ['draft', 'published', 'archived'] as const;
export type CatalogItemStatus = (typeof CATALOG_ITEM_STATUSES)[number];

export const PRODUCT_TYPES = [
  'night_light',
  'personalized_night_light',
  'laser_cut_2d_toy',
  'laser_cut_2d_decoration',
  'laser_cut_2d_constructor',
  'banner',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const ORDER_STATUSES = [
  'draft',
  'pending_payment',
  'paid',
  'review_required',
  'approved_for_production',
  'in_production',
  'ready_to_ship',
  'shipped',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PERSONALIZED_NIGHT_LIGHT = {
  maxImages: 1,
  maxTextLength: 80,
  defaultPriceCents: 2_500_000,
  defaultLedColor: 'warm_white',
  modelSlug: 'portrait-personalized-night-light',
  multiColorValue: 'multi_color',
  comfortableLedColors: [
    { value: 'warm_white', label: 'Warm white', hex: '#f7d7a1' },
    { value: 'soft_amber', label: 'Soft amber', hex: '#f4bf73' },
    { value: 'soft_peach', label: 'Soft peach', hex: '#f5b49f' },
    { value: 'mint', label: 'Mint', hex: '#a8dbc2' },
    { value: 'sky_blue', label: 'Sky blue', hex: '#9fcaea' },
  ],
} as const;

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
