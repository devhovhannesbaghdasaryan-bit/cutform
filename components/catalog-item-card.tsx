import Link from 'next/link';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { addCatalogItemToCartAction } from '@/app/cart/actions';
import { CatalogMediaSlider } from '@/components/catalog-media-slider';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sortCatalogMedia } from '@/lib/catalog-media';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import type { AppLocale } from '@/lib/i18n';
import { formatLocalizedCurrency, translate, translateWithFallback } from '@/lib/i18n';
import type { CatalogItem } from '@/lib/marketplace';

export async function CatalogItemCard({ item, locale = 'en' }: { item: CatalogItem; locale?: AppLocale }) {
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
  const activeCurrency = await getActiveCurrency();
  const convertedPrice = await convertMoney(
    item.price_cents,
    normalizeCurrency(item.currency) ?? 'AMD',
    activeCurrency,
  );
  const categoryName = item.category
    ? translateWithFallback(locale, `category.${item.category.slug}.name`, item.category.name)
    : translate(locale, 'product.uncategorized');
  const subcategoryName = item.subcategory
    ? translateWithFallback(locale, `subcategory.${item.subcategory.slug}.name`, item.subcategory.name)
    : null;

  return (
    <Card className="min-w-0 overflow-hidden rounded-lg transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,hsl(38_45%_88%),hsl(31_36%_72%))] p-6">
          <CatalogMediaSlider
            media={sliderMedia}
            fallbackTitle={item.title}
            fallbackCategory={categoryName}
            compact
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link href={`/items/${item.slug}`} className="block hover:underline">
            <p className="break-words font-medium leading-snug">{item.title}</p>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{categoryName}</span>
            {subcategoryName && <span>{subcategoryName}</span>}
            {item.is_customizable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                <Sparkles className="h-3 w-3" />
                {translate(locale, 'common.custom')}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:block sm:space-y-2 sm:text-right">
          <p className="font-semibold">
            {formatLocalizedCurrency(locale, convertedPrice.amountCents, convertedPrice.currency)}
          </p>
          <form action={addCatalogItemToCartAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <Button type="submit" size="sm" variant="outline" aria-label={`Add ${item.title} to cart`}>
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardFooter>
    </Card>
  );
}
