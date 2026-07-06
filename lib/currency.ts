import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { resolveMarket } from '@/lib/market';
import type { Json } from '@/lib/supabase/types';

export const APP_CURRENCIES = ['AMD', 'EUR', 'USD', 'RUB'] as const;
export type AppCurrency = (typeof APP_CURRENCIES)[number];

export const DEFAULT_CURRENCY: AppCurrency = 'AMD';
// Writes always target CURRENCY_COOKIE; LEGACY_CURRENCY_COOKIE exists only as
// a read fallback for pre-rename visitors (Phase 17 rename).
export const CURRENCY_COOKIE = 'uq_currency';
export const LEGACY_CURRENCY_COOKIE = 'snip_currency';

export type PaymentRoute = 'stripe' | 'bank_manual';

export interface CurrencySettings {
  code: AppCurrency;
  name: string;
  symbol: string;
  is_enabled: boolean;
  is_default: boolean;
  payment_route: PaymentRoute;
  sort_order: number;
}

export interface ExchangeRateContext extends Record<string, Json | undefined> {
  baseCurrency: AppCurrency;
  targetCurrency: AppCurrency;
  rate: number;
  provider: string;
  rateDate: string;
  fetchedAt: string;
  isStale: boolean;
  source: 'identity' | 'cache' | 'provider' | 'inverse_cache';
}

export interface ConvertedMoney {
  amountCents: number;
  currency: AppCurrency;
  exchangeRateContext: ExchangeRateContext;
}

interface ExchangeRateRow {
  base_currency: string;
  target_currency: string;
  rate: number;
  provider: string;
  rate_date: string;
  fetched_at: string;
  is_stale: boolean;
}

export function normalizeCurrency(value: unknown): AppCurrency | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return APP_CURRENCIES.includes(upper as AppCurrency) ? (upper as AppCurrency) : null;
}

export function isStripeCurrency(currency: AppCurrency) {
  return currency === 'USD' || currency === 'EUR';
}

export function getPaymentRouteForCurrency(currency: AppCurrency): PaymentRoute {
  return isStripeCurrency(currency) ? 'stripe' : 'bank_manual';
}

export async function listCurrencySettings(
  supabase: SupabaseClient = getServiceSupabase(),
) {
  const { data, error } = await supabase
    .from('currencies')
    .select('code, name, symbol, is_enabled, is_default, payment_route, sort_order')
    .order('sort_order', { ascending: true })
    .returns<CurrencySettings[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listEnabledCurrencies(supabase?: SupabaseClient) {
  const currencies = await listCurrencySettings(supabase);
  return currencies.filter((currency) => currency.is_enabled);
}

export async function getActiveCurrency() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

  const cookieStore = await cookies();
  const cookieCurrency = normalizeCurrency(
    cookieStore.get(CURRENCY_COOKIE)?.value ?? cookieStore.get(LEGACY_CURRENCY_COOKIE)?.value,
  );
  const enabled = await listEnabledCurrencies(supabase);
  const enabledCodes = new Set(enabled.map((currency) => currency.code));

  if (cookieCurrency && enabledCodes.has(cookieCurrency)) return cookieCurrency;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_currency')
      .eq('user_id', user.id)
      .maybeSingle<{ preferred_currency: string | null }>();
    const profileCurrency = normalizeCurrency(profile?.preferred_currency);
    if (profileCurrency && enabledCodes.has(profileCurrency)) return profileCurrency;
  }

  const market = await resolveMarket({ supabase: getServiceSupabase() });
  const countryCurrency = normalizeCurrency(market.countryDefaultCurrency);
  if (countryCurrency && enabledCodes.has(countryCurrency)) return countryCurrency;
  const regionCurrency = normalizeCurrency(market.regionDefaultCurrency);
  if (regionCurrency && enabledCodes.has(regionCurrency)) return regionCurrency;

  return enabled.find((currency) => currency.is_default)?.code ?? DEFAULT_CURRENCY;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function rowToContext(row: ExchangeRateRow, source: ExchangeRateContext['source']): ExchangeRateContext {
  return {
    baseCurrency: row.base_currency as AppCurrency,
    targetCurrency: row.target_currency as AppCurrency,
    rate: Number(row.rate),
    provider: row.provider,
    rateDate: row.rate_date,
    fetchedAt: row.fetched_at,
    isStale: row.is_stale,
    source,
  };
}

async function insertRate(
  supabase: SupabaseClient,
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
  rate: number,
  provider: string,
  isStale: boolean,
  metadata: Record<string, unknown> = {},
) {
  const rateDate = todayIsoDate();
  const { data, error } = await supabase
    .from('exchange_rates')
    .upsert(
      {
        base_currency: baseCurrency,
        target_currency: targetCurrency,
        rate,
        provider,
        rate_date: rateDate,
        fetched_at: new Date().toISOString(),
        is_stale: isStale,
        metadata,
      },
      { onConflict: 'base_currency,target_currency,rate_date' },
    )
    .select('base_currency, target_currency, rate, provider, rate_date, fetched_at, is_stale')
    .single<ExchangeRateRow>();

  if (error || !data) throw new Error(error?.message ?? 'Unable to cache exchange rate.');
  return data;
}

async function findCachedRate(
  supabase: SupabaseClient,
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
  rateDate?: string,
) {
  let query = supabase
    .from('exchange_rates')
    .select('base_currency, target_currency, rate, provider, rate_date, fetched_at, is_stale')
    .eq('base_currency', baseCurrency)
    .eq('target_currency', targetCurrency)
    .order('rate_date', { ascending: false })
    .order('fetched_at', { ascending: false })
    .limit(1);

  if (rateDate) query = query.eq('rate_date', rateDate);

  const { data, error } = await query.maybeSingle<ExchangeRateRow>();
  if (error) throw new Error(error.message);
  return data;
}

async function findInverseCachedRate(
  supabase: SupabaseClient,
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
  rateDate?: string,
) {
  const inverse = await findCachedRate(supabase, targetCurrency, baseCurrency, rateDate);
  if (!inverse) return null;

  return {
    ...inverse,
    base_currency: baseCurrency,
    target_currency: targetCurrency,
    rate: 1 / Number(inverse.rate),
  } satisfies ExchangeRateRow;
}

async function fetchProviderRate(baseCurrency: AppCurrency, targetCurrency: AppCurrency) {
  const env = getServerEnv();
  const provider = env.EXCHANGE_RATE_PROVIDER ?? 'open-er-api';
  const template = env.EXCHANGE_RATE_API_URL ?? 'https://open.er-api.com/v6/latest/{base}';
  const url = template
    .replace('{base}', encodeURIComponent(baseCurrency))
    .replace('{target}', encodeURIComponent(targetCurrency));

  const response = await fetch(url, {
    headers: env.EXCHANGE_RATE_API_KEY
      ? { authorization: `Bearer ${env.EXCHANGE_RATE_API_KEY}` }
      : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Exchange-rate provider returned ${response.status}.`);
  }

  const payload = await response.json() as {
    rates?: Record<string, number>;
    conversion_rates?: Record<string, number>;
    result?: string;
  };
  const rates = payload.rates ?? payload.conversion_rates;
  const rate = rates?.[targetCurrency];
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Exchange-rate provider did not return ${targetCurrency}.`);
  }

  return { provider, rate, payload };
}

export async function getExchangeRate(
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ExchangeRateContext> {
  if (baseCurrency === targetCurrency) {
    const row = await insertRate(supabase, baseCurrency, targetCurrency, 1, 'identity', false, {
      source: 'identity',
    });
    return rowToContext(row, 'identity');
  }

  const today = todayIsoDate();
  const cachedToday = await findCachedRate(supabase, baseCurrency, targetCurrency, today);
  if (cachedToday) return rowToContext(cachedToday, 'cache');

  const inverseToday = await findInverseCachedRate(supabase, baseCurrency, targetCurrency, today);
  if (inverseToday) return rowToContext(inverseToday, 'inverse_cache');

  try {
    const fetched = await fetchProviderRate(baseCurrency, targetCurrency);
    const row = await insertRate(supabase, baseCurrency, targetCurrency, fetched.rate, fetched.provider, false, {
      source: 'provider',
      result: fetched.payload.result ?? null,
    });
    return rowToContext(row, 'provider');
  } catch (error) {
    const cached = await findCachedRate(supabase, baseCurrency, targetCurrency);
    if (cached) return { ...rowToContext(cached, 'cache'), isStale: true };

    const inverse = await findInverseCachedRate(supabase, baseCurrency, targetCurrency);
    if (inverse) return { ...rowToContext(inverse, 'inverse_cache'), isStale: true };

    throw error;
  }
}

export async function convertMoney(
  amountCents: number,
  fromCurrency: AppCurrency,
  toCurrency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ConvertedMoney> {
  const exchangeRateContext = await getExchangeRate(fromCurrency, toCurrency, supabase);
  return {
    amountCents: Math.round(amountCents * exchangeRateContext.rate),
    currency: toCurrency,
    exchangeRateContext,
  };
}
