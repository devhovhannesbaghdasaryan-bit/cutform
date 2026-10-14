import { describe, expect, it } from 'vitest';
import {
  ALL_TAB,
  type BoilerplateAttachment,
  type BoilerplateCategory,
  groupBoilerplatesByCategory,
  resolveActiveTab,
  UNATTACHED_TAB,
} from '@/lib/boilerplate-categories';

const nightLights: BoilerplateCategory = {
  id: 'c1',
  slug: 'night-lights',
  name: 'Night lights',
  sort_order: 1,
};
const boxes: BoilerplateCategory = {
  id: 'c2',
  slug: 'keepsake-boxes',
  name: 'Keepsake boxes',
  sort_order: 2,
};

function attach(
  id: string,
  title: string,
  category: BoilerplateCategory | null,
): BoilerplateAttachment {
  return { boilerplate_id: id, item: { id: `item-${title}`, title, category } };
}

describe('groupBoilerplatesByCategory', () => {
  it('builds All, one tab per category in sort order, then Unattached', () => {
    const { tabs } = groupBoilerplatesByCategory(
      ['a', 'b', 'c'],
      [attach('b', 'Box', boxes), attach('a', 'Lamp', nightLights)],
    );
    expect(tabs).toEqual([
      { key: ALL_TAB, name: null, count: 3 },
      { key: 'night-lights', name: 'Night lights', count: 1 },
      { key: 'keepsake-boxes', name: 'Keepsake boxes', count: 1 },
      { key: UNATTACHED_TAB, name: null, count: 1 },
    ]);
  });

  it('lists a boilerplate under every category it is attached in, counted once each', () => {
    const { idsByTab } = groupBoilerplatesByCategory(
      ['a'],
      [
        attach('a', 'Lamp', nightLights),
        attach('a', 'Lamp 2', nightLights),
        attach('a', 'Box', boxes),
      ],
    );
    expect([...(idsByTab.get('night-lights') ?? [])]).toEqual(['a']);
    expect([...(idsByTab.get('keepsake-boxes') ?? [])]).toEqual(['a']);
    expect(idsByTab.get(UNATTACHED_TAB)?.size).toBe(0);
  });

  it('records attached item titles without duplicates', () => {
    const { attachedItemsById } = groupBoilerplatesByCategory(
      ['a'],
      [
        attach('a', 'Lamp', nightLights),
        attach('a', 'Lamp', nightLights),
        attach('a', 'Box', boxes),
      ],
    );
    expect(attachedItemsById.get('a')).toEqual(['Lamp', 'Box']);
  });

  it('treats an item without a category as attached but adds no category tab', () => {
    const { tabs, idsByTab } = groupBoilerplatesByCategory(['a'], [attach('a', 'Loose', null)]);
    expect(tabs.map((tab) => tab.key)).toEqual([ALL_TAB, UNATTACHED_TAB]);
    expect(idsByTab.get(UNATTACHED_TAB)?.size).toBe(0);
  });

  it('ignores attachments to unknown boilerplates or missing items', () => {
    const { tabs } = groupBoilerplatesByCategory(
      ['a'],
      [attach('zzz', 'Lamp', nightLights), { boilerplate_id: 'a', item: null }],
    );
    expect(tabs).toEqual([
      { key: ALL_TAB, name: null, count: 1 },
      { key: UNATTACHED_TAB, name: null, count: 1 },
    ]);
  });
});

describe('resolveActiveTab', () => {
  const { tabs } = groupBoilerplatesByCategory(['a'], [attach('a', 'Lamp', nightLights)]);

  it('keeps a requested tab that exists', () => {
    expect(resolveActiveTab(tabs, UNATTACHED_TAB)).toBe(UNATTACHED_TAB);
  });

  it('falls back to the first category for a missing or unknown value', () => {
    expect(resolveActiveTab(tabs)).toBe('night-lights');
    expect(resolveActiveTab(tabs, 'nope')).toBe('night-lights');
  });

  it('falls back to All when no category has boilerplates', () => {
    const empty = groupBoilerplatesByCategory(['a'], []).tabs;
    expect(resolveActiveTab(empty)).toBe(ALL_TAB);
  });
});
