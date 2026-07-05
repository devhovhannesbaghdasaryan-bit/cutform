import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  adjustAdminUserCreditsAction,
  updateAdminUserProfileAction,
} from '@/app/admin/users/actions';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [
    { data: profile, error },
    { data: balance },
    { data: orders },
    { data: generatedItems },
    { data: transactions },
    { data: auditRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, role, status, display_name, preferred_locale, internal_notes, created_at, updated_at')
      .eq('user_id', id)
      .maybeSingle(),
    supabase
      .from('credit_accounts')
      .select('balance, updated_at')
      .eq('user_id', id)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, status, payment_status, subtotal_cents, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('generated_items')
      .select('id, title, product_type, review_status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('transactions')
      .select('id, type, status, amount_cents, currency, provider, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('admin_audit_log')
      .select('id, action, reason, created_at')
      .eq('target_user_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  if (error || !profile) notFound();

  return (
    <main className="container max-w-6xl space-y-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{profile.display_name ?? 'User detail'}</h1>
          <p className="font-mono text-sm text-muted-foreground">{profile.user_id}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users">Back to users</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Profile</h2>
            <form action={updateAdminUserProfileAction} className="mt-4 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="userId" value={profile.user_id} />
              <label className="space-y-2 text-sm">
                <span className="font-medium">Role</span>
                <select
                  name="role"
                  defaultValue={profile.role}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Status</span>
                <select
                  name="status"
                  defaultValue={profile.status}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Preferred locale</span>
                <select
                  name="preferredLocale"
                  defaultValue={profile.preferred_locale ?? ''}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="">Auto</option>
                  <option value="en">English</option>
                  <option value="ru">Russian</option>
                  <option value="am">Armenian</option>
                </select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium">Internal notes</span>
                <textarea
                  name="internalNotes"
                  defaultValue={profile.internal_notes ?? ''}
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <div className="md:col-span-2">
                <Button type="submit">Save user changes</Button>
              </div>
            </form>
          </div>

          <AdminTable
            title="Recent orders"
            empty="No orders found."
            rows={(orders ?? []).map((order) => ({
              id: order.id,
              href: `/admin/orders/${order.id}`,
              primary: `${order.id.slice(0, 8)} - ${formatPrice(order.subtotal_cents)}`,
              secondary: `${order.status} / ${order.payment_status}`,
              createdAt: order.created_at,
            }))}
          />

          <AdminTable
            title="Generated items"
            empty="No generated items found."
            rows={(generatedItems ?? []).map((item) => ({
              id: item.id,
              primary: item.title ?? item.id.slice(0, 8),
              secondary: `${item.product_type} / ${item.review_status}`,
              createdAt: item.created_at,
            }))}
          />
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-3xl font-bold">{balance?.balance ?? 0} credits</p>
            {balance?.updated_at && (
              <p className="mt-2 text-xs text-muted-foreground">Updated {formatDate(balance.updated_at)}</p>
            )}
          </div>

          <form action={adjustAdminUserCreditsAction} className="space-y-4 rounded-lg border p-5">
            <input type="hidden" name="userId" value={profile.user_id} />
            <h2 className="font-semibold">Manual credit adjustment</h2>
            <div>
              <select
                name="direction"
                defaultValue="credit"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <div>
              <input
                name="amount"
                type="number"
                min="1"
                step="1"
                required
                placeholder="Amount"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <textarea
              name="reason"
              required
              placeholder="Reason"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" variant="outline">Apply adjustment</Button>
          </form>

          <AdminTable
            title="Transactions"
            empty="No transactions found."
            rows={(transactions ?? []).map((transaction) => ({
              id: transaction.id,
              href: `/admin/transactions/${transaction.id}`,
              primary: `${transaction.type} - ${transaction.status}`,
              secondary: `${formatPrice(transaction.amount_cents, transaction.currency)} ${transaction.provider ?? ''}`,
              createdAt: transaction.created_at,
            }))}
          />

          <AdminTable
            title="Audit history"
            empty="No audit history found."
            rows={(auditRows ?? []).map((row) => ({
              id: row.id,
              primary: row.action,
              secondary: row.reason ?? 'No reason',
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
  rows,
}: {
  title: string;
  empty: string;
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
                <div>{row.href ? <Link href={row.href} className="hover:underline">{content}</Link> : content}</div>
                <p className="shrink-0 text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
