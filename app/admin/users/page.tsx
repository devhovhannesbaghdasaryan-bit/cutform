import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin';
import { listAdminUsers } from '@/lib/admin-users';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);

  const { users, error, balanceByUser, orderCountByUser } = await listAdminUsers(supabase, params);

  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('adminUsers.title')}</h1>
        <p className="text-muted-foreground">{t('adminUsers.subtitle')}</p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <input
          name="q"
          placeholder={t('adminUsers.searchPlaceholder')}
          aria-label={t('adminUsers.searchPlaceholder')}
          defaultValue={params.q ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="role"
          defaultValue={params.role ?? ''}
          aria-label={t('adminUsers.columns.role')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminUsers.allRoles')}</option>
          <option value="user">{t('adminUsers.roles.user')}</option>
          <option value="admin">{t('adminUsers.roles.admin')}</option>
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ''}
          aria-label={t('adminUsers.columns.status')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminUsers.allStatuses')}</option>
          <option value="active">{t('adminUsers.statuses.active')}</option>
          <option value="suspended">{t('adminUsers.statuses.suspended')}</option>
          <option value="disabled">{t('adminUsers.statuses.disabled')}</option>
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          {t('adminUsers.filter')}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          {t('adminUsers.noUsers')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t('adminUsers.columns.user')}</th>
                <th className="px-4 py-3 font-medium">{t('adminUsers.columns.role')}</th>
                <th className="px-4 py-3 font-medium">{t('adminUsers.columns.status')}</th>
                <th className="px-4 py-3 font-medium">{t('adminUsers.columns.locale')}</th>
                <th className="px-4 py-3 font-medium">{t('adminUsers.columns.orders')}</th>
                <th className="px-4 py-3 font-medium">{t('adminUsers.columns.balance')}</th>
                <th className="px-4 py-3 font-medium">{t('adminUsers.columns.created')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const balance = balanceByUser.get(user.user_id);
                return (
                  <tr key={user.user_id} className="border-t">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user.user_id}`}
                        className="font-medium hover:underline"
                      >
                        {user.display_name ?? t('adminUsers.unnamedUser')}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{user.user_id}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {tDynamic(t, `adminUsers.roles.${user.role}`, user.role)}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {tDynamic(t, `adminUsers.statuses.${user.status}`, user.status)}
                    </td>
                    <td className="px-4 py-3">{user.preferred_locale ?? '-'}</td>
                    <td className="px-4 py-3">{orderCountByUser.get(user.user_id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <p>{t('adminUsers.credits', { count: balance?.balance ?? 0 })}</p>
                    </td>
                    <td className="px-4 py-3">{formatDate(user.created_at, locale)}</td>
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
