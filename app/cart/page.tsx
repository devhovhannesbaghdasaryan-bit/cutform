import Link from 'next/link';
import { ImageOff, Minus, ShoppingCart, Trash2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clearCartAction,
  removeCartItemAction,
  updateCartQuantityAction,
} from '@/app/cart/actions';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { type CartItem, listCartItems, validateCartBeforeCheckout } from '@/lib/cart';
import { getCartSessionId } from '@/lib/cart-session';
import { formatLocalizedCurrency, translate, translateTemplate } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { normalizeCurrency } from '@/lib/currency';
import { resolveMarket } from '@/lib/market';
import { calculateOrderTotals } from '@/lib/shipping';
import { resolvePublicStorageUrl } from '@/lib/storage';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

async function getCartPreviewUrls(supabase: SupabaseClient, items: CartItem[]) {
  const catalogIds = items.flatMap((item) => item.catalog_item_id ? [item.catalog_item_id] : []);
  const generatedIds = items.flatMap((item) => item.generated_item_id ? [item.generated_item_id] : []);
  const bannerIds = items.flatMap((item) => item.banner_sample_id ? [item.banner_sample_id] : []);

  const [catalogResult, generatedResult, bannerResult] = await Promise.all([
    catalogIds.length
      ? supabase.from('catalog_items').select('id, thumbnail_path').in('id', catalogIds).returns<{ id: string; thumbnail_path: string | null }[]>()
      : Promise.resolve({ data: [] as { id: string; thumbnail_path: string | null }[] }),
    generatedIds.length
      ? supabase.from('generated_items').select('id, selected_preview_path, preview_path').in('id', generatedIds).returns<{ id: string; selected_preview_path: string | null; preview_path: string | null }[]>()
      : Promise.resolve({ data: [] as { id: string; selected_preview_path: string | null; preview_path: string | null }[] }),
    bannerIds.length
      ? supabase.from('banner_samples').select('id, image_path').in('id', bannerIds).returns<{ id: string; image_path: string | null }[]>()
      : Promise.resolve({ data: [] as { id: string; image_path: string | null }[] }),
  ]);

  const catalogPaths = new Map((catalogResult.data ?? []).map((row) => [row.id, row.thumbnail_path]));
  const generatedPaths = new Map((generatedResult.data ?? []).map((row) => [row.id, row.selected_preview_path ?? row.preview_path]));
  const bannerPaths = new Map((bannerResult.data ?? []).map((row) => [row.id, row.image_path]));
  const previews = new Map<string, string>();

  await Promise.all(items.map(async (item) => {
    if (item.catalog_item_id) {
      const url = resolvePublicStorageUrl('catalog-assets', catalogPaths.get(item.catalog_item_id));
      if (url) previews.set(item.id, url);
      return;
    }
    if (item.banner_sample_id) {
      const url = resolvePublicStorageUrl('banner-assets', bannerPaths.get(item.banner_sample_id));
      if (url) previews.set(item.id, url);
      return;
    }
    if (!item.generated_item_id) return;

    const configuredPath = item.configuration.selectedPreviewPath;
    const path = typeof configuredPath === 'string'
      ? configuredPath
      : generatedPaths.get(item.generated_item_id);
    if (!path) return;
    if (ABSOLUTE_URL_PATTERN.test(path) || path.startsWith('/')) {
      previews.set(item.id, path);
      return;
    }
    const { data } = await supabase.storage.from('generated-assets').createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) previews.set(item.id, data.signedUrl);
  }));

  return previews;
}

export default async function CartPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await getRequestLocale();
  const sessionId = user ? null : await getCartSessionId();
  const cartSupabase = user ? supabase : getServiceSupabase();
  const cartData = user
    ? await listCartItems(supabase, { userId: user.id })
    : sessionId
      ? await listCartItems(cartSupabase, { sessionId })
      : { cart: null, items: [] };
  const items = cartData.items;
  const market = await resolveMarket({ supabase: cartSupabase });
  const previewUrls = await getCartPreviewUrls(cartSupabase, items);
  const issues = user
    ? await validateCartBeforeCheckout(supabase, user.id).catch(() => [])
    : [];
  const issueByItem = new Map(issues.map((issue) => [issue.cartItemId, issue]));
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
  const subtotalCurrency = items[0]?.currency ?? cartData.cart?.currency ?? 'AMD';
  const totals = market.countryCode
    ? await calculateOrderTotals({
        items,
        market,
        currency: normalizeCurrency(subtotalCurrency) ?? 'AMD',
        supabase: cartSupabase,
      }).catch(() => null)
    : null;

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-6xl space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">{translate(locale, 'cart.title')}</h1>
            <p className="max-w-2xl text-muted-foreground">{translate(locale, 'cart.description')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!user && (
              <Button asChild>
                <Link href="/login?next=/cart">{translate(locale, 'cart.login_checkout')}</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/catalog">{translate(locale, 'cart.continue_shopping')}</Link>
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">{translate(locale, 'cart.empty')}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{translate(locale, 'cart.empty_description')}</p>
            <Button asChild className="mt-5">
              <Link href="/catalog">{translate(locale, 'cart.browse_catalog')}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-lg border">
              <div className="divide-y">
                {items.map((item) => {
                  const issue = issueByItem.get(item.id);
                  const isGenerated = Boolean(item.generated_item_id);
                  const previewUrl = previewUrls.get(item.id);
                  const itemType = item.generated_item_id
                    ? translate(locale, 'cart.generated_item')
                    : item.banner_sample_id
                      ? translate(locale, 'cart.banner_item')
                      : translate(locale, 'cart.catalog_item');
                  return (
                    <div key={item.id} className="grid gap-4 p-4 sm:grid-cols-[96px_1fr_auto]">
                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted text-xs text-muted-foreground">
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Signed generated-asset URLs are dynamic and expire.
                          <img
                            src={previewUrl}
                            alt={translateTemplate(locale, 'cart.preview_alt', { name: item.title })}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex flex-col items-center gap-1 px-2 text-center">
                            <ImageOff className="h-5 w-5" aria-hidden="true" />
                            {translate(locale, 'cart.preview_unavailable')}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {itemType}
                        </p>
                        {issue && (
                          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {translate(locale, `cart.issue.${issue.code}`)}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={updateCartQuantityAction} className="flex items-center gap-2">
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <input
                              name="quantity"
                              type="number"
                              min="1"
                              max={isGenerated ? 1 : 99}
                              defaultValue={item.quantity}
                              disabled={isGenerated}
                              aria-label={translateTemplate(locale, 'cart.quantity_label', { name: item.title })}
                              className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                            />
                            <Button type="submit" variant="outline" size="sm" disabled={isGenerated}>
                              {translate(locale, 'cart.update_quantity')}
                            </Button>
                          </form>
                          <form action={removeCartItemAction}>
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              <Trash2 className="mr-1 h-4 w-4" />
                              {translate(locale, 'cart.remove')}
                            </Button>
                          </form>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatLocalizedCurrency(locale, item.unit_price_cents * item.quantity, item.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatLocalizedCurrency(locale, item.unit_price_cents, item.currency)} {translate(locale, 'common.each')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-lg border p-5">
                <h2 className="font-semibold">{translate(locale, 'cart.summary')}</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{translate(locale, 'cart.subtotal')}</dt>
                    <dd className="font-medium">{formatLocalizedCurrency(locale, subtotal, subtotalCurrency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{translate(locale, 'cart.shipping')}</dt>
                    <dd>{totals
                      ? formatLocalizedCurrency(locale, totals.shippingCents, totals.currency)
                      : market.countryCode
                        ? translate(locale, 'cart.shipping_unavailable')
                        : translate(locale, 'cart.select_country')}</dd>
                  </div>
                  {totals ? (
                    <div className="flex justify-between border-t pt-3 text-base">
                      <dt className="font-medium">{translate(locale, 'cart.total')}</dt>
                      <dd className="font-bold">{formatLocalizedCurrency(locale, totals.totalCents, totals.currency)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{translate(locale, 'cart.tax')}</dt>
                    <dd>{translate(locale, 'cart.calculated_later')}</dd>
                  </div>
                </dl>
                {!user ? (
                  <Button asChild className="mt-5 w-full">
                    <Link href="/login?next=/checkout">{translate(locale, 'cart.login_checkout')}</Link>
                  </Button>
                ) : issues.length > 0 ? (
                  <Button className="mt-5 w-full" disabled>
                    {translate(locale, 'cart.checkout_review')}
                  </Button>
                ) : (
                  <Button asChild className="mt-5 w-full">
                    <Link href="/checkout">{translate(locale, 'cart.checkout_review')}</Link>
                  </Button>
                )}
                {issues.length > 0 && (
                  <p className="mt-2 text-sm text-destructive">
                    {translate(locale, 'cart.resolve_issues')}
                  </p>
                )}
              </div>

              <form action={clearCartAction}>
                <Button type="submit" variant="outline" className="w-full">
                  <Minus className="mr-2 h-4 w-4" />
                  {translate(locale, 'cart.clear')}
                </Button>
              </form>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
