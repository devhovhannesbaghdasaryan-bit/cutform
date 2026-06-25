import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface AdminUserRow {
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
  preferred_locale: string | null;
  created_at: string;
}

interface BalanceRow {
  user_id: string;
  balance: number;
}

interface OrderOwnerRow {
  user_id: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  let query = supabase
    .from('profiles')
    .select('user_id, role, status, display_name, preferred_locale, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (params.role) query = query.eq('role', params.role);
  if (params.status) query = query.eq('status', params.status);

  const { data: users, error } = await query.returns<AdminUserRow[]>();
  const search = params.q?.trim().toLowerCase();
  const filteredUsers = (users ?? []).filter((user) => {
    if (!search) return true;
    return (
      user.user_id.toLowerCase().includes(search)
      || user.display_name?.toLowerCase().includes(search)
    );
  });

  const userIds = filteredUsers.map((user) => user.user_id);
  const { data: balances } = userIds.length
    ? await supabase
        .from('credit_accounts')
        .select('user_id, balance')
        .in('user_id', userIds)
        .returns<BalanceRow[]>()
    : { data: [] as BalanceRow[] };
  const { data: orderOwners } = userIds.length
    ? await supabase.from('orders').select('user_id').in('user_id', userIds).returns<OrderOwnerRow[]>()
    : { data: [] as OrderOwnerRow[] };

  const balanceByUser = new Map((balances ?? []).map((row) => [row.user_id, row]));
  const orderCountByUser = new Map<string, number>();
  for (const row of orderOwners ?? []) {
    orderCountByUser.set(row.user_id, (orderCountByUser.get(row.user_id) ?? 0) + 1);
  }

  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Search accounts, review status, and open support details.</p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <input
          name="q"
          placeholder="Search name or user ID"
          defaultValue={params.q ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="role"
          defaultValue={params.role ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="disabled">Disabled</option>
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          Filter
        </button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          No users found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Locale</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const balance = balanceByUser.get(user.user_id);
                return (
                  <tr key={user.user_id} className="border-t">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${user.user_id}`} className="font-medium hover:underline">
                        {user.display_name ?? 'Unnamed user'}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{user.user_id}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{user.role}</td>
                    <td className="px-4 py-3 capitalize">{user.status}</td>
                    <td className="px-4 py-3">{user.preferred_locale ?? '-'}</td>
                    <td className="px-4 py-3">{orderCountByUser.get(user.user_id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <p>{balance?.balance ?? 0} credits</p>
                    </td>
                    <td className="px-4 py-3">{formatDate(user.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
