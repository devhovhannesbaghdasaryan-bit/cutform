import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SvgRender } from '@/components/svg-render';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDate, formatPrice } from '@/lib/utils';
import { getServerSupabase } from '@/lib/supabase/server';
import { PRICING } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: product, error } = await supabase
    .from('products')
    .select(
      'id, title, svg_content, input_tokens, output_tokens, token_cost_cents, markup_cents, price_cents, created_at',
    )
    .eq('id', id)
    .single();

  // RLS hides other users' rows — error or null both mean "not yours".
  if (error || !product) notFound();

  return (
    <>
      <SiteHeader email={user.email ?? ''} />
      <main className="container max-w-4xl space-y-8 py-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{product.title}</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(product.created_at)}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex aspect-[4/3] items-center justify-center bg-muted/40 p-8">
            <SvgRender svg={product.svg_content} className="h-full w-full" />
          </div>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="text-4xl font-bold">{formatPrice(product.price_cents)}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="lg"
                aria-disabled="true"
                className="cursor-not-allowed opacity-50"
              >
                Buy
              </Button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </div>

        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            Price breakdown
          </summary>
          <div className="space-y-2 border-t px-4 py-3 text-sm">
            <Row label="Input tokens" value={product.input_tokens.toLocaleString()} />
            <Row label="Output tokens" value={product.output_tokens.toLocaleString()} />
            <Row
              label={`Token cost (input × $${PRICING.INPUT_USD_PER_MILLION}/M + output × $${PRICING.OUTPUT_USD_PER_MILLION}/M)`}
              value={formatPrice(product.token_cost_cents)}
            />
            <Row label="Markup" value={formatPrice(product.markup_cents)} />
            <div className="border-t pt-2">
              <Row label="Total" value={formatPrice(product.price_cents)} bold />
            </div>
          </div>
        </details>
      </main>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={bold ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}
