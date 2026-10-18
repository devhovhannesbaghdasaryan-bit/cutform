import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AdminNav } from '@/app/admin/admin-nav';
import { SiteHeader } from '@/components/site-header';
import { requireAdmin } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, messages] = await Promise.all([requireAdmin(), getMessages()]);

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
      <SiteHeader email={user.email ?? ''} />
      <AdminNav />
      {children}
    </NextIntlClientProvider>
  );
}
