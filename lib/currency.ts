import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { resolveMarket } from '@/lib/market';
import type { Json } from '@/lib/supabase/types';
import type { PaymentRoute } from '@/lib/payments/types';

export const APP_CURRENCIES = ['AMD', 'EUR', 'USD'] as const;
export type AppCurrency = (typeof APP_CURRENCIES)[number];

export const DEFAULT_CURRENCY: AppCurrency = 'AMD';
// Writes always target CURRENCY_COOKIE; LEGACY_CURRENCY_COOKIE exists only as
// a read fallback for pre-rename visitors (Phase 17 rename).
export const CURRENCY_COOKIE = 'uq_currency';
export const LEGACY_CURRENCY_COOKIE = 'snip_currency';

export type { PaymentRoute };

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
  source: 'identity' | 'cache' | 'provider' | 'inverse_cache' | 'cross_cache' | 'unconverted';
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

// Card currencies (USD/EUR) route to Ameriabank vPOS; AMD falls back to the
// manual/bank route. Live routing is DB-driven via getPaymentRoute() in
// lib/payments/router.ts; this pure currency→route helper backs unit tests.
function isCardCurrency(currency: AppCurrency) {
  return currency === 'USD' || currency === 'EUR';
}

export function getPaymentRouteForCurrency(currency: AppCurrency): PaymentRoute {
  return isCardCurrency(currency) ? 'ameria' : 'bank_manual';
}

export async function listCurrencySettings(supabase: SupabaseClient = getServiceSupabase()) {
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

function rowToContext(
  row: ExchangeRateRow,
  source: ExchangeRateContext['source'],
): ExchangeRateContext {
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

async function findCachedPairRate(
  supabase: SupabaseClient,
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
  rateDate?: string,
) {
  const direct = await findCachedRate(supabase, baseCurrency, targetCurrency, rateDate);
  if (direct) return { row: direct, source: 'cache' as const };

  const inverse = await findInverseCachedRate(supabase, baseCurrency, targetCurrency, rateDate);
  if (inverse) return { row: inverse, source: 'inverse_cache' as const };

  return null;
}

// Chains two cached legs through a third app currency (e.g. USD→AMD→EUR), for
// pairs that were never cached directly in either direction. The result is as
// old as its older leg.
async function findCrossCachedRate(
  supabase: SupabaseClient,
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
): Promise<ExchangeRateRow | null> {
  for (const pivot of APP_CURRENCIES) {
    if (pivot === baseCurrency || pivot === targetCurrency) continue;

    const first = await findCachedPairRate(supabase, baseCurrency, pivot);
    if (!first) continue;
    const second = await findCachedPairRate(supabase, pivot, targetCurrency);
    if (!second) continue;

    const older =
      Date.parse(first.row.fetched_at) <= Date.parse(second.row.fetched_at)
        ? first.row
        : second.row;
    return {
      base_currency: baseCurrency,
      target_currency: targetCurrency,
      rate: Number(first.row.rate) * Number(second.row.rate),
      provider:
        first.row.provider === second.row.provider
          ? first.row.provider
          : `${first.row.provider}+${second.row.provider}`,
      rate_date: older.rate_date,
      fetched_at: older.fetched_at,
      is_stale: true,
    };
  }

  return null;
}

export function buildRateProviderUrl(
  template: string,
  apiKey: string | undefined,
  base: string,
  target: string,
): string {
  return template
    .replace('{apiKey}', encodeURIComponent(apiKey ?? ''))
    .replace('{base}', encodeURIComponent(base))
    .replace('{target}', encodeURIComponent(target));
}

async function fetchProviderRate(baseCurrency: AppCurrency, targetCurrency: AppCurrency) {
  const env = getServerEnv();
  const provider = env.EXCHANGE_RATE_PROVIDER ?? 'open-er-api';
  const template = env.EXCHANGE_RATE_API_URL ?? 'https://open.er-api.com/v6/latest/{base}';
  const url = buildRateProviderUrl(
    template,
    env.EXCHANGE_RATE_API_KEY,
    baseCurrency,
    targetCurrency,
  );

  const usesApiKeyInUrl = template.includes('{apiKey}');
  const response = await fetch(url, {
    headers:
      env.EXCHANGE_RATE_API_KEY && !usesApiKeyInUrl
        ? { authorization: `Bearer ${env.EXCHANGE_RATE_API_KEY}` }
        : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Exchange-rate provider returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
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

  const cachedToday = await findCachedPairRate(
    supabase,
    baseCurrency,
    targetCurrency,
    todayIsoDate(),
  );
  if (cachedToday) return rowToContext(cachedToday.row, cachedToday.source);

  try {
    const fetched = await fetchProviderRate(baseCurrency, targetCurrency);
    const row = await insertRate(
      supabase,
      baseCurrency,
      targetCurrency,
      fetched.rate,
      fetched.provider,
      false,
      {
        source: 'provider',
        result: fetched.payload.result ?? null,
      },
    );
    return rowToContext(row, 'provider');
  } catch (error) {
    const cached = await findCachedPairRate(supabase, baseCurrency, targetCurrency);
    const cross = cached ? null : await findCrossCachedRate(supabase, baseCurrency, targetCurrency);
    const fallback = cached
      ? rowToContext(cached.row, cached.source)
      : cross
        ? rowToContext(cross, 'cross_cache')
        : null;
    if (!fallback) throw error;

    // Logged on every use so a dead provider shows up in runtime logs instead
    // of silently serving ever-older rates.
    console.warn(
      `[currency] ${baseCurrency}->${targetCurrency} provider fetch failed; using stale ${fallback.source} rate from ${fallback.rateDate}`,
      error instanceof Error ? error.message : error,
    );
    return { ...fallback, isStale: true };
  }
}

// Rate 1 back into the source currency, so the amount is shown as stored.
function unconvertedContext(currency: AppCurrency): ExchangeRateContext {
  const now = new Date().toISOString();
  return {
    baseCurrency: currency,
    targetCurrency: currency,
    rate: 1,
    provider: 'none',
    rateDate: now.slice(0, 10),
    fetchedAt: now,
    isStale: false,
    source: 'unconverted',
  };
}

/**
 * Display-only variant of getExchangeRate: when no rate can be resolved, the
 * amount stays in its source currency instead of failing the page. Never use it
 * for amounts that are charged or persisted — use getExchangeRate/convertMoney.
 */
export async function getDisplayExchangeRate(
  baseCurrency: AppCurrency,
  targetCurrency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ExchangeRateContext> {
  try {
    return await getExchangeRate(baseCurrency, targetCurrency, supabase);
  } catch (error) {
    console.error(
      `[currency] no ${baseCurrency}->${targetCurrency} rate; showing ${baseCurrency} prices unconverted`,
      error,
    );
    return unconvertedContext(baseCurrency);
  }
}

// Force-fetches a fresh provider rate, bypassing the same-day cache short-circuit
// in getExchangeRate. insertRate upserts on (base,target,rate_date) so a same-day
// refresh overwrites the cached value.
export async function refreshExchangeRate(
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
  const fetched = await fetchProviderRate(baseCurrency, targetCurrency);
  const row = await insertRate(
    supabase,
    baseCurrency,
    targetCurrency,
    fetched.rate,
    fetched.provider,
    false,
    { source: 'provider', refreshed: true },
  );
  return rowToContext(row, 'provider');
}

export function applyExchangeRate(
  amountCents: number,
  exchangeRateContext: ExchangeRateContext,
): ConvertedMoney {
  return {
    amountCents: Math.round(amountCents * exchangeRateContext.rate),
    currency: exchangeRateContext.targetCurrency,
    exchangeRateContext,
  };
}

export async function convertMoney(
  amountCents: number,
  fromCurrency: AppCurrency,
  toCurrency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ConvertedMoney> {
  const exchangeRateContext = await getExchangeRate(fromCurrency, toCurrency, supabase);
  return applyExchangeRate(amountCents, exchangeRateContext);
}

/** Display-only convertMoney; see getDisplayExchangeRate. */
export async function convertDisplayMoney(
  amountCents: number,
  fromCurrency: AppCurrency,
  toCurrency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<ConvertedMoney> {
  const exchangeRateContext = await getDisplayExchangeRate(fromCurrency, toCurrency, supabase);
  return applyExchangeRate(amountCents, exchangeRateContext);
}

/**
 * Fetches one rate per distinct source currency instead of once per caller, for
 * batch price display (e.g. catalog grids). Display-only: a currency with no
 * resolvable rate maps to an unconverted context (see getDisplayExchangeRate).
 */
export async function getExchangeRates(
  fromCurrencies: AppCurrency[],
  toCurrency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<Map<AppCurrency, ExchangeRateContext>> {
  const uniqueFromCurrencies = [...new Set(fromCurrencies)];
  const entries = await Promise.all(
    uniqueFromCurrencies.map(
      async (fromCurrency) =>
        [fromCurrency, await getDisplayExchangeRate(fromCurrency, toCurrency, supabase)] as const,
    ),
  );
  return new Map(entries);
}
