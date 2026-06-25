import {
  generateBannerSampleDraftAction,
  saveBannerSampleAction,
} from '@/app/admin/banner-samples/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

interface BannerSampleRow {
  id: string;
  title: string;
  description: string | null;
  prompt: string | null;
  image_path: string;
  reference_paths: string[];
  size_preset_id: string | null;
  material_assumptions: string | null;
  production_notes: string | null;
  status: string;
}

interface BannerPresetRow {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
}

export default async function AdminBannerSamplesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: samples }, { data: presets }] = await Promise.all([
    supabase
      .from('banner_samples')
      .select('id, title, description, prompt, image_path, reference_paths, size_preset_id, material_assumptions, production_notes, status')
      .order('updated_at', { ascending: false })
      .returns<BannerSampleRow[]>(),
    supabase
      .from('banner_size_presets')
      .select('id, name, width_mm, height_mm')
      .eq('is_active', true)
      .order('sort_order')
      .returns<BannerPresetRow[]>(),
  ]);

  return (
    <main className="container max-w-6xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Banner samples</h1>
        <p className="text-muted-foreground">Generate, review, publish, and archive reusable marketing banner templates.</p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">Generate draft sample</h2>
        <form action={generateBannerSampleDraftAction} className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea name="prompt" placeholder="Store opening banner with bold sale text and product photo space." required />
          </div>
          <div className="space-y-2">
            <Label>Size preset</Label>
            <select name="sizePresetId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">No preset</option>
              {(presets ?? []).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} - {preset.width_mm}x{preset.height_mm} mm
                </option>
              ))}
            </select>
            <Label>Reference image</Label>
            <Input name="referenceFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Generate draft sample</Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">Create sample manually</h2>
        <BannerSampleForm presets={presets ?? []} />
      </section>

      <section className="space-y-4">
        {(samples ?? []).map((sample) => (
          <div key={sample.id} className="rounded-lg border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{sample.title}</h2>
                <p className="text-sm text-muted-foreground">{sample.status}</p>
              </div>
              <a className="text-sm underline" href={sample.image_path} target="_blank" rel="noreferrer">
                Open image
              </a>
            </div>
            <BannerSampleForm sample={sample} presets={presets ?? []} />
          </div>
        ))}
      </section>
    </main>
  );
}

function BannerSampleForm({
  sample,
  presets,
}: {
  sample?: BannerSampleRow;
  presets: BannerPresetRow[];
}) {
  return (
    <form action={saveBannerSampleAction} className="mt-4 grid gap-4 md:grid-cols-2">
      {sample?.id && <input type="hidden" name="id" value={sample.id} />}
      <div className="space-y-2">
        <Label>Title</Label>
        <Input name="title" defaultValue={sample?.title ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <select name="status" defaultValue={sample?.status ?? 'draft'} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>Image path</Label>
        <Input name="imagePath" defaultValue={sample?.image_path ?? ''} placeholder="Required unless uploading an image" />
        <Input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
      </div>
      <div className="space-y-2">
        <Label>Size preset</Label>
        <select name="sizePresetId" defaultValue={sample?.size_preset_id ?? ''} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">No preset</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} - {preset.width_mm}x{preset.height_mm} mm
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Description</Label>
        <Textarea name="description" defaultValue={sample?.description ?? ''} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Prompt</Label>
        <Textarea name="prompt" defaultValue={sample?.prompt ?? ''} />
      </div>
      <div className="space-y-2">
        <Label>Reference paths</Label>
        <Input name="referencePaths" defaultValue={sample?.reference_paths.join(', ') ?? ''} />
        <Input name="referenceFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
      </div>
      <div className="space-y-2">
        <Label>Material assumptions</Label>
        <Textarea name="materialAssumptions" defaultValue={sample?.material_assumptions ?? ''} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Production notes</Label>
        <Textarea name="productionNotes" defaultValue={sample?.production_notes ?? ''} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">{sample?.id ? 'Save sample' : 'Create sample'}</Button>
      </div>
    </form>
  );
}
