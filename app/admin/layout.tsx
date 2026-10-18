import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AdminNav } from '@/app/admin/admin-nav';
import { requireAdmin } from '@/lib/admin';

const OPEN_ORDER_STATUSES = [
  'paid',
  'review_required',
  'approved_for_production',
  'in_production',
  'ready_to_ship',
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ user, supabase }, messages, t] = await Promise.all([
    requireAdmin(),
    getMessages(),
    getTranslations(),
  ]);
  const [{ count: reviewCount }, { count: openOrderCount }] = await Promise.all([
    supabase
      .from('generated_items')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'review_required'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', OPEN_ORDER_STATUSES),
  ]);

  // Admin client components read copy with useTranslations(); ship them only
  // the admin namespaces plus the shared status/common labels.
  const clientMessages = Object.fromEntries(
    Object.entries(messages).filter(
      ([namespace]) =>
        namespace.startsWith('admin') || namespace === 'status' || namespace === 'common',
    ),
  );

  return (
    <NextIntlClientProvider messages={clientMessages}>
      <div className="flex min-h-screen flex-wrap bg-background">
        <AdminNav
          reviewCount={reviewCount ?? 0}
          openOrderCount={openOrderCount ?? 0}
          email={user.email ?? ''}
        />
        <div className="flex min-w-0 flex-[999_1_560px] flex-col">
          <header className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2.5 border-b bg-card px-4 py-2.5 md:px-8">
            <form
              action="/admin/orders"
              method="get"
              className="relative min-w-0 max-w-[520px] flex-[1_1_260px]"
            >
              <label htmlFor="admin-search" className="sr-only">
                {t('adminShell.search')}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="admin-search"
                name="q"
                type="search"
                placeholder={t('adminShell.searchPlaceholder')}
                className="h-10 w-full rounded-lg border border-input bg-background pl-[38px] pr-3 text-sm font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </form>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Link
                href="/admin/generated?status=review_required"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-[13.5px] font-bold transition-colors hover:bg-accent"
              >
                <Bell className="size-4" aria-hidden="true" />
                {t('adminShell.needsAttention')}
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-extrabold ${
                    (reviewCount ?? 0) > 0
                      ? 'bg-warning text-warning-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {reviewCount ?? 0}
                </span>
              </Link>
            </div>
          </header>
          {children}
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
