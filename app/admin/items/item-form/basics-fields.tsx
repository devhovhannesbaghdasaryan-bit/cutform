import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CategoryOption, ItemFormValue, SubcategoryOption } from './types';

export function TitleSlugFields({ item }: { item?: Pick<ItemFormValue, 'title' | 'slug'> }) {
  return (
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
  return (
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
  );
}

export function StatusField({ item }: { item?: Pick<ItemFormValue, 'status'> }) {
  return (
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
  );
}

export function DescriptionField({ item }: { item?: Pick<ItemFormValue, 'description'> }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea id="description" name="description" defaultValue={item?.description ?? ''} />
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
  return (
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
          onChange={(event) => onCustomizableChange?.(event.target.checked)}
        />
        Customizable
      </label>
    </div>
  );
}
