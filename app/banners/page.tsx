import Link from 'next/link';
import { AdvancedBannerGenerationPanel, BannerCustomizer } from '@/components/banner-customizer';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface BannerSample {
  id: string;
  title: string;
  image_path: string;
}

interface BannerPreset {
  key: string;
  name: string;
  width_mm: number;
  height_mm: number;
  material: string;
  finish: string;
}

export default async function BannersPage() {
  const supabase = await getServerSupabase();
  const [{ data: samples }, { data: presets }] = await Promise.all([
    supabase
      .from('banner_samples')
      .select('id, title, image_path')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .returns<BannerSample[]>(),
    supabase
      .from('banner_size_presets')
      .select('key, name, width_mm, height_mm, material, finish')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<BannerPreset[]>(),
  ]);

  const fallbackSamples: BannerSample[] = samples?.length
    ? samples
    : [{ id: 'mock-store-banner', title: 'Store promotion sample', image_path: 'mock-banner' }];

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-10 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Marketing banners</p>
            <h1 className="text-3xl font-bold tracking-tight">Banners for stores and campaigns</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Start from a reusable sample, place your text, choose a production size, or prepare an advanced AI prompt with references.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/catalog?category=banners">View catalog filter</Link>
          </Button>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Customize a sample</h2>
            <p className="text-sm text-muted-foreground">
              Preview text and size choices before generating an orderable banner.
            </p>
          </div>
          <BannerCustomizer samples={fallbackSamples} presets={presets ?? []} />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Advanced AI banner</h2>
            <p className="text-sm text-muted-foreground">
              Advanced generation will spend credits and save the resulting banner as a generated item.
            </p>
          </div>
          <AdvancedBannerGenerationPanel presets={presets ?? []} />
        </section>
      </main>
    </>
  );
}
