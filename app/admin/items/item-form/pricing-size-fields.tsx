import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ItemFormValue } from './types';

export function PriceField({ item }: { item?: Pick<ItemFormValue, 'price_cents'> }) {
  return (
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
  );
}

export function ManufacturingNotesField({
  item,
}: {
  item?: Pick<ItemFormValue, 'manufacturing_notes'>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="manufacturingNotes">Manufacturing notes</Label>
      <Textarea
        id="manufacturingNotes"
        name="manufacturingNotes"
        defaultValue={item?.manufacturing_notes ?? ''}
      />
    </div>
  );
}

export function SizesCharacteristicsFields({
  item,
}: {
  item?: Pick<ItemFormValue, 'sizes' | 'characteristics'>;
}) {
  return (
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
  );
}
