import Link from 'next/link';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { getTranslations } from 'next-intl/server';
import { listPublishedPersonalizationModels } from '@/lib/marketplace';
import { normalizePersonalizationMockPath, resolvePublicStorageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function PersonalizedNightLightsPage() {
  const [models, t] = await Promise.all([listPublishedPersonalizationModels({
    categorySlug: 'night-lights',
    subcategorySlug: 'personalized',
  }).catch(() => []), getTranslations()]);

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t('personalizedList.eyebrow')}</p>
            <h1 className="text-3xl font-bold tracking-tight">{t('personalizedList.title')}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t('personalizedList.subtitle')}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/catalog?category=night-lights&subcategory=personalized">{t('personalizedList.filter')}</Link>
          </Button>
        </div>

        {models.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            {t('personalizedList.empty')}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => {
              const mockImagePath = normalizePersonalizationMockPath(model.mock_image_path);
              return (
              <article key={model.id} className="rounded-lg border bg-card p-4">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border bg-muted text-sm text-muted-foreground">
                  {mockImagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Admin-managed mock images can include SVG files.
                    <img
                      src={resolvePublicStorageUrl('catalog-assets', mockImagePath) ?? undefined}
                      alt={t('personalizedList.previewAlt', { title: model.title })}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="p-4 text-center">{t('personalizedList.previewSoon')}</span>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <h2 className="text-lg font-semibold">{model.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('personalizedList.modelHelp')}
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/personalize/${model.slug}`}>{t('personalizedList.personalize')}</Link>
                  </Button>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
