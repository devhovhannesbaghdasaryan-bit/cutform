import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { PersonalizeItemForm } from '@/components/personalize-item-form';
import { Button } from '@/components/ui/button';
import { getCatalogItem } from '@/lib/marketplace';
import { listCatalogItemBoilerplates } from '@/lib/personalization-boilerplates';
import { COMFORTABLE_COLORS } from '@/lib/personalization-constants';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { resolvePublicStorageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function PersonalizeItemPage({
  params,
}: {
  params: Promise<{ itemSlug: string }>;
}) {
  const { itemSlug } = await params;
  const [item, user, t, tRoot] = await Promise.all([
    getCatalogItem(itemSlug).catch(() => null),
    getCurrentUser(),
    getTranslations('personalize'),
    getTranslations(),
  ]);
  if (!item || !item.is_customizable) notFound();

  const supabase = await getServerSupabase();
  const boilerplateRows = await listCatalogItemBoilerplates(supabase, item.id).catch(() => []);
  const hasUsablePersonalization = Boolean(item.system_prompt) || boilerplateRows.length > 0;
  if (!hasUsablePersonalization && !item.skill_id) notFound();

  const boilerplates = boilerplateRows.map((boilerplate) => ({
    id: boilerplate.id,
    name: boilerplate.name,
    imageUrl: resolvePublicStorageUrl('catalog-assets', boilerplate.image_path) ?? '',
  }));
  const thumbnailUrl = resolvePublicStorageUrl('catalog-assets', item.thumbnail_path);
  const tags = new Set(item.tags ?? []);

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-8 py-10">
        <Button asChild variant="ghost" className="px-0">
          <Link href={`/items/${item.slug}`}>{t('back')}</Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section className="space-y-4">
            <div className="product-art-frame flex aspect-[4/3] items-center justify-center rounded-lg border p-4">
              {thumbnailUrl ? (
                <Image
                  src={thumbnailUrl}
                  alt={item.title}
                  width={480}
                  height={360}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-sm text-muted-foreground">{item.title}</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
              {item.description && (
                <p className="mt-1 text-muted-foreground">{item.description}</p>
              )}
            </div>
          </section>

          <aside>
            {!user ? (
              <div className="space-y-4 rounded-lg border p-5">
                <h2 className="text-xl font-semibold">{t('signInTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('signInBody')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild>
                    <Link href={`/login?next=/personalize/${item.slug}`}>{tRoot('auth.login')}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/register?next=/personalize/${item.slug}`}>
                      {tRoot('auth.signup')}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : !hasUsablePersonalization ? (
              <div className="space-y-3 rounded-lg border p-5">
                <h2 className="text-xl font-semibold">{t('comingSoonTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('comingSoonBody')}</p>
              </div>
            ) : (
              <PersonalizeItemForm
                catalogItemId={item.id}
                boilerplates={boilerplates}
                colors={[...COMFORTABLE_COLORS]}
                showColor={tags.has('personal_color')}
                showText={tags.has('personal_text')}
                showPhoto={tags.has('personal_photo')}
                copy={{
                  chooseTemplates: t('chooseTemplates'),
                  chooseTemplatesHelp: t('chooseTemplatesHelp'),
                  image: t('image'),
                  upload: t('upload'),
                  color: t('color'),
                  text: t('text'),
                  textOptional: t('textOptional'),
                  textPlaceholder: t('textPlaceholder'),
                  charactersRemaining: t.raw('charactersRemaining'),
                  creditPerStyle: t('creditPerStyle'),
                  creditTotal: t.raw('creditTotal'),
                  generate: t.raw('generate'),
                  generatingTitle: t('generatingTitle'),
                  generatingBody: t('generatingBody'),
                  selectAtLeastOne: t('selectAtLeastOne'),
                  notEnoughCredits: t('notEnoughCredits'),
                  buyCredits: t('buyCredits'),
                  requiredCredits: t('requiredCredits'),
                  availableCredits: t('availableCredits'),
                  cancel: tRoot('common.cancel'),
                }}
              />
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
