import 'server-only';

import { Polar } from '@polar-sh/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import type { InitiatePaymentInput, InitiatePaymentResult } from '@/lib/payments/types';

export { isPolarEnabled } from '@/lib/payments/flags';

export function getPolarClient(): Polar {
  const env = getServerEnv();
  if (!env.POLAR_ACCESS_TOKEN) {
    throw new Error('POLAR_ACCESS_TOKEN is required for Polar payments.');
  }
  return new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER === 'production' ? 'production' : 'sandbox',
  });
}

// Each currency has its own Polar product (priced in that currency, pay-what-you-want)
// so we can charge the buyer's original currency with a dynamic amount.
export function getPolarProductId(currency: string): string {
  const env = getServerEnv();
  const map: Record<string, string | undefined> = {
    AMD: env.POLAR_PRODUCT_ID_AMD,
    EUR: env.POLAR_PRODUCT_ID_EUR,
    USD: env.POLAR_PRODUCT_ID_USD,
  };
  const productId = map[currency.toUpperCase()];
  if (!productId) {
    throw new Error(`No Polar product configured for currency ${currency}.`);
  }
  return productId;
}

export async function initiatePolarCheckout(
  service: SupabaseClient,
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  const env = getServerEnv();
  const polar = getPolarClient();
  const successUrl = `${env.NEXT_PUBLIC_SITE_URL}/api/payments/polar/return?checkout_id={CHECKOUT_ID}`;

  // Dynamic amount: `amount` on `CheckoutCreate` sets the checkout total in
  // cents for a pay-what-you-want-priced product (confirmed against the
  // installed @polar-sh/sdk 0.48.1 types — see lib/payments/polar.ts report).
  // Metadata propagates from the checkout to the resulting order.
  const checkout = await polar.checkouts.create({
    products: [getPolarProductId(input.currency)],
    amount: input.amountCents,
    metadata: { transactionId: input.transactionId },
    successUrl,
  });

  const { error } = await service
    .from('transactions')
    .update({ provider_reference: checkout.id })
    .eq('id', input.transactionId);
  if (error) throw new Error(error.message);

  return { redirectUrl: checkout.url, providerReference: checkout.id };
}

export async function fetchPolarCheckout(checkoutId: string) {
  const polar = getPolarClient();
  return polar.checkouts.get({ id: checkoutId });
}
