import { NextResponse } from 'next/server';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { getServerEnv } from '@/lib/env';
import { settlePolarPayment } from '@/lib/payments/fulfillment';
import { getServiceSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Polar posts signed webhook events here. The signature — not the body content —
// is the trust boundary; order.paid is authoritative for fulfillment.
export async function POST(req: Request) {
  const secret = getServerEnv().POLAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[polar-webhook] POLAR_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const body = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(body, headers, secret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
    }
    throw error;
  }

  // Fulfill only on a confirmed paid order. `data` is the Polar `Order` object:
  // it carries the metadata we set on the checkout plus the amount actually
  // paid (`totalAmount`, in cents, after discounts/taxes) and its currency.
  if (event.type === 'order.paid') {
    const order = event.data;
    const transactionId =
      typeof order.metadata?.transactionId === 'string' ? order.metadata.transactionId : null;
    if (!transactionId) {
      console.error('[polar-webhook] order.paid without transactionId metadata', order.id);
      return NextResponse.json({ received: true });
    }
    try {
      await settlePolarPayment(getServiceSupabase(), {
        transactionId,
        paidAmountCents: order.totalAmount,
        paidCurrency: order.currency,
        paid: true,
        providerReference: order.id,
      });
    } catch (error) {
      // 5xx makes Polar retry the delivery.
      console.error('[polar-webhook] settle failed', transactionId, error);
      return NextResponse.json({ error: 'settle failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
