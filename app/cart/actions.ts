'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  addItemToCart,
  type CartOwner,
  clearCart,
  removeCartItem,
  updateCartItemQuantity,
} from '@/lib/cart';
import { getCartSessionId } from '@/lib/cart-session';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { resolveCatalogMarket, resolveMarket } from '@/lib/market';

async function getCartActor() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

  if (user) {
    const owner: CartOwner = { userId: user.id };
    return { supabase, owner, cartSupabase: supabase };
  }
  const sessionId = await getCartSessionId({ create: true });
  const owner: CartOwner | null = sessionId ? { sessionId } : null;
  return { supabase, owner, cartSupabase: getServiceSupabase() };
}

export async function addCatalogItemToCartAction(formData: FormData) {
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse({
    itemId: formData.get('itemId'),
  });

  if (!parsed.success) throw new Error('Invalid item.');

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

  if (owner) {
    await addItemToCart(cartSupabase, owner, input);
  }

  revalidatePath('/cart');
  revalidatePath('/catalog');
  revalidatePath(`/items/${item.id}`);
}

export async function updateCartQuantityAction(formData: FormData) {
  const parsed = z
    .object({
      cartItemId: z.string().uuid(),
      quantity: z.coerce.number().int().positive(),
    })
    .safeParse({
      cartItemId: formData.get('cartItemId'),
      quantity: formData.get('quantity'),
    });

  if (!parsed.success) throw new Error('Invalid cart quantity.');

  const { owner, cartSupabase } = await getCartActor();
  if (owner) {
    await updateCartItemQuantity(cartSupabase, owner, parsed.data.cartItemId, parsed.data.quantity);
  }
  revalidatePath('/cart');
}

export async function removeCartItemAction(formData: FormData) {
  const parsed = z.object({ cartItemId: z.string().uuid() }).safeParse({
    cartItemId: formData.get('cartItemId'),
  });

  if (!parsed.success) throw new Error('Invalid cart item.');

  const { owner, cartSupabase } = await getCartActor();
  if (owner) {
    await removeCartItem(cartSupabase, owner, parsed.data.cartItemId);
  }
  revalidatePath('/cart');
}

export async function clearCartAction() {
  const { owner, cartSupabase } = await getCartActor();
  if (owner) {
    await clearCart(cartSupabase, owner);
  }
  revalidatePath('/cart');
}
