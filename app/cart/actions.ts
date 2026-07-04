'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  addItemToSessionCart,
  addItemToUserCart,
  clearSessionCart,
  clearUserCart,
  removeSessionCartItem,
  removeCartItem,
  updateSessionCartItemQuantity,
  updateCartItemQuantity,
} from '@/lib/cart';
import { getCartSessionId } from '@/lib/cart-session';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { resolveCatalogMarket, resolveMarket } from '@/lib/market';

async function getCartActor() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return { supabase, user, sessionId: null, cartSupabase: supabase };
  const sessionId = await getCartSessionId({ create: true });
  return { supabase, user: null, sessionId, cartSupabase: getServiceSupabase() };
}

export async function addCatalogItemToCartAction(formData: FormData) {
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse({
    itemId: formData.get('itemId'),
  });

  if (!parsed.success) throw new Error('Invalid item.');

  const { supabase, user, sessionId, cartSupabase } = await getCartActor();
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
    throw new Error(error?.message ?? 'Item is not available.');
  }

  const market = await resolveMarket({ supabase: getServiceSupabase() });
  if (market.countryCode) {
    const marketResolution = await resolveCatalogMarket(item.id, market, getServiceSupabase());
    if (!marketResolution.availability.available) {
      throw new Error('This item is not available for shipping to your selected country.');
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

  if (user) {
    await addItemToUserCart(cartSupabase, user.id, input);
  } else if (sessionId) {
    await addItemToSessionCart(cartSupabase, sessionId, input);
  }

  revalidatePath('/cart');
  revalidatePath('/catalog');
  revalidatePath(`/items/${item.id}`);
}

export async function updateCartQuantityAction(formData: FormData) {
  const parsed = z.object({
    cartItemId: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
  }).safeParse({
    cartItemId: formData.get('cartItemId'),
    quantity: formData.get('quantity'),
  });

  if (!parsed.success) throw new Error('Invalid cart quantity.');

  const { user, sessionId, cartSupabase } = await getCartActor();
  if (user) {
    await updateCartItemQuantity(cartSupabase, user.id, parsed.data.cartItemId, parsed.data.quantity);
  } else if (sessionId) {
    await updateSessionCartItemQuantity(cartSupabase, sessionId, parsed.data.cartItemId, parsed.data.quantity);
  }
  revalidatePath('/cart');
}

export async function removeCartItemAction(formData: FormData) {
  const parsed = z.object({ cartItemId: z.string().uuid() }).safeParse({
    cartItemId: formData.get('cartItemId'),
  });

  if (!parsed.success) throw new Error('Invalid cart item.');

  const { user, sessionId, cartSupabase } = await getCartActor();
  if (user) {
    await removeCartItem(cartSupabase, user.id, parsed.data.cartItemId);
  } else if (sessionId) {
    await removeSessionCartItem(cartSupabase, sessionId, parsed.data.cartItemId);
  }
  revalidatePath('/cart');
}

export async function clearCartAction() {
  const { user, sessionId, cartSupabase } = await getCartActor();
  if (user) {
    await clearUserCart(cartSupabase, user.id);
  } else if (sessionId) {
    await clearSessionCart(cartSupabase, sessionId);
  }
  revalidatePath('/cart');
}
