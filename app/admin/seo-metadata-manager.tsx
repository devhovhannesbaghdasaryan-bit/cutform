'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { APP_LOCALES } from '@/lib/i18n';
import {
  generateCatalogItemSeoDraftAction,
  saveGeneratedCatalogItemSeoDraftAction,
  type SeoGenerationState,
} from '@/app/admin/actions';

const initialState: SeoGenerationState = {
  error: null,
  draft: null,
  locale: 'en',
};

const fieldOptions = [
  ['seoTitle', 'SEO title'],
  ['seoDescription', 'Meta description'],
  ['keywords', 'Keywords'],
  ['ogTitle', 'Open Graph title'],
  ['ogDescription', 'Open Graph description'],
  ['socialImagePath', 'Social image'],
] as const;

export function SeoMetadataManager({
  catalogItemId,
}: {
  catalogItemId: string;
}) {
  const [state, action, pending] = useActionState(generateCatalogItemSeoDraftAction, initialState);

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">AI SEO draft</h2>
        <p className="text-sm text-muted-foreground">
          Generate a localized draft, review it, edit the fields, then save it into the item metadata.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="catalogItemId" value={catalogItemId} />
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="seo-draft-locale">Target locale</Label>
            <select
              id="seo-draft-locale"
              name="locale"
              defaultValue={state.locale}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {APP_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Fields to regenerate</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {fieldOptions.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="fields" value={value} defaultChecked />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <p className="warning-panel rounded-md border px-3 py-2 text-xs">
          Generation does not overwrite current metadata. Saving the reviewed draft below replaces the selected locale metadata.
        </p>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Generating...' : state.draft ? 'Regenerate draft' : 'Generate draft'}
        </Button>
      </form>

      {state.draft && (
        <form action={saveGeneratedCatalogItemSeoDraftAction} className="space-y-4 rounded-md border bg-muted/20 p-4">
          <input type="hidden" name="catalogItemId" value={catalogItemId} />
          <input type="hidden" name="locale" value={state.locale} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Generated {state.locale} draft</h3>
              <p className="text-xs text-muted-foreground">Edit anything before saving.</p>
            </div>
            <Button type="submit">Save reviewed SEO draft</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="draft-seo-title">SEO title</Label>
              <Input id="draft-seo-title" name="seoTitle" defaultValue={state.draft.seoTitle} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-seo-slug">SEO slug</Label>
              <Input id="draft-seo-slug" name="seoSlug" defaultValue={state.draft.seoSlug ?? ''} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="draft-seo-description">Meta description</Label>
            <Textarea
              id="draft-seo-description"
              name="seoDescription"
              defaultValue={state.draft.seoDescription}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="draft-seo-keywords">Keywords</Label>
              <Input
                id="draft-seo-keywords"
                name="seoKeywords"
                defaultValue={state.draft.keywords.join(', ')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-social-image">Social image path</Label>
              <Input
                id="draft-social-image"
                name="socialImagePath"
                defaultValue={state.draft.socialImagePath ?? ''}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="draft-og-title">Open Graph title</Label>
            <Input id="draft-og-title" name="ogTitle" defaultValue={state.draft.ogTitle} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="draft-og-description">Open Graph description</Label>
            <Textarea
              id="draft-og-description"
              name="ogDescription"
              defaultValue={state.draft.ogDescription}
            />
          </div>
        </form>
      )}
    </section>
  );
}
