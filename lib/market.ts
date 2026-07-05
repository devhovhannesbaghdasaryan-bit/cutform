import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

// Writes always target COUNTRY_COOKIE; LEGACY_COUNTRY_COOKIE exists only as a
// read fallback for pre-rename visitors (Phase 17 rename).
export const COUNTRY_COOKIE = 'uq_country';
export const LEGACY_COUNTRY_COOKIE = 'snip_country';

export interface MarketRegion {
  id: string;
  slug: string;
  name: string;
  default_currency_code: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface MarketCountry {
  code: string;
  name: string;
  region_id: string;
  default_currency_code: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ResolvedMarket {
  countryCode: string | null;
  regionId: string | null;
  countryDefaultCurrency: string | null;
  regionDefaultCurrency: string | null;
  source: 'checkout' | 'cookie' | 'profile' | 'geo' | 'unknown';
}

export interface CatalogAvailability {
  itemId: string;
  visible: boolean;
  available: boolean;
  reason: 'available' | 'hidden' | 'shipping_unavailable' | 'country_unknown';
}

export interface ResolvedShippingRate {
  itemId: string;
  baseAmountCents: number | null;
  baseCurrency: 'AMD';
  source: 'country' | 'region' | 'missing';
  ruleId: string | null;
}

export interface CatalogMarketResolution {
  availability: CatalogAvailability;
  shipping: ResolvedShippingRate;
}

interface MarketRuleRow {
  id: string;
  catalog_item_id: string;
  region_id: string | null;
  country_code: string | null;
  visibility_override: boolean | null;
  shipping_rate_cents: number | null;
}

export function normalizeCountryCode(value: unknown) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function getCountryDisplayName(code: string, locale = 'en') {
  try {
    const displayLocale = locale === 'am' ? 'hy' : locale;
    return new Intl.DisplayNames([displayLocale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

async function findCountry(supabase: SupabaseClient, code: string) {
  const { data, error } = await supabase
    .from('countries')
    .select('code, region_id, default_currency_code, region:market_regions(default_currency_code, is_active)')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle<{
      code: string;
      region_id: string;
      default_currency_code: string | null;
      region: { default_currency_code: string | null; is_active: boolean } | null;
    }>();
  if (error) throw new Error(error.message);
  if (!data?.region?.is_active) return null;
  return data;
}

export async function resolveMarket(options: {
  checkoutCountryCode?: string | null;
  supabase?: SupabaseClient;
} = {}): Promise<ResolvedMarket> {
  const service = options.supabase ?? getServiceSupabase();
  const checkoutCode = normalizeCountryCode(options.checkoutCountryCode);
  if (checkoutCode) {
    const country = await findCountry(service, checkoutCode);
    if (!country) throw new Error('Choose a supported destination country.');
    return {
      countryCode: country.code,
      regionId: country.region_id,
      countryDefaultCurrency: country.default_currency_code,
      regionDefaultCurrency: country.region?.default_currency_code ?? null,
      source: 'checkout',
    };
  }

  const cookieStore = await cookies();
  const cookieCode = normalizeCountryCode(
    cookieStore.get(COUNTRY_COOKIE)?.value ?? cookieStore.get(LEGACY_COUNTRY_COOKIE)?.value,
  );
  if (cookieCode) {
    const country = await findCountry(service, cookieCode);
    if (country) return {
      countryCode: country.code,
      regionId: country.region_id,
      countryDefaultCurrency: country.default_currency_code,
      regionDefaultCurrency: country.region?.default_currency_code ?? null,
      source: 'cookie',
    };
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_country_code')
      .eq('user_id', user.id)
      .maybeSingle<{ preferred_country_code: string | null }>();
    const profileCode = normalizeCountryCode(profile?.preferred_country_code);
    if (profileCode) {
      const country = await findCountry(service, profileCode);
      if (country) return {
        countryCode: country.code,
        regionId: country.region_id,
        countryDefaultCurrency: country.default_currency_code,
        regionDefaultCurrency: country.region?.default_currency_code ?? null,
        source: 'profile',
      };
    }
  }

  const headerStore = await headers();
  const geoCode = normalizeCountryCode(
    headerStore.get('x-vercel-ip-country') ?? headerStore.get('cf-ipcountry'),
  );
  if (geoCode) {
    const country = await findCountry(service, geoCode);
    if (country) return {
      countryCode: country.code,
      regionId: country.region_id,
      countryDefaultCurrency: country.default_currency_code,
      regionDefaultCurrency: country.region?.default_currency_code ?? null,
      source: 'geo',
    };
  }

  return {
    countryCode: null,
    regionId: null,
    countryDefaultCurrency: null,
    regionDefaultCurrency: null,
    source: 'unknown',
  };
}

export async function listMarketGeography(supabase: SupabaseClient = getServiceSupabase()) {
  const [{ data: regions, error: regionError }, { data: countries, error: countryError }] = await Promise.all([
    supabase.from('market_regions').select('*').order('sort_order').returns<MarketRegion[]>(),
    supabase.from('countries').select('*').order('sort_order').order('code').returns<MarketCountry[]>(),
  ]);
  if (regionError) throw new Error(regionError.message);
  if (countryError) throw new Error(countryError.message);
  return { regions: regions ?? [], countries: countries ?? [] };
}

export async function resolveCatalogMarkets(
  itemIds: string[],
  market: ResolvedMarket,
  supabase: SupabaseClient = getServiceSupabase(),
) {
  const result = new Map<string, CatalogMarketResolution>();
  if (!itemIds.length) return result;

  if (!market.countryCode || !market.regionId) {
    for (const itemId of itemIds) {
      result.set(itemId, {
        availability: { itemId, visible: true, available: true, reason: 'country_unknown' },
        shipping: { itemId, baseAmountCents: null, baseCurrency: 'AMD', source: 'missing', ruleId: null },
      });
    }
    return result;
  }

  const { data, error } = await supabase
    .from('catalog_item_market_rules')
    .select('id, catalog_item_id, region_id, country_code, visibility_override, shipping_rate_cents')
    .in('catalog_item_id', itemIds)
    .or(`region_id.eq.${market.regionId},country_code.eq.${market.countryCode}`)
    .returns<MarketRuleRow[]>();
  if (error) throw new Error(error.message);

  for (const itemId of itemIds) {
    const itemRules = (data ?? []).filter((rule) => rule.catalog_item_id === itemId);
    const regionRule = itemRules.find((rule) => rule.region_id === market.regionId);
    const countryRule = itemRules.find((rule) => rule.country_code === market.countryCode);
    const visible = countryRule?.visibility_override
      ?? regionRule?.visibility_override
      ?? true;
    const shippingRule = countryRule?.shipping_rate_cents != null
      ? countryRule
      : regionRule?.shipping_rate_cents != null
        ? regionRule
        : null;
    const available = visible && Boolean(shippingRule);
    result.set(itemId, {
      availability: {
        itemId,
        visible,
        available,
        reason: !visible ? 'hidden' : shippingRule ? 'available' : 'shipping_unavailable',
      },
      shipping: {
        itemId,
        baseAmountCents: shippingRule?.shipping_rate_cents ?? null,
        baseCurrency: 'AMD',
        source: shippingRule?.country_code ? 'country' : shippingRule ? 'region' : 'missing',
        ruleId: shippingRule?.id ?? null,
      },
    });
  }
  return result;
}

export async function resolveCatalogMarket(
  itemId: string,
  market: ResolvedMarket,
  supabase?: SupabaseClient,
) {
  return (await resolveCatalogMarkets([itemId], market, supabase)).get(itemId)!;
}
