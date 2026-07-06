import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppCurrency } from '@/lib/currency';
import type { PaymentRoute } from '@/lib/payments/types';
import { normalizeCountryCode } from '@/lib/market';
import { getServiceSupabase } from '@/lib/supabase/server';

// DB-driven routing: the admin currencies page controls which provider each
// currency uses. Unknown or legacy values fall back to the manual route.
export async function getPaymentRoute(
  currency: AppCurrency,
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<PaymentRoute> {
  const { data, error } = await supabase
    .from('currencies')
    .select('payment_route')
    .eq('code', currency)
    .maybeSingle<{ payment_route: string }>();
  if (error) throw new Error(error.message);
  return data?.payment_route === 'ameria' ? 'ameria' : 'bank_manual';
}

// Country-based routing: Armenia settles via Ameriabank; every other billing
// country goes to Polar (Merchant of Record). Unknown/blank -> polar.
export function resolvePaymentRoute(
  billingCountryCode: string | null | undefined,
): 'ameria' | 'polar' {
  return normalizeCountryCode(billingCountryCode) === 'AM' ? 'ameria' : 'polar';
}
