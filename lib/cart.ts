import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCatalogMarket, resolveMarket } from '@/lib/market';

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

export interface CartItem {
  id: string;
  cart_id: string;
  catalog_item_id: string | null;
  generated_item_id: string | null;
  banner_sample_id: string | null;
  title: string;
  quantity: number;
  unit_price_cents: number;
  currency: string;
  configuration: Record<string, unknown>;
}

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
export async function getActiveCartItemCount(supabase: SupabaseClient, owner: CartOwner) {
  const query = supabase.from('carts').select('id, cart_items(id)');
  const { data } = await ('userId' in owner
    ? query.eq('user_id', owner.userId)
    : query.eq('session_id', owner.sessionId))
    .eq('status', 'active')
    .maybeSingle<{ id: string; cart_items: { id: string }[] }>();
  return data?.cart_items?.length ?? 0;
}

export async function getOrCreateUserCart(supabase: SupabaseClient, userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('carts')
    .select('id, currency')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle<{ id: string; currency: string }>();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('carts')
    .insert({ user_id: userId, status: 'active' })
    .select('id, currency')
    .single<{ id: string; currency: string }>();

  if (error || !data) throw new Error(error?.message ?? 'Unable to create cart.');
  return data;
}

export async function getOrCreateSessionCart(supabase: SupabaseClient, sessionId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('carts')
    .select('id, currency')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle<{ id: string; currency: string }>();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('carts')
    .insert({ session_id: sessionId, status: 'active' })
    .select('id, currency')
    .single<{ id: string; currency: string }>();

  if (error || !data) throw new Error(error?.message ?? 'Unable to create session cart.');
  return data;
}

export async function listUserCartItems(supabase: SupabaseClient, userId: string) {
  const cart = await getOrCreateUserCart(supabase, userId);
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

export async function listSessionCartItems(supabase: SupabaseClient, sessionId: string) {
  const cart = await getOrCreateSessionCart(supabase, sessionId);
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

export async function addItemToUserCart(
  supabase: SupabaseClient,
  userId: string,
  input: CartItemInput,
) {
  const selectedSources = [
    input.catalogItemId,
    input.generatedItemId,
    input.bannerSampleId,
  ].filter(Boolean);

  if (selectedSources.length !== 1) {
    throw new Error('Cart item must reference exactly one source.');
  }

  const cart = await getOrCreateUserCart(supabase, userId);
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
      configuration: input.configuration ?? {},
    })
    .select('id')
    .single<{ id: string }>();

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

export async function addItemToSessionCart(
  supabase: SupabaseClient,
  sessionId: string,
  input: CartItemInput,
) {
  const selectedSources = [
    input.catalogItemId,
    input.generatedItemId,
    input.bannerSampleId,
  ].filter(Boolean);

  if (selectedSources.length !== 1) {
    throw new Error('Cart item must reference exactly one source.');
  }

  const cart = await getOrCreateSessionCart(supabase, sessionId);
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
      configuration: input.configuration ?? {},
    })
    .select('id')
    .single<{ id: string }>();

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
  supabase: SupabaseClient,
  userId: string,
  cartItemId: string,
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be a positive integer.');
  }

  const cart = await getOrCreateUserCart(supabase, userId);
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', cartItemId)
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);
}

export async function removeCartItem(
  supabase: SupabaseClient,
  userId: string,
  cartItemId: string,
) {
  const cart = await getOrCreateUserCart(supabase, userId);
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);
}

export async function clearUserCart(supabase: SupabaseClient, userId: string) {
  const cart = await getOrCreateUserCart(supabase, userId);
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cart.id);
  if (error) throw new Error(error.message);
}

export async function updateSessionCartItemQuantity(
  supabase: SupabaseClient,
  sessionId: string,
  cartItemId: string,
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be a positive integer.');
  }

  const cart = await getOrCreateSessionCart(supabase, sessionId);
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', cartItemId)
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);
}

export async function removeSessionCartItem(
  supabase: SupabaseClient,
  sessionId: string,
  cartItemId: string,
) {
  const cart = await getOrCreateSessionCart(supabase, sessionId);
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);
}

export async function clearSessionCart(supabase: SupabaseClient, sessionId: string) {
  const cart = await getOrCreateSessionCart(supabase, sessionId);
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cart.id);
  if (error) throw new Error(error.message);
}

export async function mergeSessionCartIntoUserCart(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
) {
  const userCart = await getOrCreateUserCart(supabase, userId);
  const { data: sessionCart, error: sessionCartError } = await supabase
    .from('carts')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle<{ id: string }>();

  if (sessionCartError) throw new Error(sessionCartError.message);
  if (!sessionCart) return userCart;

  const { data: guestItems, error: guestItemsError } = await supabase
    .from('cart_items')
    .select(
      'catalog_item_id, generated_item_id, banner_sample_id, title, quantity, unit_price_cents, currency, configuration',
    )
    .eq('cart_id', sessionCart.id)
    .returns<Omit<CartItem, 'id' | 'cart_id'>[]>();

  if (guestItemsError) throw new Error(guestItemsError.message);

  if (guestItems?.length) {
    const { error: insertError } = await supabase.from('cart_items').insert(
      guestItems.map((item) => ({
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

  const { error: updateError } = await supabase
    .from('carts')
    .update({ status: 'converted' })
    .eq('id', sessionCart.id);

  if (updateError) throw new Error(updateError.message);
  return userCart;
}

export async function validateCartBeforeCheckout(
  supabase: SupabaseClient,
  userId: string,
  destinationCountryCode?: string | null,
) {
  const { items } = await listUserCartItems(supabase, userId);
  const issues: CartValidationIssue[] = [];
  const { data: enabledCurrencies, error: currencyError } = await supabase
    .from('currencies')
    .select('code')
    .eq('is_enabled', true)
    .returns<{ code: string }[]>();
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
        .maybeSingle<{ status: string; price_cents: number; currency: string }>();

      if (error || !catalogItem || catalogItem.status !== 'published') {
        issues.push({
          cartItemId: item.id,
          code: 'item_unavailable',
          message: 'This item is no longer available.',
        });
      } else if (
        catalogItem.price_cents !== (getNumericConfigurationValue(item.configuration, 'sourcePriceCents') ?? item.unit_price_cents)
        || catalogItem.currency !== (getStringConfigurationValue(item.configuration, 'sourceCurrency') ?? item.currency)
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
        .select('review_status, selected_preview_path, hidden_svg_path, product_type')
        .eq('id', item.generated_item_id)
        .maybeSingle<{
          review_status: string;
          selected_preview_path: string | null;
          hidden_svg_path: string | null;
          product_type: string;
        }>();

      if (error || !generatedItem || generatedItem.review_status === 'rejected') {
        issues.push({
          cartItemId: item.id,
          code: 'generated_item_not_orderable',
          message: 'This generated item is not orderable.',
        });
      }

      if (
        generatedItem?.product_type === 'personalized_night_light'
        && !getStringConfigurationValue(item.configuration, 'personalizedPreviewOptionId')
      ) {
        issues.push({
          cartItemId: item.id,
          code: 'missing_production_asset',
          message: 'This personalized item is missing its generated option.',
        });
      } else if (generatedItem?.product_type === 'personalized_night_light') {
        const optionId = getStringConfigurationValue(item.configuration, 'personalizedPreviewOptionId');
        const { data: option, error: optionError } = await supabase
          .from('personalized_preview_options')
          .select('id')
          .eq('id', optionId!)
          .eq('generated_item_id', item.generated_item_id)
          .maybeSingle<{ id: string }>();
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
