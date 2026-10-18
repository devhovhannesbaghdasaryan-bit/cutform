import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PRODUCTION_STATUSES = [
  'draft',
  'pending_payment',
  'paid',
  'review_required',
  'approved_for_production',
  'in_production',
  'ready_to_ship',
  'shipped',
  'cancelled',
  'refunded',
] as const;

const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed'] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);

  let query = supabase
    .from('orders')
    .select(
      'id, user_id, status, payment_status, subtotal_cents, currency, contact_email, created_at',
    )
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.payment) query = query.eq('payment_status', params.payment);

  const { data: orders, error } = await query;

  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('adminOrders.title')}</h1>
        <p className="text-muted-foreground">{t('adminOrders.subtitle')}</p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[220px_220px_auto]">
        <select
          name="status"
          defaultValue={params.status ?? ''}
          aria-label={t('adminOrders.statusForm.productionStatus')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminOrders.allProductionStatuses')}</option>
          {PRODUCTION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
        <select
          name="payment"
          defaultValue={params.payment ?? ''}
          aria-label={t('adminOrders.statusForm.paymentStatus')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminOrders.allPaymentStatuses')}</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`adminOrders.paymentStatus.${value}`)}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          {t('adminOrders.filter')}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !orders?.length ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          {t('adminOrders.noOrders')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t('adminOrders.columns.order')}</th>
                <th className="px-4 py-3 font-medium">{t('adminOrders.columns.buyer')}</th>
                <th className="px-4 py-3 font-medium">{t('adminOrders.columns.total')}</th>
                <th className="px-4 py-3 font-medium">{t('adminOrders.columns.payment')}</th>
                <th className="px-4 py-3 font-medium">{t('adminOrders.columns.production')}</th>
                <th className="px-4 py-3 font-medium">{t('adminOrders.columns.created')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium hover:underline"
                    >
                      {order.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p>{order.contact_email ?? t('adminOrders.noEmail')}</p>
                    <p className="text-xs text-muted-foreground">{order.user_id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {formatPrice(order.subtotal_cents, order.currency, locale)}
                  </td>
                  <td className="px-4 py-3">
                    {tDynamic(
                      t,
                      `adminOrders.paymentStatus.${order.payment_status}`,
                      order.payment_status,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tDynamic(t, `status.${order.status}`, order.status)}
                  </td>
                  <td className="px-4 py-3">{formatDate(order.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
