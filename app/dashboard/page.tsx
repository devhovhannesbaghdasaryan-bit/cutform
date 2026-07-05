import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { ProductCard } from '@/components/product-card';
import { EmptyState } from '@/components/empty-state';
import { formatLocalizedDate, translate, translateWithFallback } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [supabase, locale] = await Promise.all([getServerSupabase(), getRequestLocale()]);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, svg_content, price_cents, created_at')
    .order('created_at', { ascending: false });
  const { data: generatedItems } = await supabase
    .from('generated_items')
    .select('id, title, product_type, review_status, credit_cost, preview_path, selected_preview_path, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12);
  const { data: creditAccount } = await supabase
    .from('credit_accounts')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, payment_status, subtotal_cents, currency, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    return (
      <>
        <SiteHeader email={user.email ?? ''} />
        <main className="container py-10">
          <p className="text-destructive">Failed to load products: {error.message}</p>
        </main>
      </>
    );
  }

  const items = products ?? [];

  return (
    <>
      <SiteHeader email={user.email ?? ''} />
      <main className="container space-y-6 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{translate(locale, 'dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {translate(locale, 'dashboard.subtitle')}
          </p>
        </div>
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{translate(locale, 'dashboard.credits')}</p>
            <p className="text-3xl font-bold">{creditAccount?.balance ?? 0}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{translate(locale, 'dashboard.orders')}</p>
            <p className="text-3xl font-bold">{orders?.length ?? 0}</p>
          </div>
        </section>
        {items.length === 0 && !generatedItems?.length && !orders?.length ? (
          <EmptyState copy={{ title: translate(locale, 'empty.title'), description: translate(locale, 'empty.description'), browse: translate(locale, 'empty.browse') }} />
        ) : (
          <>
            {(orders?.length ?? 0) > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">{translate(locale, 'dashboard.recentOrders')}</h2>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">{translate(locale, 'dashboard.order')}</th>
                        <th className="px-4 py-3 font-medium">{translate(locale, 'dashboard.total')}</th>
                        <th className="px-4 py-3 font-medium">{translate(locale, 'dashboard.payment')}</th>
                        <th className="px-4 py-3 font-medium">{translate(locale, 'dashboard.production')}</th>
                        <th className="px-4 py-3 font-medium">{translate(locale, 'dashboard.created')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders?.map((order) => (
                        <tr key={order.id} className="border-t">
                          <td className="px-4 py-3">
                            <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                              {order.id.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {formatPrice(order.subtotal_cents, order.currency)}
                          </td>
                          <td className="px-4 py-3">{translateWithFallback(locale, `status.${order.payment_status}`, order.payment_status)}</td>
                          <td className="px-4 py-3">{translateWithFallback(locale, `status.${order.status}`, order.status)}</td>
                          <td className="px-4 py-3">{formatLocalizedDate(locale, order.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {(generatedItems?.length ?? 0) > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">{translate(locale, 'dashboard.generatedItems')}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {generatedItems?.map((item) => (
                    <Link
                      key={item.id}
                      href={`/generated/${item.id}`}
                      className="rounded-lg border p-4 transition-colors hover:bg-accent"
                    >
                      <div className="flex aspect-[4/3] items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                        {item.selected_preview_path || item.preview_path ? translate(locale, 'dashboard.previewSaved') : translate(locale, 'dashboard.noPreview')}
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="font-medium">{item.title ?? item.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">{item.product_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {translateWithFallback(locale, `status.${item.review_status}`, item.review_status)} · {item.credit_cost} {translate(locale, 'dashboard.credits').toLowerCase()} · {formatLocalizedDate(locale, item.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {items.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">{translate(locale, 'dashboard.approvedProducts')}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
