import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { ProductCard } from '@/components/product-card';
import { EmptyState } from '@/components/empty-state';
import { getTranslations } from 'next-intl/server';
import { formatLocalizedDate } from '@/lib/i18n';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [supabase, locale, t] = await Promise.all([getServerSupabase(), getRequestLocale(), getTranslations()]);
  const user = await getCurrentUser();
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
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{t('dashboard.credits')}</p>
            <p className="text-3xl font-bold">{creditAccount?.balance ?? 0}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{t('dashboard.orders')}</p>
            <p className="text-3xl font-bold">{orders?.length ?? 0}</p>
          </div>
        </section>
        {items.length === 0 && !generatedItems?.length && !orders?.length ? (
          <EmptyState copy={{ title: t('empty.title'), description: t('empty.description'), browse: t('empty.browse') }} />
        ) : (
          <>
            {(orders?.length ?? 0) > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">{t('dashboard.recentOrders')}</h2>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t('dashboard.order')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.total')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.payment')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.production')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.created')}</th>
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
                          <td className="px-4 py-3">{tDynamic(t, `status.${order.payment_status}`, order.payment_status)}</td>
                          <td className="px-4 py-3">{tDynamic(t, `status.${order.status}`, order.status)}</td>
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
                <h2 className="text-xl font-semibold tracking-tight">{t('dashboard.generatedItems')}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {generatedItems?.map((item) => (
                    <Link
                      key={item.id}
                      href={`/generated/${item.id}`}
                      className="rounded-lg border p-4 transition-colors hover:bg-accent"
                    >
                      <div className="flex aspect-[4/3] items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                        {item.selected_preview_path || item.preview_path ? t('dashboard.previewSaved') : t('dashboard.noPreview')}
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="font-medium">{item.title ?? item.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">{item.product_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {tDynamic(t, `status.${item.review_status}`, item.review_status)} · {item.credit_cost} {t('dashboard.credits').toLowerCase()} · {formatLocalizedDate(locale, item.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {items.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">{t('dashboard.approvedProducts')}</h2>
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
