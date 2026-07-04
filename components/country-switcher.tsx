import { CountrySwitcherClient } from '@/components/country-switcher-client';
import { getCountryDisplayName, listMarketGeography, resolveMarket } from '@/lib/market';

export async function CountrySwitcher({ locale = 'en' }: { locale?: string }) {
  const [market, geography] = await Promise.all([
    resolveMarket(),
    listMarketGeography(),
  ]);
  const countries = geography.countries
    .filter((country) => country.is_active)
    .map((country) => ({ code: country.code, label: getCountryDisplayName(country.code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  if (!countries.length) return null;
  return (
    <CountrySwitcherClient
      activeCountry={market.countryCode ?? ''}
      countries={countries}
    />
  );
}
