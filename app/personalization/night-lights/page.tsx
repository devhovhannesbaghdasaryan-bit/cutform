import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import {
  removePersonalizationBoilerplateAction,
  savePersonalizationBoilerplateAction,
  savePersonalizationModelAction,
} from '@/app/personalization/night-lights/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getServerSupabase } from '@/lib/supabase/server';
import { PERSONALIZED_NIGHT_LIGHT } from '@/lib/marketplace-constants';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import { normalizePersonalizationMockPath, resolvePublicStorageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface ModelRow {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  slug: string;
  mock_image_path: string | null;
  boilerplate_image_path: string | null;
  form_schema: Record<string, unknown>;
  status: string;
}

export default async function NightLightPersonalizationPage() {
  const supabase = await getServerSupabase();
  const { data: category } = await supabase
    .from('categories')
    .select('id, name')
    .eq('slug', 'night-lights')
    .maybeSingle<{ id: string; name: string }>();

  if (!category) throw new Error('Night lights category is not configured.');

  const [{ data: models }, { data: subcategories }, { data: boilerplates }] = await Promise.all([
    supabase
      .from('personalization_models')
      .select('id, category_id, subcategory_id, title, slug, mock_image_path, boilerplate_image_path, form_schema, status')
      .eq('category_id', category.id)
      .order('updated_at', { ascending: false })
      .returns<ModelRow[]>(),
    supabase
      .from('subcategories')
      .select('id, name, category_id')
      .eq('category_id', category.id)
      .order('sort_order')
      .returns<{ id: string; name: string; category_id: string }[]>(),
    supabase
      .from('personalization_boilerplates')
      .select('id, model_id, admin_name, name_en, name_hy, name_ru, image_path, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order')
      .order('sort_order')
      .returns<PersonalizationBoilerplate[]>(),
  ]);

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <Button asChild variant="ghost" className="mb-3 px-0">
          <Link href="/personalization">Back to categories</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Night light templates</h1>
        <p className="mt-2 text-muted-foreground">Manage customer-facing models, preview images, and production boilerplates.</p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">Create model</h2>
        <ModelForm subcategories={subcategories ?? []} />
      </section>

      <section className="space-y-4">
        {(models ?? []).map((model) => (
          <div key={model.id} className="rounded-lg border p-5">
            <h2 className="font-semibold">{model.title}</h2>
            <ModelForm model={model} subcategories={subcategories ?? []} />
            <div className="mt-6 border-t pt-6">
              <div className="mb-4">
                <h3 className="font-semibold">Boilerplate options</h3>
                <p className="text-sm text-muted-foreground">
                  Customers can choose any active option. Mark whether production requires an admin-generated manufacturing SVG.
                </p>
              </div>
              <div className="space-y-4">
                {(boilerplates ?? []).filter((item) => item.model_id === model.id).map((boilerplate) => (
                  <BoilerplateForm key={boilerplate.id} modelId={model.id} boilerplate={boilerplate} />
                ))}
                <BoilerplateForm modelId={model.id} />
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function ImageUploadField({
  id,
  label,
  pathName,
  fileName,
  currentPath,
  required = false,
}: {
  id: string;
  label: string;
  pathName: string;
  fileName: string;
  currentPath?: string | null;
  required?: boolean;
}) {
  const currentUrl = resolvePublicStorageUrl('catalog-assets', currentPath);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input type="hidden" name={pathName} value={currentPath ?? ''} />
      <div className="flex aspect-[4/3] max-w-sm items-center justify-center overflow-hidden rounded-md border bg-muted/30">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Admin uploads can include SVG files.
          <img src={currentUrl} alt={`Current ${label.toLowerCase()}`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span>No image uploaded</span>
          </div>
        )}
      </div>
      <Input
        id={id}
        name={fileName}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        required={required && !currentPath}
      />
      <p className="text-xs text-muted-foreground">
        {currentPath ? 'Choose a file to replace the current image.' : 'Upload PNG, JPG, WEBP, or SVG up to 10 MB.'}
      </p>
    </div>
  );
}

function BoilerplateForm({ modelId, boilerplate }: { modelId: string; boilerplate?: PersonalizationBoilerplate }) {
  const fieldId = `boilerplate-image-${boilerplate?.id ?? `${modelId}-new`}`;

  return (
    <form action={savePersonalizationBoilerplateAction} className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3">
      <input type="hidden" name="modelId" value={modelId} />
      {boilerplate ? <input type="hidden" name="id" value={boilerplate.id} /> : null}
      <div className="space-y-1.5">
        <Label>Admin name</Label>
        <Input name="adminName" defaultValue={boilerplate?.admin_name ?? ''} required />
      </div>
      <div className="space-y-1.5">
        <Label>English name</Label>
        <Input name="nameEn" defaultValue={boilerplate?.name_en ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label>Armenian name</Label>
        <Input name="nameHy" defaultValue={boilerplate?.name_hy ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label>Russian name</Label>
        <Input name="nameRu" defaultValue={boilerplate?.name_ru ?? ''} />
      </div>
      <div className="md:col-span-2">
        <ImageUploadField
          id={fieldId}
          label="Template image"
          pathName="imagePath"
          fileName="imageFile"
          currentPath={boilerplate?.image_path}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Manufacturing process</Label>
        <Input name="manufacturingProcess" defaultValue={boilerplate?.manufacturing_process ?? ''} required />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>AI generation instruction</Label>
        <Textarea name="generationInstruction" defaultValue={boilerplate?.generation_instruction ?? ''} required />
      </div>
      <div className="space-y-1.5">
        <Label>Display order</Label>
        <Input name="sortOrder" type="number" defaultValue={boilerplate?.sort_order ?? 0} />
      </div>
      <div className="flex flex-wrap items-center gap-5 md:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={boilerplate?.is_active ?? true} /> Active</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="generateHiddenSvg" defaultChecked={boilerplate?.generate_hidden_svg ?? false} /> Requires manufacturing SVG</label>
      </div>
      <div className="flex items-center gap-2 md:col-span-3">
        <Button type="submit" size="sm">{boilerplate ? 'Update boilerplate' : 'Add boilerplate'}</Button>
        {boilerplate ? (
          <Button type="submit" size="sm" variant="destructive" formAction={removePersonalizationBoilerplateAction} formNoValidate>
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function ModelForm({
  model,
  subcategories,
}: {
  model?: ModelRow;
  subcategories: { id: string; name: string; category_id: string }[];
}) {
  const schema = model?.form_schema ?? {};
  const suffix = model?.id ?? 'new';

  return (
    <form action={savePersonalizationModelAction} className="mt-4 grid gap-4 md:grid-cols-2">
      {model?.id && <input type="hidden" name="id" value={model.id} />}
      <div className="space-y-2">
        <Label htmlFor={`title-${suffix}`}>Title</Label>
        <Input id={`title-${suffix}`} name="title" defaultValue={model?.title ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`slug-${suffix}`}>Slug</Label>
        <Input id={`slug-${suffix}`} name="slug" defaultValue={model?.slug ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Input value="Night lights" disabled />
      </div>
      <div className="space-y-2">
        <Label>Subcategory</Label>
        <select name="subcategoryId" defaultValue={model?.subcategory_id ?? ''} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">None</option>
          {subcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
          ))}
        </select>
      </div>
      <ImageUploadField
        id={`mock-image-${suffix}`}
        label="Customer mock image"
        pathName="mockImagePath"
        fileName="mockImageFile"
        currentPath={normalizePersonalizationMockPath(model?.mock_image_path)}
      />
      <ImageUploadField
        id={`boilerplate-image-${suffix}`}
        label="Base boilerplate image"
        pathName="boilerplateImagePath"
        fileName="boilerplateImageFile"
        currentPath={model?.boilerplate_image_path}
      />
      <div className="space-y-2">
        <Label>Price (AMD)</Label>
        <Input
          name="basePriceAmd"
          type="number"
          min="0"
          step="1"
          defaultValue={Number(schema.basePriceCents ?? PERSONALIZED_NIGHT_LIGHT.defaultPriceCents) / 100}
        />
      </div>
      <div className="space-y-2">
        <Label>Credit cost</Label>
        <Input name="creditCost" type="number" min="0" defaultValue={Number(schema.creditCost ?? 0)} />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <select name="status" defaultValue={model?.status ?? 'draft'} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Production notes</Label>
        <Textarea name="productionNotes" defaultValue={String(schema.productionNotes ?? '')} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">{model?.id ? 'Save model' : 'Create model'}</Button>
      </div>
    </form>
  );
}
