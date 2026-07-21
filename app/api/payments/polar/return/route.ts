import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { settlePolarPayment } from '@/lib/payments/fulfillment';
import { fetchPolarCheckout } from '@/lib/payments/polar';
import { getServiceSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Polar redirects the buyer's browser here after checkout. Query params carry no
// authority: we re-fetch the checkout from Polar (server truth) and settle. This
// closes the gap before the async webhook lands; both call the same idempotent settle.
export async function GET(req: Request) {
  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const checkoutId = new URL(req.url).searchParams.get('checkout_id');
  if (!checkoutId) {
    return NextResponse.redirect(new URL('/?checkout=invalid', siteUrl));
  }

  try {
    const checkout = await fetchPolarCheckout(checkoutId);
    const transactionId =
      typeof checkout.metadata?.transactionId === 'string' ? checkout.metadata.transactionId : null;
    if (!transactionId) {
      return NextResponse.redirect(new URL('/?checkout=invalid', siteUrl));
    }

    // `checkout.amount` is in cents, before discounts and taxes — the same
    // pre-tax figure `settlePolarPayment` exact-matches against
    // `transaction.amount_cents`. (Unlike the webhook, which reads an `Order`
    // and must use `order.netAmount` — there is no `Order.amount` field.)
    // A checkout is paid once it reaches 'confirmed' (payment captured) or
    // 'succeeded' (fully processed); anything else is not-yet-paid.
    const paid = checkout.status === 'confirmed' || checkout.status === 'succeeded';
    const result = await settlePolarPayment(getServiceSupabase(), {
      transactionId,
      paidAmountCents: checkout.amount,
      paidCurrency: checkout.currency,
      paid,
      providerReference: checkoutId,
    });
    return NextResponse.redirect(new URL(result.redirectPath, siteUrl));
  } catch (error) {
    console.error('[polar-return]', checkoutId, error);
    return NextResponse.redirect(new URL('/?checkout=error', siteUrl));
  }
}
