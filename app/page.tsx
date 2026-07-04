import Link from 'next/link';
import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ArrowRight, BadgeCheck, PackageCheck, Sparkles } from 'lucide-react';
import { CategoryNavigation } from '@/components/category-navigation';
import { Button } from '@/components/ui/button';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { SvgRender } from '@/components/svg-render';
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
  const heroProducts = await loadHeroProducts();

  return (
    <>
      <MarketplaceHeader />
      <main>
        <section className="cyber-grid-surface overflow-hidden border-b">
          <div className="storefront-container grid min-h-[calc(100vh-5rem)] gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-center lg:py-14">
            <div className="min-w-0 space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/80 px-3 py-1 text-sm text-foreground shadow-sm">
                <Sparkles className="h-4 w-4 text-cyber-magenta" />
                {translate(locale, 'landing.eyebrow')}
              </div>
              <div className="space-y-4">
                <h1 className="mx-auto max-w-3xl break-words text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:mx-0 lg:text-6xl">
                  {translate(locale, 'landing.title')}
                </h1>
                <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0 md:text-xl">
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
                  <Link href="/personalize/portrait-personalized-night-light">
                    {translate(locale, 'landing.generate_custom')}
                  </Link>
                </Button>
              </div>
              <div className="grid gap-3 text-left sm:grid-cols-2 lg:max-w-xl">
                <div className="flex items-start gap-3 rounded-lg border bg-card/75 p-3 shadow-sm">
                  <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyber-yellow" />
                  <p className="text-sm text-muted-foreground">{translate(locale, 'catalog.subtitle')}</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border bg-card/75 p-3 shadow-sm">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <p className="text-sm text-muted-foreground">{translate(locale, 'generation.preview_disclaimer')}</p>
                </div>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="product-art-frame grid gap-3 p-3 shadow-xl shadow-cyber-cyan/10 sm:grid-cols-[1.15fr_0.85fr] sm:p-4">
                {heroProducts.map((product, index) => (
                  <article
                    key={product.title}
                    className={index === 0 ? 'hero-product-card sm:row-span-2' : 'hero-product-card'}
                  >
                    <div className={index === 0 ? 'h-full min-h-64' : 'h-36 sm:h-full'}>
                      <SvgRender svg={product.svg} className="h-full w-full p-5" />
                    </div>
                    <div className="absolute inset-x-3 bottom-3 rounded-md border bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
                      <p className="text-xs font-medium uppercase text-muted-foreground">{product.category}</p>
                      <p className="truncate text-sm font-semibold">{product.title}</p>
                    </div>
                  </article>
                ))}
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

async function loadHeroProducts() {
  const productRoot = path.join(process.cwd(), 'products');
  const loaded = await Promise.all([
    readHeroProduct(
      productRoot,
      'Modular plywood shelving',
      'CNC routed decor',
      'cnc-routed-wood-furniture-decor-fixtures',
      '01-modular-plywood-shelving',
    ),
    readHeroProduct(
      productRoot,
      'Personalized lithophane lamp',
      'Night lights',
      '3d-printed-products-parts-fixtures-custom-devices',
      '07-personalized-lithophane-lamps',
    ),
    readHeroProduct(
      productRoot,
      'Flat-pack laptop stand',
      'Desk gifts',
      'cnc-routed-wood-furniture-decor-fixtures',
      '04-flat-pack-laptop-stand',
    ),
  ]);

  return loaded.filter((item) => item.svg);
}

async function readHeroProduct(
  productRoot: string,
  title: string,
  category: string,
  group: string,
  slug: string,
) {
  return {
    title,
    category,
    svg: await readFile(path.join(productRoot, group, slug, 'assets', 'hero.svg'), 'utf8').catch(() => ''),
  };
}
