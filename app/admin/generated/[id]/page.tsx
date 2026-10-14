import { AlertTriangle, Check, Download, FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { reviewGeneratedItemAction } from '@/app/admin/generated/actions';
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
import { DEFAULT_TRACE_OPTIONS } from '@/lib/svg-trace';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminGeneratedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

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
  const status = REVIEW_STATUS[item.review_status] ?? {
    label: item.review_status,
    className: 'border text-muted-foreground',
  };

  return (
    <main className="container max-w-6xl space-y-6 px-4 py-6 sm:space-y-7 sm:px-6 sm:py-8">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-2 flex gap-2 text-sm text-muted-foreground">
          <Link href="/admin/generated" className="hover:text-foreground">
            Generations
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
            {humanize(item.product_type)}
          </span>
          <span>
            Generated {formatDate(item.created_at)} · user{' '}
            <span className="font-mono">{item.user_id.slice(0, 8)}</span> · {item.credit_cost}{' '}
            {item.credit_cost === 1 ? 'credit' : 'credits'}
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
              />
            ))
          ) : (
            <article className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Source assets</h2>
              {sourceAssets.length ? (
                <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                  {sourceAssets.map((asset, index) => (
                    <AssetPreviewCard
                      key={asset.storagePath}
                      title={`Source image ${index + 1}`}
                      path={asset.storagePath}
                      url={asset.url}
                      downloadUrl={asset.downloadUrl}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No source image was stored.</p>
              )}
              {parentPreviewPath ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <AssetPreviewCard
                    title="Generated preview"
                    path={parentPreviewPath}
                    url={parentPreviewUrl}
                    downloadUrl={parentPreviewDownloadUrl}
                  />
                  {item.manufacturing_file_path ? (
                    <AssetPreviewCard
                      title="Manufacturing PNG"
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
            <h2 className="font-semibold">Customer request</h2>
            <dl className="mt-3.5 grid gap-4 sm:grid-cols-3">
              <Info label="Engraved text" value={item.custom_text} emphasize />
              <Info
                label="LED colour"
                value={item.multi_color ? 'Multi color' : item.color}
                empty="Not chosen"
              />
              <Info label="Customer prompt" value={item.prompt} empty="None" />
            </dl>
          </article>

          <RawData
            entries={[
              hasContent(item.manufacturing_metadata)
                ? { title: 'Manufacturing metadata', value: item.manufacturing_metadata }
                : null,
              hasContent(item.generation_options)
                ? { title: 'Generation options', value: item.generation_options }
                : null,
              validationWarnings.length
                ? { title: 'Validation warnings', value: validationWarnings }
                : null,
              item.svg_content.trim()
                ? { title: 'Raw manufacturing SVG', value: item.svg_content }
                : null,
              ...(artifacts ?? []).map((artifact) => ({
                title: `Artifact · ${artifact.artifact_type}`,
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
              <h2 className="font-semibold">Review decision</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Approving releases the production file to the workshop.
              </p>
            </div>

            <fieldset className="m-0 space-y-2 border-0 p-0">
              <legend className="mb-2 text-sm font-medium">Decision</legend>
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
                    <span className="block font-semibold">{decision.label}</span>
                    <span className="block text-xs text-muted-foreground">{decision.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="note" className="text-sm font-medium">
                Internal note
              </label>
              <textarea
                id="note"
                name="note"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Reason, production concerns, or change request."
              />
            </div>
            <button
              type="submit"
              className="h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Save review
            </button>
          </form>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Timeline
            </h2>
            <ol className="mt-3 space-y-3 text-sm">
              <TimelineEntry
                active
                title={status.label}
                detail={`Updated ${formatDate(item.updated_at)}`}
              />
              <TimelineEntry
                title="Submitted"
                detail={`${formatDate(item.created_at)} · ${item.credit_cost} ${
                  item.credit_cost === 1 ? 'credit' : 'credits'
                } debited`}
              />
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

const REVIEW_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  preview_ready: {
    label: 'Preview ready · awaiting review',
    className: 'bg-accent text-accent-foreground',
  },
  review_required: {
    label: 'Changes requested',
    className: 'bg-destructive/15 text-destructive',
  },
  approved: { label: 'Approved', className: 'bg-success/15 text-success' },
  rejected: { label: 'Rejected', className: 'bg-destructive/15 text-destructive' },
};

const DECISIONS = [
  {
    value: 'approved',
    label: 'Approve',
    hint: 'Production file is correct and matches the preview',
  },
  {
    value: 'review_required',
    label: 'Request changes',
    hint: 'Customer must upload a different photo or text',
  },
  { value: 'rejected', label: 'Reject', hint: 'Cannot be produced' },
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
}: {
  item: GeneratedItemAdminDetail;
  option: OptionAsset;
  sourceAssets: SourceAsset[];
  optionCount: number;
}) {
  const name = getOptionName(option);
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
                ? 'Will the produced item match the preview?'
                : 'Preview and production file'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {optionCount > 1 ? `Option ${option.option_index} · ` : ''}
              {name}
              {previewLinked
                ? ' · the customer preview was rendered from this manufacturing PNG.'
                : option.manufacturing_file_path
                  ? ' · the manufacturing PNG was generated separately from the preview.'
                  : ' · no manufacturing PNG yet.'}
            </p>
          </div>
          {previewLinked ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
              <Check className="size-3.5" aria-hidden="true" />
              Preview linked to production file
            </span>
          ) : option.manufacturing_file_path ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Preview may differ from production file
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3.5 min-[560px]:grid-cols-3">
          {source ? (
            <AssetFigure
              title="Customer photo"
              path={source.storagePath}
              url={source.url}
              downloadUrl={source.downloadUrl}
              tag={extension(source.storagePath)}
            />
          ) : (
            <EmptyFigure title="Customer photo" message="No source image was stored." />
          )}
          {option.manufacturing_file_path ? (
            <AssetFigure
              title="Manufacturing PNG"
              path={option.manufacturing_file_path}
              url={option.manufacturingFileUrl}
              downloadUrl={option.manufacturingFileDownloadUrl}
              tag="Engraved"
              emphasized
            />
          ) : (
            <EmptyFigure
              title="Manufacturing PNG"
              message="Generate it below to get a production file."
            />
          )}
          <AssetFigure
            title="Customer preview"
            path={option.preview_image_path}
            url={option.previewUrl}
            downloadUrl={option.previewDownloadUrl}
            tag={extension(option.preview_image_path)}
          />
        </div>
        {sourceAssets.length > 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {sourceAssets.length} customer photos were uploaded; the first is shown.
          </p>
        ) : null}
      </article>

      {option.manufacturing_file_path && (requiresSvg || option.manufacturingSvgPath) ? (
        <TracePanel item={item} option={option} />
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
                ? 'Regenerate the manufacturing PNG'
                : 'Generate the manufacturing PNG'}
            </span>
            <span className="block text-sm text-muted-foreground">
              {previewLinked
                ? 'Replaces the production file. The preview the customer approved will no longer match it.'
                : 'Admin-only production step; the customer preview is not affected.'}
            </span>
          </span>
          <span className="text-sm font-medium text-muted-foreground group-open:hidden">Show</span>
          <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">
            Hide
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

      <RawData entries={[{ title: 'Option metadata', value: option.metadata }]} />
    </div>
  );
}

function TracePanel({ item, option }: { item: GeneratedItemAdminDetail; option: OptionAsset }) {
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
      ? formatDate(option.metadata.manufacturingSvgGeneratedAt)
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
              <h2 className="font-semibold">Manufacturing SVGs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasSvg
                  ? `Traced from the PNG${generatedAt ? ` · ${generatedAt}` : ''}${
                      trace?.source === 'admin_regeneration' ? ' · by an admin' : ' · automatically'
                    }`
                  : qualityFailed
                    ? 'Not produced: the PNG failed the trace quality check.'
                    : status === 'trace_failed'
                      ? 'The automatic trace failed; the PNG itself looks fine.'
                      : 'Not traced yet.'}
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
                  Trace healthy
                </>
              ) : qualityFailed ? (
                'Not produced'
              ) : (
                'Pending'
              )}
            </span>
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              <span className="font-semibold">{error}</span>
              {qualityFailed
                ? ' Regenerate the PNG; re-tracing the same file will fail again.'
                : ' Try tracing it again.'}
            </p>
          ) : null}

          {trace ? (
            <dl className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Ink coverage"
                value={`${(trace.inkCoverage * 100).toFixed(1)}%`}
                hint={`accepted ${bounds.min * 100}–${bounds.max * 100}%`}
                alert={qualityFailed}
              />
              {trace.pathCount !== null ? (
                <Stat label="Paths" value={String(trace.pathCount)} hint="outlines + holes" />
              ) : null}
              {trace.units ? (
                <Stat
                  label="Units"
                  value={trace.units}
                  hint={
                    trace.units === 'mm' ? 'real size for the laser' : 'set artwork width in mm'
                  }
                />
              ) : null}
            </dl>
          ) : null}

          {hasSvg && !hasStrokeSvg ? (
            <p className="text-sm text-muted-foreground">
              Only the fill SVG exists for this option. Re-trace from the PNG to also get the stroke
              (cut line) version.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {hasSvg && option.manufacturingSvgDownloadUrl ? (
              <a
                href={option.manufacturingSvgDownloadUrl}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
              >
                <Download className="size-4" aria-hidden="true" />
                Fill SVG · engrave
              </a>
            ) : null}
            {hasSvg && option.manufacturingSvgStrokeDownloadUrl ? (
              <a
                href={option.manufacturingSvgStrokeDownloadUrl}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
              >
                <Download className="size-4" aria-hidden="true" />
                Stroke SVG · cut lines
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
    : `Personalized option ${option.option_index}`;
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
