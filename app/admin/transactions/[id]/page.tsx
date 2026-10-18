import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminTransactionAction } from '@/app/admin/transactions/actions';
import { Button } from '@/components/ui/button';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface TransactionDetail {
  id: string;
  user_id: string | null;
  order_id: string | null;
  credit_ledger_id: string | null;
  type: string;
  status: string;
  amount_cents: number;
  currency: string;
  provider: string | null;
  payment_provider_route: string | null;
  provider_reference: string | null;
  exchange_rate_context: Record<string, unknown>;
  admin_reason: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
}

export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);

  const [{ data: transaction, error }, { data: auditRows }] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        'id, user_id, order_id, credit_ledger_id, type, status, amount_cents, currency, provider, payment_provider_route, provider_reference, exchange_rate_context, admin_reason, metadata, created_by, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle<TransactionDetail>(),
    supabase
      .from('admin_audit_log')
      .select('id, actor_user_id, action, reason, created_at')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .returns<AuditRow[]>(),
  ]);

  if (error || !transaction) notFound();

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('adminTransactions.detail.title', { id: transaction.id.slice(0, 8) })}
          </h1>
          <p className="text-muted-foreground">
            {t('adminTransactions.detail.created', {
              date: formatDate(transaction.created_at, locale),
            })}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/transactions">{t('adminTransactions.detail.back')}</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminTransactions.detail.details')}</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Detail
                label={t('adminTransactions.detail.type')}
                value={tDynamic(t, `adminTransactions.types.${transaction.type}`, transaction.type)}
              />
              <Detail
                label={t('adminTransactions.detail.status')}
                value={tDynamic(
                  t,
                  `adminTransactions.statuses.${transaction.status}`,
                  transaction.status,
                )}
              />
              <Detail
                label={t('adminTransactions.detail.amount')}
                value={formatPrice(transaction.amount_cents, transaction.currency, locale)}
              />
              <Detail
                label={t('adminTransactions.detail.provider')}
                value={transaction.provider ?? '-'}
              />
              <Detail
                label={t('adminTransactions.detail.paymentRoute')}
                value={transaction.payment_provider_route ?? '-'}
              />
              <Detail
                label={t('adminTransactions.detail.providerReference')}
                value={transaction.provider_reference ?? '-'}
              />
              <Detail
                label={t('adminTransactions.detail.creditLedger')}
                value={transaction.credit_ledger_id ?? '-'}
              />
              <Detail
                label={t('adminTransactions.detail.createdBy')}
                value={transaction.created_by ?? '-'}
              />
              <Detail
                label={t('adminTransactions.detail.updated')}
                value={formatDate(transaction.updated_at, locale)}
              />
            </dl>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminTransactions.detail.exchangeRateContext')}</h2>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(transaction.exchange_rate_context ?? {}, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminTransactions.detail.safeMetadata')}</h2>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(transaction.metadata ?? {}, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border">
            <div className="border-b p-4">
              <h2 className="font-semibold">{t('adminTransactions.detail.auditHistory')}</h2>
            </div>
            {!auditRows?.length ? (
              <p className="p-4 text-sm text-muted-foreground">
                {t('adminTransactions.detail.noAuditRows')}
              </p>
            ) : (
              <div className="divide-y">
                {auditRows.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-4 p-4 text-sm">
                    <div>
                      <p className="font-medium">{row.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.reason ?? t('adminTransactions.detail.noReason')}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(row.created_at, locale)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">
              {t('adminTransactions.detail.linkedRecords')}
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <LinkedRecord
                label={t('adminTransactions.detail.user')}
                openLabel={t('adminTransactions.detail.open')}
                href={transaction.user_id ? `/admin/users/${transaction.user_id}` : null}
              />
              <LinkedRecord
                label={t('adminTransactions.detail.order')}
                openLabel={t('adminTransactions.detail.open')}
                href={transaction.order_id ? `/admin/orders/${transaction.order_id}` : null}
              />
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminTransactions.detail.adminReason')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {transaction.admin_reason ?? t('adminTransactions.detail.noAdminReason')}
            </p>
          </div>

          <form action={adminTransactionAction} className="space-y-4 rounded-lg border p-5">
            <input type="hidden" name="transactionId" value={transaction.id} />
            <h2 className="font-semibold">{t('adminTransactions.action.title')}</h2>
            <label className="space-y-2 text-sm">
              <span className="font-medium">{t('adminTransactions.action.label')}</span>
              <select
                name="actionType"
                defaultValue="note"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="note">{t('adminTransactions.action.note')}</option>
                <option value="manual_refund">{t('adminTransactions.action.manualRefund')}</option>
                <option value="reversal">{t('adminTransactions.action.reversal')}</option>
                <option value="reconcile">{t('adminTransactions.action.reconcile')}</option>
                <option value="ameria_check">{t('adminTransactions.action.ameriaCheck')}</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">
                {t('adminTransactions.action.reconciliationStatus')}
              </span>
              <select
                name="status"
                defaultValue=""
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="">{t('adminTransactions.action.noStatusChange')}</option>
                <option value="pending">{t('adminTransactions.statuses.pending')}</option>
                <option value="succeeded">{t('adminTransactions.statuses.succeeded')}</option>
                <option value="failed">{t('adminTransactions.statuses.failed')}</option>
                <option value="cancelled">{t('adminTransactions.statuses.cancelled')}</option>
                <option value="reversed">{t('adminTransactions.statuses.reversed')}</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">{t('adminTransactions.action.amountCents')}</span>
              <input
                name="amountCents"
                type="number"
                min="0"
                step="1"
                placeholder={String(transaction.amount_cents)}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">{t('adminTransactions.action.noteReason')}</span>
              <textarea
                name="note"
                required
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <Button type="submit" variant="outline" className="w-full">
              {t('adminTransactions.action.submit')}
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}

function LinkedRecord({
  label,
  openLabel,
  href,
}: {
  label: string;
  openLabel: string;
  href: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {href ? (
        <Link href={href} className="font-medium hover:underline">
          {openLabel}
        </Link>
      ) : (
        <span>-</span>
      )}
    </div>
  );
}
