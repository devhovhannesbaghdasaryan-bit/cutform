'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { updateActiveCartCurrency } from '@/app/currency/actions';
import { getCartSessionId } from '@/lib/cart-session';
import { CURRENCY_COOKIE, LEGACY_CURRENCY_COOKIE, listEnabledCurrencies, normalizeCurrency } from '@/lib/currency';
import { COUNTRY_COOKIE, normalizeCountryCode, resolveMarket } from '@/lib/market';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

const countrySchema = z.object({
  country: z.string().trim().length(2),
  next: z.string().optional(),
});

export async function setCountryPreferenceAction(formData: FormData) {
  const parsed = countrySchema.safeParse({
    country: formData.get('country'),
    next: formData.get('next') || undefined,
  });
  if (!parsed.success) throw new Error('Choose a valid country.');
  const countryCode = normalizeCountryCode(parsed.data.country);
  if (!countryCode) throw new Error('Choose a valid country.');

  const service = getServiceSupabase();
  const { data: country, error } = await service
    .from('countries')
    .select('code')
    .eq('code', countryCode)
    .eq('is_active', true)
    .maybeSingle<{ code: string }>();
  if (error || !country) throw new Error(error?.message ?? 'That country is not available.');

  const cookieStore = await cookies();
  cookieStore.set(COUNTRY_COOKIE, countryCode, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const sessionId = user ? null : await getCartSessionId({ create: false });
  if (user) {
    const { error: profileError } = await service
      .from('profiles')
      .update({ preferred_country_code: countryCode })
      .eq('user_id', user.id);
    if (profileError) throw new Error(profileError.message);
  }

  let cartQuery = service.from('carts').update({ destination_country_code: countryCode }).eq('status', 'active');
  cartQuery = user ? cartQuery.eq('user_id', user.id) : cartQuery.eq('session_id', sessionId ?? '');
  const { error: cartError } = await cartQuery;
  if (cartError) throw new Error(cartError.message);

  // A geographic default changes the cart only when the user has not made an explicit choice.
  const explicitCookieCurrency = normalizeCurrency(
    cookieStore.get(CURRENCY_COOKIE)?.value ?? cookieStore.get(LEGACY_CURRENCY_COOKIE)?.value,
  );
  const { data: profile } = user
    ? await service.from('profiles').select('preferred_currency').eq('user_id', user.id).maybeSingle<{ preferred_currency: string | null }>()
    : { data: null };
  const explicitProfileCurrency = normalizeCurrency(profile?.preferred_currency);
  if (!explicitCookieCurrency && !explicitProfileCurrency) {
    const market = await resolveMarket({ checkoutCountryCode: countryCode, supabase: service });
    const enabled = await listEnabledCurrencies(service);
    const enabledCodes = new Set(enabled.map((item) => item.code));
    const geographicCurrency = normalizeCurrency(market.countryDefaultCurrency)
      ?? normalizeCurrency(market.regionDefaultCurrency)
      ?? enabled.find((item) => item.is_default)?.code
      ?? 'AMD';
    if (enabledCodes.has(geographicCurrency)) {
      await updateActiveCartCurrency({
        service,
        userId: user?.id,
        sessionId,
        currency: geographicCurrency,
      });
    }
  }

  for (const path of ['/', '/catalog', '/cart', '/checkout']) revalidatePath(path);
  const next = parsed.data.next;
  if (next?.startsWith('/') && !next.startsWith('//')) redirect(next);
}
