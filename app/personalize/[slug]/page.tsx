import Link from 'next/link';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { notFound } from 'next/navigation';
import { CatalogMediaSlider } from '@/components/catalog-media-slider';
import { PersonalizedNightLightForm } from '@/components/personalized-night-light-form';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { getPrimaryCatalogMedia } from '@/lib/catalog-media';
import { getPublishedPersonalizationModel, listPublishedCatalogItems } from '@/lib/marketplace';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { getRequestLocale } from '@/lib/i18n-server';
import {
  getBoilerplateName,
  type PersonalizationBoilerplate,
} from '@/lib/personalization-boilerplates';
import { resolvePublicStorageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const LOCAL_NIGHT_LIGHTS = [
  { slug: '01-iron-man-illusion-lamp', title: 'Iron Man Illusion Lamp' },
  { slug: '02-personalized-baby-night-light', title: 'Personalized Baby Moon Night Light' },
  { slug: '03-romantic-couple-night-light', title: 'Romantic Moon Couple Night Light' },
  { slug: '04-batman-illusion-lamp', title: 'Batman Illusion Lamp' },
  { slug: '05-personalized-whale-night-light', title: 'Personalized Whale Ocean Night Light' },
  { slug: '06-personalized-moon-phase-lamp', title: 'Personalized Moon Phase Lamp' },
  { slug: '07-personalized-bunny-night-light', title: 'Personalized Bunny Floral Night Light' },
  { slug: '08-custom-couple-portrait-night-light', title: 'Custom Couple Portrait Night Light' },
] as const;

export default async function PersonalizedModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [model, supabase, locale, t] = await Promise.all([
    getPublishedPersonalizationModel(slug).catch(() => null),
    getServerSupabase(),
    getRequestLocale(),
    getTranslations(),
  ]);
  if (!model) notFound();
  const popularNightLights = await listPublishedCatalogItems('night-lights')
    .then((items) =>
      [...items].sort((a, b) => Number(b.is_popular) - Number(a.is_popular)).slice(0, 10),
    )
    .catch(() => []);
  const user = await getCurrentUser();
  const { data: boilerplateRows } = await supabase
    .from('personalization_boilerplates')
    .select(
      'id, model_id, admin_name, name_en, name_hy, name_ru, image_path, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order',
    )
    .eq('model_id', model.id)
    .eq('is_active', true)
    .order('sort_order')
    .returns<PersonalizationBoilerplate[]>();
  const boilerplates = (boilerplateRows ?? []).map((boilerplate) => ({
    id: boilerplate.id,
    name: getBoilerplateName(boilerplate, locale),
    imageUrl: resolvePublicStorageUrl('catalog-assets', boilerplate.image_path) ?? '',
  }));
  const tNight = await getTranslations('nightLight');
  // .raw: some entries are ICU templates ({count}) interpolated client-side.
  const copy: Record<string, string> = Object.fromEntries(
    (
      [
        'chooseTemplates',
        'chooseTemplatesHelp',
        'image',
        'upload',
        'color',
        'text',
        'textOptional',
        'textPlaceholder',
        'charactersRemaining',
        'creditPerStyle',
        'creditTotal',
        'generate',
        'generatingTitle',
        'generatingBody',
        'selectAtLeastOne',
        'notEnoughCredits',
        'buyCredits',
        'noTemplates',
        'requiredCredits',
        'availableCredits',
      ] as const
    ).map((key) => [key, tNight.raw(key)]),
  );
  copy.cancel = t('common.cancel');

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-8 py-10">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/catalog/night-lights/personalized">{t('nightLight.back')}</Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('nightLight.modelEyebrow')}</p>
              <h1 className="text-3xl font-bold tracking-tight">{t('nightLight.title')}</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">{t('nightLight.sectionIntro')}</p>
            </div>
            <div className="space-y-3" data-testid="popular-night-lights">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{t('nightLight.popularTitle')}</h2>
                  <p className="text-sm text-muted-foreground">{t('nightLight.popularHelp')}</p>
                </div>
                <Button asChild variant="link" size="sm" className="h-auto shrink-0 px-0">
                  <Link href="/catalog?category=night-lights">{t('common.view_all')}</Link>
                </Button>
              </div>

              {popularNightLights.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {popularNightLights.map((item) => {
                    const primaryMedia = getPrimaryCatalogMedia(item.media ?? []);
                    const media = primaryMedia
                      ? [primaryMedia]
                      : item.thumbnail_path
                        ? [
                            {
                              id: `${item.id}-thumbnail`,
                              media_type: 'image' as const,
                              storage_path: item.thumbnail_path,
                              alt_text: item.title,
                              poster_path: null,
                              sort_order: 0,
                              is_primary: true,
                            },
                          ]
                        : [];

                    return (
                      <Link
                        key={item.id}
                        href={`/items/${item.slug}`}
                        className="group min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                      >
                        <div className="product-art-frame border-0 p-2">
                          <CatalogMediaSlider
                            media={media}
                            fallbackTitle={item.title}
                            fallbackCategory={item.category?.name}
                            compact
                          />
                        </div>
                        <p className="truncate px-3 pb-3 pt-1 text-sm font-medium group-hover:text-primary">
                          {item.title}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              ) : LOCAL_NIGHT_LIGHTS.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {LOCAL_NIGHT_LIGHTS.map((item) => (
                    <article
                      key={item.slug}
                      className="group min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                    >
                      <div className="product-art-frame border-0 p-2">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-black/10 bg-white/35 shadow-inner">
                          <Image
                            src={`/products/night-lights/${item.slug}.png`}
                            alt={item.title}
                            fill
                            sizes="(min-width: 1024px) 18vw, 45vw"
                            className="object-cover"
                          />
                        </div>
                      </div>
                      <p className="truncate px-3 pb-3 pt-1 text-sm font-medium">{item.title}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl border bg-muted p-8 text-center text-sm text-muted-foreground shadow-sm">
                  <ImageOff className="h-8 w-8" />
                  <span>{t('nightLight.popularEmpty')}</span>
                </div>
              )}
            </div>
          </section>

          <aside>
            {user ? (
              <PersonalizedNightLightForm
                modelId={model.id}
                boilerplates={boilerplates}
                copy={copy}
              />
            ) : (
              <div className="space-y-4 rounded-lg border p-5">
                <h2 className="text-xl font-semibold">{t('nightLight.signInTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('nightLight.signInBody')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild>
                    <Link href={`/login?next=/personalize/${model.slug}`}>{t('auth.login')}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/register?next=/personalize/${model.slug}`}>
                      {t('auth.signup')}
                    </Link>
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
