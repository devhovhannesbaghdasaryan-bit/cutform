/**
 * Groups the shared boilerplate library into tabs by the catalog category of
 * the items each boilerplate is attached to. Boilerplates carry no category of
 * their own, so a boilerplate attached to items in several categories appears
 * under each of them, and one attached to no item lands in "unattached".
 */

export const ALL_TAB = 'all';
export const UNATTACHED_TAB = 'unattached';

export interface BoilerplateCategory {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
}

export interface BoilerplateAttachment {
  boilerplate_id: string;
  item: {
    id: string;
    title: string;
    category: BoilerplateCategory | null;
  } | null;
}

export interface BoilerplateTab {
  /** URL value for `?category=`: a category slug, `all` or `unattached`. */
  key: string;
  /** Category name; null for the built-in `all` / `unattached` tabs (labels come from translations). */
  name: string | null;
  count: number;
}

export interface BoilerplateGrouping {
  tabs: BoilerplateTab[];
  /** Item titles each boilerplate is attached to, in attachment order, deduplicated. */
  attachedItemsById: Map<string, string[]>;
  /** Boilerplate ids per tab key. */
  idsByTab: Map<string, Set<string>>;
}

export function groupBoilerplatesByCategory(
  boilerplateIds: readonly string[],
  attachments: readonly BoilerplateAttachment[],
): BoilerplateGrouping {
  const known = new Set(boilerplateIds);
  const categories = new Map<string, BoilerplateCategory>();
  const idsByTab = new Map<string, Set<string>>();
  const attachedItemsById = new Map<string, string[]>();

  for (const { boilerplate_id: id, item } of attachments) {
    if (!known.has(id) || !item) continue;

    const titles = attachedItemsById.get(id) ?? [];
    if (!titles.includes(item.title)) titles.push(item.title);
    attachedItemsById.set(id, titles);

    const category = item.category;
    if (!category) continue;
    categories.set(category.slug, category);
    const ids = idsByTab.get(category.slug) ?? new Set<string>();
    ids.add(id);
    idsByTab.set(category.slug, ids);
  }

  const unattached = new Set(boilerplateIds.filter((id) => !attachedItemsById.has(id)));
  idsByTab.set(ALL_TAB, new Set(boilerplateIds));
  idsByTab.set(UNATTACHED_TAB, unattached);

  const categoryTabs = [...categories.values()]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((category) => ({
      key: category.slug,
      name: category.name,
      count: idsByTab.get(category.slug)?.size ?? 0,
    }));

  return {
    tabs: [
      { key: ALL_TAB, name: null, count: boilerplateIds.length },
      ...categoryTabs,
      { key: UNATTACHED_TAB, name: null, count: unattached.size },
    ],
    attachedItemsById,
    idsByTab,
  };
}

/**
 * Resolves the `?category=` value to a tab key. Unknown or missing values fall
 * back to the first category tab, or to `all` when no category has boilerplates.
 */
export function resolveActiveTab(tabs: readonly BoilerplateTab[], requested?: string): string {
  if (requested && tabs.some((tab) => tab.key === requested)) return requested;
  return tabs.find((tab) => tab.key !== ALL_TAB && tab.key !== UNATTACHED_TAB)?.key ?? ALL_TAB;
}
