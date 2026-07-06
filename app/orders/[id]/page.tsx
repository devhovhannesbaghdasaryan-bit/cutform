import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { getOrderDetail } from '@/lib/orders';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import { formatDate, formatPrice } from '@/lib/utils';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

  if (!user) redirect(`/login?next=/orders/${id}`);

  const detail = await getOrderDetail(supabase, id, { userId: user.id });

  if (!detail) notFound();

  const t = await getTranslations();
  const { order, items, itemsError } = detail;

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-5xl space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t('order.created', { date: formatDate(order.created_at) })}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('order.title')} {order.id.slice(0, 8)}
            </h1>
            <p className="text-muted-foreground">
              {t('order.status_line', {
                status: tDynamic(t, `status.${order.status}`, order.status),
                payment: tDynamic(t, `status.${order.payment_status}`, order.payment_status),
              })}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">{t('generated.backDashboard')}</Link>
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="rounded-lg border">
            <div className="border-b p-4">
              <h2 className="font-semibold">{t('order.items_title')}</h2>
            </div>
            {itemsError ? (
              <p className="p-4 text-sm text-destructive">{itemsError.message}</p>
            ) : !items?.length ? (
              <p className="p-4 text-sm text-muted-foreground">{t('order.no_items')}</p>
            ) : (
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="grid gap-4 p-4 sm:grid-cols-[96px_1fr_auto]">
                    <div className="flex aspect-square items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                      {item.image_path || item.selected_preview_path
                        ? t('dashboard.previewSaved')
                        : t('order.no_image')}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('order.qty', { count: item.quantity })}
                      </p>
                      {item.custom_text || item.led_color || item.multi_color ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.custom_text
                            ? `${t('order.custom_text', { text: item.custom_text })} `
                            : ''}
                          {item.multi_color
                            ? t('order.led_multi')
                            : item.led_color
                              ? t('order.led_color', {
                                  color: tDynamic(
                                    t,
                                    `generated.color.${item.led_color}`,
                                    item.led_color,
                                  ),
                                })
                              : ''}
                        </p>
                      ) : null}
                      {item.banner_size_key ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('order.banner_size', { size: item.banner_size_key })}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatPrice(item.total_price_cents, item.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('generated.priceEach', {
                          price: formatPrice(item.unit_price_cents, item.currency),
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('order.summary')}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('cart.subtotal')}</dt>
                <dd className="font-medium">{formatPrice(order.subtotal_cents, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('cart.shipping')}</dt>
                <dd className="font-medium">{formatPrice(order.shipping_cents, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t pt-3 text-base">
                <dt className="font-medium">{t('cart.total')}</dt>
                <dd className="font-bold">{formatPrice(order.total_cents, order.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('order.contact')}</dt>
                <dd>{order.contact_email ?? user.email ?? '-'}</dd>
              </div>
              {order.shipping_address ? (
                <div>
                  <dt className="text-muted-foreground">{t('order.shipping_address')}</dt>
                  <dd className="whitespace-pre-line">
                    {formatShippingAddress(order.shipping_address)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>
      </main>
    </>
  );
}

function formatShippingAddress(address: Record<string, unknown>) {
  return [
    address.recipientName,
    address.addressLine1,
    address.addressLine2,
    [address.city, address.administrativeArea, address.postalCode].filter(Boolean).join(', '),
    address.countryCode,
    address.phone,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n');
}
