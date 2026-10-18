import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TRANSACTION_TYPES = [
  'payment',
  'refund',
  'credit_purchase',
  'credit_spend',
  'credit_refund',
  'manual_adjustment',
  'reversal',
] as const;

const TRANSACTION_STATUSES = ['pending', 'succeeded', 'failed', 'cancelled', 'reversed'] as const;

interface AdminTransactionRow {
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
  created_at: string;
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    provider?: string;
    currency?: string;
    userId?: string;
    orderId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);

  let query = supabase
    .from('transactions')
    .select(
      'id, user_id, order_id, credit_ledger_id, type, status, amount_cents, currency, provider, payment_provider_route, provider_reference, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (params.type) query = query.eq('type', params.type);
  if (params.status) query = query.eq('status', params.status);
  if (params.provider) query = query.eq('provider', params.provider);
  if (params.currency) query = query.eq('currency', params.currency.toUpperCase());
  if (params.userId) query = query.eq('user_id', params.userId);
  if (params.orderId) query = query.eq('order_id', params.orderId);
  if (params.dateFrom) query = query.gte('created_at', params.dateFrom);
  if (params.dateTo) query = query.lte('created_at', params.dateTo);

  const { data: transactions, error } = await query.returns<AdminTransactionRow[]>();
  const search = params.q?.trim().toLowerCase();
  const filteredTransactions = (transactions ?? []).filter((transaction) => {
    if (!search) return true;
    return [
      transaction.id,
      transaction.user_id,
      transaction.order_id,
      transaction.credit_ledger_id,
      transaction.provider_reference,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(search));
  });

  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('adminTransactions.title')}</h1>
        <p className="text-muted-foreground">{t('adminTransactions.subtitle')}</p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_160px_160px_150px_150px_auto]">
        <input
          name="q"
          placeholder={t('adminTransactions.searchPlaceholder')}
          aria-label={t('adminTransactions.searchPlaceholder')}
          defaultValue={params.q ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="type"
          defaultValue={params.type ?? ''}
          aria-label={t('adminTransactions.columns.type')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminTransactions.allTypes')}</option>
          {TRANSACTION_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`adminTransactions.types.${value}`)}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ''}
          aria-label={t('adminTransactions.columns.status')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminTransactions.allStatuses')}</option>
          {TRANSACTION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`adminTransactions.statuses.${value}`)}
            </option>
          ))}
        </select>
        <input
          name="provider"
          placeholder={t('adminTransactions.providerPlaceholder')}
          aria-label={t('adminTransactions.providerPlaceholder')}
          defaultValue={params.provider ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="currency"
          defaultValue={params.currency ?? ''}
          aria-label={t('adminTransactions.allCurrencies')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminTransactions.allCurrencies')}</option>
          <option value="AMD">AMD</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="RUB">RUB</option>
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          {t('adminTransactions.filter')}
        </button>
        <input
          name="userId"
          placeholder={t('adminTransactions.userIdPlaceholder')}
          aria-label={t('adminTransactions.userIdPlaceholder')}
          defaultValue={params.userId ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="orderId"
          placeholder={t('adminTransactions.orderIdPlaceholder')}
          aria-label={t('adminTransactions.orderIdPlaceholder')}
          defaultValue={params.orderId ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="dateFrom"
          type="date"
          defaultValue={params.dateFrom ?? ''}
          aria-label={t('adminTransactions.dateFrom')}
          title={t('adminTransactions.dateFrom')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="dateTo"
          type="date"
          defaultValue={params.dateTo ?? ''}
          aria-label={t('adminTransactions.dateTo')}
          title={t('adminTransactions.dateTo')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : filteredTransactions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          {t('adminTransactions.noTransactions')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">
                  {t('adminTransactions.columns.transaction')}
                </th>
                <th className="px-4 py-3 font-medium">{t('adminTransactions.columns.user')}</th>
                <th className="px-4 py-3 font-medium">{t('adminTransactions.columns.type')}</th>
                <th className="px-4 py-3 font-medium">{t('adminTransactions.columns.amount')}</th>
                <th className="px-4 py-3 font-medium">
                  {t('adminTransactions.columns.providerRoute')}
                </th>
                <th className="px-4 py-3 font-medium">{t('adminTransactions.columns.status')}</th>
                <th className="px-4 py-3 font-medium">{t('adminTransactions.columns.created')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/transactions/${transaction.id}`}
                      className="font-medium hover:underline"
                    >
                      {transaction.id.slice(0, 8)}
                    </Link>
                    {transaction.order_id && (
                      <p className="text-xs text-muted-foreground">
                        {t('adminTransactions.orderRef', { id: transaction.order_id.slice(0, 8) })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {transaction.user_id ? (
                      <Link
                        href={`/admin/users/${transaction.user_id}`}
                        className="hover:underline"
                      >
                        {transaction.user_id.slice(0, 8)}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tDynamic(t, `adminTransactions.types.${transaction.type}`, transaction.type)}
                  </td>
                  <td className="px-4 py-3">
                    {formatPrice(transaction.amount_cents, transaction.currency, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <p>{transaction.payment_provider_route ?? transaction.provider ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.provider_reference ?? ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {tDynamic(
                      t,
                      `adminTransactions.statuses.${transaction.status}`,
                      transaction.status,
                    )}
                  </td>
                  <td className="px-4 py-3">{formatDate(transaction.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
