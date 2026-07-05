import { notFound } from 'next/navigation';
import { reviewGeneratedItemAction } from '@/app/admin/generated/actions';
import { AssetPreviewCard } from './asset-preview-card';
import { ManufacturingSvgForm } from './manufacturing-svg-form';
import { requireAdmin } from '@/lib/admin';
import type { GeneratedItemRow, PersonalizedPreviewOptionRow } from '@/lib/generated-items';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type GeneratedAdminDetail = Omit<GeneratedItemRow, 'category_id' | 'subcategory_id' | 'generated_by'>;

type PreviewOption = Pick<
  PersonalizedPreviewOptionRow,
  'id' | 'option_index' | 'preview_image_path' | 'hidden_svg_path' | 'status' | 'metadata'
>;

export default async function AdminGeneratedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: item, error }, { data: options }, { data: artifacts }] = await Promise.all([
    supabase
      .from('generated_items')
      .select(
        'id, user_id, title, product_type, review_status, credit_cost, source_image_path, original_image_paths, preview_path, selected_preview_path, hidden_svg_path, custom_text, color, multi_color, prompt, svg_content, manufacturing_metadata, generation_options, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle<GeneratedAdminDetail>(),
    supabase
      .from('personalized_preview_options')
      .select('id, option_index, preview_image_path, hidden_svg_path, status, metadata')
      .eq('generated_item_id', id)
      .order('option_index', { ascending: true })
      .returns<PreviewOption[]>(),
    supabase
      .from('generated_item_artifacts')
      .select('id, artifact_type, storage_path, content_text, metadata, created_at')
      .eq('generated_item_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (error || !item) notFound();

  const sourcePaths = [...new Set([
    ...(item.source_image_path ? [item.source_image_path] : []),
    ...item.original_image_paths,
  ])];
  const sourceAssets = await Promise.all(sourcePaths.map(async (storagePath) => {
    const [preview, download] = await Promise.all([
      supabase.storage.from('user-uploads').createSignedUrl(storagePath, 60 * 60),
      supabase.storage.from('user-uploads').createSignedUrl(storagePath, 60 * 60, { download: fileName(storagePath) }),
    ]);
    return { storagePath, url: preview.data?.signedUrl ?? null, downloadUrl: download.data?.signedUrl ?? null };
  }));
  const optionAssets = await Promise.all((options ?? []).map(async (option) => ({
    ...option,
    previewUrl: (await supabase.storage.from('generated-assets').createSignedUrl(option.preview_image_path, 60 * 60)).data?.signedUrl ?? null,
    previewDownloadUrl: (await supabase.storage.from('generated-assets').createSignedUrl(option.preview_image_path, 60 * 60, { download: fileName(option.preview_image_path) })).data?.signedUrl ?? null,
    hiddenSvgUrl: option.hidden_svg_path
      ? (await supabase.storage.from('generated-assets').createSignedUrl(option.hidden_svg_path, 60 * 60)).data?.signedUrl ?? null
      : null,
    hiddenSvgDownloadUrl: option.hidden_svg_path
      ? (await supabase.storage.from('generated-assets').createSignedUrl(option.hidden_svg_path, 60 * 60, { download: fileName(option.hidden_svg_path) })).data?.signedUrl ?? null
      : null,
  })));
  const parentPreviewPath = item.selected_preview_path ?? item.preview_path;
  const parentPreviewUrl = parentPreviewPath
    ? (await supabase.storage.from('generated-assets').createSignedUrl(parentPreviewPath, 60 * 60)).data?.signedUrl ?? null
    : null;
  const parentPreviewDownloadUrl = parentPreviewPath
    ? (await supabase.storage.from('generated-assets').createSignedUrl(parentPreviewPath, 60 * 60, { download: fileName(parentPreviewPath) })).data?.signedUrl ?? null
    : null;
  const parentHiddenSvgUrl = item.hidden_svg_path
    ? (await supabase.storage.from('generated-assets').createSignedUrl(item.hidden_svg_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const parentHiddenSvgDownloadUrl = item.hidden_svg_path
    ? (await supabase.storage.from('generated-assets').createSignedUrl(item.hidden_svg_path, 60 * 60, { download: fileName(item.hidden_svg_path) })).data?.signedUrl ?? null
    : null;
  const validationWarnings = extractValidationWarnings(item.manufacturing_metadata);

  return (
    <main className="container max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">Generated {formatDate(item.created_at)}</p>
        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{item.title ?? item.id.slice(0, 8)}</h1>
        <p className="break-words text-sm text-muted-foreground sm:text-base">
          {item.product_type} &middot; {item.review_status} &middot; user {item.user_id.slice(0, 8)}
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-8">
        <section className="min-w-0 space-y-6">
          <div className="min-w-0 rounded-lg border p-4 sm:p-5">
            <h2 className="font-semibold">Source assets</h2>
            {sourceAssets.length ? (
              <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                {sourceAssets.map((asset, index) => (
                  <AssetPreviewCard key={asset.storagePath} title={`Source image ${index + 1}`} path={asset.storagePath} url={asset.url} downloadUrl={asset.downloadUrl} />
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">No source image was stored.</p>}
            <div className="mt-5 grid gap-3 border-t pt-5 text-sm sm:grid-cols-2">
              <Info label="LED" value={item.multi_color ? 'Multi color' : item.color ?? '-'} />
              <Info label="Text" value={item.custom_text ?? '-'} />
              <Info label="Prompt" value={item.prompt ?? '-'} />
            </div>
          </div>

          {optionAssets.length ? (
            <section className="min-w-0 space-y-4">
              <h2 className="break-words text-lg font-semibold tracking-tight sm:text-xl">Personalized preview options</h2>
              <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                {optionAssets.map((option) => (
                  <article key={option.id} className="min-w-0 space-y-4 overflow-hidden rounded-lg border p-3 sm:p-4">
                    <div>
                      <p className="font-semibold">{getOptionName(option)}</p>
                      <p className="text-sm text-muted-foreground">Option {option.option_index} · {option.status}</p>
                    </div>
                    <AssetPreviewCard title="Generated preview" path={option.preview_image_path} url={option.previewUrl} downloadUrl={option.previewDownloadUrl} />
                    {option.hidden_svg_path ? (
                      <AssetPreviewCard title="Manufacturing PNG" path={option.hidden_svg_path} url={option.hiddenSvgUrl} downloadUrl={option.hiddenSvgDownloadUrl} />
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No manufacturing PNG has been generated by an admin.</div>
                    )}
                    <ManufacturingSvgForm
                      generatedItemId={item.id}
                      optionId={option.id}
                      optionName={getOptionName(option)}
                      defaultPrompt={buildManufacturingPrompt(item, option)}
                      hasExistingSvg={Boolean(option.hidden_svg_path)}
                    />
                    <Snapshot title="Option metadata" value={option.metadata} />
                  </article>
                ))}
              </div>
            </section>
          ) : parentPreviewPath ? (
            <section className="grid gap-4 sm:grid-cols-2">
              <AssetPreviewCard title="Generated preview" path={parentPreviewPath} url={parentPreviewUrl} downloadUrl={parentPreviewDownloadUrl} />
              {item.hidden_svg_path ? <AssetPreviewCard title="Manufacturing PNG" path={item.hidden_svg_path} url={parentHiddenSvgUrl} downloadUrl={parentHiddenSvgDownloadUrl} /> : null}
            </section>
          ) : null}

          {item.svg_content.trim() ? <Snapshot title="Raw manufacturing SVG" value={item.svg_content} /> : null}
          {hasContent(item.manufacturing_metadata) ? <Snapshot title="Manufacturing metadata" value={item.manufacturing_metadata} /> : null}
          {hasContent(item.generation_options) ? <Snapshot title="Generation options" value={item.generation_options} /> : null}
          {validationWarnings.length ? <Snapshot title="Validation warnings" value={validationWarnings} /> : null}
          {artifacts?.length ? (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Artifacts</h2>
              <div className="grid gap-3">
                {artifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-lg border p-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <Info label="Type" value={artifact.artifact_type} />
                      <Info label="Storage path" value={artifact.storage_path ?? '-'} />
                    </div>
                    <Snapshot title="Artifact metadata" value={artifact.metadata} />
                    {artifact.content_text ? <Snapshot title="Content" value={artifact.content_text} /> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-6">
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Review</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Credits</dt>
                <dd>{item.credit_cost}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{formatDate(item.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <form action={reviewGeneratedItemAction} className="space-y-4 rounded-lg border p-5">
            <input type="hidden" name="generatedItemId" value={item.id} />
            <div className="space-y-2">
              <label htmlFor="decision" className="text-sm font-medium">
                Decision
              </label>
              <select
                id="decision"
                name="decision"
                defaultValue={item.review_status === 'rejected' ? 'review_required' : 'approved'}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
                <option value="review_required">Request changes</option>
              </select>
            </div>
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
            <button className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Save review
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function extractValidationWarnings(metadata: Record<string, unknown>) {
  const warnings = metadata.validationWarnings ?? metadata.warnings ?? [];
  return Array.isArray(warnings) ? warnings : [];
}

function hasContent(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function getOptionName(option: PreviewOption) {
  return typeof option.metadata.boilerplateName === 'string'
    ? option.metadata.boilerplateName
    : `Personalized option ${option.option_index}`;
}

function buildManufacturingPrompt(item: GeneratedAdminDetail, option: PreviewOption) {
  void item;
  void option;
  return 'Transform the source photo into clean black-on-white pencil line art for laser engraving on a clear acrylic glass night light. Preserve the people’s recognizable likeness, pose, facial expressions, hairstyle, clothing outlines, hands, and important personal details. Draw elegant, realistic contour lines with a hand-sketched pencil or fine-ink appearance: crisp solid black strokes on a pure white background, with varied line weight and only sparse black hatching where essential for facial definition. Keep faces attractive and clearly readable while simplifying photographic detail into engravable outlines. Use continuous, well-separated lines with no tiny noisy marks, no filled dark areas, and no soft gray shading. Center and crop the subjects as one cohesive engraving composition with a clean outer silhouette suitable for display on an acrylic panel. Output only the flat engraving artwork. No color, gradients, skin tones, lighting effects, glow, shadows, grayscale wash, background scene, frame, acrylic panel, wooden base, lamp mockup, text, watermark, or extra elements.';
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="break-all font-medium">{value}</p>
    </div>
  );
}

function fileName(path: string) {
  return path.split('/').at(-1) ?? 'asset';
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-lg border p-3 sm:p-4">
      <p className="text-sm font-medium">{title}</p>
      <pre className="mt-2 max-h-96 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs sm:whitespace-pre">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
