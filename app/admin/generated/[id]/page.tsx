import { notFound } from 'next/navigation';
import { reviewGeneratedItemAction } from '@/app/admin/generated/actions';
import { requireAdmin } from '@/lib/admin';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface GeneratedAdminDetail {
  id: string;
  user_id: string;
  title: string | null;
  product_type: string;
  review_status: string;
  credit_cost: number;
  source_image_path: string | null;
  original_image_paths: string[];
  preview_path: string | null;
  selected_preview_path: string | null;
  hidden_svg_path: string | null;
  custom_text: string | null;
  color: string | null;
  multi_color: boolean;
  prompt: string | null;
  svg_content: string;
  manufacturing_metadata: Record<string, unknown>;
  generation_options: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface PreviewOption {
  id: string;
  option_index: number;
  preview_image_path: string;
  hidden_svg_path: string;
  status: string;
  metadata: Record<string, unknown>;
}

interface Artifact {
  id: string;
  artifact_type: string;
  storage_path: string | null;
  content_text: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

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
      .order('created_at', { ascending: false })
      .returns<Artifact[]>(),
  ]);

  if (error || !item) notFound();

  return (
    <main className="container max-w-6xl space-y-8 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Generated {formatDate(item.created_at)}</p>
        <h1 className="text-3xl font-bold tracking-tight">{item.title ?? item.id.slice(0, 8)}</h1>
        <p className="text-muted-foreground">
          {item.product_type} &middot; {item.review_status} &middot; user {item.user_id.slice(0, 8)}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Preview and source assets</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Source image" value={item.source_image_path ?? '-'} />
              <Info label="Original images" value={item.original_image_paths.join(', ') || '-'} />
              <Info label="Preview" value={item.preview_path ?? '-'} />
              <Info label="Selected preview" value={item.selected_preview_path ?? '-'} />
              <Info label="Hidden SVG" value={item.hidden_svg_path ?? '-'} />
              <Info label="LED" value={item.multi_color ? 'Multi color' : item.color ?? '-'} />
              <Info label="Text" value={item.custom_text ?? '-'} />
              <Info label="Prompt" value={item.prompt ?? '-'} />
            </div>
          </div>

          {options?.length ? (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Personalized preview options</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {options.map((option) => (
                  <div key={option.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      {option.preview_image_path}
                    </div>
                    <Info label="Status" value={option.status} />
                    <Info label="Hidden SVG" value={option.hidden_svg_path} />
                    <Snapshot title="Option metadata" value={option.metadata} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <Snapshot title="Raw manufacturing SVG" value={item.svg_content || 'No SVG content stored.'} />
          <Snapshot title="Manufacturing metadata" value={item.manufacturing_metadata} />
          <Snapshot title="Generation options" value={item.generation_options} />
          <Snapshot title="Validation warnings" value={extractValidationWarnings(item.manufacturing_metadata)} />
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

        <aside className="space-y-6">
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
  return Array.isArray(warnings) && warnings.length ? warnings : ['No validation warnings stored.'];
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="break-all font-medium">{value}</p>
    </div>
  );
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium">{title}</p>
      <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
