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
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations();
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
      .select(
        'id, category_id, subcategory_id, title, slug, mock_image_path, boilerplate_image_path, form_schema, status',
      )
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
      .select(
        'id, model_id, admin_name, name_en, name_hy, name_ru, image_path, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order',
      )
      .order('sort_order')
      .returns<PersonalizationBoilerplate[]>(),
  ]);

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <Button asChild variant="ghost" className="mb-3 px-0">
          <Link href="/personalization">{t('personalization.back')}</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('personalization.nightLightsTitle')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('personalization.nightLightsSubtitle')}</p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">{t('personalization.createModel')}</h2>
        <ModelForm subcategories={subcategories ?? []} />
      </section>

      <section className="space-y-4">
        {(models ?? []).map((model) => (
          <div key={model.id} className="rounded-lg border p-5">
            <h2 className="font-semibold">{model.title}</h2>
            <ModelForm model={model} subcategories={subcategories ?? []} />
            <div className="mt-6 border-t pt-6">
              <div className="mb-4">
                <h3 className="font-semibold">{t('personalization.boilerplateOptions')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('personalization.boilerplateHelp')}
                </p>
              </div>
              <div className="space-y-4">
                {(boilerplates ?? [])
                  .filter((item) => item.model_id === model.id)
                  .map((boilerplate) => (
                    <BoilerplateForm
                      key={boilerplate.id}
                      modelId={model.id}
                      boilerplate={boilerplate}
                    />
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

async function ImageUploadField({
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
  const t = await getTranslations();
  const currentUrl = resolvePublicStorageUrl('catalog-assets', currentPath);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input type="hidden" name={pathName} value={currentPath ?? ''} />
      <div className="flex aspect-[4/3] max-w-sm items-center justify-center overflow-hidden rounded-md border bg-muted/30">
        {currentUrl ? (
          // biome-ignore lint/performance/noImgElement: admin uploads can be SVG
          <img
            src={currentUrl}
            alt={t('personalization.currentImageAlt', { label: label.toLowerCase() })}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span>{t('personalization.noImage')}</span>
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
        {currentPath ? t('personalization.replaceImageHelp') : t('personalization.uploadHelp')}
      </p>
    </div>
  );
}

async function BoilerplateForm({
  modelId,
  boilerplate,
}: {
  modelId: string;
  boilerplate?: PersonalizationBoilerplate;
}) {
  const t = await getTranslations();
  const fieldId = `boilerplate-image-${boilerplate?.id ?? `${modelId}-new`}`;

  return (
    <form
      action={savePersonalizationBoilerplateAction}
      className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3"
    >
      <input type="hidden" name="modelId" value={modelId} />
      {boilerplate ? <input type="hidden" name="id" value={boilerplate.id} /> : null}
      <div className="space-y-1.5">
        <Label>{t('personalization.adminName')}</Label>
        <Input name="adminName" defaultValue={boilerplate?.admin_name ?? ''} required />
      </div>
      <div className="space-y-1.5">
        <Label>{t('personalization.nameEn')}</Label>
        <Input name="nameEn" defaultValue={boilerplate?.name_en ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label>{t('personalization.nameHy')}</Label>
        <Input name="nameHy" defaultValue={boilerplate?.name_hy ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label>{t('personalization.nameRu')}</Label>
        <Input name="nameRu" defaultValue={boilerplate?.name_ru ?? ''} />
      </div>
      <div className="md:col-span-2">
        <ImageUploadField
          id={fieldId}
          label={t('personalization.templateImage')}
          pathName="imagePath"
          fileName="imageFile"
          currentPath={boilerplate?.image_path}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('personalization.manufacturingProcess')}</Label>
        <Input
          name="manufacturingProcess"
          defaultValue={boilerplate?.manufacturing_process ?? ''}
          required
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>{t('personalization.generationInstruction')}</Label>
        <Textarea
          name="generationInstruction"
          defaultValue={boilerplate?.generation_instruction ?? ''}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('personalization.displayOrder')}</Label>
        <Input name="sortOrder" type="number" defaultValue={boilerplate?.sort_order ?? 0} />
      </div>
      <div className="flex flex-wrap items-center gap-5 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={boilerplate?.is_active ?? true} />{' '}
          {t('profile.status.active')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="generateHiddenSvg"
            defaultChecked={boilerplate?.generate_hidden_svg ?? false}
          />{' '}
          {t('personalization.requiresSvg')}
        </label>
      </div>
      <div className="flex items-center gap-2 md:col-span-3">
        <Button type="submit" size="sm">
          {boilerplate
            ? t('personalization.updateBoilerplate')
            : t('personalization.addBoilerplate')}
        </Button>
        {boilerplate ? (
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            formAction={removePersonalizationBoilerplateAction}
            formNoValidate
          >
            {t('cart.remove')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

async function ModelForm({
  model,
  subcategories,
}: {
  model?: ModelRow;
  subcategories: { id: string; name: string; category_id: string }[];
}) {
  const t = await getTranslations();
  const schema = model?.form_schema ?? {};
  const suffix = model?.id ?? 'new';

  return (
    <form action={savePersonalizationModelAction} className="mt-4 grid gap-4 md:grid-cols-2">
      {model?.id && <input type="hidden" name="id" value={model.id} />}
      <div className="space-y-2">
        <Label htmlFor={`title-${suffix}`}>{t('personalization.modelTitle')}</Label>
        <Input id={`title-${suffix}`} name="title" defaultValue={model?.title ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`slug-${suffix}`}>{t('personalization.slug')}</Label>
        <Input id={`slug-${suffix}`} name="slug" defaultValue={model?.slug ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label>{t('personalization.category')}</Label>
        <Input value={t('personalization.nightLights')} disabled />
      </div>
      <div className="space-y-2">
        <Label>{t('personalization.subcategory')}</Label>
        <select
          name="subcategoryId"
          defaultValue={model?.subcategory_id ?? ''}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">{t('personalization.none')}</option>
          {subcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>
              {subcategory.name}
            </option>
          ))}
        </select>
      </div>
      <ImageUploadField
        id={`mock-image-${suffix}`}
        label={t('personalization.mockImage')}
        pathName="mockImagePath"
        fileName="mockImageFile"
        currentPath={normalizePersonalizationMockPath(model?.mock_image_path)}
      />
      <ImageUploadField
        id={`boilerplate-image-${suffix}`}
        label={t('personalization.baseBoilerplateImage')}
        pathName="boilerplateImagePath"
        fileName="boilerplateImageFile"
        currentPath={model?.boilerplate_image_path}
      />
      <div className="space-y-2">
        <Label>{t('personalization.priceAmd')}</Label>
        <Input
          name="basePriceAmd"
          type="number"
          min="0"
          step="1"
          defaultValue={
            Number(schema.basePriceCents ?? PERSONALIZED_NIGHT_LIGHT.defaultPriceCents) / 100
          }
        />
      </div>
      <div className="space-y-2">
        <Label>{t('personalization.creditCost')}</Label>
        <Input
          name="creditCost"
          type="number"
          min="0"
          defaultValue={Number(schema.creditCost ?? 0)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('personalization.status')}</Label>
        <select
          name="status"
          defaultValue={model?.status ?? 'draft'}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="draft">{t('status.draft')}</option>
          <option value="published">{t('status.published')}</option>
          <option value="archived">{t('status.archived')}</option>
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>{t('product.production_notes')}</Label>
        <Textarea name="productionNotes" defaultValue={String(schema.productionNotes ?? '')} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">
          {model?.id ? t('personalization.saveModel') : t('personalization.createModel')}
        </Button>
      </div>
    </form>
  );
}
