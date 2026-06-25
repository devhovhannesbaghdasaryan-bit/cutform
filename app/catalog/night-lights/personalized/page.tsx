import Link from 'next/link';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { listPublishedPersonalizationModels } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

export default async function PersonalizedNightLightsPage() {
  const models = await listPublishedPersonalizationModels({
    categorySlug: 'night-lights',
    subcategorySlug: 'personalized',
  }).catch(() => []);

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Night lights / Personalized</p>
            <h1 className="text-3xl font-bold tracking-tight">Personalized night lights</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Choose a model, upload images, set comfortable LED color, and generate preview options before ordering.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/catalog?category=night-lights&subcategory=personalized">Catalog filter</Link>
          </Button>
        </div>

        {models.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            Personalized models will appear here after an admin publishes them.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <article key={model.id} className="rounded-lg border bg-card p-4">
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                  {model.mock_image_path ? `Mock image: ${model.mock_image_path}` : 'Mock image'}
                </div>
                <div className="mt-4 space-y-2">
                  <h2 className="text-lg font-semibold">{model.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Generates 3 preview options from up to 3 uploaded images.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/personalize/${model.slug}`}>Personalize</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
