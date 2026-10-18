import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/components/admin/status-badge';
import { requireAdmin } from '@/lib/admin';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { cn, formatDate, formatPrice } from '@/lib/utils';

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

// Status tabs: each is a group of production (or payment) statuses.
const VIEWS = {
  all: { statuses: null, payment: null },
  review: { statuses: ['review_required'], payment: null },
  paid: { statuses: ['paid'], payment: null },
  production: { statuses: ['approved_for_production', 'in_production'], payment: null },
  ready: { statuses: ['ready_to_ship'], payment: null },
  shipped: { statuses: ['shipped'], payment: null },
  unpaid: { statuses: null, payment: 'unpaid' },
  cancelled: { statuses: ['cancelled', 'refunded'], payment: null },
} as const;
type ViewKey = keyof typeof VIEWS;
const VIEW_KEYS = Object.keys(VIEWS) as ViewKey[];

const ORDER_SELECT =
  'id, user_id, status, payment_status, total_cents, currency, contact_email, created_at, order_items (id, generated_item_id)';

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_cents: number;
  currency: string;
  contact_email: string | null;
  created_at: string;
  order_items: { id: string; generated_item_id: string | null }[];
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string; view?: string; q?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);
  const view: ViewKey = VIEW_KEYS.find((key) => key === params.view) ?? 'all';
  const search = params.q?.trim() || undefined;

  let query = supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  const viewConfig = VIEWS[view];
  if (viewConfig.statuses) query = query.in('status', [...viewConfig.statuses]);
  if (viewConfig.payment) query = query.eq('payment_status', viewConfig.payment);
  if (params.status) query = query.eq('status', params.status);
  if (params.payment) query = query.eq('payment_status', params.payment);
  if (search) {
    const pattern = `%${search.replace(/[%_,]/g, '')}%`;
    query = query.or(`contact_email.ilike.${pattern},id.ilike.${pattern}`);
  }

  const [{ data: orders, error }, counts] = await Promise.all([
    query.returns<OrderRow[]>(),
    Promise.all(
      VIEW_KEYS.map(async (key) => {
        const config = VIEWS[key];
        let countQuery = supabase.from('orders').select('id', { count: 'exact', head: true });
        if (config.statuses) countQuery = countQuery.in('status', [...config.statuses]);
        if (config.payment) countQuery = countQuery.eq('payment_status', config.payment);
        const { count } = await countQuery;
        return [key, count ?? 0] as const;
      }),
    ),
  ]);
  const countByView = new Map(counts);

  const hrefFor = (next: { view?: ViewKey; q?: string }) => {
    const search = new URLSearchParams();
    const nextView = next.view ?? view;
    if (nextView !== 'all') search.set('view', nextView);
    const nextQ = 'q' in next ? next.q : params.q;
    if (nextQ) search.set('q', nextQ);
    const queryString = search.toString();
    return queryString ? `/admin/orders?${queryString}` : '/admin/orders';
  };

  return (
    <main className="container flex max-w-[1240px] flex-col gap-[18px] py-7 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">{t('adminOrders.title')}</h1>
          <p className="text-muted-foreground">{t('adminOrders.subtitle')}</p>
        </div>
      </div>

      <nav aria-label={t('adminOrders.tabsLabel')} className="flex flex-wrap border-b">
        {VIEW_KEYS.map((key) => {
          const active = key === view;
          const count = countByView.get(key) ?? 0;
          return (
            <Link
              key={key}
              href={hrefFor({ view: key })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'mr-5 inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-bold transition-colors',
                active
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`adminOrders.tabs.${key}`)}
              <span
                className={cn(
                  'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-extrabold',
                  key === 'review' && count > 0
                    ? 'bg-warning text-warning-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <form className="flex flex-wrap items-center gap-2.5" method="get" action="/admin/orders">
        {view !== 'all' ? <input type="hidden" name="view" value={view} /> : null}
        <div className="relative min-w-0 max-w-[360px] flex-[1_1_240px]">
          <label htmlFor="q" className="sr-only">
            {t('adminOrders.searchLabel')}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ''}
            placeholder={t('adminOrders.searchPlaceholder')}
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm font-medium"
          />
        </div>
        <select
          name="status"
          defaultValue={params.status ?? ''}
          aria-label={t('adminOrders.statusForm.productionStatus')}
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-semibold"
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
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-semibold"
        >
          <option value="">{t('adminOrders.allPaymentStatuses')}</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`adminOrders.paymentStatus.${value}`)}
            </option>
          ))}
        </select>
        <button
          className="h-10 rounded-lg border border-input bg-card px-4 text-sm font-bold hover:bg-accent"
          type="submit"
        >
          {t('adminOrders.filter')}
        </button>
        {search || params.status || params.payment ? (
          <Link href={hrefFor({ q: undefined })} className="text-sm font-bold text-primary">
            {t('adminOrders.reset')}
          </Link>
        ) : null}
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !orders?.length ? (
        <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
          {t('adminOrders.noOrders')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5">{t('adminOrders.columns.order')}</th>
                  <th className="px-3.5 py-2.5">{t('adminOrders.columns.buyer')}</th>
                  <th className="px-3.5 py-2.5">{t('adminOrders.columns.items')}</th>
                  <th className="px-3.5 py-2.5">{t('adminOrders.columns.total')}</th>
                  <th className="px-3.5 py-2.5">{t('adminOrders.columns.payment')}</th>
                  <th className="px-3.5 py-2.5">{t('adminOrders.columns.production')}</th>
                  <th className="px-3.5 py-2.5">{t('adminOrders.columns.created')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const personalized = order.order_items.filter(
                    (item) => item.generated_item_id,
                  ).length;
                  return (
                    <tr key={order.id} className="border-t transition-colors hover:bg-background">
                      <td className="px-3.5 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-mono font-bold hover:underline"
                        >
                          {order.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3.5 py-3">
                        <p>{order.contact_email ?? t('adminOrders.noEmail')}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {order.user_id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-3.5 py-3">
                        {order.order_items.length}
                        {personalized ? (
                          <span className="text-xs text-muted-foreground">
                            {' '}
                            · {t('adminOrders.personalizedCount', { count: personalized })}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3.5 py-3 font-bold">
                        {formatPrice(order.total_cents, order.currency, locale)}
                      </td>
                      <td className="px-3.5 py-3">
                        <StatusBadge
                          status={order.payment_status}
                          label={tDynamic(
                            t,
                            `adminOrders.paymentStatus.${order.payment_status}`,
                            order.payment_status,
                          )}
                        />
                      </td>
                      <td className="px-3.5 py-3">
                        <StatusBadge
                          status={order.status}
                          label={tDynamic(t, `status.${order.status}`, order.status)}
                        />
                      </td>
                      <td className="px-3.5 py-3 text-muted-foreground">
                        {formatDate(order.created_at, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
