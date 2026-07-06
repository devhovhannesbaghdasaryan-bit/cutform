import { resolveCatalogMarket, resolveMarket } from '@/lib/market';
import type { Json, Tables, TypedSupabaseClient } from '@/lib/supabase/types';

export interface CartItemInput {
  catalogItemId?: string;
  generatedItemId?: string;
  bannerSampleId?: string;
  title: string;
  quantity?: number;
  unitPriceCents: number;
  currency?: string;
  configuration?: Record<string, unknown>;
}

export type CartItem = Pick<
  Tables<'cart_items'>,
  | 'id'
  | 'cart_id'
  | 'catalog_item_id'
  | 'generated_item_id'
  | 'banner_sample_id'
  | 'title'
  | 'quantity'
  | 'unit_price_cents'
  | 'currency'
> & {
  configuration: Record<string, Json | undefined>;
};

/** A cart item without identity columns — the shape copied between carts. */
export type CartItemSnapshot = Omit<CartItem, 'id' | 'cart_id'>;

export interface CartValidationIssue {
  cartItemId: string;
  code:
    | 'price_changed'
    | 'item_unavailable'
    | 'generated_item_not_orderable'
    | 'missing_production_asset'
    | 'currency_disabled'
    | 'market_unavailable'
    | 'shipping_unavailable';
  message: string;
}

function getNumericConfigurationValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getStringConfigurationValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export type CartOwner = { userId: string } | { sessionId: string };

/**
 * Error-tolerant item count for the owner's active cart, for display surfaces
 * such as headers. Never creates a cart; returns 0 when no active cart exists
 * or the query fails.
 */
export async function getActiveCartItemCount(supabase: TypedSupabaseClient, owner: CartOwner) {
  const query = supabase.from('carts').select('id, cart_items(id)');
  const { data } = await ('userId' in owner
    ? query.eq('user_id', owner.userId)
    : query.eq('session_id', owner.sessionId)
  )
    .eq('status', 'active')
    .maybeSingle();
  return data?.cart_items?.length ?? 0;
}

export async function getOrCreateCart(supabase: TypedSupabaseClient, owner: CartOwner) {
  const activeCartQuery = supabase.from('carts').select('id, currency');
  const { data: existing, error: existingError } = await ('userId' in owner
    ? activeCartQuery.eq('user_id', owner.userId)
    : activeCartQuery.eq('session_id', owner.sessionId)
  )
    .eq('status', 'active')
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('carts')
    .insert(
      'userId' in owner
        ? { user_id: owner.userId, status: 'active' }
        : { session_id: owner.sessionId, status: 'active' },
    )
    .select('id, currency')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Unable to create cart.');
  return data;
}

export async function listCartItems(supabase: TypedSupabaseClient, owner: CartOwner) {
  const cart = await getOrCreateCart(supabase, owner);
  const { data, error } = await supabase
    .from('cart_items')
    .select(
      'id, cart_id, catalog_item_id, generated_item_id, banner_sample_id, title, quantity, unit_price_cents, currency, configuration',
    )
    .eq('cart_id', cart.id)
    .order('created_at', { ascending: true })
    .returns<CartItem[]>();

  if (error) throw new Error(error.message);
  return { cart, items: data ?? [] };
}

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

export async function updateCartItemQuantity(
  supabase: TypedSupabaseClient,
  owner: CartOwner,
  cartItemId: string,
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be a positive integer.');
  }

  const cart = await getOrCreateCart(supabase, owner);
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', cartItemId)
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);
}

export async function removeCartItem(
  supabase: TypedSupabaseClient,
  owner: CartOwner,
  cartItemId: string,
) {
  const cart = await getOrCreateCart(supabase, owner);
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);
}

export async function clearCart(supabase: TypedSupabaseClient, owner: CartOwner) {
  const cart = await getOrCreateCart(supabase, owner);
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cart.id);
  if (error) throw new Error(error.message);
}

export interface CartMergePlan {
  /** Session items to append to the user cart as new rows. */
  inserts: CartItemSnapshot[];
  /** User cart items whose quantity should change. Always empty under current semantics. */
  quantityUpdates: { cartItemId: string; quantity: number }[];
  /** User cart item ids to delete. Always empty under current semantics. */
  deletes: string[];
}

/**
 * Pure merge-decision logic for merging a guest (session) cart into a user
 * cart. Semantics are preserved exactly from the pre-refactor implementation:
 * every session item is appended to the user cart as a new row. Existing user
 * items are never coalesced with session items — even when both reference the
 * same source item with an identical configuration — so quantities are carried
 * over as-is (never summed) and `userItems` never affects the plan.
 */
export function planCartMerge(
  sessionItems: CartItemSnapshot[],
  _userItems: CartItem[],
): CartMergePlan {
  return {
    inserts: sessionItems.map((item) => ({
      catalog_item_id: item.catalog_item_id,
      generated_item_id: item.generated_item_id,
      banner_sample_id: item.banner_sample_id,
      title: item.title,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      currency: item.currency,
      configuration: item.configuration,
    })),
    quantityUpdates: [],
    deletes: [],
  };
}

export async function mergeSessionCartIntoUserCart(
  supabase: TypedSupabaseClient,
  sessionId: string,
  userId: string,
) {
  const userCart = await getOrCreateCart(supabase, { userId });
  const { data: sessionCart, error: sessionCartError } = await supabase
    .from('carts')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle();

  if (sessionCartError) throw new Error(sessionCartError.message);
  if (!sessionCart) return userCart;

  const { data: guestItems, error: guestItemsError } = await supabase
    .from('cart_items')
    .select(
      'catalog_item_id, generated_item_id, banner_sample_id, title, quantity, unit_price_cents, currency, configuration',
    )
    .eq('cart_id', sessionCart.id)
    .returns<CartItemSnapshot[]>();

  if (guestItemsError) throw new Error(guestItemsError.message);

  // planCartMerge never inspects existing user items (guest items are always
  // appended), so they are not fetched — matching the pre-refactor queries.
  const plan = planCartMerge(guestItems ?? [], []);

  if (plan.inserts.length) {
    const { error: insertError } = await supabase.from('cart_items').insert(
      plan.inserts.map((item) => ({
        cart_id: userCart.id,
        catalog_item_id: item.catalog_item_id,
        generated_item_id: item.generated_item_id,
        banner_sample_id: item.banner_sample_id,
        title: item.title,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        currency: item.currency,
        configuration: item.configuration,
      })),
    );

    if (insertError) throw new Error(insertError.message);
  }

  for (const update of plan.quantityUpdates) {
    const { error: quantityError } = await supabase
      .from('cart_items')
      .update({ quantity: update.quantity })
      .eq('id', update.cartItemId)
      .eq('cart_id', userCart.id);

    if (quantityError) throw new Error(quantityError.message);
  }

  if (plan.deletes.length) {
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .in('id', plan.deletes)
      .eq('cart_id', userCart.id);

    if (deleteError) throw new Error(deleteError.message);
  }

  const { error: updateError } = await supabase
    .from('carts')
    .update({ status: 'converted' })
    .eq('id', sessionCart.id);

  if (updateError) throw new Error(updateError.message);
  return userCart;
}

export async function validateCartBeforeCheckout(
  supabase: TypedSupabaseClient,
  userId: string,
  destinationCountryCode?: string | null,
) {
  const { items } = await listCartItems(supabase, { userId });
  const issues: CartValidationIssue[] = [];
  const { data: enabledCurrencies, error: currencyError } = await supabase
    .from('currencies')
    .select('code')
    .eq('is_enabled', true);
  if (currencyError) throw new Error(currencyError.message);
  const enabledCurrencyCodes = new Set((enabledCurrencies ?? []).map((currency) => currency.code));
  const market = await resolveMarket({
    checkoutCountryCode: destinationCountryCode,
    supabase,
  });

  for (const item of items) {
    if (!enabledCurrencyCodes.has(item.currency)) {
      issues.push({
        cartItemId: item.id,
        code: 'currency_disabled',
        message: 'This cart item uses a disabled currency. Switch currency or re-add the item.',
      });
    }

    if (item.catalog_item_id) {
      const { data: catalogItem, error } = await supabase
        .from('catalog_items')
        .select('status, price_cents, currency')
        .eq('id', item.catalog_item_id)
        .maybeSingle();

      if (error || !catalogItem || catalogItem.status !== 'published') {
        issues.push({
          cartItemId: item.id,
          code: 'item_unavailable',
          message: 'This item is no longer available.',
        });
      } else if (
        catalogItem.price_cents !==
          (getNumericConfigurationValue(item.configuration, 'sourcePriceCents') ??
            item.unit_price_cents) ||
        catalogItem.currency !==
          (getStringConfigurationValue(item.configuration, 'sourceCurrency') ?? item.currency)
      ) {
        issues.push({
          cartItemId: item.id,
          code: 'price_changed',
          message: 'The item price changed. Please review before checkout.',
        });
      }
      if (catalogItem && market.countryCode) {
        const resolution = await resolveCatalogMarket(item.catalog_item_id, market, supabase);
        if (!resolution.availability.visible) {
          issues.push({
            cartItemId: item.id,
            code: 'market_unavailable',
            message: 'This item is not sold in your destination country.',
          });
        } else if (resolution.shipping.baseAmountCents == null) {
          issues.push({
            cartItemId: item.id,
            code: 'shipping_unavailable',
            message: 'Shipping is not available for this item and destination.',
          });
        }
      }
    }

    if (item.generated_item_id) {
      const { data: generatedItem, error } = await supabase
        .from('generated_items')
        .select('review_status, selected_preview_path, manufacturing_file_path, product_type')
        .eq('id', item.generated_item_id)
        .maybeSingle();

      if (error || !generatedItem || generatedItem.review_status === 'rejected') {
        issues.push({
          cartItemId: item.id,
          code: 'generated_item_not_orderable',
          message: 'This generated item is not orderable.',
        });
      }

      if (
        generatedItem?.product_type === 'personalized_night_light' &&
        !getStringConfigurationValue(item.configuration, 'personalizedPreviewOptionId')
      ) {
        issues.push({
          cartItemId: item.id,
          code: 'missing_production_asset',
          message: 'This personalized item is missing its generated option.',
        });
      } else if (generatedItem?.product_type === 'personalized_night_light') {
        const optionId = getStringConfigurationValue(
          item.configuration,
          'personalizedPreviewOptionId',
        );
        const { data: option, error: optionError } = await supabase
          .from('personalized_preview_options')
          .select('id')
          .eq('id', optionId!)
          .eq('generated_item_id', item.generated_item_id)
          .maybeSingle();
        if (optionError || !option) {
          issues.push({
            cartItemId: item.id,
            code: 'missing_production_asset',
            message: 'This personalized option is no longer available.',
          });
        }
      }
    }
  }

  return issues;
}
