import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CategoryNavigation } from '@/components/category-navigation';
import { Button } from '@/components/ui/button';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { translate } from '@/lib/i18n';
import { listCategories, listPopularCatalogItems, listSubcategories } from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { resolveCatalogMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return resolveCatalogMetadata({
    locale,
    path: '/',
    fallback: {
      title: translate(locale, 'landing.meta_title'),
      slug: '',
      description: translate(locale, 'landing.meta_description'),
    },
  });
}

export default async function LandingPage() {
  const locale = await getRequestLocale();
  const [popularItems, categories, subcategories] = await Promise.all([
    listPopularCatalogItems(4).catch(() => []),
    listCategories().catch(() => []),
    listSubcategories().catch(() => []),
  ]);

  return (
    <>
      <MarketplaceHeader />
      <main>
        <section className="overflow-hidden border-b bg-white">
          <div className="storefront-container grid min-h-[calc(100vh-5rem)] gap-10 py-12 lg:grid-cols-[1fr_560px] lg:items-center lg:py-16">
            <div className="min-w-0 space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                {translate(locale, 'landing.eyebrow')}
              </div>
              <div className="space-y-4">
                <h1 className="mx-auto max-w-3xl break-words text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:mx-0 lg:text-6xl">
                  {translate(locale, 'landing.title')}
                </h1>
                <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg lg:mx-0 md:text-xl">
                  {translate(locale, 'landing.subtitle')}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg">
                  <Link href="/catalog">
                    {translate(locale, 'landing.browse_catalog')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/create">{translate(locale, 'landing.generate_custom')}</Link>
                </Button>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="product-art-frame flex items-center justify-center p-4 shadow-sm sm:p-8">
                <div className="grid h-full w-full grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {translate(locale, 'landing.hero_night_lights')}
                    </p>
                    <div className="mt-6 h-24 rounded-full border bg-secondary" />
                  </div>
                  <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {translate(locale, 'landing.hero_banners')}
                    </p>
                    <div className="mt-6 h-20 rounded-md bg-primary" />
                  </div>
                  <div className="col-span-2 rounded-lg border bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {translate(locale, 'landing.hero_laser_gifts')}
                    </p>
                    <div className="mt-5 grid grid-cols-4 gap-3">
                      <span className="h-12 rounded-md bg-muted" />
                      <span className="h-12 rounded-md bg-muted" />
                      <span className="h-12 rounded-md bg-muted" />
                      <span className="h-12 rounded-md bg-muted" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CategoryNavigation categories={categories} subcategories={subcategories} locale={locale} />

        <section className="storefront-section bg-muted/30">
          <div className="storefront-container space-y-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="storefront-heading">{translate(locale, 'landing.popular_title')}</h2>
                <p className="text-sm text-muted-foreground">{translate(locale, 'landing.popular_subtitle')}</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/catalog">{translate(locale, 'common.view_all')}</Link>
              </Button>
            </div>
            {popularItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                {translate(locale, 'landing.popular_empty')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {popularItems.map((item) => (
                  <CatalogItemCard key={item.id} item={item} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
