import { updateCurrencySettingsAction } from '@/app/admin/currencies/actions';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import type { AppCurrency } from '@/lib/currency';
import { APP_CURRENCIES } from '@/lib/currency';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface CurrencyRow {
  code: AppCurrency;
  name: string;
  symbol: string;
  is_enabled: boolean;
  is_default: boolean;
  payment_route: string;
  sort_order: number;
}

interface RateRow {
  base_currency: string;
  target_currency: string;
  rate: number;
  provider: string;
  rate_date: string;
  fetched_at: string;
  is_stale: boolean;
}

export default async function AdminCurrenciesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: currencies, error }, { data: rates }] = await Promise.all([
    supabase
      .from('currencies')
      .select('code, name, symbol, is_enabled, is_default, payment_route, sort_order')
      .order('sort_order', { ascending: true })
      .returns<CurrencyRow[]>(),
    supabase
      .from('exchange_rates')
      .select('base_currency, target_currency, rate, provider, rate_date, fetched_at, is_stale')
      .eq('base_currency', 'AMD')
      .in('target_currency', APP_CURRENCIES)
      .order('rate_date', { ascending: false })
      .order('fetched_at', { ascending: false })
      .limit(20)
      .returns<RateRow[]>(),
  ]);

  const latestRateByCurrency = new Map<string, RateRow>();
  for (const rate of rates ?? []) {
    if (!latestRateByCurrency.has(rate.target_currency)) {
      latestRateByCurrency.set(rate.target_currency, rate);
    }
  }

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Currencies</h1>
        <p className="text-muted-foreground">
          Manage enabled storefront currencies, payment routes, and daily exchange-rate cache status.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : (
        <form action={updateCurrencySettingsAction} className="space-y-6">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Enabled</th>
                  <th className="px-4 py-3 font-medium">Currency</th>
                  <th className="px-4 py-3 font-medium">Payment route</th>
                  <th className="px-4 py-3 font-medium">Latest AMD rate</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(currencies ?? []).map((currency) => {
                  const rate = latestRateByCurrency.get(currency.code);
                  return (
                    <tr key={currency.code} className="border-t">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          name="enabledCurrencies"
                          value={currency.code}
                          defaultChecked={currency.is_enabled}
                          disabled={currency.is_default}
                          className="h-4 w-4"
                        />
                        {currency.is_default ? (
                          <input type="hidden" name="enabledCurrencies" value={currency.code} />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {currency.code} {currency.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {currency.name}{currency.is_default ? ' · default' : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          name={`paymentRoute:${currency.code}`}
                          defaultValue={currency.payment_route === 'ameria' ? 'ameria' : 'bank_manual'}
                          className="h-9 rounded-md border border-input bg-background px-2"
                        >
                          <option value="ameria">Ameriabank</option>
                          <option value="bank_manual">Bank / manual</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {rate ? (
                          <>
                            <p className="font-medium">{Number(rate.rate).toFixed(6)}</p>
                            <p className="text-xs text-muted-foreground">
                              {rate.provider} · {formatDate(rate.fetched_at)}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rate?.is_stale ? (
                          <span className="bg-warning text-warning-foreground rounded-full px-2 py-1 text-xs font-medium">
                            Stale fallback
                          </span>
                        ) : rate ? (
                          <span className="bg-success/15 text-success rounded-full px-2 py-1 text-xs font-medium">
                            Cached
                          </span>
                        ) : (
                          <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                            No rate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Save currency settings</Button>
          </div>
        </form>
      )}
    </main>
  );
}
