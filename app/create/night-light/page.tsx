import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { NightLightPreview } from '@/components/night-light-preview';
import { getServerSupabase } from '@/lib/supabase/server';
import { CreateClient } from '../create-client';

export const dynamic = 'force-dynamic';

export default async function CreateNightLightPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/create/night-light');

  return (
    <>
      <SiteHeader email={user.email ?? ''} hideCreate />
      <main className="container space-y-4 py-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create night light</h1>
          <p className="text-muted-foreground">Upload an image, add optional base text, choose a size, and generate a preview-ready SVG.</p>
        </div>
        <NightLightPreview className="max-w-xl" />
        <CreateClient initialProductType="night_light" mode="night-light" />
      </main>
    </>
  );
}
