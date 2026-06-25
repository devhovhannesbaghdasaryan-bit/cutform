import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PersonalizedNightLightForm } from '@/components/personalized-night-light-form';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { getPublishedPersonalizationModel } from '@/lib/marketplace';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PersonalizedModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [model, supabase] = await Promise.all([
    getPublishedPersonalizationModel(slug).catch(() => null),
    getServerSupabase(),
  ]);
  if (!model) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-8 py-10">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/catalog/night-lights/personalized">Back to personalized night lights</Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <section className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Personalized model</p>
              <h1 className="text-3xl font-bold tracking-tight">{model.title}</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Upload images, choose a comfortable LED color, and add short base text. You will choose one of 3 generated previews before buying.
              </p>
            </div>
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
              {model.mock_image_path ? `Mock image: ${model.mock_image_path}` : 'Mock image'}
            </div>
          </section>

          <aside>
            {user ? (
              <PersonalizedNightLightForm modelId={model.id} />
            ) : (
              <div className="space-y-4 rounded-lg border p-5">
                <h2 className="text-xl font-semibold">Sign in to generate</h2>
                <p className="text-sm text-muted-foreground">
                  You can browse models as a guest, but generation uses your uploads, credit balance, and saved preview history.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild>
                    <Link href={`/login?next=/personalize/${model.slug}`}>Log in</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/register?next=/personalize/${model.slug}`}>Register</Link>
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
