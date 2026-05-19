import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { getServerSupabase } from '@/lib/supabase/server';
import { CreateClient } from './create-client';

export const dynamic = 'force-dynamic';

export default async function CreatePage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <>
      <SiteHeader email={user.email ?? ''} hideCreate />
      <main className="container py-6">
        <CreateClient />
      </main>
    </>
  );
}
