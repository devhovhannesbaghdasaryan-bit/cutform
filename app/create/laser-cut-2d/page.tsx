import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { Wood2DPreview } from '@/components/wood-2d-preview';
import { getServerSupabase } from '@/lib/supabase/server';
import { CreateClient } from '../create-client';

export const dynamic = 'force-dynamic';

export default async function CreateLaserCut2DPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/create/laser-cut-2d');

  return (
    <>
      <SiteHeader email={user.email ?? ''} hideCreate />
      <main className="container space-y-4 py-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create 2D laser-cut item</h1>
          <p className="text-muted-foreground">Upload a reference image, choose toy, decoration, or constructor, and generate cuttable SVG layers.</p>
        </div>
        <Wood2DPreview className="max-w-xl" />
        <CreateClient initialProductType="laser_cut_2d_decoration" mode="laser-cut-2d" />
      </main>
    </>
  );
}
