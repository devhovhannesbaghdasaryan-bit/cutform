import { CurrencySwitcherClient } from '@/components/currency-switcher-client';
import { getTranslations } from 'next-intl/server';
import { getActiveCurrency, listEnabledCurrencies } from '@/lib/currency';

export async function CurrencySwitcher() {
  const [activeCurrency, currencies] = await Promise.all([
    getActiveCurrency(),
    listEnabledCurrencies(),
  ]);

  if (currencies.length <= 1) return null;
  const t = await getTranslations();

  return (
    <CurrencySwitcherClient
      activeCurrency={activeCurrency}
      currencies={currencies}
      label={t('nav.currency')}
    />
  );
}
