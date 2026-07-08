'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createCatalogItemAction, updateCatalogItemAction } from '@/app/admin/items/actions';
import { errorOf, idleState } from '@/lib/action-state';
import {
  ClassificationFields,
  DescriptionField,
  FlagsFields,
  StatusField,
  TitleSlugFields,
} from './basics-fields';
import { MarketRulesSection } from './market-rules-fields';
import { MediaSection, ThumbnailFields } from './media-fields';
import { PersonalizationFields } from './personalization-fields';
import {
  ManufacturingNotesField,
  PriceField,
  SizesCharacteristicsFields,
} from './pricing-size-fields';
import { SeoSection } from './seo-section';
import type {
  BoilerplateOption,
  CatalogMediaFormValue,
  CategoryOption,
  ItemFormValue,
  MarketCountryFormValue,
  MarketRegionFormValue,
  MarketRuleFormValue,
  SeoFormValue,
  SubcategoryOption,
} from './types';

export function ItemForm({
  categories,
  subcategories,
  item,
  media,
  seo,
  seoRecords,
  marketRegions = [],
  marketCountries = [],
  marketRules = [],
  boilerplateOptions = [],
  selectedBoilerplateIds = [],
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  item?: ItemFormValue;
  media?: CatalogMediaFormValue[];
  seo?: SeoFormValue | null;
  seoRecords?: SeoFormValue[];
  marketRegions?: MarketRegionFormValue[];
  marketCountries?: MarketCountryFormValue[];
  marketRules?: MarketRuleFormValue[];
  boilerplateOptions?: BoilerplateOption[];
  selectedBoilerplateIds?: string[];
}) {
  const actionFn = item?.id ? updateCatalogItemAction : createCatalogItemAction;
  const [state, action, pending] = useActionState(actionFn, idleState);
  const error = errorOf(state);
  const [isCustomizable, setIsCustomizable] = useState(item?.is_customizable ?? false);

  return (
    <form action={action} className="space-y-6">
      {item?.id && <input type="hidden" name="id" value={item.id} />}

      <TitleSlugFields item={item} />

      {marketRegions.length > 0 && (
        <MarketRulesSection
          marketRegions={marketRegions}
          marketCountries={marketCountries}
          marketRules={marketRules}
        />
      )}

      <ClassificationFields categories={categories} subcategories={subcategories} item={item} />

      <div className="grid gap-4 md:grid-cols-3">
        <PriceField item={item} />
        <StatusField item={item} />
      </div>

      <DescriptionField item={item} />

      <ThumbnailFields item={item} />

      <MediaSection media={media} />

      <ManufacturingNotesField item={item} />

      <SizesCharacteristicsFields item={item} />

      <SeoSection item={item} seo={seo} seoRecords={seoRecords} />

      <FlagsFields item={item} onCustomizableChange={setIsCustomizable} />

      {isCustomizable && (
        <PersonalizationFields
          item={item}
          boilerplateOptions={boilerplateOptions}
          selectedBoilerplateIds={selectedBoilerplateIds}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : item?.id ? 'Save item' : 'Create item'}
      </Button>
    </form>
  );
}
