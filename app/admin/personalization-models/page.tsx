import { savePersonalizationModelAction } from '@/app/admin/personalization-models/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/admin';

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

export default async function AdminPersonalizationModelsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: models }, { data: categories }, { data: subcategories }] = await Promise.all([
    supabase
      .from('personalization_models')
      .select('id, category_id, subcategory_id, title, slug, mock_image_path, boilerplate_image_path, form_schema, status')
      .order('updated_at', { ascending: false })
      .returns<ModelRow[]>(),
    supabase.from('categories').select('id, name').order('sort_order').returns<{ id: string; name: string }[]>(),
    supabase
      .from('subcategories')
      .select('id, name, category_id')
      .order('sort_order')
      .returns<{ id: string; name: string; category_id: string }[]>(),
  ]);

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Personalized models</h1>
        <p className="text-muted-foreground">Manage publishable Night lights &gt; Personalized model templates.</p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">Create model</h2>
        <ModelForm categories={categories ?? []} subcategories={subcategories ?? []} />
      </section>

      <section className="space-y-4">
        {(models ?? []).map((model) => (
          <div key={model.id} className="rounded-lg border p-5">
            <h2 className="font-semibold">{model.title}</h2>
            <ModelForm
              model={model}
              categories={categories ?? []}
              subcategories={subcategories ?? []}
            />
          </div>
        ))}
      </section>
    </main>
  );
}

function ModelForm({
  model,
  categories,
  subcategories,
}: {
  model?: ModelRow;
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
}) {
  const schema = model?.form_schema ?? {};
  return (
    <form action={savePersonalizationModelAction} className="mt-4 grid gap-4 md:grid-cols-2">
      {model?.id && <input type="hidden" name="id" value={model.id} />}
      <div className="space-y-2">
        <Label htmlFor={`title-${model?.id ?? 'new'}`}>Title</Label>
        <Input id={`title-${model?.id ?? 'new'}`} name="title" defaultValue={model?.title ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`slug-${model?.id ?? 'new'}`}>Slug</Label>
        <Input id={`slug-${model?.id ?? 'new'}`} name="slug" defaultValue={model?.slug ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <select name="categoryId" defaultValue={model?.category_id ?? categories[0]?.id ?? ''} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
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
      <div className="space-y-2">
        <Label>Mock image path</Label>
        <Input name="mockImagePath" defaultValue={model?.mock_image_path ?? ''} />
        <Input name="mockImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
      </div>
      <div className="space-y-2">
        <Label>Boilerplate image path</Label>
        <Input name="boilerplateImagePath" defaultValue={model?.boilerplate_image_path ?? ''} />
        <Input name="boilerplateImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
      </div>
      <div className="space-y-2">
        <Label>Base price, cents</Label>
        <Input name="basePriceCents" type="number" min="0" defaultValue={Number(schema.basePriceCents ?? 0)} />
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
