import { AdminNav } from '@/app/admin/admin-nav';
import { SiteHeader } from '@/components/site-header';
import { requireAdmin } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <>
      <SiteHeader email={user.email ?? ''} />
      <AdminNav />
      {children}
    </>
  );
}
