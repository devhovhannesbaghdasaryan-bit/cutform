import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ComponentType } from 'react';
import { ArrowRight, Blocks, Check, Gift, Lamp, Megaphone, Puzzle, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { getTranslations } from 'next-intl/server';
import { tDynamic } from '@/lib/i18n-dynamic';
import { listCategories, listPopularCatalogItems } from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { resolveCatalogMetadata } from '@/lib/seo';
import {
  applyExchangeRate,
  getActiveCurrency,
  getExchangeRates,
  normalizeCurrency,
} from '@/lib/currency';

export const dynamic = 'force-dynamic';

const CATEGORY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  toys: Gift,
  constructors: Puzzle,
  decorations: Blocks,
  'night-lights': Lamp,
  banners: Megaphone,
};

/** The category whose items are generated from a customer photo. */
const CUSTOM_CATEGORY_SLUG = 'night-lights';

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
  const [popularItems, categories, t] = await Promise.all([
    listPopularCatalogItems(4).catch(() => []),
    listCategories().catch(() => []),
    getTranslations(),
  ]);
  const activeCurrency = await getActiveCurrency();
  const exchangeRates = await getExchangeRates(
    popularItems.map((item) => normalizeCurrency(item.currency) ?? 'AMD'),
    activeCurrency,
  );
  const trustLines = [
    t('landing.trust_preview'),
    t('landing.trust_review'),
    t('landing.trust_workshop'),
  ];
  const steps = [
    { title: t('landing.step1_title'), body: t('landing.step1_body') },
    { title: t('landing.step2_title'), body: t('landing.step2_body') },
    { title: t('landing.step3_title'), body: t('landing.step3_body') },
  ];

  return (
    <>
      <MarketplaceHeader />
      <main>
        {/* Hero */}
        <section className="overflow-hidden border-b">
          <div className="storefront-container flex flex-wrap items-center gap-x-12 gap-y-8 py-12 lg:py-14">
            <div className="flex min-w-0 max-w-[600px] flex-[1_1_440px] flex-col gap-6">
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-primary/40 bg-card px-3 py-1.5 text-sm font-semibold">
                <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                {t('landing.badge')}
              </span>
              <h1 className="break-words text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]">
                {t('landing.title')}
              </h1>
              <p className="max-w-[520px] text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {t('landing.subtitle')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-13 px-6 text-base font-bold">
                  <Link href="/catalog">
                    {t('landing.browse_catalog')}
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-13 px-5 text-base">
                  <Link href={`/catalog?category=${CUSTOM_CATEGORY_SLUG}`}>
                    <Lamp className="mr-2 size-4" />
                    {t('landing.cta_custom')}
                  </Link>
                </Button>
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-2.5 text-sm font-medium text-muted-foreground">
                {trustLines.map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="relative m-0 min-w-0 flex-[1_1_520px]">
              <Image
                src="/landing/hero.webp"
                alt={t('landing.hero_alt')}
                width={1536}
                height={1024}
                priority
                sizes="(min-width: 1024px) 640px, 100vw"
                className="aspect-[3/2] w-full rounded-2xl border object-cover"
              />
              <figcaption className="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl border bg-background/85 py-2.5 pl-2.5 pr-3.5 backdrop-blur">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
                >
                  <Scissors className="size-4" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold">{t('landing.chip_title')}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('landing.chip_subtitle')}
                  </span>
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* How custom night lights work */}
        <section id="custom" className="border-b bg-muted/30">
          <div className="storefront-container py-14">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div className="min-w-0 max-w-[620px]">
                <p className="mb-1.5 text-[13px] font-extrabold uppercase tracking-wider text-primary">
                  {t('landing.how_eyebrow')}
                </p>
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-[34px]">
                  {t('landing.how_title')}
                </h2>
              </div>
              <p className="max-w-[360px] text-[15px] text-muted-foreground">
                {t('landing.how_note')}
              </p>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-3.5 rounded-xl border bg-card p-5 sm:p-6"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-muted text-[15px] font-extrabold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-lg font-extrabold leading-snug">{step.title}</span>
                  <span className="text-[15px] text-muted-foreground">{step.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Categories */}
        <section id="categories" className="border-b">
          <div className="storefront-container py-14">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-[34px]">
                {t('landing.categories_title')}
              </h2>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-1.5 text-[15px] font-bold hover:text-primary"
              >
                {t('landing.categories_all')}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category.slug] ?? Gift;
                const isCustom = category.slug === CUSTOM_CATEGORY_SLUG;
                const name = tDynamic(t, `category.${category.slug}.name`, category.name);
                const description = tDynamic(
                  t,
                  `category.${category.slug}.description`,
                  category.description ?? '',
                );
                return (
                  <Link
                    key={category.id}
                    href={`/catalog?category=${category.slug}`}
                    className={`group flex min-w-0 flex-col gap-3 rounded-xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-md ${
                      isCustom ? 'border-2 border-primary bg-primary/5' : 'bg-card'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid aspect-square place-items-center rounded-lg text-primary ${
                        isCustom
                          ? 'bg-gradient-to-br from-primary/25 to-muted'
                          : 'bg-gradient-to-br from-muted to-muted/40'
                      }`}
                    >
                      <Icon className="size-11" />
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="break-words font-extrabold">{name}</span>
                      {isCustom ? (
                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground">
                          {t('landing.custom_tag')}
                        </span>
                      ) : null}
                    </span>
                    {description ? (
                      <span className="line-clamp-2 text-[13px] text-muted-foreground">
                        {description}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Popular items */}
        <section className="border-b bg-muted/30">
          <div className="storefront-container py-14">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-[34px]">
                  {t('landing.popular_title')}
                </h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">
                  {t('landing.popular_subtitle')}
                </p>
              </div>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-1.5 text-[15px] font-bold hover:text-primary"
              >
                {t('common.view_all')}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            {popularItems.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
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

        {/* Credits */}
        <section>
          <div className="storefront-container py-14">
            <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card px-6 py-7 sm:px-8">
              <div className="min-w-0 max-w-[640px]">
                <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-[26px]">
                  {t('landing.credits_title')}
                </h2>
                <p className="mt-2 text-[15px] text-muted-foreground">
                  {t('landing.credits_body')}
                </p>
              </div>
              <Button asChild size="lg" className="h-12 px-6 text-[15px] font-bold">
                <Link href="/credits">{t('landing.credits_cta')}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
