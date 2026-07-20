import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { removeBoilerplateAction, saveBoilerplateAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import { resolvePublicStorageUrl } from '@/lib/storage';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BoilerplateLibraryPage() {
  const t = await getTranslations();
  const supabase = await getServerSupabase();
  const { data: boilerplates } = await supabase
    .from('personalization_boilerplates')
    .select(
      'id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order, price_adjustment_percent',
    )
    .order('sort_order')
    .returns<PersonalizationBoilerplate[]>();

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <Button asChild variant="ghost" className="mb-3 px-0">
          <Link href="/admin/personalization">{t('personalization.back')}</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('personalization.boilerplateLibraryTitle')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('personalization.boilerplateLibrarySubtitle')}
        </p>
      </div>

      <section className="space-y-4">
        {(boilerplates ?? []).map((boilerplate) => (
          <BoilerplateForm key={boilerplate.id} boilerplate={boilerplate} />
        ))}
        <BoilerplateForm />
      </section>
    </main>
  );
}

async function BoilerplateForm({ boilerplate }: { boilerplate?: PersonalizationBoilerplate }) {
  const t = await getTranslations();
  const fieldId = `boilerplate-image-${boilerplate?.id ?? 'new'}`;
  const currentUrl = resolvePublicStorageUrl('catalog-assets', boilerplate?.image_path);

  return (
    <form
      action={saveBoilerplateAction}
      className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3"
    >
      {boilerplate ? <input type="hidden" name="id" value={boilerplate.id} /> : null}
      <div className="space-y-1.5">
        <Label>{t('personalization.boilerplateName')}</Label>
        <Input name="name" defaultValue={boilerplate?.name ?? ''} required />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={fieldId}>{t('personalization.templateImage')}</Label>
        <input type="hidden" name="imagePath" value={boilerplate?.image_path ?? ''} />
        <div className="flex aspect-[4/3] max-w-sm items-center justify-center overflow-hidden rounded-md border bg-muted/30">
          {currentUrl ? (
            // biome-ignore lint/performance/noImgElement: admin uploads can be SVG; next/image cannot render SVG markup
            <img
              src={currentUrl}
              alt={t('personalization.currentImageAlt', { label: t('personalization.templateImage').toLowerCase() })}
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
          id={fieldId}
          name="imageFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required={!boilerplate?.image_path}
        />
        <p className="text-xs text-muted-foreground">
          {boilerplate ? t('personalization.replaceImageHelp') : t('personalization.uploadHelp')}
        </p>
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
      <div className="space-y-1.5">
        <Label>{t('personalization.priceAdjustmentPercent')}</Label>
        <Input
          name="priceAdjustmentPercent"
          type="number"
          step={1}
          defaultValue={boilerplate?.price_adjustment_percent ?? ''}
        />
        <p className="text-xs text-muted-foreground">{t('personalization.priceAdjustmentHelp')}</p>
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
      {boilerplate ? (
        <p className="text-xs text-muted-foreground md:col-span-3">
          {t('personalization.openaiFileId')}: <code>{boilerplate.openai_file_id}</code>
        </p>
      ) : null}
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
            formAction={removeBoilerplateAction}
            formNoValidate
          >
            {t('cart.remove')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
