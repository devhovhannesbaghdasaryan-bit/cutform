import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: vi.fn(),
  getServerSupabase: vi.fn(),
  getServiceSupabase: vi.fn(),
}));

import { getDisplayExchangeRate, getExchangeRate, getExchangeRates } from '@/lib/currency';

interface RateRow {
  base_currency: string;
  target_currency: string;
  rate: number;
  provider: string;
  rate_date: string;
  fetched_at: string;
  is_stale: boolean;
}

function rate(base: string, target: string, value: number, date: string, provider = 'open-er-api') {
  return {
    base_currency: base,
    target_currency: target,
    rate: value,
    provider,
    rate_date: date,
    fetched_at: `${date}T00:30:00+00:00`,
    is_stale: false,
  } satisfies RateRow;
}

// Just enough of the exchange_rates query surface lib/currency uses: eq
// filters, latest-first ordering, maybeSingle, and upsert().select().single().
function fakeSupabase(rows: RateRow[]) {
  return {
    from(table: string) {
      if (table !== 'exchange_rates') throw new Error(`Unexpected table in test: ${table}`);
      const filters: Partial<RateRow> = {};
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (column: keyof RateRow, value: never) => {
          filters[column] = value;
          return builder;
        },
        maybeSingle: async () => {
          const matches = rows
            .filter((row) =>
              Object.entries(filters).every(([key, value]) => row[key as keyof RateRow] === value),
            )
            .sort((a, b) => b.rate_date.localeCompare(a.rate_date));
          return { data: matches[0] ?? null, error: null };
        },
        upsert: (row: RateRow) => {
          rows.push(row);
          return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
        },
      };
      return builder;
    },
  } as never;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv('EXCHANGE_RATE_API_URL', '');
  vi.stubEnv('EXCHANGE_RATE_PROVIDER', '');
  vi.stubEnv('EXCHANGE_RATE_API_KEY', '');
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchMock.mockResolvedValue(new Response('{"result":"error"}', { status: 403 }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getExchangeRate', () => {
  it('fetches from the keyless open.er-api endpoint by default', async () => {
    fetchMock.mockResolvedValue(Response.json({ result: 'success', rates: { EUR: 0.86 } }));

    const context = await getExchangeRate('USD', 'EUR', fakeSupabase([]));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.er-api.com/v6/latest/USD',
      expect.anything(),
    );
    expect(context).toMatchObject({ rate: 0.86, provider: 'open-er-api', source: 'provider' });
  });

  it('falls back to the latest cached rate for the pair when the provider fails', async () => {
    const supabase = fakeSupabase([rate('USD', 'AMD', 366, '2026-07-22')]);

    const context = await getExchangeRate('USD', 'AMD', supabase);

    expect(context).toMatchObject({ rate: 366, source: 'cache', isStale: true });
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('chains cached legs through a pivot currency when the pair was never cached', async () => {
    const supabase = fakeSupabase([
      rate('USD', 'AMD', 400, '2026-07-22'),
      rate('AMD', 'EUR', 0.0025, '2026-07-06', 'seed'),
    ]);

    const context = await getExchangeRate('USD', 'EUR', supabase);

    expect(context.source).toBe('cross_cache');
    expect(context.rate).toBeCloseTo(1);
    expect(context).toMatchObject({
      baseCurrency: 'USD',
      targetCurrency: 'EUR',
      provider: 'open-er-api+seed',
      rateDate: '2026-07-06',
      isStale: true,
    });
  });

  it('uses inverse legs when building a cross rate', async () => {
    const supabase = fakeSupabase([
      rate('USD', 'AMD', 400, '2026-07-22'),
      rate('EUR', 'AMD', 500, '2026-07-22'),
    ]);

    const context = await getExchangeRate('USD', 'EUR', supabase);

    expect(context.source).toBe('cross_cache');
    expect(context.rate).toBeCloseTo(0.8);
  });

  it('rethrows the provider error when nothing usable is cached', async () => {
    await expect(getExchangeRate('USD', 'EUR', fakeSupabase([]))).rejects.toThrow(
      'Exchange-rate provider returned 403.',
    );
  });
});

describe('display conversion', () => {
  it('keeps the source currency instead of throwing when no rate resolves', async () => {
    const context = await getDisplayExchangeRate('USD', 'EUR', fakeSupabase([]));

    expect(context).toMatchObject({
      baseCurrency: 'USD',
      targetCurrency: 'USD',
      rate: 1,
      source: 'unconverted',
    });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('getExchangeRates degrades per currency rather than failing the batch', async () => {
    const supabase = fakeSupabase([rate('AMD', 'EUR', 0.0024, '2026-07-06', 'seed')]);

    const rates = await getExchangeRates(['AMD', 'USD', 'USD'], 'EUR', supabase);

    expect(rates.get('AMD')).toMatchObject({ targetCurrency: 'EUR', source: 'cache' });
    expect(rates.get('USD')).toMatchObject({ targetCurrency: 'USD', source: 'unconverted' });
  });
});
