import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminTransactionAction } from '@/app/admin/transactions/actions';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
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
            Transaction {transaction.id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">Created {formatDate(transaction.created_at)}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/transactions">Back to transactions</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Type" value={transaction.type} />
              <Detail label="Status" value={transaction.status} />
              <Detail
                label="Amount"
                value={formatPrice(transaction.amount_cents, transaction.currency)}
              />
              <Detail label="Provider" value={transaction.provider ?? '-'} />
              <Detail label="Payment route" value={transaction.payment_provider_route ?? '-'} />
              <Detail label="Provider reference" value={transaction.provider_reference ?? '-'} />
              <Detail label="Credit ledger" value={transaction.credit_ledger_id ?? '-'} />
              <Detail label="Created by" value={transaction.created_by ?? '-'} />
              <Detail label="Updated" value={formatDate(transaction.updated_at)} />
            </dl>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Exchange-rate context</h2>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(transaction.exchange_rate_context ?? {}, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Safe metadata</h2>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(transaction.metadata ?? {}, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border">
            <div className="border-b p-4">
              <h2 className="font-semibold">Audit history</h2>
            </div>
            {!auditRows?.length ? (
              <p className="p-4 text-sm text-muted-foreground">
                No audit rows for this transaction.
              </p>
            ) : (
              <div className="divide-y">
                {auditRows.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-4 p-4 text-sm">
                    <div>
                      <p className="font-medium">{row.action}</p>
                      <p className="text-xs text-muted-foreground">{row.reason ?? 'No reason'}</p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(row.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">Linked records</p>
            <div className="mt-4 space-y-3 text-sm">
              <LinkedRecord
                label="User"
                href={transaction.user_id ? `/admin/users/${transaction.user_id}` : null}
              />
              <LinkedRecord
                label="Order"
                href={transaction.order_id ? `/admin/orders/${transaction.order_id}` : null}
              />
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Admin reason</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {transaction.admin_reason ?? 'No admin reason recorded.'}
            </p>
          </div>

          <form action={adminTransactionAction} className="space-y-4 rounded-lg border p-5">
            <input type="hidden" name="transactionId" value={transaction.id} />
            <h2 className="font-semibold">Transaction action</h2>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Action</span>
              <select
                name="actionType"
                defaultValue="note"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="note">Add review note</option>
                <option value="manual_refund">Record manual refund</option>
                <option value="reversal">Create reversal</option>
                <option value="reconcile">Reconcile status</option>
                <option value="ameria_check">Check with Ameriabank</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Reconciliation status</span>
              <select
                name="status"
                defaultValue=""
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="">No status change</option>
                <option value="pending">Pending</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="reversed">Reversed</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Amount, cents</span>
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
              <span className="font-medium">Note / reason</span>
              <textarea
                name="note"
                required
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <Button type="submit" variant="outline" className="w-full">
              Save transaction action
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

function LinkedRecord({ label, href }: { label: string; href: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {href ? (
        <Link href={href} className="font-medium hover:underline">
          Open
        </Link>
      ) : (
        <span>-</span>
      )}
    </div>
  );
}
