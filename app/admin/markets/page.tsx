import { Globe2, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  createMarketRegionAction,
  updateCountryMarketAction,
  updateMarketRegionAction,
} from '@/app/admin/markets/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requireAdminPermission } from '@/lib/admin';
import { listCurrencySettings } from '@/lib/currency';
import { getRequestLocale } from '@/lib/i18n-server';
import { getCountryDisplayName, listMarketGeography } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function AdminMarketsPage() {
  const { supabase } = await requireAdminPermission('catalog_manage');
  const [{ regions, countries }, currencies, t, locale] = await Promise.all([
    listMarketGeography(supabase),
    listCurrencySettings(supabase),
    getTranslations(),
    getRequestLocale(),
  ]);
  const countryName = (code: string) => getCountryDisplayName(code, locale);
  const currencyLabel = (code: string, isEnabled: boolean) =>
    isEnabled ? code : t('adminMarkets.disabledCurrency', { code });
  const activeRegions = regions.filter((region) => region.is_active);

  return (
    <main className="container max-w-6xl space-y-8 py-10">
      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6" />
          <h1 className="text-3xl font-bold tracking-tight">{t('adminMarkets.title')}</h1>
        </div>
        <p className="mt-2 text-muted-foreground">{t('adminMarkets.subtitle')}</p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">{t('adminMarkets.createRegion')}</h2>
        <form
          action={createMarketRegionAction}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <Input
            name="name"
            placeholder={t('adminMarkets.regionName')}
            aria-label={t('adminMarkets.regionName')}
            required
          />
          <Input
            name="slug"
            placeholder="region-slug"
            aria-label={t('adminMarkets.regionSlug')}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
          />
          <Button type="submit">
            <Plus className="mr-2 h-4 w-4" />
            {t('adminMarkets.addRegion')}
          </Button>
        </form>
      </section>

      <div className="space-y-4">
        {regions.map((region) => {
          const regionCountries = countries
            .filter((country) => country.region_id === region.id)
            .sort((a, b) => countryName(a.code).localeCompare(countryName(b.code)));
          const assignedDisabled =
            region.default_currency_code &&
            !currencies.find((currency) => currency.code === region.default_currency_code)
              ?.is_enabled;
          return (
            <details
              key={region.id}
              className="rounded-lg border bg-card"
              open={region.slug === 'asia'}
            >
              <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
                {region.name}{' '}
                <span className="font-normal text-muted-foreground">
                  ({regionCountries.length})
                </span>
              </summary>
              <div className="space-y-5 border-t p-5">
                <form
                  action={updateMarketRegionAction}
                  className="grid gap-3 md:grid-cols-[1fr_170px_100px_auto_auto]"
                >
                  <input type="hidden" name="id" value={region.id} />
                  <Input
                    name="name"
                    defaultValue={region.name}
                    aria-label={t('adminMarkets.regionName')}
                    required
                  />
                  <select
                    name="defaultCurrency"
                    defaultValue={region.default_currency_code ?? ''}
                    aria-label={t('adminMarkets.defaultCurrency')}
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">{t('adminMarkets.globalDefault')}</option>
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currencyLabel(currency.code, currency.is_enabled)}
                      </option>
                    ))}
                  </select>
                  <Input
                    name="sortOrder"
                    type="number"
                    defaultValue={region.sort_order}
                    aria-label={t('adminMarkets.sortOrder')}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input name="isActive" type="checkbox" defaultChecked={region.is_active} />
                    {t('adminMarkets.active')}
                  </label>
                  <Button type="submit" variant="outline">
                    {t('adminMarkets.saveRegion')}
                  </Button>
                </form>
                {assignedDisabled ? (
                  <p className="text-sm text-destructive">{t('adminMarkets.assignedDisabled')}</p>
                ) : null}

                <div className="divide-y rounded-md border">
                  {regionCountries.map((country) => (
                    <form
                      key={country.code}
                      action={updateCountryMarketAction}
                      className="grid gap-3 p-3 md:grid-cols-[minmax(180px,1fr)_220px_170px_auto] md:items-center"
                    >
                      <input type="hidden" name="code" value={country.code} />
                      <div>
                        <span className="font-medium">{countryName(country.code)}</span>{' '}
                        <span className="text-xs text-muted-foreground">{country.code}</span>
                      </div>
                      <select
                        name="regionId"
                        defaultValue={country.region_id}
                        aria-label={t('adminMarkets.countryRegion', {
                          country: countryName(country.code),
                        })}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        {activeRegions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="defaultCurrency"
                        defaultValue={country.default_currency_code ?? ''}
                        aria-label={t('adminMarkets.countryCurrency', {
                          country: countryName(country.code),
                        })}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="">{t('adminMarkets.inheritRegion')}</option>
                        {currencies.map((currency) => (
                          <option key={currency.code} value={currency.code}>
                            {currencyLabel(currency.code, currency.is_enabled)}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="ghost">
                        {t('common.save')}
                      </Button>
                    </form>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}
