import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { CardHoverBoundary } from '@/components/catalog-card-hover';
import { CatalogMediaSlider } from '@/components/catalog-media-slider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { sortCatalogMedia } from '@/lib/catalog-media';
import type { ConvertedMoney } from '@/lib/currency';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/lib/i18n';
import { formatLocalizedCurrency } from '@/lib/i18n';
import { tDynamic } from '@/lib/i18n-dynamic';
import type { CatalogItem } from '@/lib/marketplace';

/**
 * Catalog card: product photo on slate, one gold "Custom" chip at most, the
 * price as the loudest text. Customizable items lead to the personalize
 * builder; ready-made items add straight to the cart. Never both.
 */
export async function CatalogItemCard({
  item,
  locale = 'en',
  convertedPrice,
}: {
  item: CatalogItem;
  locale?: AppLocale;
  convertedPrice: ConvertedMoney;
}) {
  const t = await getTranslations();
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
  const categoryName = item.category
    ? tDynamic(t, `category.${item.category.slug}.name`, item.category.name)
    : t('product.uncategorized');
  const subcategoryName = item.subcategory
    ? tDynamic(t, `subcategory.${item.subcategory.slug}.name`, item.subcategory.name)
    : null;

  return (
    <CardHoverBoundary>
      <Card className="group relative isolate flex min-w-0 flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,23,28,0.12)]">
        <Link
          href={`/items/${item.slug}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={item.title}
        />
        <div className="product-art-frame rounded-none">
          <CatalogMediaSlider
            media={sliderMedia}
            fallbackTitle={item.title}
            fallbackCategory={categoryName}
            showMediaLabel={t.raw('product.showMedia')}
            compact
          />
        </div>
        {item.is_customizable ? (
          <span className="pointer-events-none absolute left-3 top-3 z-20 inline-flex h-[26px] items-center gap-1.5 rounded-full bg-gold px-2.5 text-xs font-bold text-gold-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t('common.custom')}
          </span>
        ) : null}
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <p className="text-[12.5px] font-semibold text-muted-foreground">
            {categoryName}
            {subcategoryName ? ` · ${subcategoryName}` : ''}
          </p>
          <p
            className="line-clamp-2 min-h-[2.6rem] text-base font-bold leading-snug transition-colors group-hover:text-primary"
            title={item.title}
          >
            {item.title}
          </p>
          <div className="relative z-20 mt-auto flex items-center justify-between gap-3 pt-2">
            <p className="truncate text-[17px] font-extrabold">
              {formatLocalizedCurrency(locale, convertedPrice.amountCents, convertedPrice.currency)}
            </p>
            {item.is_customizable ? (
              <Button asChild size="sm">
                <Link href={`/personalize/${item.slug}`}>{t('product.personalizeShort')}</Link>
              </Button>
            ) : (
              <AddToCartButton
                itemId={item.id}
                ariaLabel={t('product.addToCartLabel', { name: item.title })}
                buttonText={t('product.addShort')}
              />
            )}
          </div>
        </div>
      </Card>
    </CardHoverBoundary>
  );
}
