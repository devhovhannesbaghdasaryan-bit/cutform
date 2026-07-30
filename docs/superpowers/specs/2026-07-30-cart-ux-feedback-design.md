# Cart UX: add-to-cart feedback, line merging, badge semantics

**Date:** 2026-07-30
**Status:** Approved
**Origin:** July 2026 UX audit, high finding: add-to-cart gives no success/error feedback (silent failure during the Supabase 503 bursts), repeat adds create duplicate cart lines instead of incrementing quantity, and the header badge counts distinct lines (so quantity changes never move it).

## Design

### 1. `planCartAdd` — pure merge decision (`lib/cart.ts`)

```ts
export type CartAddPlan =
  | { kind: 'insert' }
  | { kind: 'increment'; cartItemId: string; nextQuantity: number };

export function planCartAdd(existingItems: CartItem[], input: CartItemInput): CartAddPlan
```

Returns `increment` only when `input.catalogItemId` is set, `input.currency` is set, and an existing line matches on all of: `catalog_item_id === input.catalogItemId`, `currency === input.currency`, `unit_price_cents === input.unitPriceCents`. When `input.currency` is undefined the plan is always `insert` (the catalog add action always sets it; the rule keeps the helper total). First matching line wins. `nextQuantity = matched.quantity + (input.quantity ?? 1)`.

- Configuration is deliberately ignored in matching: for catalog items it stores volatile pricing context (`exchangeRateContext`), not user-visible options.
- Generated items and banner samples always `insert` (each is unique).
- Price/currency mismatch always inserts — merging lines priced under different currencies/rates would corrupt the cart.

Mirrors the existing pure-function pattern of `planCartMerge` (same file) and is unit-tested the same way.

`addItemToCart` fetches the cart's existing items, calls `planCartAdd`, and either updates the matched row's quantity or inserts as today. Known race: two concurrent adds can still create duplicate rows (no DB constraint added — accepted).

### 2. Badge counts units (`lib/cart.ts`)

`getActiveCartItemCount` selects `cart_items(quantity)` and returns the sum of quantities instead of the row count. Same error-tolerant contract (0 on missing cart or query failure). Quantity updates on `/cart` now visibly move the badge; no tooltip needed.

### 3. `addCatalogItemToCartAction` returns `ActionState` (`app/cart/actions.ts`)

Signature becomes the repo's `useActionState` contract: `(prevState: ActionState, formData: FormData) => Promise<ActionState>` using `actionSuccess` / `actionError` from `lib/action-state.ts` instead of `throw`. `revalidatePath` calls unchanged. User-facing messages localized in the action via `getTranslations` with new `cart.*` keys (invalid item, unavailable item, market-blocked, generic add failure, added-success). Update/remove/clear cart actions keep their current throwing shape — the audit finding against them is resolved by the badge change.

### 4. `components/add-to-cart-button.tsx` (new, client component)

One component for both call sites:

- `useActionState(addCatalogItemToCartAction, idleState)`; renders inside a `<form>` with the hidden `itemId` input.
- Pending: button disabled with lucide `Loader2` spinner replacing the cart icon.
- On state change (`useEffect`): `status === 'success'` → `sonner` `toast.success(labels.added)`; `status === 'error'` → `toast.error(state.error)`. The Toaster is already mounted in `app/layout.tsx`.
- Props: `itemId: string`, `labels: { added: string; ariaLabel: string; buttonText?: string }` — catalog card uses icon-only (`components/catalog-item-card.tsx`), product page passes `buttonText` (`app/items/[slug]/page.tsx`). Both call sites swap their inline `<form action={…}>` for this component.

### i18n

New `cart.*` keys in `messages/en.json`, `messages/am.json`, `messages/ru.json` for: added-success toast, invalid item, item unavailable, market-unavailable, generic add failure. AM/RU strings drafted by implementation; flagged for the user's proofread (same caveat as the receipt emails).

## Success criteria

Add-to-cart shows a success toast on real success and an error toast (with a meaningful message) on any failure — including transient 503s; double-adding the same catalog item yields one line with quantity 2; changing a line's quantity moves the header badge; badge equals total units everywhere.

## Testing

- Vitest for `planCartAdd`: merges identical catalog item (quantity math), inserts on price mismatch, currency mismatch, different catalog item, generated/banner items, empty cart; first-match-wins with multiple candidates.
- Existing `tests/lib/cart-merge.test.ts` and `generated-item-cart-add.test.ts` stay green.
- Manual browser QA: success toast, error toast (e.g. unpublished item), duplicate-add merge, badge arithmetic after quantity update.

## Out of scope

- Guest→user login merge keeps append semantics (`planCartMerge` unchanged).
- Feedback/pending states for update/remove/clear cart forms.
- Generated-item and banner add-to-cart paths keep their current UX (separate actions).
