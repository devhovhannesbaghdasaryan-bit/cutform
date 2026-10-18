import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n-config';
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
  const t = useTranslations();
  const locale = normalizeLocale(useLocale()) ?? DEFAULT_LOCALE;
  const fallbackAmd =
    item?.price_cents != null && (item.currency ?? 'AMD') === 'AMD'
      ? Math.round(item.price_cents / 100)
      : 0;
  const defaultValue = priceAmd ?? fallbackAmd;
  const needsConversion = storedPrice && storedPrice.currency !== 'AMD';

  return (
    <div className="space-y-2">
      <Label htmlFor="priceAmd">{t('adminItems.pricing.priceAmd')}</Label>
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
          {t('adminItems.pricing.storedAs', {
            price: formatPrice(storedPrice.amountCents, storedPrice.currency, locale),
          })}
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
  const t = useTranslations();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="manufacturingNotes">{t('adminItems.pricing.manufacturingNotes')}</Label>
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
  const t = useTranslations();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="sizesJson">{t('adminItems.pricing.sizesJson')}</Label>
        <Textarea
          id="sizesJson"
          name="sizesJson"
          defaultValue={JSON.stringify(item?.sizes ?? [], null, 2)}
          placeholder='[{"label":"Medium","widthMm":300,"heightMm":200}]'
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="characteristics">{t('adminItems.pricing.characteristics')}</Label>
          <AutogenerateButton field="characteristics" />
        </div>
        <Textarea
          id="characteristics"
          name="characteristics"
          defaultValue={item?.characteristics ?? ''}
          placeholder={t('adminItems.pricing.characteristicsPlaceholder')}
        />
      </div>
    </div>
  );
}
