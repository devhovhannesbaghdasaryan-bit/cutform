import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle, Boxes, Coins, CreditCard, FileText, Images, Plus } from 'lucide-react';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { loadOrderProductionPacks } from '@/lib/production-pack/load';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FULFIL_STATUSES = [
  'paid',
  'review_required',
  'approved_for_production',
  'in_production',
  'ready_to_ship',
];
const PIPELINE_STATUSES = [
  'paid',
  'review_required',
  'approved_for_production',
  'in_production',
  'ready_to_ship',
] as const;
const RECENT_ORDER_SELECT =
  'id, contact_email, status, payment_status, total_cents, currency, created_at, order_items (id, generated_item_id)';

type RecentOrder = {
  id: string;
  contact_email: string | null;
  status: string;
  payment_status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  order_items: { id: string; generated_item_id: string | null }[];
};

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: fulfilCount },
    pipelineCounts,
    { count: shippedThisMonth },
    reviewQueue,
    paidOrdersThisMonth,
    creditsIssued,
    creditsSpent,
    unpaidOrders,
    drafts,
    { count: publishedCount },
    { count: draftCount },
    { count: customizableCount },
    pendingPurchases,
    recentOrders,
    paidAwaitingDocs,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', FULFIL_STATUSES),
    Promise.all(
      PIPELINE_STATUSES.map((status) =>
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', status)
          .then(({ count }) => count ?? 0),
      ),
    ),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'shipped')
      .gte('updated_at', monthStart),
    supabase
      .from('generated_items')
      .select('id, title, product_type, created_at', { count: 'exact' })
      .eq('review_status', 'review_required')
      .order('created_at', { ascending: true })
      .limit(6),
    supabase
      .from('orders')
      .select('total_cents, currency')
      .eq('payment_status', 'paid')
      .gte('created_at', monthStart)
      .limit(1000)
      .returns<{ total_cents: number; currency: string }[]>(),
    supabase
      .from('credit_ledger')
      .select('delta')
      .gt('delta', 0)
      .gte('created_at', monthStart)
      .limit(2000)
      .returns<{ delta: number }[]>(),
    supabase
      .from('credit_ledger')
      .select('delta')
      .lt('delta', 0)
      .gte('created_at', monthStart)
      .limit(2000)
      .returns<{ delta: number }[]>(),
    supabase
      .from('orders')
      .select('id, contact_email, total_cents, currency, created_at')
      .eq('status', 'pending_payment')
      .lt('created_at', threeDaysAgo)
      .order('created_at', { ascending: true })
      .limit(4)
      .returns<
        {
          id: string;
          contact_email: string | null;
          total_cents: number;
          currency: string;
          created_at: string;
        }[]
      >(),
    supabase
      .from('catalog_items')
      .select('id, title, updated_at')
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(3)
      .returns<{ id: string; title: string; updated_at: string }[]>(),
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('is_customizable', true),
    supabase
      .from('transactions')
      .select('id, amount_cents, currency, created_at')
      .eq('type', 'credit_purchase')
      .eq('status', 'pending')
      .in('provider', ['manual', 'bank_manual'])
      .order('created_at', { ascending: true })
      .limit(4)
      .returns<{ id: string; amount_cents: number; currency: string; created_at: string }[]>(),
    supabase
      .from('orders')
      .select(RECENT_ORDER_SELECT)
      .order('created_at', { ascending: false })
      .limit(6)
      .returns<RecentOrder[]>(),
    supabase
      .from('orders')
      .select('id, contact_email, total_cents, currency, created_at')
      .eq('payment_status', 'paid')
      .in('status', ['paid', 'review_required'])
      .order('created_at', { ascending: true })
      .limit(4)
      .returns<
        {
          id: string;
          contact_email: string | null;
          total_cents: number;
          currency: string;
          created_at: string;
        }[]
      >(),
  ]);

  // Which review-required generations are already ordered (those come first).
  const reviewIds = (reviewQueue.data ?? []).map((item) => item.id);
  const { data: orderedLinks } = reviewIds.length
    ? await supabase
        .from('order_items')
        .select('generated_item_id, order_id')
        .in('generated_item_id', reviewIds)
        .returns<{ generated_item_id: string; order_id: string }[]>()
    : { data: [] as { generated_item_id: string; order_id: string }[] };
  const orderByGeneration = new Map(
    (orderedLinks ?? []).map((row) => [row.generated_item_id, row.order_id]),
  );
  const reviewItems = [...(reviewQueue.data ?? [])].sort(
    (a, b) => Number(orderByGeneration.has(b.id)) - Number(orderByGeneration.has(a.id)),
  );

  // Tech-sheet readiness for the oldest paid orders still before production.
  const docsByOrder = await Promise.all(
    (paidAwaitingDocs.data ?? []).map(async (order) => {
      const packs = (await loadOrderProductionPacks(supabase, order.id).catch(() => null)) ?? [];
      return {
        order,
        total: packs.length,
        ready: packs.filter((pack) => pack.sheet.status === 'ready').length,
      };
    }),
  );
  const ordersMissingDocs = docsByOrder.filter(
    (entry) => entry.total > 0 && entry.ready < entry.total,
  );

  const revenueByCurrency = new Map<string, number>();
  for (const order of paidOrdersThisMonth.data ?? []) {
    revenueByCurrency.set(
      order.currency,
      (revenueByCurrency.get(order.currency) ?? 0) + order.total_cents,
    );
  }
  const primaryCurrency = revenueByCurrency.has('AMD')
    ? 'AMD'
    : (revenueByCurrency.keys().next().value ?? 'AMD');
  const primaryRevenue = revenueByCurrency.get(primaryCurrency) ?? 0;
  const otherCurrencyCount = Math.max(
    0,
    revenueByCurrency.size - (revenueByCurrency.has(primaryCurrency) ? 1 : 0),
  );
  const paidOrderCount = paidOrdersThisMonth.data?.length ?? 0;
  const issued = (creditsIssued.data ?? []).reduce((sum, row) => sum + row.delta, 0);
  const spent = (creditsSpent.data ?? []).reduce((sum, row) => sum - row.delta, 0);
  const oldestReview = reviewItems[0]?.created_at ?? null;

  const attentionCount =
    reviewItems.length +
    ordersMissingDocs.length +
    (unpaidOrders.data?.length ?? 0) +
    (pendingPurchases.data?.length ?? 0);
  const pipeline = PIPELINE_STATUSES.map((status, index) => ({
    status,
    count: pipelineCounts[index] ?? 0,
  }));
  const pipelineMax = Math.max(1, ...pipeline.map((entry) => entry.count), shippedThisMonth ?? 0);

  return (
    <main className="container flex max-w-[1240px] flex-col gap-6 py-7 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">{t('adminOverview.title')}</h1>
          <p className="text-muted-foreground">
            {formatDate(now, locale)} · {t('adminOverview.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/items/new">
              <Plus className="size-4" aria-hidden="true" />
              {t('adminOverview.newItem')}
            </Link>
          </Button>
          {reviewItems[0] ? (
            <Button asChild>
              <Link href={`/admin/generated/${reviewItems[0].id}`}>
                {t('adminOverview.reviewNext')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap gap-3.5">
        <Link
          href="/admin/orders"
          className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5 rounded-xl border bg-card px-[18px] py-4 text-foreground transition-colors hover:bg-accent/40"
        >
          <span className="text-[12.5px] font-bold text-muted-foreground">
            {t('adminOverview.kpiToFulfil')}
          </span>
          <span className="text-[30px] font-extrabold leading-none">{fulfilCount ?? 0}</span>
          <span className="text-[12.5px] text-muted-foreground">
            {t('adminOverview.kpiToFulfilDetail', {
              paid: pipeline[0]?.count ?? 0,
              production: (pipeline[2]?.count ?? 0) + (pipeline[3]?.count ?? 0),
              ready: pipeline[4]?.count ?? 0,
            })}
          </span>
        </Link>
        <Link
          href="/admin/generated?status=review_required"
          className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5 rounded-xl border border-gold/60 bg-[linear-gradient(120deg,hsl(var(--gold-soft)),hsl(var(--card))_70%)] px-[18px] py-4 text-foreground"
        >
          <span className="text-[12.5px] font-bold text-muted-foreground">
            {t('adminOverview.kpiReview')}
          </span>
          <span className="text-[30px] font-extrabold leading-none">{reviewQueue.count ?? 0}</span>
          <span className="text-[12.5px] font-bold text-warning-foreground">
            {oldestReview
              ? t('adminOverview.kpiReviewOldest', { date: formatDate(oldestReview, locale) })
              : t('adminOverview.kpiReviewEmpty')}
          </span>
        </Link>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5 rounded-xl border bg-card px-[18px] py-4">
          <span className="text-[12.5px] font-bold text-muted-foreground">
            {t('adminOverview.kpiRevenue')}
          </span>
          <span className="text-[26px] font-extrabold leading-none">
            {formatPrice(primaryRevenue, primaryCurrency, locale)}
          </span>
          <span className="text-[12.5px] text-muted-foreground">
            {t('adminOverview.kpiRevenueDetail', { count: paidOrderCount })}
            {otherCurrencyCount
              ? ` · ${t('adminOverview.kpiRevenueOther', { count: otherCurrencyCount })}`
              : ''}
          </span>
        </div>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5 rounded-xl border bg-card px-[18px] py-4">
          <span className="text-[12.5px] font-bold text-muted-foreground">
            {t('adminOverview.kpiCredits')}
          </span>
          <span className="text-[30px] font-extrabold leading-none">{issued}</span>
          <span className="text-[12.5px] text-muted-foreground">
            {t('adminOverview.kpiCreditsDetail', { spent })}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* Left column */}
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-[18px] py-3.5">
              <h2 className="text-base font-semibold">{t('adminOverview.attentionTitle')}</h2>
              <span className="text-[13px] text-muted-foreground">
                {t('adminOverview.attentionSubtitle', { count: attentionCount })}
              </span>
            </div>
            {attentionCount === 0 ? (
              <p className="px-[18px] py-6 text-sm text-muted-foreground">
                {t('adminOverview.attentionEmpty')}
              </p>
            ) : null}
            {reviewItems.map((item) => {
              const orderId = orderByGeneration.get(item.id);
              return (
                <AttentionRow
                  key={item.id}
                  tone="amber"
                  icon={Images}
                  title={`${item.title ?? item.id.slice(0, 8)} · ${tDynamic(t, `generated.productType.${item.product_type}`, item.product_type)}`}
                  meta={`${
                    orderId
                      ? t('adminOverview.attGenerationOrdered', { id: orderId.slice(0, 8) })
                      : t('adminOverview.attGenerationNotOrdered')
                  } · ${t('adminOverview.attWaiting', { date: formatDate(item.created_at, locale) })}`}
                  action={{
                    href: `/admin/generated/${item.id}`,
                    label: t('adminOverview.actionReview'),
                    primary: Boolean(orderId),
                  }}
                />
              );
            })}
            {ordersMissingDocs.map(({ order, ready, total }) => (
              <AttentionRow
                key={order.id}
                tone="red"
                icon={FileText}
                title={`${t('adminOrders.detail.title', { id: order.id.slice(0, 8) })} · ${t('adminOverview.attOrderTechDocs', { ready, total })}`}
                meta={`${order.contact_email ?? t('adminOrders.noEmail')} · ${formatPrice(order.total_cents, order.currency, locale)}`}
                action={{
                  href: `/admin/orders/${order.id}`,
                  label: t('adminOverview.actionOpenOrder'),
                }}
              />
            ))}
            {(unpaidOrders.data ?? []).map((order) => (
              <AttentionRow
                key={order.id}
                tone="grey"
                icon={CreditCard}
                title={`${t('adminOrders.detail.title', { id: order.id.slice(0, 8) })} · ${t('adminOverview.attOrderUnpaid', { date: formatDate(order.created_at, locale) })}`}
                meta={`${order.contact_email ?? t('adminOrders.noEmail')} · ${formatPrice(order.total_cents, order.currency, locale)}`}
                action={{
                  href: `/admin/orders/${order.id}`,
                  label: t('adminOverview.actionOpenOrder'),
                }}
              />
            ))}
            {(pendingPurchases.data ?? []).map((purchase) => (
              <AttentionRow
                key={purchase.id}
                tone="teal"
                icon={Coins}
                title={t('adminOverview.attTransaction')}
                meta={t('adminOverview.attTransactionDetail', {
                  amount: formatPrice(purchase.amount_cents, purchase.currency, locale),
                  date: formatDate(purchase.created_at, locale),
                })}
                action={{
                  href: `/admin/transactions/${purchase.id}`,
                  label: t('adminOverview.actionConfirmPayment'),
                }}
              />
            ))}
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-[18px] py-3.5">
              <h2 className="text-base font-semibold">{t('adminOverview.recentOrders')}</h2>
              <Link href="/admin/orders" className="text-[13.5px] font-bold text-primary">
                {t('adminOverview.allOrders')}
              </Link>
            </div>
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
                  {(recentOrders.data ?? []).map((order) => {
                    const personalized = order.order_items.filter(
                      (item) => item.generated_item_id,
                    ).length;
                    return (
                      <tr key={order.id} className="border-t">
                        <td className="px-3.5 py-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-mono font-bold hover:underline"
                          >
                            {order.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3.5 py-3">
                          {order.contact_email ?? t('adminOrders.noEmail')}
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
                  {!recentOrders.data?.length ? (
                    <tr>
                      <td colSpan={7} className="px-3.5 py-6 text-sm text-muted-foreground">
                        {t('adminOrders.noOrders')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-[18px]">
            <h2 className="text-base font-semibold">{t('adminOverview.pipelineTitle')}</h2>
            <div className="flex flex-col gap-2.5 text-[13px]">
              {[...pipeline, { status: 'shipped' as const, count: shippedThisMonth ?? 0 }].map(
                (entry) => (
                  <div key={entry.status}>
                    <div className="mb-1 flex justify-between">
                      <span className="font-bold">
                        {t(`adminOverview.pipeline.${entry.status}`)}
                      </span>
                      <span>{entry.count}</span>
                    </div>
                    <div className="h-2 rounded bg-muted">
                      <div
                        className={`h-full rounded ${
                          entry.status === 'review_required'
                            ? 'bg-gold'
                            : entry.status === 'paid'
                              ? 'bg-success'
                              : entry.status === 'shipped'
                                ? 'bg-muted-foreground'
                                : 'bg-primary'
                        }`}
                        style={{ width: `${Math.round((entry.count / pipelineMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
            <Link href="/admin/orders" className="text-[13px] font-bold text-primary">
              {t('adminOverview.qaOrders')}
            </Link>
          </section>

          <section className="flex flex-col gap-2.5 rounded-xl border bg-card p-[18px]">
            <h2 className="text-base font-semibold">{t('adminOverview.catalogHealth')}</h2>
            <ul className="flex flex-col gap-2 text-[13.5px]">
              <li className="flex justify-between gap-2">
                <span>{t('adminOverview.healthPublished')}</span>
                <strong>{publishedCount ?? 0}</strong>
              </li>
              <li className="flex justify-between gap-2">
                <span>{t('adminOverview.healthCustomizable')}</span>
                <strong>{customizableCount ?? 0}</strong>
              </li>
              <li
                className={`flex justify-between gap-2 ${(draftCount ?? 0) > 0 ? 'text-warning-foreground' : ''}`}
              >
                <span>{t('adminOverview.healthDrafts')}</span>
                <strong>{draftCount ?? 0}</strong>
              </li>
            </ul>
            {drafts.data?.length ? (
              <ul className="flex flex-col gap-1.5 border-t pt-2.5 text-[13px]">
                {drafts.data.map((draft) => (
                  <li key={draft.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/admin/items/${draft.id}`}
                      className="truncate font-semibold hover:underline"
                    >
                      {draft.title}
                    </Link>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDate(draft.updated_at, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link href="/admin/items?status=draft" className="text-[13px] font-bold text-primary">
              {t('adminOverview.healthFix')}
            </Link>
          </section>

          <section className="flex flex-col gap-2.5 rounded-xl border bg-card p-[18px]">
            <h2 className="text-base font-semibold">{t('adminOverview.quickActions')}</h2>
            <div className="flex flex-col gap-1.5">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/admin/items/new">
                  <Boxes className="size-4" aria-hidden="true" />
                  {t('adminOverview.newItem')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/admin/personalization/boilerplates">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {t('adminOverview.qaBoilerplate')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/admin/currencies">
                  <Coins className="size-4" aria-hidden="true" />
                  {t('adminOverview.qaCurrencies')}
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function AttentionRow({
  tone,
  icon: Icon,
  title,
  meta,
  action,
}: {
  tone: 'amber' | 'red' | 'grey' | 'teal';
  icon: typeof Images;
  title: string;
  meta: string;
  action: { href: string; label: string; primary?: boolean };
}) {
  const toneClass = {
    amber: 'bg-warning text-warning-foreground',
    red: 'bg-danger-soft text-destructive',
    grey: 'bg-muted text-muted-foreground',
    teal: 'bg-secondary text-secondary-foreground',
  }[tone];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b px-[18px] py-3.5 last:border-b-0">
      <span className={`grid size-9 shrink-0 place-items-center rounded-[9px] ${toneClass}`}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-[1_1_260px]">
        <p className="font-bold">{title}</p>
        <p className="text-[13px] text-muted-foreground">{meta}</p>
      </div>
      <Button asChild variant={action.primary ? 'default' : 'outline'} size="sm">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    </div>
  );
}
