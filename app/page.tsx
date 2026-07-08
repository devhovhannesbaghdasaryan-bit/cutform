import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, PackageCheck, Sparkles } from 'lucide-react';
import { CategoryNavigation } from '@/components/category-navigation';
import { Button } from '@/components/ui/button';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { getTranslations } from 'next-intl/server';
import { listCategories, listPopularCatalogItems, listSubcategories } from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { resolveCatalogMetadata } from '@/lib/seo';
import { applyExchangeRate, getActiveCurrency, getExchangeRates, normalizeCurrency } from '@/lib/currency';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = await getTranslations();
  return resolveCatalogMetadata({
    locale,
    path: '/',
    fallback: {
      title: t('landing.meta_title'),
      slug: '',
      description: t('landing.meta_description'),
    },
  });
}

export default async function LandingPage() {
  const locale = await getRequestLocale();
  const [popularItems, categories, subcategories, t] = await Promise.all([
    listPopularCatalogItems(4).catch(() => []),
    listCategories().catch(() => []),
    listSubcategories().catch(() => []),
    getTranslations(),
  ]);
  const activeCurrency = await getActiveCurrency();
  const exchangeRates = await getExchangeRates(
    popularItems.map((item) => normalizeCurrency(item.currency) ?? 'AMD'),
    activeCurrency,
  );

  return (
    <>
      <MarketplaceHeader />
      <main>
        <section className="cyber-grid-surface overflow-hidden border-b">
          <div className="storefront-container grid min-h-[calc(100vh-5rem)] gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-center lg:py-14">
            <div className="min-w-0 space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/80 px-3 py-1 text-sm text-foreground shadow-sm">
                <Sparkles className="h-4 w-4 text-cyber-magenta" />
                {t('landing.eyebrow')}
              </div>
              <div className="space-y-4">
                <h1 className="mx-auto max-w-3xl break-words text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:mx-0 lg:text-6xl">
                  {t('landing.title')}
                </h1>
                <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0 md:text-xl">
                  {t('landing.subtitle')}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg">
                  <Link href="/catalog">
                    {t('landing.browse_catalog')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-3 text-left sm:grid-cols-2 lg:max-w-xl">
                <div className="flex items-start gap-3 rounded-lg border bg-card/75 p-3 shadow-sm">
                  <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyber-yellow" />
                  <p className="text-sm text-muted-foreground">{t('catalog.subtitle')}</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border bg-card/75 p-3 shadow-sm">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <p className="text-sm text-muted-foreground">
                    {t('generation.preview_disclaimer')}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-lg border shadow-xl shadow-cyber-cyan/10">
              <Image
                src="/landing/landing.jpg"
                alt={t('landing.title')}
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-contain"
              />
            </div>
          </div>
        </section>

        <CategoryNavigation categories={categories} subcategories={subcategories} />

        <section className="storefront-section bg-muted/30">
          <div className="storefront-container space-y-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="storefront-heading">{t('landing.popular_title')}</h2>
                <p className="text-sm text-muted-foreground">{t('landing.popular_subtitle')}</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/catalog">{t('common.view_all')}</Link>
              </Button>
            </div>
            {popularItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                {t('landing.popular_empty')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {popularItems.map((item) => {
                  const fromCurrency = normalizeCurrency(item.currency) ?? 'AMD';
                  // biome-ignore lint/style/noNonNullAssertion: exchangeRates was built from these same items' currencies
                  const rate = exchangeRates.get(fromCurrency)!;
                  return (
                    <CatalogItemCard
                      key={item.id}
                      item={item}
                      locale={locale}
                      convertedPrice={applyExchangeRate(item.price_cents, rate)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
