'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutogenerateButton, useItemFormAi } from './ai-context';
import type { CategoryOption, ItemFormValue, SubcategoryOption } from './types';

export function TitleSlugFields({ item }: { item?: Pick<ItemFormValue, 'title' | 'slug'> }) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="title">{t('adminItems.basics.title')}</Label>
          <AutogenerateButton field="title" />
        </div>
        <Input id="title" name="title" defaultValue={item?.title ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">{t('adminItems.basics.slug')}</Label>
        <Input id="slug" name="slug" defaultValue={item?.slug ?? ''} required />
      </div>
    </div>
  );
}

export function ClassificationFields({
  categories,
  subcategories,
  item,
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  item?: Pick<ItemFormValue, 'category_id' | 'subcategory_id' | 'item_type'>;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="categoryId">{t('adminItems.basics.category')}</Label>
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
        <Label htmlFor="subcategoryId">{t('adminItems.basics.subcategory')}</Label>
        <select
          id="subcategoryId"
          name="subcategoryId"
          defaultValue={item?.subcategory_id ?? ''}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('adminItems.basics.none')}</option>
          {subcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>
              {subcategory.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="itemType">{t('adminItems.basics.itemType')}</Label>
        <select
          id="itemType"
          name="itemType"
          defaultValue={item?.item_type ?? 'standard'}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="standard">{t('adminItems.basics.itemTypes.standard')}</option>
          <option value="toy">{t('adminItems.basics.itemTypes.toy')}</option>
          <option value="decoration">{t('adminItems.basics.itemTypes.decoration')}</option>
          <option value="night_light">{t('adminItems.basics.itemTypes.nightLight')}</option>
          <option value="personalized_night_light">
            {t('adminItems.basics.itemTypes.personalizedNightLight')}
          </option>
          <option value="banner">{t('adminItems.basics.itemTypes.banner')}</option>
        </select>
      </div>
    </div>
  );
}

export function StatusField({ item }: { item?: Pick<ItemFormValue, 'status'> }) {
  const t = useTranslations();
  return (
    <div className="space-y-2">
      <Label htmlFor="status">{t('adminItems.basics.status')}</Label>
      <select
        id="status"
        name="status"
        defaultValue={item?.status ?? 'draft'}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="draft">{t('status.draft')}</option>
        <option value="published">{t('status.published')}</option>
        <option value="archived">{t('status.archived')}</option>
      </select>
    </div>
  );
}

export function DescriptionField({ item }: { item?: Pick<ItemFormValue, 'description'> }) {
  const t = useTranslations();
  const { onDescriptionInput } = useItemFormAi();
  return (
    <div className="space-y-2">
      <Label htmlFor="description">{t('adminItems.basics.description')}</Label>
      <Textarea
        id="description"
        name="description"
        defaultValue={item?.description ?? ''}
        onInput={(event) => onDescriptionInput(event.currentTarget.value)}
      />
    </div>
  );
}

export function FlagsFields({
  item,
  onCustomizableChange,
}: {
  item?: Pick<ItemFormValue, 'is_popular' | 'is_customizable'>;
  onCustomizableChange?: (checked: boolean) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap gap-6">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPopular" defaultChecked={item?.is_popular ?? false} />
        {t('adminItems.basics.popular')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isCustomizable"
          defaultChecked={item?.is_customizable ?? false}
          onChange={(event) => onCustomizableChange?.(event.target.checked)}
        />
        {t('adminItems.basics.customizable')}
      </label>
    </div>
  );
}
