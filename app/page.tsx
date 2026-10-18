import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Coins,
  Eye,
  Lamp,
  Scissors,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { SiteFooter } from '@/components/site-footer';
import { getTranslations } from 'next-intl/server';
import { tDynamic } from '@/lib/i18n-dynamic';
import { listCategories, listCategoryCovers, listPopularCatalogItems } from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { resolveCatalogMetadata } from '@/lib/seo';
import { resolvePublicStorageUrl } from '@/lib/storage';
import {
  applyExchangeRate,
  getActiveCurrency,
  getExchangeRates,
  normalizeCurrency,
} from '@/lib/currency';

export const dynamic = 'force-dynamic';

/** The category whose items are generated from a customer photo. */
const CUSTOM_CATEGORY_SLUG = 'night-lights';
/** Categories engraved with the buyer's names and dates. */
const ENGRAVED_CATEGORY_SLUGS = new Set([
  'keepsake-boxes',
  'anniversary-gifts',
  'kitchen-and-dining',
]);

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
  const [popularItems, categories, covers, t] = await Promise.all([
    listPopularCatalogItems(8).catch(() => []),
    listCategories().catch(() => []),
    listCategoryCovers().catch(() => ({}) as Record<string, { path: string; title: string }>),
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
  const workshopFacts = [
    { icon: Eye, title: t('landing.trust_preview'), body: t('landing.trust_preview_body') },
    { icon: ShieldCheck, title: t('landing.trust_review'), body: t('landing.trust_review_body') },
    { icon: Truck, title: t('landing.trust_delivery'), body: t('landing.trust_delivery_body') },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <MarketplaceHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-36 -top-44 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--gold)/0.30),transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-60 -left-52 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.14),transparent)]"
          />
          <div className="storefront-container relative flex flex-wrap items-center gap-x-12 gap-y-8 py-14 lg:py-16">
            <div className="flex min-w-0 max-w-[600px] flex-[1_1_440px] flex-col gap-6">
              <span className="inline-flex items-center gap-2 self-start rounded-full border bg-card px-3 py-1.5 text-[13px] font-bold text-muted-foreground">
                <span aria-hidden="true" className="size-2 rounded-full bg-gold" />
                {t('landing.badge')}
              </span>
              <h1 className="break-words text-[34px] font-bold leading-[1.05] sm:text-5xl lg:text-[56px]">
                {t('landing.title')}
              </h1>
              <p className="max-w-[540px] text-lg leading-relaxed text-muted-foreground sm:text-[19px]">
                {t('landing.subtitle')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" variant="ink">
                  <Link href="/catalog">
                    {t('landing.browse_catalog')}
                    <ArrowRight className="size-[18px]" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="gold">
                  <Link href={`/catalog?category=${CUSTOM_CATEGORY_SLUG}`}>
                    <Lamp className="size-[18px]" aria-hidden="true" />
                    {t('landing.cta_custom')}
                  </Link>
                </Button>
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-2.5 text-sm font-semibold text-muted-foreground">
                {trustLines.map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <Check className="size-[18px] shrink-0 text-success" aria-hidden="true" />
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
                className="aspect-[3/2] w-full rounded-[20px] object-cover shadow-[0_24px_48px_rgba(20,23,28,0.18)]"
              />
              <figcaption className="absolute bottom-5 left-5 flex items-center gap-3 rounded-[14px] bg-slate/85 py-2.5 pl-2.5 pr-3.5 text-white backdrop-blur">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-gold text-gold-foreground"
                >
                  <Scissors className="size-5" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-bold">{t('landing.chip_title')}</span>
                  <span className="text-[12.5px] text-[#C9CED8]">{t('landing.chip_subtitle')}</span>
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Categories */}
        <section id="categories" className="border-b">
          <div className="storefront-container storefront-section">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <h2 className="storefront-heading">{t('landing.categories_title')}</h2>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:text-secondary-foreground"
              >
                {t('landing.categories_all')}
                <ArrowRight className="size-[18px]" aria-hidden="true" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-5">
              {categories.map((category) => {
                const isCustom = category.slug === CUSTOM_CATEGORY_SLUG;
                const isEngraved = ENGRAVED_CATEGORY_SLUGS.has(category.slug);
                const name = tDynamic(t, `category.${category.slug}.name`, category.name);
                const description = tDynamic(
                  t,
                  `category.${category.slug}.description`,
                  category.description ?? '',
                );
                const cover = covers[category.id];
                const coverUrl = cover
                  ? resolvePublicStorageUrl('catalog-assets', cover.path)
                  : null;
                return (
                  <Link
                    key={category.id}
                    href={`/catalog?category=${category.slug}`}
                    className="group flex min-w-0 flex-[1_1_280px] flex-col gap-2.5 text-foreground"
                  >
                    <span
                      className={`product-art-frame relative block aspect-[5/4] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_28px_rgba(20,23,28,0.16)] ${
                        isCustom ? 'outline outline-2 outline-offset-2 outline-gold' : ''
                      }`}
                    >
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={cover?.title ?? name}
                          fill
                          sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 100vw"
                          className="object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-white/70">
                          <Sparkles className="size-10" aria-hidden="true" />
                        </span>
                      )}
                      {isCustom ? (
                        <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-gold-foreground">
                          {t('landing.category_custom_tag')}
                        </span>
                      ) : isEngraved ? (
                        <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-gold-foreground">
                          {t('landing.category_engraved_tag')}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="break-words text-[17px] font-bold">{name}</span>
                      <ChevronRight
                        className="size-[18px] shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </span>
                    {description ? (
                      <span className="line-clamp-2 text-[13.5px] text-muted-foreground">
                        {description}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* How custom night lights work */}
        <section id="how" className="border-b bg-card">
          <div className="storefront-container storefront-section">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div className="min-w-0 max-w-[640px]">
                <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-secondary-foreground">
                  {t('landing.how_eyebrow')}
                </p>
                <h2 className="storefront-heading">{t('landing.how_title')}</h2>
              </div>
              <p className="max-w-[380px] text-[14.5px] text-muted-foreground">
                {t('landing.how_note')}
              </p>
            </div>
            <ol className="flex flex-wrap gap-5">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-xl border bg-background p-[18px]"
                >
                  {index === 0 ? (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2.5 rounded-[10px] border-2 border-dashed border-input bg-card text-center text-muted-foreground">
                      <Camera className="size-10 text-primary" aria-hidden="true" />
                      <span className="font-bold text-foreground">
                        {t('landing.step1_visual_title')}
                      </span>
                      <span className="text-[13px]">{t('landing.step1_visual_body')}</span>
                    </div>
                  ) : index === 1 ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-slate">
                      <Image
                        src="/landing/hero.webp"
                        alt={t('landing.step2_visual_alt')}
                        fill
                        sizes="(min-width: 1024px) 400px, 100vw"
                        className="origin-[92%_40%] scale-[2.4] object-cover"
                      />
                      <span className="absolute bottom-3 left-3 inline-flex h-[30px] items-center gap-1.5 rounded-full bg-slate/85 px-3 text-xs font-bold text-white">
                        <Sparkles className="size-4 text-gold" aria-hidden="true" />
                        {t('landing.step2_visual_chip')}
                      </span>
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2.5 rounded-[10px] bg-slate p-4 text-center text-white">
                      <ShieldCheck className="size-10 text-gold" aria-hidden="true" />
                      <span className="font-bold">{t('landing.step3_visual_title')}</span>
                      <span className="text-[13px] text-[#C9CED8]">
                        {t('landing.step3_visual_body')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-foreground font-display text-[15px] font-extrabold text-gold">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold leading-snug">{step.title}</h3>
                      <p className="mt-1 text-[14.5px] text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href={`/catalog?category=${CUSTOM_CATEGORY_SLUG}`}>
                  {t('landing.how_cta')}
                  <ArrowRight className="size-[18px]" aria-hidden="true" />
                </Link>
              </Button>
              <span className="text-sm text-muted-foreground">{t('landing.how_cta_note')}</span>
            </div>
          </div>
        </section>

        {/* Popular items */}
        <section className="border-b">
          <div className="storefront-container storefront-section">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <h2 className="storefront-heading">{t('landing.popular_title')}</h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">
                  {t('landing.popular_subtitle')}
                </p>
              </div>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:text-secondary-foreground"
              >
                {t('common.view_all')}
                <ArrowRight className="size-[18px]" aria-hidden="true" />
              </Link>
            </div>
            {popularItems.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                {t('landing.popular_empty')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* The workshop */}
        <section className="bg-slate text-white">
          <div className="storefront-container flex flex-wrap items-center gap-x-16 gap-y-10 py-16">
            <div className="min-w-0 max-w-[560px] flex-[1_1_380px]">
              <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-gold">
                {t('landing.workshop_eyebrow')}
              </p>
              <h2 className="storefront-heading">{t('landing.workshop_title')}</h2>
              <p className="mt-3.5 text-base leading-relaxed text-[#C9CED8]">
                {t('landing.workshop_body')}
              </p>
              <Button asChild variant="gold" className="mt-6">
                <Link href="#how">{t('landing.workshop_cta')}</Link>
              </Button>
            </div>
            <ul className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5">
              {workshopFacts.map((fact) => {
                const Icon = fact.icon;
                return (
                  <li
                    key={fact.title}
                    className="flex items-start gap-4 rounded-[14px] border border-white/10 bg-white/5 p-[18px]"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-gold/15 text-gold"
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-bold">{fact.title}</p>
                      <p className="text-sm text-[#C9CED8]">{fact.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Credits */}
        <section>
          <div className="storefront-container storefront-section">
            <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-[14px] border border-gold/60 bg-[linear-gradient(120deg,hsl(var(--gold-soft)),hsl(var(--card))_60%)] px-6 py-7 sm:px-8">
              <div className="flex min-w-0 max-w-[720px] items-center gap-[18px]">
                <span
                  aria-hidden="true"
                  className="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-gold text-gold-foreground"
                >
                  <Coins className="size-[26px]" />
                </span>
                <div>
                  <h2 className="text-2xl font-bold leading-tight">{t('landing.credits_title')}</h2>
                  <p className="mt-1.5 text-[15px] text-muted-foreground">
                    {t('landing.credits_body')}
                  </p>
                </div>
              </div>
              <Button asChild variant="ink">
                <Link href="/credits">{t('landing.credits_cta')}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
