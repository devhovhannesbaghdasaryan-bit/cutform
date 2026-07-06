'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCartSessionId } from '@/lib/cart-session';
import { CURRENCY_COOKIE, convertMoney, normalizeCurrency } from '@/lib/currency';
import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';

const currencySchema = z.object({
  currency: z.string().trim().min(3).max(3),
  next: z.string().optional(),
});

export async function updateActiveCartCurrency({
  service,
  userId,
  sessionId,
  currency,
}: {
  service: ReturnType<typeof getServiceSupabase>;
  userId?: string;
  sessionId?: string | null;
  currency: NonNullable<ReturnType<typeof normalizeCurrency>>;
}) {
  let query = service
    .from('carts')
    .select('id')
    .eq('status', 'active')
    .limit(1);

  if (userId) query = query.eq('user_id', userId);
  else if (sessionId) query = query.eq('session_id', sessionId);
  else return;

  const { data: cart, error: cartError } = await query.maybeSingle<{ id: string }>();
  if (cartError) throw new Error(cartError.message);
  if (!cart) return;

  const { data: items, error: itemsError } = await service
    .from('cart_items')
    .select('id, unit_price_cents, currency, configuration')
    .eq('cart_id', cart.id)
    .returns<
      {
        id: string;
        unit_price_cents: number;
        currency: string;
        configuration: Record<string, unknown>;
      }[]
    >();
  if (itemsError) throw new Error(itemsError.message);

  for (const item of items ?? []) {
    const sourcePrice = typeof item.configuration.sourcePriceCents === 'number'
      ? item.configuration.sourcePriceCents
      : item.unit_price_cents;
    const sourceCurrency = normalizeCurrency(item.configuration.sourceCurrency) ?? normalizeCurrency(item.currency) ?? 'AMD';
    const converted = await convertMoney(sourcePrice, sourceCurrency, currency, service);
    const { error } = await service
      .from('cart_items')
      .update({
        unit_price_cents: converted.amountCents,
        currency: converted.currency,
        configuration: {
          ...(item.configuration ?? {}),
          sourcePriceCents: sourcePrice,
          sourceCurrency,
          exchangeRateContext: converted.exchangeRateContext,
        },
      })
      .eq('id', item.id);
    if (error) throw new Error(error.message);
  }

  const { error: cartUpdateError } = await service
    .from('carts')
    .update({ currency })
    .eq('id', cart.id);
  if (cartUpdateError) throw new Error(cartUpdateError.message);
}

export async function setCurrencyPreferenceAction(formData: FormData) {
  const parsed = currencySchema.safeParse({
    currency: formData.get('currency'),
    next: formData.get('next') || undefined,
  });
  if (!parsed.success) throw new Error('Choose a valid currency.');

  const currency = normalizeCurrency(parsed.data.currency);
  if (!currency) throw new Error('Unsupported currency.');

  const service = getServiceSupabase();
  const { data: settings, error: settingsError } = await service
    .from('currencies')
    .select('code')
    .eq('code', currency)
    .eq('is_enabled', true)
    .maybeSingle<{ code: string }>();
  if (settingsError) throw new Error(settingsError.message);
  if (!settings) throw new Error('That currency is not currently enabled.');

  const cookieStore = await cookies();
  cookieStore.set(CURRENCY_COOKIE, currency, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  const user = await getCurrentUser();
  if (user) {
    const { error } = await service
      .from('profiles')
      .update({ preferred_currency: currency })
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
  }

  await updateActiveCartCurrency({
    service,
    userId: user?.id,
    sessionId: user ? null : await getCartSessionId({ create: false }),
    currency,
  });

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/cart');
  revalidatePath('/checkout');
  revalidatePath('/credits');

  const next = parsed.data.next;
  if (next && next.startsWith('/') && !next.startsWith('//')) redirect(next);
}
