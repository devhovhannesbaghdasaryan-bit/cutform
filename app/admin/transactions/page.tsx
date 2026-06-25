import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">Inspect payments, credit activity, refunds, and manual adjustments.</p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_160px_160px_150px_150px_auto]">
        <input
          name="q"
          placeholder="Search IDs or provider reference"
          defaultValue={params.q ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="type"
          defaultValue={params.type ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          <option value="payment">Payment</option>
          <option value="refund">Refund</option>
          <option value="credit_purchase">Credit purchase</option>
          <option value="credit_spend">Credit spend</option>
          <option value="credit_refund">Credit refund</option>
          <option value="manual_adjustment">Manual adjustment</option>
          <option value="reversal">Reversal</option>
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="reversed">Reversed</option>
        </select>
        <input
          name="provider"
          placeholder="Provider"
          defaultValue={params.provider ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="currency"
          defaultValue={params.currency ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All currencies</option>
          <option value="AMD">AMD</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="RUB">RUB</option>
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          Filter
        </button>
        <input
          name="userId"
          placeholder="User ID"
          defaultValue={params.userId ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="orderId"
          placeholder="Order ID"
          defaultValue={params.orderId ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="dateFrom"
          type="date"
          defaultValue={params.dateFrom ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="dateTo"
          type="date"
          defaultValue={params.dateTo ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : filteredTransactions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          No transactions found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Provider route</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/admin/transactions/${transaction.id}`} className="font-medium hover:underline">
                      {transaction.id.slice(0, 8)}
                    </Link>
                    {transaction.order_id && (
                      <p className="text-xs text-muted-foreground">Order {transaction.order_id.slice(0, 8)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {transaction.user_id ? (
                      <Link href={`/admin/users/${transaction.user_id}`} className="hover:underline">
                        {transaction.user_id.slice(0, 8)}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">{transaction.type}</td>
                  <td className="px-4 py-3">{formatPrice(transaction.amount_cents, transaction.currency)}</td>
                  <td className="px-4 py-3">
                    <p>{transaction.payment_provider_route ?? transaction.provider ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">{transaction.provider_reference ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">{transaction.status}</td>
                  <td className="px-4 py-3">{formatDate(transaction.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
