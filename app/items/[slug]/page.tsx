import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Sparkles } from 'lucide-react';
import { addCatalogItemToCartAction } from '@/app/cart/actions';
import { CatalogMediaSlider } from '@/components/catalog-media-slider';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { sortCatalogMedia } from '@/lib/catalog-media';
import { getCatalogItem, getCatalogItemSeoMetadata } from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { getTranslations } from 'next-intl/server';
import { createProductStructuredData, resolveCatalogMetadata } from '@/lib/seo';
import { resolvePublicStorageUrl } from '@/lib/storage';
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

  const seo = await getCatalogItemSeoMetadata(item.id, locale).catch(() => null);

  return resolveCatalogMetadata({
    locale,
    path: `/items/${item.slug}`,
    seo,
    fallback: {
      title: item.title,
      slug: item.slug,
      description: item.description,
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
  const locale = await getRequestLocale();
  const t = await getTranslations();
  const activeCurrency = await getActiveCurrency();
  const convertedPrice = await convertMoney(
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
  const media = sortCatalogMedia(item.media ?? []);
  const sliderMedia = media.length
    ? media
    : item.thumbnail_path
      ? [{
          id: `${item.id}-thumbnail`,
          media_type: 'image' as const,
          storage_path: item.thumbnail_path,
          alt_text: item.title,
          poster_path: null,
          sort_order: 0,
          is_primary: true,
        }]
      : [];

  return (
    <>
      <MarketplaceHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="container max-w-6xl space-y-8 py-10">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/catalog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('product.back_to_catalog')}
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div className="product-art-frame p-6">
            <CatalogMediaSlider
              media={sliderMedia}
              fallbackTitle={item.title}
              fallbackCategory={item.category?.name}
            />
          </div>

          <section className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {item.category?.name && (
                  <span className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
                    {item.category.name}
                  </span>
                )}
                {item.is_customizable && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                    <Sparkles className="h-4 w-4" />
                    {t('product.customizable')}
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-bold tracking-tight">{item.title}</h1>
              {item.description && (
                <p className="text-lg text-muted-foreground">{item.description}</p>
              )}
            </div>

            <div className="rounded-lg border p-5">
              <p className="text-sm text-muted-foreground">{t('common.price')}</p>
              <p className="text-4xl font-bold">{formatPrice(convertedPrice.amountCents, convertedPrice.currency)}</p>
              {convertedPrice.exchangeRateContext.isStale ? (
                <p className="mt-1 text-xs text-muted-foreground">{t('product.exchange_rate_note')}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <form action={addCatalogItemToCartAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <Button size="lg" type="submit">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {t('product.add_to_cart')}
                </Button>
              </form>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="lg" variant="outline" aria-disabled="true" className="cursor-not-allowed opacity-50">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {t('product.buy')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('product.buy_tooltip')}</TooltipContent>
              </Tooltip>
            </div>

            {item.manufacturing_notes && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium">{t('product.production_notes')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.manufacturing_notes}</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
