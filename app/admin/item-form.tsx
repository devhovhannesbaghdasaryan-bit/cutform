'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n';
import { validateSeoMetadata } from '@/lib/seo-validation';
import {
  createCatalogItemAction,
  updateCatalogItemAction,
  type AdminFormState,
} from '@/app/admin/actions';

interface CategoryOption {
  id: string;
  name: string;
}

interface SubcategoryOption {
  id: string;
  name: string;
  category_id: string;
}

interface SeoFormValue {
  locale?: AppLocale;
  seo_slug?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  keywords?: string[] | null;
  og_title?: string | null;
  og_description?: string | null;
  social_image_path?: string | null;
  noindex?: boolean;
  generated_by_ai?: boolean;
  reviewed_by_admin?: boolean;
}

interface ItemFormValue {
  id?: string;
  title?: string;
  slug?: string;
  category_id?: string;
  subcategory_id?: string | null;
  item_type?: string;
  description?: string | null;
  price_cents?: number;
  status?: string;
  is_popular?: boolean;
  is_customizable?: boolean;
  thumbnail_path?: string | null;
  manufacturing_notes?: string | null;
  sizes?: unknown;
  characteristics?: string | null;
}

interface CatalogMediaFormValue {
  id: string;
  media_type: 'image' | 'video';
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

const initial: AdminFormState = { error: null };

export function ItemForm({
  categories,
  subcategories,
  item,
  media,
  seo,
  seoRecords,
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  item?: ItemFormValue;
  media?: CatalogMediaFormValue[];
  seo?: SeoFormValue | null;
  seoRecords?: SeoFormValue[];
}) {
  const actionFn = item?.id ? updateCatalogItemAction : createCatalogItemAction;
  const [state, action, pending] = useActionState(actionFn, initial);
  const seoByLocale = new Map<AppLocale, SeoFormValue>();
  if (seo) seoByLocale.set('en', seo);
  seoRecords?.forEach((record) => {
    if (record.locale) seoByLocale.set(record.locale, record);
  });

  return (
    <form action={action} className="space-y-6">
      {item?.id && <input type="hidden" name="id" value={item.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={item?.title ?? ''} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={item?.slug ?? ''} required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={item?.category_id ?? categories[0]?.id ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcategoryId">Subcategory</Label>
          <select
            id="subcategoryId"
            name="subcategoryId"
            defaultValue={item?.subcategory_id ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="itemType">Item type</Label>
          <select
            id="itemType"
            name="itemType"
            defaultValue={item?.item_type ?? 'standard'}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="standard">Standard</option>
            <option value="toy">Toy</option>
            <option value="decoration">Decoration</option>
            <option value="night_light">Night light</option>
            <option value="personalized_night_light">Personalized night light</option>
            <option value="banner">Banner</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="priceCents">Price, cents</Label>
          <Input
            id="priceCents"
            name="priceCents"
            type="number"
            min="0"
            step="1"
            defaultValue={item?.price_cents ?? 0}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={item?.status ?? 'draft'}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={item?.description ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnailPath">Thumbnail path</Label>
        <p className="text-xs text-muted-foreground">
          Recommended 4:3 image, at least 1200x900 px. Accepted: PNG, JPG, WEBP, SVG up to 50 MB.
        </p>
        <Input
          id="thumbnailPath"
          name="thumbnailPath"
          defaultValue={item?.thumbnail_path ?? ''}
          placeholder="Optional storage path or URL"
        />
        <Input
          id="thumbnailFile"
          name="thumbnailFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
        />
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="font-semibold">Product media</h2>
          <p className="text-sm text-muted-foreground">
            Upload images or videos and set their display order. Product cards play videos on hover.
          </p>
        </div>

        {media?.length ? (
          <div className="space-y-3">
            {media
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((mediaItem) => (
                <div key={mediaItem.id} className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[80px_1fr_110px_90px_90px]">
                  <div className="text-xs">
                    <p className="font-medium uppercase">{mediaItem.media_type}</p>
                    <p className="break-all text-muted-foreground">{mediaItem.storage_path}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`mediaAlt_${mediaItem.id}`}>Alt text</Label>
                    <Input
                      id={`mediaAlt_${mediaItem.id}`}
                      name={`mediaAlt_${mediaItem.id}`}
                      defaultValue={mediaItem.alt_text ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`mediaSort_${mediaItem.id}`}>Order</Label>
                    <Input
                      id={`mediaSort_${mediaItem.id}`}
                      name={`mediaSort_${mediaItem.id}`}
                      type="number"
                      step="1"
                      defaultValue={mediaItem.sort_order}
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input
                      type="radio"
                      name="mediaPrimary"
                      value={mediaItem.id}
                      defaultChecked={mediaItem.is_primary}
                    />
                    Primary
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-destructive">
                    <input type="checkbox" name="mediaRemove" value={mediaItem.id} />
                    Remove
                  </label>
                </div>
              ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No gallery media yet. Upload files below to create the product slider.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="mediaFiles">Upload images/videos</Label>
          <p className="text-xs text-muted-foreground">
            Accepted: PNG, JPG, WEBP, SVG, MP4, WEBM up to 50 MB each.
          </p>
          <Input
            id="mediaFiles"
            name="mediaFiles"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm"
          />
        </div>
      </section>

      <div className="space-y-2">
        <Label htmlFor="manufacturingNotes">Manufacturing notes</Label>
        <Textarea
          id="manufacturingNotes"
          name="manufacturingNotes"
          defaultValue={item?.manufacturing_notes ?? ''}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sizesJson">Sizes JSON</Label>
          <Textarea
            id="sizesJson"
            name="sizesJson"
            defaultValue={JSON.stringify(item?.sizes ?? [], null, 2)}
            placeholder='[{"label":"Medium","widthMm":300,"heightMm":200}]'
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="characteristics">Admin-only characteristics</Label>
          <Textarea
            id="characteristics"
            name="characteristics"
            defaultValue={item?.characteristics ?? ''}
            placeholder="Materials, specifications, finish, production assumptions."
          />
        </div>
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="font-semibold">SEO metadata</h2>
          <p className="text-sm text-muted-foreground">
            Manage indexed metadata for English, Russian, and Armenian storefront pages.
          </p>
        </div>
        {APP_LOCALES.map((locale) => {
          const currentSeo = seoByLocale.get(locale);
          const warnings = validateSeoMetadata(
            {
              seo_title: currentSeo?.seo_title ?? null,
              seo_description: currentSeo?.seo_description ?? null,
              seo_slug: currentSeo?.seo_slug ?? item?.slug ?? null,
              keywords: currentSeo?.keywords ?? [],
              og_title: currentSeo?.og_title ?? null,
              og_description: currentSeo?.og_description ?? null,
              social_image_path: currentSeo?.social_image_path ?? item?.thumbnail_path ?? null,
              noindex: currentSeo?.noindex ?? false,
            },
            { requireLocalized: locale !== 'en' },
          );
          const previewTitle = currentSeo?.seo_title || item?.title || 'SEO title preview';
          const previewDescription = currentSeo?.seo_description || item?.description || 'Meta description preview appears here.';

          return (
            <div key={locale} className="space-y-4 rounded-md border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide">{locale}</h3>
                  <p className="text-xs text-muted-foreground">
                    {currentSeo?.generated_by_ai ? 'Generated by AI' : 'Manual metadata'}
                    {currentSeo?.reviewed_by_admin ? ' - reviewed' : ' - needs review'}
                  </p>
                </div>
                {warnings.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {warnings.map((warning) => (
                      <div key={warning.code}>{warning.message}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="truncate text-sm font-medium text-blue-700">{previewTitle}</p>
                <p className="truncate text-xs text-emerald-700">/items/{currentSeo?.seo_slug || item?.slug || 'item-slug'}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{previewDescription}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`seoTitle_${locale}`}>SEO title</Label>
                  <Input
                    id={`seoTitle_${locale}`}
                    name={`seoTitle_${locale}`}
                    defaultValue={currentSeo?.seo_title ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`seoKeywords_${locale}`}>Keywords</Label>
                  <Input
                    id={`seoKeywords_${locale}`}
                    name={`seoKeywords_${locale}`}
                    defaultValue={currentSeo?.keywords?.join(', ') ?? ''}
                    placeholder="wooden gift, night light"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`seoDescription_${locale}`}>Meta description</Label>
                <Textarea
                  id={`seoDescription_${locale}`}
                  name={`seoDescription_${locale}`}
                  defaultValue={currentSeo?.seo_description ?? ''}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`ogTitle_${locale}`}>Open Graph title</Label>
                  <Input
                    id={`ogTitle_${locale}`}
                    name={`ogTitle_${locale}`}
                    defaultValue={currentSeo?.og_title ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`socialImagePath_${locale}`}>Social image path</Label>
                  <p className="text-xs text-muted-foreground">
                    Recommended 1200x630 px for Open Graph sharing.
                  </p>
                  <Input
                    id={`socialImagePath_${locale}`}
                    name={`socialImagePath_${locale}`}
                    defaultValue={currentSeo?.social_image_path ?? ''}
                  />
                  <Input
                    id={`socialImageFile_${locale}`}
                    name={`socialImageFile_${locale}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`ogDescription_${locale}`}>Open Graph description</Label>
                <Textarea
                  id={`ogDescription_${locale}`}
                  name={`ogDescription_${locale}`}
                  defaultValue={currentSeo?.og_description ?? ''}
                />
              </div>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPopular" defaultChecked={item?.is_popular ?? false} />
          Popular
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isCustomizable"
            defaultChecked={item?.is_customizable ?? false}
          />
          Customizable
        </label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : item?.id ? 'Save item' : 'Create item'}
      </Button>
    </form>
  );
}
