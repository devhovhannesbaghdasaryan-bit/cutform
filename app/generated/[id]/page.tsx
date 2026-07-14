import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { addGeneratedItemToCartAction } from '@/app/generated/actions';
import { GeneratedPreviewSelector } from '@/components/generated-preview-selector';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { formatLocalizedCurrency, formatLocalizedDate } from '@/lib/i18n';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import type { GeneratedItemRow, PersonalizedPreviewOptionRow } from '@/lib/generated-items';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import type { Tables } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type GeneratedItemDetail = Pick<
  GeneratedItemRow,
  | 'id'
  | 'title'
  | 'product_type'
  | 'review_status'
  | 'credit_cost'
  | 'preview_path'
  | 'selected_preview_path'
  | 'custom_text'
  | 'color'
  | 'multi_color'
  | 'svg_content'
  | 'manufacturing_metadata'
  | 'generation_options'
  | 'created_at'
> & {
  catalog_item: Pick<Tables<'catalog_items'>, 'title' | 'slug' | 'price_cents' | 'currency'> | null;
};

type PreviewOption = Pick<
  PersonalizedPreviewOptionRow,
  'id' | 'option_index' | 'preview_image_path' | 'status' | 'metadata'
> & {
  boilerplate: Pick<PersonalizationBoilerplate, 'name'> | null;
};

export default async function GeneratedItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

  if (!user) redirect(`/login?next=/generated/${id}`);

  const [{ data: item, error }, { data: options }, locale] = await Promise.all([
    supabase
      .from('generated_items')
      .select(
        'id, title, product_type, review_status, credit_cost, preview_path, selected_preview_path, custom_text, color, multi_color, svg_content, manufacturing_metadata, generation_options, created_at, catalog_item:catalog_items(title, slug, price_cents, currency)',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle<GeneratedItemDetail>(),
    supabase
      .from('personalized_preview_options')
      .select(
        'id, option_index, preview_image_path, status, metadata, boilerplate:personalization_boilerplates(name)',
      )
      .eq('generated_item_id', id)
      .order('option_index', { ascending: true })
      .returns<PreviewOption[]>(),
    getRequestLocale(),
  ]);
  const t = await getTranslations();

  if (error || !item) notFound();

  const previewOptions = await Promise.all(
    (options ?? []).map(async (option) => ({
      ...option,
      previewUrl:
        (
          await supabase.storage
            .from('generated-assets')
            .createSignedUrl(option.preview_image_path, 60 * 60)
        ).data?.signedUrl ?? null,
    })),
  );

  const selectedPath = item.selected_preview_path ?? item.preview_path;
  const fallbackPreviewUrl = selectedPath
    ? ((await supabase.storage.from('generated-assets').createSignedUrl(selectedPath, 60 * 60)).data
        ?.signedUrl ?? null)
    : null;
  const warnings = extractValidationWarnings(item.manufacturing_metadata);
  const bannerDetails =
    item.product_type === 'banner' ? extractBannerDetails(item.generation_options) : null;
  const hasPreviewOptions = previewOptions.length > 0;
  const canOrder = item.review_status !== 'rejected';
  const salePriceCents = item.catalog_item?.price_cents ?? 0;
  const saleCurrency = item.catalog_item?.currency ?? 'AMD';
  const localizedProductType = tDynamic(
    t,
    `generated.productType.${item.product_type}`,
    item.product_type.replaceAll('_', ' '),
  );
  const itemTitle =
    item.product_type === 'personalized_night_light'
      ? localizedProductType
      : (item.title ?? localizedProductType);
  const reviewStatus = tDynamic(
    t,
    `status.${item.review_status}`,
    item.review_status.replaceAll('_', ' '),
  );
  const lightColor = item.multi_color
    ? t('generated.multiColor')
    : tDynamic(t, `generated.color.${item.color}`, item.color?.replaceAll('_', ' ') ?? '-');

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-6xl space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t('generated.created', { date: formatLocalizedDate(locale, item.created_at) })}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{itemTitle}</h1>
            <p className="text-muted-foreground">
              {reviewStatus} &middot;{' '}
              {t('generated.creditsUsed', { count: String(item.credit_cost) })}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">{t('generated.backDashboard')}</Link>
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <GeneratedPreviewSelector
              generatedItemId={item.id}
              itemTitle={itemTitle}
              options={previewOptions.map((option) => {
                const style =
                  typeof option.metadata.engravingStyle === 'string'
                    ? option.metadata.engravingStyle
                    : null;
                const styleFallback =
                  typeof option.metadata.engravingStyleLabel === 'string'
                    ? option.metadata.engravingStyleLabel
                    : '';
                const styleLabel = style
                  ? tDynamic(t, `generated.laserStyle.${style}`, styleFallback)
                  : null;
                const boilerplateName =
                  option.boilerplate?.name ??
                  (typeof option.metadata.boilerplateName === 'string'
                    ? option.metadata.boilerplateName
                    : null);
                const label =
                  styleLabel && boilerplateName
                    ? `${boilerplateName} · ${styleLabel}`
                    : (styleLabel ??
                      boilerplateName ??
                      t('generated.option', { number: String(option.option_index) }));
                return {
                  id: option.id,
                  previewUrl: option.previewUrl,
                  label,
                  priceCents: previewOptionPriceCents(option, salePriceCents),
                };
              })}
              fallbackPreviewUrl={fallbackPreviewUrl}
              locale={locale}
              currency={saleCurrency}
              priceLabel={
                salePriceCents > 0
                  ? t('generated.priceEach', {
                      price: formatLocalizedCurrency(locale, salePriceCents, saleCurrency),
                    })
                  : null
              }
              copy={{
                resultsTitle: t('personalize.results'),
                resultsHelp: t('personalize.resultsHelp'),
                addSelected: t('personalize.addSelected'),
                previewUnavailable: t('generated.previewUnavailable'),
                noPreview: t('generated.noPreview'),
                // Raw templates ({name}/{price}) — the client component interpolates them.
                previewAlt: t.raw('generated.previewAlt'),
                total: t.raw('generated.total'),
              }}
            />
            {!hasPreviewOptions && item.svg_content ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">{t('generated.rawSvg')}</h2>
                <pre className="max-h-96 overflow-auto rounded-lg border bg-muted p-4 text-xs">
                  {item.svg_content}
                </pre>
              </section>
            ) : null}
            {warnings.length ? (
              <section className="warning-panel space-y-3 rounded-lg border p-4">
                <h2 className="text-lg font-semibold">{t('generated.warnings')}</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>

          <aside className="space-y-6">
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">{t('generated.customization')}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {item.custom_text ? (
                  <div>
                    <dt className="text-muted-foreground">{t('generated.personalizedText')}</dt>
                    <dd>{item.custom_text}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">{t('generated.lightColor')}</dt>
                  <dd className="capitalize">{lightColor}</dd>
                </div>
              </dl>
            </div>

            {bannerDetails ? (
              <div className="rounded-lg border p-5">
                <h2 className="font-semibold">{t('generated.bannerReview')}</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t('generated.size')}</dt>
                    <dd>{bannerDetails.sizeLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('generated.textPlacement')}</dt>
                    <dd>{bannerDetails.textPlacement}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {!hasPreviewOptions ? (
              <form action={addGeneratedItemToCartAction} className="rounded-lg border p-5">
                <input type="hidden" name="generatedItemId" value={item.id} />
                {salePriceCents > 0 && (
                  <p className="mb-3 text-center text-lg font-semibold">
                    {formatLocalizedCurrency(locale, salePriceCents, saleCurrency)}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={!canOrder}>
                  {t('generated.addToCart')}
                </Button>
                {!canOrder && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('generated.selectPreview')}
                  </p>
                )}
              </form>
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}

/** Per-option price in cents: the style's own price, falling back to the catalog price. */
function previewOptionPriceCents(
  option: { metadata: Record<string, unknown> },
  salePriceCents: number,
): number | null {
  const raw = option.metadata.unitPriceCents;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return salePriceCents > 0 ? salePriceCents : null;
}

function extractValidationWarnings(metadata: Record<string, unknown>) {
  const warnings = metadata.validationWarnings ?? metadata.warnings ?? [];
  return Array.isArray(warnings)
    ? warnings.filter((warning): warning is string => typeof warning === 'string')
    : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function extractBannerDetails(options: Record<string, unknown>) {
  const sizePreset = asRecord(options.sizePreset);
  const placement = asRecord(options.textPlacement);
  const dimensions =
    typeof sizePreset.width_mm === 'number' && typeof sizePreset.height_mm === 'number'
      ? `${sizePreset.width_mm}x${sizePreset.height_mm} mm`
      : null;
  const sizeLabel = [
    asString(sizePreset.name) ?? asString(options.bannerSizeKey) ?? 'Size requires review',
    dimensions,
  ]
    .filter(Boolean)
    .join(' - ');
  const placementLabel = [
    asString(placement.zone) ?? 'center',
    asString(placement.alignment) ?? 'center',
  ].join(', ');

  return {
    sizeLabel,
    textPlacement: placementLabel,
  };
}
