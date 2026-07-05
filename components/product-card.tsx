import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import type { Tables } from '@/lib/supabase/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { SvgRender } from './svg-render';

export type ProductCardItem = Pick<
  Tables<'products'>,
  'id' | 'title' | 'svg_content' | 'price_cents' | 'created_at'
>;

export function ProductCard({ product }: { product: ProductCardItem }) {
  return (
    <Link href={`/products/${product.id}`} className="block focus:outline-none">
      <Card className="overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring">
        <CardContent className="flex aspect-square items-center justify-center bg-muted/40 p-6">
          <SvgRender svg={product.svg_content} className="h-full w-full" />
        </CardContent>
        <CardFooter className="flex items-start justify-between gap-2 p-4 pt-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{product.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(product.created_at)}</p>
          </div>
          <p className="font-semibold">{formatPrice(product.price_cents)}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
