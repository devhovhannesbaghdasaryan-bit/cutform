import { AlertTriangle, Check, Download, FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { reviewGeneratedItemAction } from '@/app/admin/generated/actions';
import { ProductionPackLinks, productionPackHrefs } from '@/app/admin/production-pack-links';
import { AssetFigure } from './asset-figure';
import { AssetPreviewCard } from './asset-preview-card';
import { ManufacturingFileForm } from './manufacturing-file-form';
import { ManufacturingSvgForm } from './manufacturing-svg-form';
import { requireAdmin } from '@/lib/admin';
import {
  getGeneratedItemAdminDetail,
  type AdminGeneratedPreviewOption,
  type GeneratedItemAdminDetail,
} from '@/lib/generated-items';
import type { AppLocale } from '@/lib/i18n';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { DEFAULT_TRACE_OPTIONS } from '@/lib/svg-trace';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminGeneratedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ supabase }, t, locale] = await Promise.all([
    requireAdmin(),
    getTranslations(),
    getRequestLocale(),
  ]);

  const detail = await getGeneratedItemAdminDetail(supabase, id);

  if (!detail) notFound();

  const {
    item,
    artifacts,
    sourceAssets,
    optionAssets,
    parentPreviewPath,
    parentPreviewUrl,
    parentPreviewDownloadUrl,
    parentManufacturingFileUrl,
    parentManufacturingFileDownloadUrl,
  } = detail;
  const validationWarnings = extractValidationWarnings(item.manufacturing_metadata);
  const knownStatus = REVIEW_STATUS[item.review_status];
  const status = knownStatus
    ? {
        label: t(`adminGenerated.reviewStatus.${knownStatus.key}`),
        className: knownStatus.className,
      }
    : {
        label: tDynamic(t, `status.${item.review_status}`, item.review_status),
        className: 'border text-muted-foreground',
      };
  const creditCount = { count: item.credit_cost };

  return (
    <main className="container max-w-6xl space-y-6 px-4 py-6 sm:space-y-7 sm:px-6 sm:py-8">
      <div className="min-w-0">
        <nav
          aria-label={t('adminGenerated.detail.breadcrumbLabel')}
          className="mb-2 flex gap-2 text-sm text-muted-foreground"
        >
          <Link href="/admin/generated" className="hover:text-foreground">
            {t('adminGenerated.detail.breadcrumb')}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-mono">{item.id.slice(0, 8)}</span>
        </nav>
        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
          {item.title ?? item.id.slice(0, 8)}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {status.label}
          </span>
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
            {tDynamic(t, `generated.productType.${item.product_type}`, humanize(item.product_type))}
          </span>
          <span>
            {t.rich('adminGenerated.detail.meta', {
              date: formatDate(item.created_at, locale),
              user: item.user_id.slice(0, 8),
              ...creditCount,
              mono: (chunks) => <span className="font-mono">{chunks}</span>,
            })}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="min-w-0 flex-[999_1_640px] space-y-6">
          {optionAssets.length ? (
            optionAssets.map((option) => (
              <OptionReview
                key={option.id}
                item={item}
                option={option}
                sourceAssets={sourceAssets}
                optionCount={optionAssets.length}
                locale={locale}
              />
            ))
          ) : (
            <article className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">{t('adminGenerated.detail.sourceAssets')}</h2>
              {sourceAssets.length ? (
                <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                  {sourceAssets.map((asset, index) => (
                    <AssetPreviewCard
                      key={asset.storagePath}
                      title={t('adminGenerated.detail.sourceImage', { number: index + 1 })}
                      path={asset.storagePath}
                      url={asset.url}
                      downloadUrl={asset.downloadUrl}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('adminGenerated.detail.noSourceImage')}
                </p>
              )}
              {parentPreviewPath ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <AssetPreviewCard
                    title={t('adminGenerated.detail.generatedPreview')}
                    path={parentPreviewPath}
                    url={parentPreviewUrl}
                    downloadUrl={parentPreviewDownloadUrl}
                  />
                  {item.manufacturing_file_path ? (
                    <AssetPreviewCard
                      title={t('adminGenerated.detail.manufacturingPng')}
                      path={item.manufacturing_file_path}
                      url={parentManufacturingFileUrl}
                      downloadUrl={parentManufacturingFileDownloadUrl}
                    />
                  ) : null}
                </div>
              ) : null}
            </article>
          )}

          <article className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">{t('adminGenerated.detail.customerRequest')}</h2>
            <dl className="mt-3.5 grid gap-4 sm:grid-cols-3">
              <Info
                label={t('adminGenerated.detail.engravedText')}
                value={item.custom_text}
                emphasize
              />
              <Info
                label={t('adminGenerated.detail.ledColour')}
                value={
                  item.multi_color
                    ? t('adminGenerated.detail.multiColor')
                    : item.color
                      ? tDynamic(t, `generated.color.${item.color}`, item.color)
                      : item.color
                }
                empty={t('adminGenerated.detail.notChosen')}
              />
              <Info
                label={t('adminGenerated.detail.customerPrompt')}
                value={item.prompt}
                empty={t('adminGenerated.detail.none')}
              />
            </dl>
          </article>

          <RawData
            entries={[
              hasContent(item.manufacturing_metadata)
                ? {
                    title: t('adminGenerated.detail.manufacturingMetadata'),
                    value: item.manufacturing_metadata,
                  }
                : null,
              hasContent(item.generation_options)
                ? {
                    title: t('adminGenerated.detail.generationOptions'),
                    value: item.generation_options,
                  }
                : null,
              validationWarnings.length
                ? {
                    title: t('adminGenerated.detail.validationWarnings'),
                    value: validationWarnings,
                  }
                : null,
              item.svg_content.trim()
                ? { title: t('adminGenerated.detail.rawSvg'), value: item.svg_content }
                : null,
              ...(artifacts ?? []).map((artifact) => ({
                title: t('adminGenerated.detail.artifact', { type: artifact.artifact_type }),
                value: {
                  storagePath: artifact.storage_path,
                  metadata: artifact.metadata,
                  ...(artifact.content_text ? { content: artifact.content_text } : {}),
                },
              })),
            ]}
          />
        </section>

        <aside className="min-w-0 max-w-[380px] flex-[1_1_320px] space-y-4">
          <form
            action={reviewGeneratedItemAction}
            className="space-y-4 rounded-xl border bg-card p-5"
          >
            <input type="hidden" name="generatedItemId" value={item.id} />
            <div>
              <h2 className="font-semibold">{t('adminGenerated.review.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('adminGenerated.review.help')}
              </p>
            </div>

            <fieldset className="m-0 space-y-2 border-0 p-0">
              <legend className="mb-2 text-sm font-medium">
                {t('adminGenerated.review.decision')}
              </legend>
              {DECISIONS.map((decision) => (
                <label
                  key={decision.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="radio"
                    name="decision"
                    value={decision.value}
                    defaultChecked={
                      (item.review_status === 'rejected' ? 'review_required' : 'approved') ===
                      decision.value
                    }
                    className="size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {t(`adminGenerated.review.${decision.key}`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`adminGenerated.review.${decision.key}Hint`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="note" className="text-sm font-medium">
                {t('adminGenerated.review.note')}
              </label>
              <textarea
                id="note"
                name="note"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t('adminGenerated.review.notePlaceholder')}
              />
            </div>
            <button
              type="submit"
              className="h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {t('adminGenerated.review.save')}
            </button>
          </form>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">{t('adminGenerated.docs.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {optionAssets.length > 1
                ? t('adminGenerated.docs.helpMultiple', { count: optionAssets.length })
                : t('adminGenerated.docs.helpSingle')}
            </p>
            <div className="mt-3">
              <ProductionPackLinks
                hrefs={productionPackHrefs(`/admin/generated/${item.id}/production-pack`)}
                packLabel={
                  optionAssets.length > 1 ? t('adminGenerated.docs.packAllOptions') : undefined
                }
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('adminGenerated.timeline.title')}
            </h2>
            <ol className="mt-3 space-y-3 text-sm">
              <TimelineEntry
                active
                title={status.label}
                detail={t('adminGenerated.timeline.updated', {
                  date: formatDate(item.updated_at, locale),
                })}
              />
              <TimelineEntry
                title={t('adminGenerated.timeline.submitted')}
                detail={t('adminGenerated.timeline.debited', {
                  date: formatDate(item.created_at, locale),
                  ...creditCount,
                })}
              />
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

type ReviewStatusKey = 'draft' | 'previewReady' | 'reviewRequired' | 'approved' | 'rejected';

const REVIEW_STATUS: Record<string, { key: ReviewStatusKey; className: string }> = {
  draft: { key: 'draft', className: 'bg-muted text-muted-foreground' },
  preview_ready: { key: 'previewReady', className: 'bg-accent text-accent-foreground' },
  review_required: { key: 'reviewRequired', className: 'bg-destructive/15 text-destructive' },
  approved: { key: 'approved', className: 'bg-success/15 text-success' },
  rejected: { key: 'rejected', className: 'bg-destructive/15 text-destructive' },
};

/** `value` is sent to the server; `key` picks the label/hint under adminGenerated.review. */
const DECISIONS = [
  { value: 'approved', key: 'approve' },
  { value: 'review_required', key: 'requestChanges' },
  { value: 'rejected', key: 'reject' },
] as const;

type SourceAsset = GeneratedItemAdminDetailAssets['sourceAssets'][number];
type GeneratedItemAdminDetailAssets = NonNullable<
  Awaited<ReturnType<typeof getGeneratedItemAdminDetail>>
>;
type OptionAsset = GeneratedItemAdminDetailAssets['optionAssets'][number];

function OptionReview({
  item,
  option,
  sourceAssets,
  optionCount,
  locale,
}: {
  item: GeneratedItemAdminDetail;
  option: OptionAsset;
  sourceAssets: SourceAsset[];
  optionCount: number;
  locale: AppLocale;
}) {
  const t = useTranslations();
  const name =
    getOptionName(option) ??
    t('adminGenerated.option.personalizedOption', { number: option.option_index });
  const previewLinked = option.metadata.previewRenderedFromManufacturingPng === true;
  const source = sourceAssets[0];
  const requiresSvg = option.metadata.requiresManufacturingSvg === true;

  return (
    <div className="space-y-6">
      <article className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-semibold">
              {previewLinked
                ? t('adminGenerated.option.matchTitle')
                : t('adminGenerated.option.previewAndFile')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {optionCount > 1
                ? `${t('adminGenerated.option.optionNumber', { number: option.option_index })} · `
                : ''}
              {name}
              {' · '}
              {previewLinked
                ? t('adminGenerated.option.linkedNote')
                : option.manufacturing_file_path
                  ? t('adminGenerated.option.separateNote')
                  : t('adminGenerated.option.noPngNote')}
            </p>
          </div>
          {previewLinked ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
              <Check className="size-3.5" aria-hidden="true" />
              {t('adminGenerated.option.linkedBadge')}
            </span>
          ) : option.manufacturing_file_path ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {t('adminGenerated.option.mayDifferBadge')}
            </span>
          ) : null}
        </div>

        {optionCount > 1 ? (
          <div className="mt-3">
            <ProductionPackLinks
              hrefs={productionPackHrefs(`/admin/generated/${item.id}/production-pack`, {
                option: option.id,
              })}
              packLabel={t('adminGenerated.docs.packThisOption')}
            />
          </div>
        ) : null}

        <div className="mt-4 grid gap-3.5 min-[560px]:grid-cols-3">
          {source ? (
            <AssetFigure
              title={t('adminGenerated.option.customerPhoto')}
              path={source.storagePath}
              url={source.url}
              downloadUrl={source.downloadUrl}
              tag={extension(source.storagePath)}
            />
          ) : (
            <EmptyFigure
              title={t('adminGenerated.option.customerPhoto')}
              message={t('adminGenerated.detail.noSourceImage')}
            />
          )}
          {option.manufacturing_file_path ? (
            <AssetFigure
              title={t('adminGenerated.detail.manufacturingPng')}
              path={option.manufacturing_file_path}
              url={option.manufacturingFileUrl}
              downloadUrl={option.manufacturingFileDownloadUrl}
              tag={t('adminGenerated.option.engravedTag')}
              emphasized
            />
          ) : (
            <EmptyFigure
              title={t('adminGenerated.detail.manufacturingPng')}
              message={t('adminGenerated.option.generateBelow')}
            />
          )}
          <AssetFigure
            title={t('adminGenerated.option.customerPreview')}
            path={option.preview_image_path}
            url={option.previewUrl}
            downloadUrl={option.previewDownloadUrl}
            tag={extension(option.preview_image_path)}
          />
        </div>
        {sourceAssets.length > 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('adminGenerated.option.photosUploaded', { count: sourceAssets.length })}
          </p>
        ) : null}
      </article>

      {option.manufacturing_file_path && (requiresSvg || option.manufacturingSvgPath) ? (
        <TracePanel item={item} option={option} locale={locale} />
      ) : null}

      <details
        className={`group rounded-xl border ${
          previewLinked ? 'border-destructive/40 bg-destructive/5' : 'bg-card'
        }`}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 sm:px-5 [&::-webkit-details-marker]:hidden">
          {previewLinked ? (
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-md bg-destructive/15 text-destructive"
            >
              <AlertTriangle className="size-4" />
            </span>
          ) : null}
          <span className="min-w-0 flex-[1_1_280px]">
            <span className="block font-semibold">
              {option.manufacturing_file_path
                ? t('adminGenerated.option.regenerateTitle')
                : t('adminGenerated.option.generateTitle')}
            </span>
            <span className="block text-sm text-muted-foreground">
              {previewLinked
                ? t('adminGenerated.option.regenerateWarning')
                : t('adminGenerated.option.adminOnly')}
            </span>
          </span>
          <span className="text-sm font-medium text-muted-foreground group-open:hidden">
            {t('adminGenerated.option.show')}
          </span>
          <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">
            {t('adminGenerated.option.hide')}
          </span>
        </summary>
        <div className="border-t p-4 sm:px-5">
          <ManufacturingFileForm
            generatedItemId={item.id}
            optionId={option.id}
            optionName={name}
            defaultPrompt={buildManufacturingPrompt(item, option)}
            hasExistingFile={Boolean(option.manufacturing_file_path)}
            previewLinked={previewLinked}
          />
        </div>
      </details>

      <RawData
        entries={[{ title: t('adminGenerated.detail.optionMetadata'), value: option.metadata }]}
      />
    </div>
  );
}

function TracePanel({
  item,
  option,
  locale,
}: {
  item: GeneratedItemAdminDetail;
  option: OptionAsset;
  locale: AppLocale;
}) {
  const t = useTranslations();
  const trace = readTrace(option.metadata);
  const error =
    typeof option.metadata.manufacturingSvgError === 'string'
      ? option.metadata.manufacturingSvgError
      : null;
  const status = option.metadata.manufacturingSvgStatus;
  const hasSvg = Boolean(option.manufacturingSvgUrl && option.manufacturingSvgPath);
  const hasStrokeSvg = Boolean(option.manufacturingSvgStrokeDownloadUrl);
  const qualityFailed = status === 'quality_check_failed';
  const generatedAt =
    typeof option.metadata.manufacturingSvgGeneratedAt === 'string'
      ? formatDate(option.metadata.manufacturingSvgGeneratedAt, locale)
      : null;
  const bounds = DEFAULT_TRACE_OPTIONS.inkCoverage;

  return (
    <article
      className={`rounded-xl border p-5 ${
        qualityFailed ? 'border-destructive/40 bg-destructive/5' : 'bg-card'
      }`}
    >
      <div className="flex flex-wrap items-start gap-5">
        {hasSvg && option.manufacturingSvgPath ? (
          <div className="w-full min-[560px]:w-36">
            <AssetFigure
              title="SVG"
              path={option.manufacturingSvgPath}
              url={option.manufacturingSvgUrl}
              downloadUrl={option.manufacturingSvgDownloadUrl}
              isSvg
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className={`grid size-24 shrink-0 place-items-center rounded-lg border border-dashed ${
              qualityFailed ? 'border-destructive/40 text-destructive/60' : 'text-muted-foreground'
            }`}
          >
            <FileText className="size-8" />
          </div>
        )}

        <div className="min-w-0 flex-[1_1_320px] space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div>
              <h2 className="font-semibold">{t('adminGenerated.trace.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasSvg
                  ? [
                      t('adminGenerated.trace.tracedFromPng'),
                      generatedAt,
                      trace?.source === 'admin_regeneration'
                        ? t('adminGenerated.trace.byAdmin')
                        : t('adminGenerated.trace.automatically'),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : qualityFailed
                    ? t('adminGenerated.trace.qualityFailed')
                    : status === 'trace_failed'
                      ? t('adminGenerated.trace.traceFailed')
                      : t('adminGenerated.trace.notTraced')}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                hasSvg
                  ? 'bg-success/15 text-success'
                  : qualityFailed
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {hasSvg ? (
                <>
                  <Check className="size-3.5" aria-hidden="true" />
                  {t('adminGenerated.trace.healthy')}
                </>
              ) : qualityFailed ? (
                t('adminGenerated.trace.notProduced')
              ) : (
                t('adminGenerated.trace.pending')
              )}
            </span>
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              <span className="font-semibold">{error}</span>{' '}
              {qualityFailed
                ? t('adminGenerated.trace.qualityFailedHint')
                : t('adminGenerated.trace.retryHint')}
            </p>
          ) : null}

          {trace ? (
            <dl className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={t('adminGenerated.trace.inkCoverage')}
                value={`${(trace.inkCoverage * 100).toFixed(1)}%`}
                hint={t('adminGenerated.trace.inkAccepted', {
                  min: bounds.min * 100,
                  max: bounds.max * 100,
                })}
                alert={qualityFailed}
              />
              {trace.pathCount !== null ? (
                <Stat
                  label={t('adminGenerated.trace.paths')}
                  value={String(trace.pathCount)}
                  hint={t('adminGenerated.trace.pathsHint')}
                />
              ) : null}
              {trace.units ? (
                <Stat
                  label={t('adminGenerated.trace.units')}
                  value={trace.units}
                  hint={
                    trace.units === 'mm'
                      ? t('adminGenerated.trace.unitsMm')
                      : t('adminGenerated.trace.unitsOther')
                  }
                />
              ) : null}
            </dl>
          ) : null}

          {hasSvg && !hasStrokeSvg ? (
            <p className="text-sm text-muted-foreground">{t('adminGenerated.trace.fillOnly')}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {hasSvg && option.manufacturingSvgDownloadUrl ? (
              <a
                href={option.manufacturingSvgDownloadUrl}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
              >
                <Download className="size-4" aria-hidden="true" />
                {t('adminGenerated.trace.fillSvg')}
              </a>
            ) : null}
            {hasSvg && option.manufacturingSvgStrokeDownloadUrl ? (
              <a
                href={option.manufacturingSvgStrokeDownloadUrl}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
              >
                <Download className="size-4" aria-hidden="true" />
                {t('adminGenerated.trace.strokeSvg')}
              </a>
            ) : null}
            <ManufacturingSvgForm
              generatedItemId={item.id}
              optionId={option.id}
              hasExistingSvg={hasSvg}
              primary={!hasSvg && !qualityFailed}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

interface TraceStats {
  inkCoverage: number;
  pathCount: number | null;
  units: string | null;
  source: string | null;
}

function readTrace(metadata: Record<string, unknown>): TraceStats | null {
  const trace = metadata.manufacturingSvgTrace;
  if (!trace || typeof trace !== 'object') return null;
  const record = trace as Record<string, unknown>;
  if (typeof record.inkCoverage !== 'number') return null;
  return {
    inkCoverage: record.inkCoverage,
    pathCount: typeof record.pathCount === 'number' ? record.pathCount : null,
    units: typeof record.units === 'string' ? record.units : null,
    source: typeof record.source === 'string' ? record.source : null,
  };
}

function Stat({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 text-xl font-bold tracking-tight ${alert ? 'text-destructive' : ''}`}>
        {value}
      </dd>
      <dd className="text-[11px] text-muted-foreground">{hint}</dd>
    </div>
  );
}

function EmptyFigure({ title, message }: { title: string; message: string }) {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2.5">
      <div className="grid aspect-square w-full place-items-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        {message}
      </div>
      <figcaption className="font-semibold">{title}</figcaption>
    </figure>
  );
}

function TimelineEntry({
  title,
  detail,
  active = false,
}: {
  title: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full ${active ? 'bg-success' : 'bg-border'}`}
      />
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}

function RawData({ entries }: { entries: Array<{ title: string; value: unknown } | null> }) {
  const present = entries.filter((entry): entry is { title: string; value: unknown } =>
    Boolean(entry),
  );
  if (!present.length) return null;
  return (
    <div className="rounded-xl border bg-card px-5 py-1">
      {present.map((entry) => (
        <details key={entry.title} className="border-b last:border-b-0">
          <summary className="cursor-pointer py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            {entry.title}
          </summary>
          <pre className="mb-3.5 max-h-96 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs sm:whitespace-pre">
            {typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}

function extractValidationWarnings(metadata: Record<string, unknown>) {
  const warnings = metadata.validationWarnings ?? metadata.warnings ?? [];
  return Array.isArray(warnings) ? warnings : [];
}

function hasContent(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function humanize(value: string) {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extension(path: string) {
  const ext = path.split('.').pop();
  return ext && ext !== path ? `.${ext}` : undefined;
}

function getOptionName(option: AdminGeneratedPreviewOption) {
  return typeof option.metadata.boilerplateName === 'string'
    ? option.metadata.boilerplateName
    : null;
}

function buildManufacturingPrompt(
  item: GeneratedItemAdminDetail,
  option: AdminGeneratedPreviewOption,
) {
  void item;
  const generation = option.metadata.manufacturingPngGeneration;
  if (
    generation &&
    typeof generation === 'object' &&
    'prompt' in generation &&
    typeof generation.prompt === 'string' &&
    generation.prompt.length >= 40
  ) {
    return generation.prompt;
  }
  return 'Transform the source photo into clean black-on-white pencil line art for laser engraving on a clear acrylic glass night light. Preserve the people’s recognizable likeness, pose, facial expressions, hairstyle, clothing outlines, hands, and important personal details. Draw elegant, realistic contour lines with a hand-sketched pencil or fine-ink appearance: crisp solid black strokes on a pure white background, with varied line weight and only sparse black hatching where essential for facial definition. Keep faces attractive and clearly readable while simplifying photographic detail into engravable outlines. Use continuous, well-separated lines with no tiny noisy marks, no filled dark areas, and no soft gray shading. Center and crop the subjects as one cohesive engraving composition with a clean outer silhouette suitable for display on an acrylic panel. Output only the flat engraving artwork. No color, gradients, skin tones, lighting effects, glow, shadows, grayscale wash, background scene, frame, acrylic panel, wooden base, lamp mockup, text, watermark, or extra elements.';
}

function Info({
  label,
  value,
  empty = '-',
  emphasize = false,
}: {
  label: string;
  value: string | null | undefined;
  empty?: string;
  emphasize?: boolean;
}) {
  const text = value?.trim();
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 break-words ${
          text ? (emphasize ? 'font-semibold' : 'font-medium') : 'text-muted-foreground'
        }`}
      >
        {text ? (emphasize ? `“${text}”` : text) : empty}
      </dd>
    </div>
  );
}
