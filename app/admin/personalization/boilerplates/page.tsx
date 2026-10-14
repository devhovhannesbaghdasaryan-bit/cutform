import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { removeBoilerplateAction, saveBoilerplateAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ALL_TAB,
  type BoilerplateAttachment,
  type BoilerplateTab,
  groupBoilerplatesByCategory,
  resolveActiveTab,
  UNATTACHED_TAB,
} from '@/lib/boilerplate-categories';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import { resolvePublicStorageUrl } from '@/lib/storage';
import { getServerSupabase } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const LIBRARY_PATH = '/admin/personalization/boilerplates';

export default async function BoilerplateLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations();
  const supabase = await getServerSupabase();
  const [{ data: boilerplates }, { data: attachments }] = await Promise.all([
    supabase
      .from('personalization_boilerplates')
      .select(
        'id, name, image_path, openai_file_id, manufacturing_process, manufacturing_prompt, generation_instruction, generate_hidden_svg, is_active, sort_order, price_adjustment_percent, artwork_width_mm, skill_openai_file_id, skill_path',
      )
      .order('sort_order')
      .returns<PersonalizationBoilerplate[]>(),
    supabase
      .from('catalog_item_boilerplates')
      .select(
        'boilerplate_id, item:catalog_items(id, title, category:categories(id, slug, name, sort_order))',
      )
      .order('sort_order')
      .returns<BoilerplateAttachment[]>(),
  ]);

  const library = boilerplates ?? [];
  const grouping = groupBoilerplatesByCategory(
    library.map((boilerplate) => boilerplate.id),
    attachments ?? [],
  );
  const activeTab = resolveActiveTab(grouping.tabs, params.category);
  const activeIds = grouping.idsByTab.get(activeTab) ?? new Set<string>();
  const shown = library.filter((boilerplate) => activeIds.has(boilerplate.id));
  const tabLabel = (tab: BoilerplateTab) =>
    tab.key === ALL_TAB
      ? t('personalization.tabAll')
      : tab.key === UNATTACHED_TAB
        ? t('personalization.tabUnattached')
        : (tab.name ?? tab.key);
  const active = grouping.tabs.find((tab) => tab.key === activeTab);

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

      <div className="space-y-2.5">
        <nav
          aria-label={t('personalization.categoryTabsLabel')}
          className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {grouping.tabs.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={`${LIBRARY_PATH}?category=${encodeURIComponent(tab.key)}`}
                aria-current={selected ? 'page' : undefined}
                scroll={false}
                className={cn(
                  '-mb-px inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  selected
                    ? 'border-foreground font-semibold text-foreground'
                    : 'border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tabLabel(tab)}
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </nav>
        <p className="text-[13px] text-muted-foreground">{t('personalization.categoryTabsHelp')}</p>
      </div>

      <section className="space-y-4">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-6 py-10 text-center">
            <p className="font-semibold">
              {t('personalization.emptyCategoryTitle', {
                category: active ? tabLabel(active) : '',
              })}
            </p>
            <p className="max-w-md text-[13px] text-muted-foreground">
              {activeTab === UNATTACHED_TAB
                ? t('personalization.emptyUnattachedHelp')
                : t('personalization.emptyCategoryHelp')}
            </p>
          </div>
        ) : null}
        {shown.map((boilerplate) => (
          <BoilerplateForm
            key={boilerplate.id}
            boilerplate={boilerplate}
            attachedItems={grouping.attachedItemsById.get(boilerplate.id) ?? []}
          />
        ))}
        <BoilerplateForm />
      </section>
    </main>
  );
}

async function BoilerplateForm({
  boilerplate,
  attachedItems = [],
}: {
  boilerplate?: PersonalizationBoilerplate;
  attachedItems?: string[];
}) {
  const t = await getTranslations();
  const fieldId = `boilerplate-image-${boilerplate?.id ?? 'new'}`;
  const currentUrl = resolvePublicStorageUrl('catalog-assets', boilerplate?.image_path);

  return (
    <form action={saveBoilerplateAction} className="overflow-hidden rounded-lg border bg-muted/20">
      <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
        {boilerplate && currentUrl ? (
          // biome-ignore lint/performance/noImgElement: admin uploads can be SVG; next/image cannot render SVG markup
          <img
            src={currentUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-md border bg-background object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground"
          >
            <ImageOff className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {boilerplate ? boilerplate.name : t('personalization.newBoilerplate')}
            </span>
            {boilerplate ? (
              <span
                className={cn(
                  'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-wide',
                  boilerplate.is_active
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {boilerplate.is_active ? t('profile.status.active') : t('personalization.inactive')}
              </span>
            ) : null}
          </div>
          {boilerplate ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {attachedItems.length > 0 ? (
                <>
                  <span>{t('personalization.attachedTo')}</span>
                  {attachedItems.map((title) => (
                    <span
                      key={title}
                      className="inline-flex h-5 items-center whitespace-nowrap rounded border bg-background px-2 text-foreground"
                    >
                      {title}
                    </span>
                  ))}
                </>
              ) : (
                <span>{t('personalization.notAttached')}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('personalization.newBoilerplateHelp')}
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
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
                alt={t('personalization.currentImageAlt', {
                  label: t('personalization.templateImage').toLowerCase(),
                })}
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
        <div className="space-y-1.5 md:col-span-3">
          <Label>{t('personalization.manufacturingPrompt')}</Label>
          <Textarea
            name="manufacturingPrompt"
            defaultValue={boilerplate?.manufacturing_prompt ?? ''}
            rows={6}
          />
          <p className="text-xs text-muted-foreground">
            {t('personalization.manufacturingPromptHelp')}
          </p>
          <p className="text-xs text-muted-foreground">
            <code>{'{{#text}} … {{/text}}'}</code> · <code>{'{{text}}'}</code> ·{' '}
            <code>{'{{textStyle}}'}</code>
          </p>
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
          <p className="text-xs text-muted-foreground">
            {t('personalization.priceAdjustmentHelp')}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('personalization.artworkWidthMm')}</Label>
          <Input
            name="artworkWidthMm"
            type="number"
            min={1}
            step={0.1}
            defaultValue={boilerplate?.artwork_width_mm ?? ''}
          />
          <p className="text-xs text-muted-foreground">{t('personalization.artworkWidthMmHelp')}</p>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`boilerplate-skill-${boilerplate?.id ?? 'new'}`}>
            {t('personalization.skillFile')}
          </Label>
          <Input
            id={`boilerplate-skill-${boilerplate?.id ?? 'new'}`}
            name="skillFile"
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
          />
          <p className="text-xs text-muted-foreground">{t('personalization.skillFileHelp')}</p>
          {boilerplate?.skill_openai_file_id ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t('personalization.skillAttached')}:{' '}
                <code>{boilerplate.skill_openai_file_id}</code>
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="removeSkill" /> {t('personalization.removeSkill')}
              </label>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-5 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={boilerplate?.is_active ?? true}
            />{' '}
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
      </div>
    </form>
  );
}
