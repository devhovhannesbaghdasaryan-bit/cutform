import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { settleAmeriaPayment } from '@/lib/payments/fulfillment';
import { getServiceSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ameriabank vPOS redirects the customer's browser here after the hosted
// payment page. Query params carry no authority: the outcome is decided by a
// server-side GetPaymentDetails call inside settleAmeriaPayment.
export async function GET(req: Request) {
  const paymentId = new URL(req.url).searchParams.get('paymentID');
  try {
    const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
    if (!paymentId) {
      return NextResponse.redirect(new URL('/?checkout=invalid', siteUrl));
    }
    const result = await settleAmeriaPayment(getServiceSupabase(), paymentId);
    return NextResponse.redirect(new URL(result.redirectPath, siteUrl));
  } catch (error) {
    console.error('[ameria-callback]', paymentId, error);
    return NextResponse.redirect(new URL('/?checkout=error', req.url));
  }
}
