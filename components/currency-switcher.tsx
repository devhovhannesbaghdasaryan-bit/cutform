import { CurrencySwitcherClient } from '@/components/currency-switcher-client';
import { getActiveCurrency, listEnabledCurrencies } from '@/lib/currency';

export async function CurrencySwitcher() {
  const [activeCurrency, currencies] = await Promise.all([
    getActiveCurrency(),
    listEnabledCurrencies(),
  ]);

  if (currencies.length <= 1) return null;

  return <CurrencySwitcherClient activeCurrency={activeCurrency} currencies={currencies} />;
}
