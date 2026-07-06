import { describe, expect, it } from 'vitest';
import { getCatalogMediaKind, getPrimaryCatalogMedia, sortCatalogMedia } from '@/lib/catalog-media';
import { CREDIT_PACKS, getCreditPack } from '@/lib/credit-packs';
import { normalizeCurrency, getPaymentRouteForCurrency } from '@/lib/currency';
import type { CatalogItemMedia } from '@/lib/marketplace';

function media(overrides: Partial<CatalogItemMedia>): CatalogItemMedia {
  return {
    id: 'id',
    media_type: 'image',
    storage_path: 'path.png',
    alt_text: null,
    poster_path: null,
    sort_order: 0,
    is_primary: false,
    ...overrides,
  };
}

describe('getCatalogMediaKind', () => {
  it('maps known mime types', () => {
    expect(getCatalogMediaKind('image/png')).toBe('image');
    expect(getCatalogMediaKind('video/mp4')).toBe('video');
    expect(getCatalogMediaKind('application/pdf')).toBeNull();
  });
});

describe('sortCatalogMedia / getPrimaryCatalogMedia', () => {
  it('orders by sort_order, then primary flag, then id', () => {
    const items = [
      media({ id: 'b', sort_order: 1 }),
      media({ id: 'a', sort_order: 0 }),
      media({ id: 'c', sort_order: 1, is_primary: true }),
    ];
    expect(sortCatalogMedia(items).map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('prefers the primary item, falling back to the first', () => {
    const primary = media({ id: 'p', sort_order: 5, is_primary: true });
    expect(getPrimaryCatalogMedia([media({ id: 'x' }), primary])?.id).toBe('p');
    expect(getPrimaryCatalogMedia([media({ id: 'x' })])?.id).toBe('x');
    expect(getPrimaryCatalogMedia([])).toBeNull();
  });
});

describe('getCreditPack', () => {
  it('finds packs by key and rejects unknown keys', () => {
    expect(getCreditPack('starter')).toBe(CREDIT_PACKS[0]);
    expect(getCreditPack('nope')).toBeNull();
  });
});

describe('currency helpers', () => {
  it('normalizes currency codes case-insensitively', () => {
    expect(normalizeCurrency(' usd ')).toBe('USD');
    expect(normalizeCurrency('amd')).toBe('AMD');
    expect(normalizeCurrency('GBP')).toBeNull();
    expect(normalizeCurrency(42)).toBeNull();
  });

  it('routes card currencies to ameria and the rest to bank_manual', () => {
    expect(getPaymentRouteForCurrency('USD')).toBe('ameria');
    expect(getPaymentRouteForCurrency('EUR')).toBe('ameria');
    expect(getPaymentRouteForCurrency('AMD')).toBe('bank_manual');
    expect(getPaymentRouteForCurrency('RUB')).toBe('bank_manual');
  });
});
