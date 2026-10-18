import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckoutForm } from '@/app/checkout/checkout-form';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { listCartItems, validateCartBeforeCheckout } from '@/lib/cart';
import { normalizeCurrency } from '@/lib/currency';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { getCountryDisplayName, resolveMarket } from '@/lib/market';
import { calculateOrderTotals } from '@/lib/shipping';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

  if (!user) redirect('/login?next=/checkout');

  const locale = await getRequestLocale();
  const [{ items }, market, t] = await Promise.all([
    listCartItems(supabase, { userId: user.id }),
    resolveMarket({ checkoutCountryCode: 'AM' }),
    getTranslations(),
  ]);

  if (!items.length) redirect('/cart');

  const issues = await validateCartBeforeCheckout(supabase, user.id, market.countryCode).catch(
    () => [],
  );

  const issueByItem = new Map(issues.map((issue) => [issue.cartItemId, issue]));
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
  const subtotalCurrency = items[0]?.currency ?? 'AMD';
  const totals = market.countryCode
    ? await calculateOrderTotals({
        items,
        market,
        currency: normalizeCurrency(subtotalCurrency) ?? 'AMD',
        supabase,
      }).catch(() => null)
    : null;

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-5xl space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('checkout.review')}</h1>
            <p className="text-muted-foreground">{t('checkout.review_help')}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/cart">{t('checkout.back_to_cart')}</Link>
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="rounded-lg border">
            <div className="border-b p-4">
              <h2 className="font-semibold">{t('order.items')}</h2>
            </div>
            <div className="divide-y">
              {items.map((item) => {
                const issue = issueByItem.get(item.id);
                return (
                  <div key={item.id} className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('order.qty', { count: item.quantity })} &middot;{' '}
                        {item.generated_item_id
                          ? t('cart.generated_item')
                          : item.banner_sample_id
                            ? t('cart.banner_item')
                            : t('cart.catalog_item')}
                      </p>
                      {issue ? (
                        <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {tDynamic(t, `cart.issue.${issue.code}`, issue.message)}
                        </p>
                      ) : null}
                    </div>
                    <p className="font-medium">
                      {formatPrice(item.unit_price_cents * item.quantity, item.currency, locale)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <CheckoutForm
              locale={locale}
              defaultEmail={user.email ?? ''}
              countryName={getCountryDisplayName('AM', locale)}
              subtotalText={formatPrice(subtotal, subtotalCurrency, locale)}
              shippingText={
                totals
                  ? formatPrice(totals.shippingCents, totals.currency, locale)
                  : t('checkout.select_destination')
              }
              totalText={
                totals
                  ? formatPrice(totals.totalCents, totals.currency, locale)
                  : formatPrice(subtotal, subtotalCurrency, locale)
              }
              hasIssues={issues.length > 0}
              canSubmit={issues.length === 0 && totals !== null}
              copy={{
                summary: t('order.summary'),
                paymentNote: t('checkout.payment_note'),
                contactEmail: t('checkout.contact_email'),
                recipient: t('checkout.recipient'),
                phone: t('checkout.phone'),
                address1: t('checkout.address1'),
                address2: t('checkout.address2'),
                country: t('checkout.country'),
                city: t('checkout.city'),
                region: t('checkout.region'),
                postal: t('checkout.postal'),
                subtotal: t('cart.subtotal'),
                shipping: t('cart.shipping'),
                total: t('cart.total'),
                resolveIssues: t('checkout.resolve_issues'),
                createOrder: t('checkout.create_order'),
                creatingOrder: t('checkout.creating_order'),
              }}
            />
          </aside>
        </div>
      </main>
    </>
  );
}
