import { describe, expect, it } from 'vitest';
import { planGeneratedItemCartAdd } from '@/lib/generated-items';

const pricing = {
  unitPriceCents: 12000,
  currency: 'AMD',
  sourcePriceCents: 10000,
  sourceCurrency: 'AMD',
  exchangeRateContext: { rate: 1.2 },
};

describe('planGeneratedItemCartAdd', () => {
  it('produces one cart-add call per selected option, carrying that option identity, when optionIds is non-empty', () => {
    // This is the exact scenario the branch on `product_type === 'personalized_night_light'`
    // used to break for any non-night-light item: real preview options existed and were
    // submitted, but the stale check routed everything into the generic single-line branch,
    // silently dropping the customer's selection.
    const calls = planGeneratedItemCartAdd({
      item: { id: 'item-1', title: 'Custom Mug', productType: 'standard', creditCost: 2 },
      optionIds: ['option-1', 'option-2'],
      fetchedOptions: [
        {
          id: 'option-1',
          previewImagePath: 'previews/option-1.png',
          manufacturingFilePath: 'manufacturing/option-1.svg',
          metadata: { boilerplateName: 'Sunset' },
        },
        {
          id: 'option-2',
          previewImagePath: 'previews/option-2.png',
          manufacturingFilePath: null,
          metadata: {},
        },
      ],
      pricing,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      generatedItemId: 'item-1',
      title: 'Sunset',
      quantity: 1,
      unitPriceCents: 12000,
      currency: 'AMD',
      configuration: {
        productType: 'standard',
        personalizedPreviewOptionId: 'option-1',
        selectedPreviewPath: 'previews/option-1.png',
        hiddenSvgPath: 'manufacturing/option-1.svg',
        boilerplateSnapshot: { boilerplateName: 'Sunset' },
        creditCost: 1,
        sourcePriceCents: 10000,
        sourceCurrency: 'AMD',
        exchangeRateContext: { rate: 1.2 },
      },
    });
    expect(calls[1]).toEqual({
      generatedItemId: 'item-1',
      title: 'Custom Mug',
      quantity: 1,
      unitPriceCents: 12000,
      currency: 'AMD',
      configuration: {
        productType: 'standard',
        personalizedPreviewOptionId: 'option-2',
        selectedPreviewPath: 'previews/option-2.png',
        hiddenSvgPath: null,
        boilerplateSnapshot: {},
        creditCost: 1,
        sourcePriceCents: 10000,
        sourceCurrency: 'AMD',
        exchangeRateContext: { rate: 1.2 },
      },
    });
  });

  it('produces a single generic cart-add call when optionIds is empty', () => {
    const calls = planGeneratedItemCartAdd({
      item: { id: 'item-2', title: 'Engraved Frame', productType: 'standard', creditCost: 3 },
      optionIds: [],
      fetchedOptions: [],
      pricing,
    });

    expect(calls).toEqual([
      {
        generatedItemId: 'item-2',
        title: 'Engraved Frame',
        quantity: 1,
        unitPriceCents: 12000,
        currency: 'AMD',
        configuration: {
          productType: 'standard',
          creditCost: 3,
          sourcePriceCents: 10000,
          sourceCurrency: 'AMD',
          exchangeRateContext: { rate: 1.2 },
        },
      },
    ]);
  });

  it('falls back to a generated title when the item has no title and no options are selected', () => {
    const calls = planGeneratedItemCartAdd({
      item: { id: 'item-3abcdef01', title: null, productType: 'banner', creditCost: 1 },
      optionIds: [],
      fetchedOptions: [],
      pricing,
    });

    expect(calls[0]?.title).toBe('banner item-3ab');
  });

  it('throws when a requested optionId has no matching fetched option', () => {
    expect(() =>
      planGeneratedItemCartAdd({
        item: { id: 'item-4', title: 'Poster', productType: 'standard', creditCost: 1 },
        optionIds: ['option-missing'],
        fetchedOptions: [],
        pricing,
      }),
    ).toThrow('One or more generated options are unavailable.');
  });
});
