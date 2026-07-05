import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/supabase/types';
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe';
import { adjustCredits } from '@/lib/credits';

export const runtime = 'nodejs';

// Metadata contract written by createCreditPackCheckoutAction
// (app/credits/actions.ts); creditAmount arrives as a string.
const creditPackMetadataSchema = z.object({
  purchaseType: z.literal('credit_pack'),
  transactionId: z.string().min(1),
  userId: z.string().min(1),
  creditAmount: z.coerce.number().int().positive(),
  packKey: z.string().optional(),
});

// Metadata contract written by createCheckoutOrderAction
// (app/checkout/actions.ts); userId is written but not consumed here.
const orderMetadataSchema = z.object({
  purchaseType: z.literal('order'),
  transactionId: z.string().min(1),
  orderId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

async function markTransactionStatus(
  transactionId: string | undefined,
  status: 'succeeded' | 'failed' | 'cancelled',
  providerReference?: string | null,
) {
  if (!transactionId) return;
  const update: TablesUpdate<'transactions'> = { status };
  if (providerReference) update.provider_reference = providerReference;
  await getServiceSupabase().from('transactions').update(update).eq('id', transactionId);
}

async function fulfillCreditPack(session: Stripe.Checkout.Session) {
  const parsed = creditPackMetadataSchema.safeParse(session.metadata ?? {});
  if (!parsed.success) {
    throw new Error('Credit checkout session is missing fulfillment metadata.');
  }
  const { transactionId, userId, creditAmount, packKey } = parsed.data;

  const service = getServiceSupabase();
  const { data: transaction, error } = await service
    .from('transactions')
    .select('id, status')
    .eq('id', transactionId)
    .maybeSingle<{ id: string; status: string }>();
  if (error) throw new Error(error.message);
  if (transaction?.status === 'succeeded') return;

  const ledger = await adjustCredits(service, {
    userId,
    delta: creditAmount,
    reason: 'purchase',
    referenceType: 'stripe_checkout_session',
    referenceId: session.id,
    metadata: {
      transactionId,
      packKey: packKey ?? null,
      stripeCheckoutSessionId: session.id,
    },
  });

  await service
    .from('transactions')
    .update({
      status: 'succeeded',
      provider_reference: session.id,
      credit_ledger_id: ledger.ledgerId,
    })
    .eq('id', transactionId);
}

async function fulfillOrderPayment(session: Stripe.Checkout.Session) {
  const parsed = orderMetadataSchema.safeParse(session.metadata ?? {});
  if (!parsed.success) throw new Error('Order checkout session is missing fulfillment metadata.');
  const { transactionId, orderId } = parsed.data;

  const service = getServiceSupabase();
  const { data: transaction, error } = await service
    .from('transactions')
    .select('id, status')
    .eq('id', transactionId)
    .maybeSingle<{ id: string; status: string }>();
  if (error) throw new Error(error.message);
  if (transaction?.status === 'succeeded') return;

  await service
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'review_required',
      transaction_id: transactionId,
    })
    .eq('id', orderId);

  await service
    .from('transactions')
    .update({ status: 'succeeded', provider_reference: session.id })
    .eq('id', transactionId);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return;
  if (session.metadata?.purchaseType === 'credit_pack') {
    await fulfillCreditPack(session);
    return;
  }
  if (session.metadata?.purchaseType === 'order') {
    await fulfillOrderPayment(session);
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid Stripe signature.' },
      { status: 400 },
    );
  }

  // Narrowing on event.type types event.data.object as Stripe.Checkout.Session.
  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object);
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    await markTransactionStatus(session.metadata?.transactionId, 'cancelled', session.id);
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object;
    await markTransactionStatus(session.metadata?.transactionId, 'failed', session.id);
  }

  return NextResponse.json({ received: true });
}
