import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Camera, Check, ChevronRight, Scissors, Sparkles } from 'lucide-react';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { CatalogMediaSlider } from '@/components/catalog-media-slider';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import {
  applyExchangeRate,
  convertDisplayMoney,
  getActiveCurrency,
  getExchangeRates,
  normalizeCurrency,
} from '@/lib/currency';
import { sortCatalogMedia } from '@/lib/catalog-media';
import {
  getCatalogItem,
  getCatalogItemSeoMetadata,
  listPublishedCatalogItems,
} from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { getTranslations } from 'next-intl/server';
import { tDynamic } from '@/lib/i18n-dynamic';
import { listCatalogItemBoilerplates } from '@/lib/personalization-boilerplates';
import { createProductStructuredData, resolveCatalogMetadata } from '@/lib/seo';
import { resolvePublicStorageUrl } from '@/lib/storage';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const item = await getCatalogItem(slug).catch(() => null);
  if (!item) return {};
  const t = await getTranslations();

  const seo = await getCatalogItemSeoMetadata(item.id, locale).catch(() => null);

  return resolveCatalogMetadata({
    locale,
    path: `/items/${item.slug}`,
    seo,
    fallback: {
      title: item.title,
      slug: item.slug,
      description: item.description || t('landing.meta_description'),
      imagePath: resolvePublicStorageUrl('catalog-assets', item.thumbnail_path),
    },
  });
}

export default async function CatalogItemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getCatalogItem(slug).catch(() => null);
  if (!item) notFound();
  const supabase = await getServerSupabase();
  const hasUsablePersonalization =
    item.is_customizable &&
    (Boolean(item.system_prompt) ||
      Boolean(item.skill_id) ||
      (await listCatalogItemBoilerplates(supabase, item.id).catch(() => [])).length > 0);
  const locale = await getRequestLocale();
  const t = await getTranslations();
  const activeCurrency = await getActiveCurrency();
  const convertedPrice = await convertDisplayMoney(
    item.price_cents,
    normalizeCurrency(item.currency) ?? 'AMD',
    activeCurrency,
  );
  const structuredData = createProductStructuredData({
    locale,
    name: item.title,
    description: item.description,
    image: resolvePublicStorageUrl('catalog-assets', item.thumbnail_path),
    slug: item.slug,
    priceCents: item.price_cents,
    currency: item.currency,
  });
  const categoryName = item.category
    ? tDynamic(t, `category.${item.category.slug}.name`, item.category.name)
    : null;
  const subcategoryName = item.subcategory
    ? tDynamic(t, `subcategory.${item.subcategory.slug}.name`, item.subcategory.name)
    : null;
  const media = sortCatalogMedia(item.media ?? []);
  const sliderMedia = media.length
    ? media
    : item.thumbnail_path
      ? [
          {
            id: `${item.id}-thumbnail`,
            media_type: 'image' as const,
            storage_path: item.thumbnail_path,
            alt_text: item.title,
            poster_path: null,
            sort_order: 0,
            is_primary: true,
          },
        ]
      : [];
  const tags = new Set(item.tags ?? []);
  const personalizationLines = [
    tags.has('personal_photo') ? t('product.personalization_photo') : null,
    tags.has('personal_text') ? t('product.personalization_text') : null,
    tags.has('personal_color') ? t('product.personalization_color') : null,
    t('product.personalization_note'),
  ].filter((line): line is string => Boolean(line));

  // "You may also like": other published items from the same category.
  const related = item.category
    ? await listPublishedCatalogItems(undefined, undefined, 1, {})
        .then(({ items }) =>
          items
            .filter((other) => other.id !== item.id && other.category?.slug === item.category?.slug)
            .slice(0, 4),
        )
        .catch(() => [])
    : [];
  const relatedRates = await getExchangeRates(
    related.map((other) => normalizeCurrency(other.currency) ?? 'AMD'),
    activeCurrency,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <MarketplaceHeader />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data serialized from trusted server data, not user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="storefront-container flex flex-1 flex-col gap-10 py-7 pb-16">
        <nav
          aria-label={t('catalog.breadcrumb')}
          className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground">
            {t('product.breadcrumb_home')}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <Link href="/catalog" className="hover:text-foreground">
            {t('catalog.shop_title')}
          </Link>
          {item.category && categoryName ? (
            <>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <Link
                href={`/catalog?category=${item.category.slug}`}
                className="hover:text-foreground"
              >
                {categoryName}
              </Link>
            </>
          ) : null}
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="truncate text-foreground">{item.title}</span>
        </nav>

        <div className="flex flex-wrap items-start gap-x-14 gap-y-10">
          {/* Gallery */}
          <section aria-label={t('product.photos')} className="min-w-0 flex-[1_1_520px]">
            <div className="product-art-frame relative rounded-[18px]">
              <CatalogMediaSlider
                media={sliderMedia}
                fallbackTitle={item.title}
                fallbackCategory={categoryName}
                showMediaLabel={t.raw('product.showMedia')}
                sizes="(min-width: 1024px) 55vw, 100vw"
                priority
              />
              {item.is_customizable ? (
                <span className="pointer-events-none absolute left-4 top-4 z-20 inline-flex h-[30px] items-center gap-1.5 rounded-full bg-gold px-3 text-[13px] font-bold text-gold-foreground">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {t('product.sample_badge')}
                </span>
              ) : null}
            </div>
          </section>

          {/* Buy panel */}
          <section className="flex min-w-0 max-w-[560px] flex-[1_1_400px] flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {item.is_customizable ? (
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-gold px-2.5 text-xs font-bold text-gold-foreground">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {t('common.custom')}
                </span>
              ) : null}
              {item.category && categoryName ? (
                <Link
                  href={`/catalog?category=${item.category.slug}`}
                  className="inline-flex h-[26px] items-center rounded-full bg-card px-2.5 text-xs font-bold text-muted-foreground ring-1 ring-inset ring-input hover:text-foreground"
                >
                  {categoryName}
                </Link>
              ) : null}
              {item.subcategory && subcategoryName ? (
                <Link
                  href={`/catalog?category=${item.category?.slug}&subcategory=${item.subcategory.slug}`}
                  className="inline-flex h-[26px] items-center rounded-full bg-card px-2.5 text-xs font-bold text-muted-foreground ring-1 ring-inset ring-input hover:text-foreground"
                >
                  {subcategoryName}
                </Link>
              ) : null}
            </div>
            <div>
              <h1 className="text-[28px] font-bold leading-[1.12] sm:text-[38px]">{item.title}</h1>
              {item.description ? (
                <p className="mt-2.5 text-base text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-[34px] font-extrabold tracking-tight">
                {formatPrice(convertedPrice.amountCents, convertedPrice.currency, locale)}
              </span>
              <span className="text-[13.5px] text-muted-foreground">
                {item.is_customizable ? t('product.price_note_custom') : t('product.price_note')}
                {convertedPrice.exchangeRateContext.isStale
                  ? ` · ${t('product.exchange_rate_note')}`
                  : ''}
              </span>
            </div>

            {hasUsablePersonalization ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[13px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {t('product.order_paths')}
                </p>
                <div className="flex flex-col gap-1.5 rounded-[14px] border-2 border-primary bg-card p-4 shadow-[0_8px_24px_hsl(var(--primary)/0.10)]">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className="text-base font-extrabold">
                      {t('product.path_personalize_title')}
                    </span>
                    <span className="inline-flex h-[26px] items-center rounded-full bg-gold-soft px-2.5 text-xs font-bold text-warning-foreground">
                      {t('product.path_personalize_chip')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('product.path_personalize_body')}
                  </p>
                  <Button asChild variant="gold" className="mt-2 self-start">
                    <Link href={`/personalize/${item.slug}`}>
                      <Camera className="size-[18px]" aria-hidden="true" />
                      {t('product.path_personalize_cta')}
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-col gap-1.5 rounded-[14px] border bg-card p-4">
                  <span className="text-base font-extrabold">{t('product.path_sample_title')}</span>
                  <p className="text-sm text-muted-foreground">{t('product.path_sample_body')}</p>
                  <div className="mt-2">
                    <AddToCartButton
                      itemId={item.id}
                      ariaLabel={t('product.add_to_cart')}
                      buttonText={t('product.add_to_cart')}
                      variant="outline"
                      size="lg"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <AddToCartButton
                  itemId={item.id}
                  ariaLabel={t('product.add_to_cart')}
                  buttonText={t('product.add_to_cart')}
                  size="lg"
                  variant="default"
                />
              </div>
            )}

            <ul className="flex flex-col gap-2.5 text-sm font-semibold text-muted-foreground">
              {[t('product.facts_preview'), t('product.facts_review'), t('product.facts_made')].map(
                (line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 size-[18px] shrink-0 text-success"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>

        {/* Details */}
        <section aria-labelledby="details-heading" className="flex flex-col gap-[18px]">
          <h2 id="details-heading" className="text-2xl font-bold">
            {t('product.details')}
          </h2>
          <div className="flex flex-wrap gap-4">
            {item.is_customizable ? (
              <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 rounded-xl border bg-card p-[22px]">
                <h3 className="text-base font-semibold">{t('product.personalization_title')}</h3>
                <ul className="flex flex-col gap-1.5 pl-[18px] text-sm">
                  {personalizationLines.map((line) => (
                    <li key={line} className="list-disc">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {item.manufacturing_notes ? (
              <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 rounded-xl border bg-card p-[22px]">
                <h3 className="text-base font-semibold">{t('product.production_notes')}</h3>
                <p className="text-sm text-muted-foreground">{item.manufacturing_notes}</p>
              </div>
            ) : null}
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 rounded-xl border bg-card p-[22px]">
              <h3 className="text-base font-semibold">{t('product.workshop_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('product.workshop_body')}</p>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Scissors className="size-[18px] text-primary" aria-hidden="true" />
                {t('product.made_in')}
              </p>
            </div>
          </div>
        </section>

        {hasUsablePersonalization ? (
          <section
            aria-labelledby="how-heading"
            className="flex flex-wrap items-center gap-x-10 gap-y-6 rounded-xl border bg-card px-8 py-7"
          >
            <div className="min-w-0 max-w-[360px] flex-[1_1_260px]">
              <p className="mb-1.5 text-[13px] font-extrabold uppercase tracking-wider text-secondary-foreground">
                {t('landing.how_eyebrow')}
              </p>
              <h2 id="how-heading" className="text-2xl font-bold leading-tight">
                {t('product.how_title')}
              </h2>
            </div>
            <ol className="flex min-w-0 flex-[2_1_520px] flex-wrap gap-4">
              {[
                { title: t('landing.step1_title'), body: t('product.how_step1') },
                { title: t('landing.step2_title'), body: t('product.how_step2') },
                { title: t('landing.step3_title'), body: t('product.how_step3') },
              ].map((step, index) => (
                <li key={step.title} className="flex min-w-0 flex-[1_1_160px] gap-3 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-foreground font-display text-sm font-extrabold text-gold">
                    {index + 1}
                  </span>
                  <span>
                    <strong>{step.title}</strong>
                    <br />
                    <span className="text-muted-foreground">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {related.length ? (
          <section aria-labelledby="related-heading" className="flex flex-col gap-[18px]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="related-heading" className="text-2xl font-bold">
                {t('product.related')}
              </h2>
              {item.category && categoryName ? (
                <Link
                  href={`/catalog?category=${item.category.slug}`}
                  className="text-[15px] font-bold text-primary"
                >
                  {t('catalog.all_category', { name: categoryName })}
                </Link>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((other) => {
                const fromCurrency = normalizeCurrency(other.currency) ?? 'AMD';
                // biome-ignore lint/style/noNonNullAssertion: relatedRates was built from these same items' currencies
                const rate = relatedRates.get(fromCurrency)!;
                return (
                  <CatalogItemCard
                    key={other.id}
                    item={other}
                    locale={locale}
                    convertedPrice={applyExchangeRate(other.price_cents, rate)}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
