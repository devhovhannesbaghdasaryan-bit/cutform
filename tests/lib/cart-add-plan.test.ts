import { describe, expect, it } from 'vitest';
import { type CartItem, type CartItemInput, planCartAdd } from '@/lib/cart';

function line(overrides: Partial<CartItem>): CartItem {
  return {
    id: 'line-1',
    cart_id: 'cart-1',
    catalog_item_id: 'cat-1',
    generated_item_id: null,
    banner_sample_id: null,
    title: 'Item',
    quantity: 1,
    unit_price_cents: 1000,
    currency: 'USD',
    configuration: {},
    ...overrides,
  };
}

function catalogInput(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    catalogItemId: 'cat-1',
    title: 'Item',
    unitPriceCents: 1000,
    currency: 'USD',
    ...overrides,
  };
}

describe('planCartAdd', () => {
  it('increments a line matching catalog item, currency, and unit price', () => {
    expect(planCartAdd([line({ quantity: 2 })], catalogInput())).toEqual({
      kind: 'increment',
      cartItemId: 'line-1',
      nextQuantity: 3,
    });
  });

  it('adds the input quantity when provided', () => {
    expect(planCartAdd([line({ quantity: 2 })], catalogInput({ quantity: 5 }))).toEqual({
      kind: 'increment',
      cartItemId: 'line-1',
      nextQuantity: 7,
    });
  });

  it('ignores configuration differences when matching', () => {
    const existing = line({ configuration: { exchangeRateContext: 'old' } });
    expect(planCartAdd([existing], catalogInput()).kind).toBe('increment');
  });

  it('inserts when the cart is empty', () => {
    expect(planCartAdd([], catalogInput())).toEqual({ kind: 'insert' });
  });

  it('inserts when unit price differs', () => {
    expect(planCartAdd([line({ unit_price_cents: 900 })], catalogInput())).toEqual({
      kind: 'insert',
    });
  });

  it('inserts when currency differs', () => {
    expect(planCartAdd([line({ currency: 'AMD' })], catalogInput())).toEqual({ kind: 'insert' });
  });

  it('inserts when the catalog item differs', () => {
    expect(planCartAdd([line({ catalog_item_id: 'cat-2' })], catalogInput())).toEqual({
      kind: 'insert',
    });
  });

  it('inserts for generated items even when a line matches otherwise', () => {
    const input: CartItemInput = {
      generatedItemId: 'gen-1',
      title: 'Generated',
      unitPriceCents: 1000,
      currency: 'USD',
    };
    expect(planCartAdd([line({})], input)).toEqual({ kind: 'insert' });
  });

  it('inserts when input currency is undefined', () => {
    expect(planCartAdd([line({})], catalogInput({ currency: undefined }))).toEqual({
      kind: 'insert',
    });
  });

  it('uses the first matching line when several match', () => {
    const first = line({ id: 'line-1' });
    const second = line({ id: 'line-2' });
    expect(planCartAdd([first, second], catalogInput())).toEqual({
      kind: 'increment',
      cartItemId: 'line-1',
      nextQuantity: 2,
    });
  });
});
