import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatPrice } from '@/lib/utils';
import { AutogenerateButton } from './ai-context';
import type { ItemFormValue, StoredPriceFormValue } from './types';

export function PriceField({
  item,
  priceAmd,
  storedPrice,
}: {
  item?: Pick<ItemFormValue, 'price_cents' | 'currency'>;
  /** Price to show, in whole drams. Falls back to the item's own price when it is already AMD. */
  priceAmd?: number;
  /** The price as currently stored, when it is not in AMD yet. */
  storedPrice?: StoredPriceFormValue | null;
}) {
  const fallbackAmd =
    item?.price_cents != null && (item.currency ?? 'AMD') === 'AMD'
      ? Math.round(item.price_cents / 100)
      : 0;
  const defaultValue = priceAmd ?? fallbackAmd;
  const needsConversion = storedPrice && storedPrice.currency !== 'AMD';

  return (
    <div className="space-y-2">
      <Label htmlFor="priceAmd">Price, AMD</Label>
      <Input
        id="priceAmd"
        name="priceAmd"
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        defaultValue={defaultValue}
        required
      />
      {needsConversion ? (
        <p className="text-xs text-muted-foreground">
          Stored as {formatPrice(storedPrice.amountCents, storedPrice.currency)}. Prefilled at
          today&apos;s rate; saving stores the price in AMD.
        </p>
      ) : null}
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
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="manufacturingNotes">Manufacturing notes</Label>
        <AutogenerateButton field="manufacturingNotes" />
      </div>
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="characteristics">Admin-only characteristics</Label>
          <AutogenerateButton field="characteristics" />
        </div>
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
