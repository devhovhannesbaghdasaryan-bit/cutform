import { describe, expect, it } from 'vitest';
import { mapCatalogItemTypeToProductType } from '@/lib/marketplace-constants';

describe('mapCatalogItemTypeToProductType', () => {
  it('maps known item types to their product type', () => {
    expect(mapCatalogItemTypeToProductType('toy')).toBe('laser_cut_2d_toy');
    expect(mapCatalogItemTypeToProductType('decoration')).toBe('laser_cut_2d_decoration');
    expect(mapCatalogItemTypeToProductType('night_light')).toBe('night_light');
    expect(mapCatalogItemTypeToProductType('personalized_night_light')).toBe(
      'personalized_night_light',
    );
    expect(mapCatalogItemTypeToProductType('banner')).toBe('banner');
    expect(mapCatalogItemTypeToProductType('standard')).toBe('standard');
  });

  it('falls back to standard for an unknown item type', () => {
    expect(mapCatalogItemTypeToProductType('unknown_type')).toBe('standard');
  });
});
