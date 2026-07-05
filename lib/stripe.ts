import 'server-only';

import Stripe from 'stripe';
import { getServerEnv } from '@/lib/env';
import type { TypedSupabaseClient } from '@/lib/supabase/types';

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!stripeClient) {
    const secretKey = getServerEnv().STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY is required for Stripe checkout.');
    stripeClient = new Stripe(secretKey, { typescript: true });
  }
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = getServerEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is required for Stripe webhooks.');
  return secret;
}

export interface CheckoutSessionForTransactionInput {
  transactionId: string;
  customerEmail?: string;
  currency: string;
  amountCents: number;
  productName: string;
  productDescription?: string;
  metadata: Stripe.MetadataParam;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a single-line-item Stripe Checkout session for a pending transaction
 * and stores the session id as the transaction's provider reference.
 * The webhook (app/api/webhooks/stripe/route.ts) relies on the metadata keys
 * passed here, so callers own the exact metadata contract.
 * Returns the hosted checkout URL.
 */
export async function createCheckoutSessionForTransaction(
  service: TypedSupabaseClient,
  input: CheckoutSessionForTransactionInput,
) {
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: input.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountCents,
          product_data: {
            name: input.productName,
            ...(input.productDescription !== undefined && { description: input.productDescription }),
          },
        },
      },
    ],
    metadata: input.metadata,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  await service
    .from('transactions')
    .update({ provider_reference: session.id })
    .eq('id', input.transactionId);

  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  return session.url;
}
