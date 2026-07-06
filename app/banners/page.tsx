import Link from 'next/link';
import { AdvancedBannerGenerationPanel, BannerCustomizer } from '@/components/banner-customizer';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { listBannerSamples, listBannerSizePresets, type BannerSample } from '@/lib/banners';
import { getTranslations } from 'next-intl/server';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BannersPage() {
  const [supabase, t, tBanner] = await Promise.all([
    getServerSupabase(),
    getTranslations(),
    getTranslations('banner'),
  ]);
  const [{ data: samples }, { data: presets }] = await Promise.all([
    listBannerSamples(supabase),
    listBannerSizePresets(supabase),
  ]);

  const fallbackSamples: BannerSample[] = samples?.length
    ? samples
    : [{ id: 'mock-store-banner', title: t('banners.sampleFallback'), image_path: 'mock-banner' }];
  const bannerCopy = Object.fromEntries(
    (
      [
        'sample',
        'size',
        'text',
        'textPlaceholder',
        'previewText',
        'custom',
        'review',
        'unavailable',
        'advancedPrompt',
        'promptPlaceholder',
        'reference',
        'rights',
        'generate',
        'disclaimer',
      ] as const
    ).map((key) => [key, tBanner.raw(key)]),
  ) as Parameters<typeof BannerCustomizer>[0]['copy'];

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-10 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t('banners.eyebrow')}</p>
            <h1 className="text-3xl font-bold tracking-tight">{t('banners.title')}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{t('banners.subtitle')}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/catalog?category=banners">{t('banners.filter')}</Link>
          </Button>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t('banners.customize')}</h2>
            <p className="text-sm text-muted-foreground">{t('banners.customizeHelp')}</p>
          </div>
          <BannerCustomizer samples={fallbackSamples} presets={presets ?? []} copy={bannerCopy} />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t('banners.advanced')}</h2>
            <p className="text-sm text-muted-foreground">{t('banners.advancedHelp')}</p>
          </div>
          <AdvancedBannerGenerationPanel presets={presets ?? []} copy={bannerCopy} />
        </section>
      </main>
    </>
  );
}
