import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface AdminOrder {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  subtotal_cents: number;
  currency: string;
  contact_email: string | null;
  created_at: string;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  let query = supabase
    .from('orders')
    .select('id, user_id, status, payment_status, subtotal_cents, currency, contact_email, created_at')
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.payment) query = query.eq('payment_status', params.payment);

  const { data: orders, error } = await query.returns<AdminOrder[]>();

  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">See order queue, payment state, and production status.</p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[220px_220px_auto]">
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All production statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_payment">Pending payment</option>
          <option value="paid">Paid</option>
          <option value="review_required">Review required</option>
          <option value="approved_for_production">Approved for production</option>
          <option value="in_production">In production</option>
          <option value="ready_to_ship">Ready to ship</option>
          <option value="shipped">Shipped</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          name="payment"
          defaultValue={params.payment ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All payment statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          Filter
        </button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !orders?.length ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          No orders found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Production</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                      {order.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p>{order.contact_email ?? 'No email'}</p>
                    <p className="text-xs text-muted-foreground">{order.user_id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">{formatPrice(order.subtotal_cents, order.currency)}</td>
                  <td className="px-4 py-3">{order.payment_status}</td>
                  <td className="px-4 py-3">{order.status}</td>
                  <td className="px-4 py-3">{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
