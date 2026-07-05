import { describe, expect, it } from 'vitest';
import { type CartItem, type CartItemSnapshot, planCartMerge } from '@/lib/cart';

function snapshot(overrides: Partial<CartItemSnapshot> = {}): CartItemSnapshot {
  return {
    catalog_item_id: 'catalog-1',
    generated_item_id: null,
    banner_sample_id: null,
    title: 'Walnut coaster',
    quantity: 1,
    unit_price_cents: 2500,
    currency: 'AMD',
    configuration: {},
    ...overrides,
  };
}

function userItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'user-item-1',
    cart_id: 'user-cart-1',
    ...snapshot(),
    ...overrides,
  };
}

describe('planCartMerge', () => {
  it('returns no operations for an empty session cart, even when the user cart has items', () => {
    const plan = planCartMerge([], [userItem()]);
    expect(plan).toEqual({ inserts: [], quantityUpdates: [], deletes: [] });
  });

  it('appends a session item as a new row even when the user cart already has the same item with an identical configuration (quantities are NOT summed)', () => {
    // Documented oddity preserved from the pre-refactor implementation:
    // mergeSessionCartIntoUserCart never coalesced duplicates. The same source
    // item with a byte-identical configuration produces a second cart row
    // instead of a quantity update.
    const configuration = { sourcePriceCents: 2500, sourceCurrency: 'AMD' };
    const sessionItem = snapshot({ quantity: 2, configuration });
    const existing = userItem({ quantity: 3, configuration });

    const plan = planCartMerge([sessionItem], [existing]);

    expect(plan.inserts).toEqual([sessionItem]);
    expect(plan.quantityUpdates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('keeps session items with a different configuration as separate inserts', () => {
    const sessionItem = snapshot({ configuration: { color: 'red' } });
    const existing = userItem({ configuration: { color: 'blue' } });

    const plan = planCartMerge([sessionItem], [existing]);

    expect(plan.inserts).toEqual([sessionItem]);
    expect(plan.quantityUpdates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('carries conflicting session items over untouched (same source, different price/quantity)', () => {
    // Same outcome as the pre-refactor implementation: the guest row keeps its
    // own price and quantity; the user's existing row is never updated or
    // deleted, so both prices coexist in the merged cart.
    const sessionItem = snapshot({ quantity: 4, unit_price_cents: 1800 });
    const existing = userItem({ quantity: 1, unit_price_cents: 2500 });

    const plan = planCartMerge([sessionItem], [existing]);

    expect(plan.inserts).toEqual([
      expect.objectContaining({ quantity: 4, unit_price_cents: 1800 }),
    ]);
    expect(plan.quantityUpdates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('inserts every session item in order, preserving all fields', () => {
    const first = snapshot({ title: 'First', quantity: 2 });
    const second = snapshot({
      catalog_item_id: null,
      generated_item_id: 'generated-1',
      title: 'Second',
      unit_price_cents: 9900,
      currency: 'USD',
      configuration: { personalizedPreviewOptionId: 'option-1', creditCost: 1 },
    });
    const third = snapshot({
      catalog_item_id: null,
      banner_sample_id: 'banner-1',
      title: 'Third',
    });

    const plan = planCartMerge([first, second, third], []);

    expect(plan.inserts).toEqual([first, second, third]);
    expect(plan.quantityUpdates).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const sessionItem = snapshot({ configuration: { color: 'red' } });
    const sessionItems = [sessionItem];
    const existing = [userItem()];

    const plan = planCartMerge(sessionItems, existing);
    plan.inserts[0]!.title = 'Changed';
    plan.inserts.push(snapshot({ title: 'Extra' }));

    expect(sessionItem.title).toBe('Walnut coaster');
    expect(sessionItems).toHaveLength(1);
    expect(existing).toHaveLength(1);
  });
});
