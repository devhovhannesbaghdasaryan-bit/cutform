import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { addGeneratedItemToCartAction, selectGeneratedPreviewAction } from '@/app/generated/actions';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface GeneratedItemDetail {
  id: string;
  title: string | null;
  product_type: string;
  review_status: string;
  credit_cost: number;
  source_image_path: string | null;
  preview_path: string | null;
  selected_preview_path: string | null;
  original_image_paths: string[];
  custom_text: string | null;
  color: string | null;
  multi_color: boolean;
  prompt: string | null;
  svg_content: string;
  manufacturing_metadata: Record<string, unknown>;
  generation_options: Record<string, unknown>;
  created_at: string;
}

interface PreviewOption {
  id: string;
  option_index: number;
  preview_image_path: string;
  status: string;
}

export default async function GeneratedItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/generated/${id}`);

  const [{ data: item, error }, { data: options }] = await Promise.all([
    supabase
      .from('generated_items')
      .select(
        'id, title, product_type, review_status, credit_cost, source_image_path, preview_path, selected_preview_path, original_image_paths, custom_text, color, multi_color, prompt, svg_content, manufacturing_metadata, generation_options, created_at',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle<GeneratedItemDetail>(),
    supabase
      .from('personalized_preview_options')
      .select('id, option_index, preview_image_path, status')
      .eq('generated_item_id', id)
      .order('option_index', { ascending: true })
      .returns<PreviewOption[]>(),
  ]);

  if (error || !item) notFound();

  const selectedPath = item.selected_preview_path ?? item.preview_path;
  const previewUrl = selectedPath
    ? (await supabase.storage.from('generated-assets').createSignedUrl(selectedPath, 60 * 60)).data?.signedUrl ?? null
    : null;
  const warnings = extractValidationWarnings(item.manufacturing_metadata);
  const bannerDetails = item.product_type === 'banner' ? extractBannerDetails(item.generation_options) : null;
  const canOrder =
    item.review_status !== 'rejected'
    && (item.product_type !== 'personalized_night_light' || Boolean(item.selected_preview_path));

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-6xl space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Generated {formatDate(item.created_at)}</p>
            <h1 className="text-3xl font-bold tracking-tight">{item.title ?? item.product_type}</h1>
            <p className="text-muted-foreground">
              {item.review_status} &middot; {item.credit_cost} credits
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <div className="rounded-lg border p-4">
              <div className="relative flex aspect-[4/3] items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt={item.title ?? 'Generated preview'}
                    fill
                    sizes="(min-width: 1024px) 720px, 100vw"
                    className="rounded-md object-contain"
                  />
                ) : selectedPath ? (
                  `Preview: ${selectedPath}`
                ) : (
                  'No preview selected'
                )}
              </div>
            </div>

            {options?.length ? (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Preview options</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {options.map((option) => (
                    <div key={option.id} className="rounded-lg border p-4">
                      <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                        {option.preview_image_path}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          Option {option.option_index}
                          {option.status === 'selected' ? ' (selected)' : ''}
                        </p>
                        <form action={selectGeneratedPreviewAction}>
                          <input type="hidden" name="generatedItemId" value={item.id} />
                          <input type="hidden" name="optionId" value={option.id} />
                          <Button type="submit" size="sm" variant="outline" disabled={option.status === 'selected'}>
                            Select
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {item.product_type !== 'personalized_night_light' && item.svg_content ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">Raw SVG</h2>
                <pre className="max-h-96 overflow-auto rounded-lg border bg-muted p-4 text-xs">
                  {item.svg_content}
                </pre>
              </section>
            ) : null}
            {warnings.length ? (
              <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <h2 className="text-lg font-semibold">Manufacturability warnings</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>

          <aside className="space-y-6">
            <div className="rounded-lg border p-5">
              <h2 className="font-semibold">Configuration</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>{item.product_type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Text</dt>
                  <dd>{item.custom_text || '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">LED color</dt>
                  <dd>{item.multi_color ? 'Multi color' : item.color || '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Original images</dt>
                  <dd>{item.original_image_paths.length ? item.original_image_paths.join(', ') : '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Prompt</dt>
                  <dd>{item.prompt || '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Credit cost</dt>
                  <dd>{item.credit_cost}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source image</dt>
                  <dd className="break-all">{item.source_image_path || '-'}</dd>
                </div>
              </dl>
            </div>

            {bannerDetails ? (
              <div className="rounded-lg border p-5">
                <h2 className="font-semibold">Banner review</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Size preset</dt>
                    <dd>{bannerDetails.sizeLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Text placement</dt>
                    <dd>{bannerDetails.textPlacement}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sample source</dt>
                    <dd className="break-all">{bannerDetails.sampleSource}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reference images</dt>
                    <dd className="break-all">
                      {item.original_image_paths.length ? item.original_image_paths.join(', ') : '-'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <form action={addGeneratedItemToCartAction} className="rounded-lg border p-5">
              <input type="hidden" name="generatedItemId" value={item.id} />
              <Button type="submit" className="w-full" disabled={!canOrder}>
                Add selected result to cart
              </Button>
              {!canOrder && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a valid preview before ordering this generated item.
                </p>
              )}
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}

function extractValidationWarnings(metadata: Record<string, unknown>) {
  const warnings = metadata.validationWarnings ?? metadata.warnings ?? [];
  return Array.isArray(warnings) ? warnings.filter((warning): warning is string => typeof warning === 'string') : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
  ].filter(Boolean).join(' - ');
  const placementLabel = [
    asString(placement.zone) ?? 'center',
    asString(placement.alignment) ?? 'center',
  ].join(', ');

  return {
    sizeLabel,
    textPlacement: placementLabel,
    sampleSource: asString(options.sampleImagePath) ?? asString(options.source) ?? '-',
  };
}
