import 'server-only';

import Stripe from 'stripe';
import { getServerEnv } from '@/lib/env';

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
