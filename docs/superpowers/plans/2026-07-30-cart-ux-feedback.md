# Cart UX Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add-to-cart gives real success/error feedback, repeat adds merge into one line, and the header badge counts total units.

**Architecture:** A pure `planCartAdd` decision function in `lib/cart.ts` (mirroring the tested `planCartMerge` pattern) drives merge-vs-insert inside `addItemToCart`; `getActiveCartItemCount` switches to summing quantities; `addCatalogItemToCartAction` converts from throwing to the repo's `ActionState` contract with localized messages; one client `AddToCartButton` (useActionState + sonner toasts) replaces the two inline forms.

**Tech Stack:** Next.js App Router server actions, `lib/action-state.ts` (`ActionState`, `actionSuccess`, `actionError`, `idleState`), next-intl `getTranslations`, sonner (Toaster already mounted in `app/layout.tsx`), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-cart-ux-feedback-design.md`
- No new dependencies.
- Merge rule (exact): increment only when `input.catalogItemId` is set, `input.currency` is set, and an existing line matches `catalog_item_id === input.catalogItemId && currency === input.currency && unit_price_cents === input.unitPriceCents`. Configuration is ignored. Generated/banner items always insert. First matching line wins. `nextQuantity = matched.quantity + (input.quantity ?? 1)`.
- Badge = sum of `quantity` across the active cart's items; 0 on missing cart or query failure (unchanged error-tolerant contract).
- `updateCartQuantityAction`, `removeCartItemAction`, `clearCartAction`, and `planCartMerge` are NOT modified.
- New i18n keys (all three locale files): `cart.added`, `cart.add_invalid`, `cart.add_unavailable`, `cart.add_market_unavailable`, `cart.add_failed`.
- Work on branch `cart-ux-feedback` (cut from `main`).
- If you run the formatter, scope it to files you changed; verify `git status --porcelain` shows no unrelated modified tracked files before committing.

---

### Task 1: `planCartAdd` pure helper (TDD)

**Files:**
- Modify: `lib/cart.ts` (add exports near `planCartMerge`)
- Test: `tests/lib/cart-add-plan.test.ts` (new)

**Interfaces:**
- Consumes: existing types `CartItem`, `CartItemInput` from `lib/cart.ts`.
- Produces: `export type CartAddPlan = { kind: 'insert' } | { kind: 'increment'; cartItemId: string; nextQuantity: number }` and `export function planCartAdd(existingItems: CartItem[], input: CartItemInput): CartAddPlan` — Task 2 calls it inside `addItemToCart`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/cart-add-plan.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/cart-add-plan.test.ts`
Expected: FAIL — `planCartAdd` is not exported from `@/lib/cart`.

- [ ] **Step 3: Implement**

In `lib/cart.ts`, directly above the `CartMergePlan` interface, add:

```ts
export type CartAddPlan =
  | { kind: 'insert' }
  | { kind: 'increment'; cartItemId: string; nextQuantity: number };

/**
 * Pure merge-vs-insert decision for adding an item to a cart. Repeat adds of
 * the same catalog item coalesce into one line — but only when currency and
 * unit price also match, so lines priced under different display currencies
 * or exchange rates are never silently merged. Configuration is ignored on
 * purpose: for catalog items it stores volatile pricing context
 * (exchangeRateContext), not user-visible options. Generated items and
 * banner samples are unique and always insert.
 */
export function planCartAdd(existingItems: CartItem[], input: CartItemInput): CartAddPlan {
  if (!input.catalogItemId || !input.currency) return { kind: 'insert' };

  const match = existingItems.find(
    (item) =>
      item.catalog_item_id === input.catalogItemId &&
      item.currency === input.currency &&
      item.unit_price_cents === input.unitPriceCents,
  );

  if (!match) return { kind: 'insert' };
  return {
    kind: 'increment',
    cartItemId: match.id,
    nextQuantity: match.quantity + (input.quantity ?? 1),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/cart-add-plan.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck` (only acceptable error: pre-existing one in `tests/lib/supabase/server.test.ts`), `pnpm lint`, `pnpm biome format --write lib/cart.ts tests/lib/cart-add-plan.test.ts`.

```bash
git add lib/cart.ts tests/lib/cart-add-plan.test.ts
git commit -m "feat: add planCartAdd merge decision for repeat cart adds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire merging into `addItemToCart`; badge counts units

**Files:**
- Modify: `lib/cart.ts` (`addItemToCart`, `getActiveCartItemCount`)

**Interfaces:**
- Consumes: `planCartAdd(existingItems: CartItem[], input: CartItemInput): CartAddPlan` from Task 1.
- Produces: no signature changes — `addItemToCart` still resolves to `{ id: string }`-shaped data and `getActiveCartItemCount` still resolves to `number`; callers are unaffected.

- [ ] **Step 1: Make `addItemToCart` consult the plan**

In `lib/cart.ts`, inside `addItemToCart`, after the existing `const cart = await getOrCreateCart(supabase, owner);` line and before the insert, add the existing-items fetch and plan branch, so the function becomes:

```ts
export async function addItemToCart(
  supabase: TypedSupabaseClient,
  owner: CartOwner,
  input: CartItemInput,
) {
  const selectedSources = [input.catalogItemId, input.generatedItemId, input.bannerSampleId].filter(
    Boolean,
  );

  if (selectedSources.length !== 1) {
    throw new Error('Cart item must reference exactly one source.');
  }

  const cart = await getOrCreateCart(supabase, owner);

  const { data: existingItems, error: existingItemsError } = await supabase
    .from('cart_items')
    .select(
      'id, cart_id, catalog_item_id, generated_item_id, banner_sample_id, title, quantity, unit_price_cents, currency, configuration',
    )
    .eq('cart_id', cart.id)
    .returns<CartItem[]>();

  if (existingItemsError) throw new Error(existingItemsError.message);

  const plan = planCartAdd(existingItems ?? [], input);
  if (plan.kind === 'increment') {
    const { error: incrementError } = await supabase
      .from('cart_items')
      .update({ quantity: plan.nextQuantity })
      .eq('id', plan.cartItemId)
      .eq('cart_id', cart.id);

    if (incrementError) throw new Error(incrementError.message);
    return { id: plan.cartItemId };
  }

  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      cart_id: cart.id,
      catalog_item_id: input.catalogItemId ?? null,
      generated_item_id: input.generatedItemId ?? null,
      banner_sample_id: input.bannerSampleId ?? null,
      title: input.title,
      quantity: input.quantity ?? 1,
      unit_price_cents: input.unitPriceCents,
      currency: input.currency ?? cart.currency,
      configuration: (input.configuration ?? {}) as Json,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Unable to add item to cart.');
  if (input.currency && input.currency !== cart.currency) {
    const { error: cartUpdateError } = await supabase
      .from('carts')
      .update({ currency: input.currency })
      .eq('id', cart.id);
    if (cartUpdateError) throw new Error(cartUpdateError.message);
  }
  return data;
}
```

(The insert path and cart-currency update are unchanged from today; only the fetch + plan branch is new.)

- [ ] **Step 2: Sum quantities in `getActiveCartItemCount`**

Replace the function body so it selects quantities and sums them:

```ts
export async function getActiveCartItemCount(supabase: TypedSupabaseClient, owner: CartOwner) {
  const query = supabase.from('carts').select('id, cart_items(quantity)');
  const { data } = await ('userId' in owner
    ? query.eq('user_id', owner.userId)
    : query.eq('session_id', owner.sessionId)
  )
    .eq('status', 'active')
    .maybeSingle();
  return (data?.cart_items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}
```

Keep the existing doc comment, amending its first line to "Error-tolerant total unit count (sum of quantities) for the owner's active cart, …".

- [ ] **Step 3: Verify**

Run: `pnpm test` (full suite — `tests/lib/cart-merge.test.ts` and `tests/lib/generated-item-cart-add.test.ts` must stay green), `pnpm typecheck` (pre-existing error only), `pnpm lint`, `pnpm biome format --write lib/cart.ts`.
Expected: suite fully green (289 tests after Task 1's 10 additions).

- [ ] **Step 4: Commit**

```bash
git add lib/cart.ts
git commit -m "feat: merge repeat cart adds and count cart badge in units

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: ActionState add-to-cart with toasts

**Files:**
- Modify: `app/cart/actions.ts` (`addCatalogItemToCartAction` only)
- Create: `components/add-to-cart-button.tsx`
- Modify: `components/catalog-item-card.tsx:90-101` (replace inline form)
- Modify: `app/items/[slug]/page.tsx:165-171` (replace inline form)
- Modify: `messages/en.json`, `messages/am.json`, `messages/ru.json` (five `cart.*` keys)

**Interfaces:**
- Consumes: `ActionState`, `actionSuccess`, `actionError`, `idleState` from `@/lib/action-state`; `addItemToCart` (Task 2 behavior) via the action.
- Produces: `addCatalogItemToCartAction(prevState: ActionState<null>, formData: FormData): Promise<ActionState<null>>`; `AddToCartButton(props: { itemId: string; ariaLabel: string; buttonText?: string; size?: 'sm' | 'lg'; variant?: 'outline' | 'default'; className?: string })`.

- [ ] **Step 1: Add the i18n keys**

Inside the `"cart"` object of `messages/en.json`:

```json
"added": "Added to cart",
"add_invalid": "Invalid item.",
"add_unavailable": "This item is not available.",
"add_market_unavailable": "This item is not available for shipping to your selected country.",
"add_failed": "Couldn't add the item. Please try again."
```

`messages/am.json` `"cart"`:

```json
"added": "Ավելացվեց զամբյուղ",
"add_invalid": "Անվավեր ապրանք։",
"add_unavailable": "Ապրանքը հասանելի չէ։",
"add_market_unavailable": "Այս ապրանքը հասանելի չէ ձեր ընտրած երկիր առաքման համար։",
"add_failed": "Չհաջողվեց ավելացնել ապրանքը։ Խնդրում ենք կրկին փորձել։"
```

`messages/ru.json` `"cart"`:

```json
"added": "Добавлено в корзину",
"add_invalid": "Недопустимый товар.",
"add_unavailable": "Товар недоступен.",
"add_market_unavailable": "Этот товар недоступен для доставки в выбранную страну.",
"add_failed": "Не удалось добавить товар. Пожалуйста, попробуйте ещё раз."
```

- [ ] **Step 2: Convert the action**

In `app/cart/actions.ts`, add imports:

```ts
import { getTranslations } from 'next-intl/server';
import { type ActionState, actionError, actionSuccess } from '@/lib/action-state';
```

Replace `addCatalogItemToCartAction` with:

```ts
export async function addCatalogItemToCartAction(
  _prevState: ActionState<null>,
  formData: FormData,
): Promise<ActionState<null>> {
  const t = await getTranslations();
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse({
    itemId: formData.get('itemId'),
  });

  if (!parsed.success) return actionError(t('cart.add_invalid'));

  try {
    const { supabase, owner, cartSupabase } = await getCartActor();
    const { data: item, error } = await supabase
      .from('catalog_items')
      .select('id, title, price_cents, currency, status')
      .eq('id', parsed.data.itemId)
      .maybeSingle<{
        id: string;
        title: string;
        price_cents: number;
        currency: string;
        status: string;
      }>();

    if (error || !item || item.status !== 'published') {
      return actionError(t('cart.add_unavailable'));
    }

    const market = await resolveMarket({ supabase: getServiceSupabase() });
    if (market.countryCode) {
      const marketResolution = await resolveCatalogMarket(item.id, market, getServiceSupabase());
      if (!marketResolution.availability.available) {
        return actionError(t('cart.add_market_unavailable'));
      }
    }

    const sourceCurrency = normalizeCurrency(item.currency) ?? 'AMD';
    const activeCurrency = await getActiveCurrency();
    const converted = await convertMoney(
      item.price_cents,
      sourceCurrency,
      activeCurrency,
      getServiceSupabase(),
    );

    const input = {
      catalogItemId: item.id,
      title: item.title,
      unitPriceCents: converted.amountCents,
      currency: converted.currency,
      configuration: {
        sourcePriceCents: item.price_cents,
        sourceCurrency,
        exchangeRateContext: converted.exchangeRateContext,
      },
    };

    if (owner) {
      await addItemToCart(cartSupabase, owner, input);
    }

    revalidatePath('/cart');
    revalidatePath('/catalog');
    revalidatePath(`/items/${item.id}`);
    return actionSuccess(null, t('cart.added'));
  } catch {
    return actionError(t('cart.add_failed'));
  }
}
```

(The queries, market check, and currency conversion are today's logic verbatim; only throws→returns and the try/catch wrapper are new. Do not touch the other actions in this file.)

- [ ] **Step 3: Create the button component**

Create `components/add-to-cart-button.tsx`:

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { addCatalogItemToCartAction } from '@/app/cart/actions';
import { Button } from '@/components/ui/button';
import { idleState } from '@/lib/action-state';

/**
 * Add-to-cart form with feedback tied to the server action's result: pending
 * spinner while submitting, sonner toast on success or failure. Messages are
 * localized server-side and arrive in the action state.
 */
export function AddToCartButton({
  itemId,
  ariaLabel,
  buttonText,
  size = 'sm',
  variant = 'outline',
  className,
}: {
  itemId: string;
  ariaLabel: string;
  buttonText?: string;
  size?: 'sm' | 'lg';
  variant?: 'outline' | 'default';
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(addCatalogItemToCartAction, idleState);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message);
    } else if (state.status === 'error') {
      toast.error(state.error);
    }
  }, [state]);

  const icon = pending ? (
    <Loader2 className={buttonText ? 'mr-2 h-4 w-4 animate-spin' : 'h-4 w-4 animate-spin'} />
  ) : (
    <ShoppingCart className={buttonText ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />
  );

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="itemId" value={itemId} />
      <Button
        type="submit"
        size={size}
        variant={variant}
        className={className}
        disabled={pending}
        aria-label={ariaLabel}
      >
        {icon}
        {buttonText}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Swap the catalog card call site**

In `components/catalog-item-card.tsx`: remove the `addCatalogItemToCartAction`, `ShoppingCart`, and `Button` imports if now unused, add `import { AddToCartButton } from '@/components/add-to-cart-button';`, and replace the whole inline form block

```tsx
            <form action={addCatalogItemToCartAction} className="shrink-0">
              <input type="hidden" name="itemId" value={item.id} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="shadow-sm"
                aria-label={`Add ${item.title} to cart`}
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </form>
```

with:

```tsx
            <AddToCartButton
              itemId={item.id}
              ariaLabel={`Add ${item.title} to cart`}
              className="shadow-sm"
            />
```

- [ ] **Step 5: Swap the product page call site**

In `app/items/[slug]/page.tsx`: add `import { AddToCartButton } from '@/components/add-to-cart-button';`, drop the now-unused `addCatalogItemToCartAction` import, and replace

```tsx
              <form action={addCatalogItemToCartAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <Button size="lg" type="submit">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {t('product.add_to_cart')}
                </Button>
              </form>
```

with:

```tsx
              <AddToCartButton
                itemId={item.id}
                ariaLabel={t('product.add_to_cart')}
                buttonText={t('product.add_to_cart')}
                size="lg"
                variant="default"
              />
```

(`ShoppingCart` and `Button` remain used elsewhere on this page — keep those imports.)

- [ ] **Step 6: Verify**

Run: `pnpm test` (full suite green), `pnpm typecheck` (pre-existing error only), `pnpm lint`, `pnpm biome format --write app/cart/actions.ts components/add-to-cart-button.tsx components/catalog-item-card.tsx "app/items/[slug]/page.tsx" messages/en.json messages/am.json messages/ru.json`.

- [ ] **Step 7: Update the knowledge graph and commit**

Run: `graphify update .` (skip with a report note if unavailable).

```bash
git add app/cart/actions.ts components/add-to-cart-button.tsx components/catalog-item-card.tsx "app/items/[slug]/page.tsx" messages/en.json messages/am.json messages/ru.json
# Only the tracked root graph artifacts — never the dated graphify-out/20*/ snapshot dirs
git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json graphify-out/graph.html graphify-out/.graphify_labels.json
git commit -m "feat: add-to-cart feedback with localized toasts

Converts addCatalogItemToCartAction to the ActionState contract and adds
a shared AddToCartButton with pending state and sonner toasts, so silent
failures (including transient 503s) surface to the user.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual follow-ups (not engineer tasks)

- Browser QA per the spec: success toast, error toast, duplicate-add merges to quantity 2, badge moves after quantity update.
- AM/RU strings — user proofread (flagged like the receipt emails).
