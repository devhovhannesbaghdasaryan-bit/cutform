import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { getAdminUserDetail } from '@/lib/admin-users';
import type { AppLocale } from '@/lib/i18n';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { formatDate, formatPrice } from '@/lib/utils';
import { CreditAdjustmentForm, UserProfileForm } from './user-forms';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);

  const detail = await getAdminUserDetail(supabase, id);

  if (!detail) notFound();

  const { profile, balance, orders, generatedItems, transactions, auditRows } = detail;

  return (
    <main className="container max-w-6xl space-y-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile.display_name ?? t('adminUsers.detail.fallbackTitle')}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">{profile.user_id}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users">{t('adminUsers.detail.back')}</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminUsers.detail.profile')}</h2>
            <UserProfileForm
              userId={profile.user_id}
              role={profile.role}
              status={profile.status}
              preferredLocale={profile.preferred_locale}
              internalNotes={profile.internal_notes}
            />
          </div>

          <AdminTable
            title={t('adminUsers.detail.recentOrders')}
            empty={t('adminUsers.detail.noOrders')}
            locale={locale}
            rows={orders.map((order) => ({
              id: order.id,
              href: `/admin/orders/${order.id}`,
              primary: `${order.id.slice(0, 8)} - ${formatPrice(order.subtotal_cents, undefined, locale)}`,
              secondary: `${tDynamic(t, `status.${order.status}`, order.status)} / ${tDynamic(
                t,
                `adminOrders.paymentStatus.${order.payment_status}`,
                order.payment_status,
              )}`,
              createdAt: order.created_at,
            }))}
          />

          <AdminTable
            title={t('adminUsers.detail.generatedItems')}
            empty={t('adminUsers.detail.noGeneratedItems')}
            locale={locale}
            rows={generatedItems.map((item) => ({
              id: item.id,
              primary: item.title ?? item.id.slice(0, 8),
              secondary: `${item.product_type} / ${tDynamic(t, `status.${item.review_status}`, item.review_status)}`,
              createdAt: item.created_at,
            }))}
          />
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">{t('adminUsers.detail.balance')}</p>
            <p className="text-3xl font-bold">
              {t('adminUsers.credits', { count: balance?.balance ?? 0 })}
            </p>
            {balance?.updated_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('adminUsers.detail.updated', { date: formatDate(balance.updated_at, locale) })}
              </p>
            )}
          </div>

          <CreditAdjustmentForm userId={profile.user_id} />

          <AdminTable
            title={t('adminUsers.detail.transactions')}
            empty={t('adminUsers.detail.noTransactions')}
            locale={locale}
            rows={transactions.map((transaction) => ({
              id: transaction.id,
              href: `/admin/transactions/${transaction.id}`,
              primary: `${tDynamic(t, `adminTransactions.types.${transaction.type}`, transaction.type)} - ${tDynamic(
                t,
                `adminTransactions.statuses.${transaction.status}`,
                transaction.status,
              )}`,
              secondary: `${formatPrice(transaction.amount_cents, transaction.currency, locale)} ${transaction.provider ?? ''}`,
              createdAt: transaction.created_at,
            }))}
          />

          <AdminTable
            title={t('adminUsers.detail.auditHistory')}
            empty={t('adminUsers.detail.noAuditHistory')}
            locale={locale}
            rows={auditRows.map((row) => ({
              id: row.id,
              primary: row.action,
              secondary: row.reason ?? t('adminUsers.detail.noReason'),
              createdAt: row.created_at,
            }))}
          />
        </aside>
      </div>
    </main>
  );
}

function AdminTable({
  title,
  empty,
  locale,
  rows,
}: {
  title: string;
  empty: string;
  locale: AppLocale;
  rows: Array<{
    id: string;
    href?: string;
    primary: string;
    secondary: string;
    createdAt: string;
  }>;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b p-4">
        <h2 className="font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y">
          {rows.map((row) => {
            const content = (
              <>
                <p className="font-medium">{row.primary}</p>
                <p className="text-xs text-muted-foreground">{row.secondary}</p>
              </>
            );
            return (
              <div key={row.id} className="flex items-start justify-between gap-4 p-4 text-sm">
                <div>
                  {row.href ? (
                    <Link href={row.href} className="hover:underline">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(row.createdAt, locale)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
