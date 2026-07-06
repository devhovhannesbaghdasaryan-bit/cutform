'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createOrderFromCart } from '@/lib/orders';
import { initiateAmeriaPayment } from '@/lib/payments/ameria';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { createTransactionRecord } from '@/lib/transactions';

const checkoutSchema = z.object({
  contactEmail: z.string().email().optional().or(z.literal('')),
  locale: z.enum(['en', 'ru', 'am']).optional().or(z.literal('')),
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40),
  addressLine1: z.string().trim().min(3).max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(100),
  administrativeArea: z.string().trim().max(100).optional().or(z.literal('')),
  postalCode: z.string().trim().max(30).optional().or(z.literal('')),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/),
});

export async function createCheckoutOrderAction(formData: FormData) {
  const parsed = checkoutSchema.safeParse({
    contactEmail: formData.get('contactEmail') || '',
    locale: formData.get('locale') || '',
    recipientName: formData.get('recipientName'),
    phone: formData.get('phone'),
    addressLine1: formData.get('addressLine1'),
    addressLine2: formData.get('addressLine2') || '',
    city: formData.get('city'),
    administrativeArea: formData.get('administrativeArea') || '',
    postalCode: formData.get('postalCode') || '',
    countryCode: formData.get('countryCode'),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid checkout data.');

  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/checkout');

  const order = await createOrderFromCart(supabase, user.id, {
    contactEmail: parsed.data.contactEmail || user.email,
    locale: parsed.data.locale || null,
    shippingAddress: {
      recipientName: parsed.data.recipientName,
      phone: parsed.data.phone,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 || null,
      city: parsed.data.city,
      administrativeArea: parsed.data.administrativeArea || null,
      postalCode: parsed.data.postalCode || null,
      countryCode: parsed.data.countryCode,
    },
  });

  const { data: orderTotals, error: totalError } = await supabase
    .from('orders')
    .select('subtotal_cents, shipping_cents, total_cents, currency, exchange_rate_context, payment_provider_route')
    .eq('id', order.id)
    .eq('user_id', user.id)
    .single<{
      subtotal_cents: number;
      shipping_cents: number;
      total_cents: number;
      currency: string;
      exchange_rate_context: Record<string, unknown>;
      payment_provider_route: 'ameria' | 'bank_manual' | null;
    }>();

  if (totalError || !orderTotals) throw new Error(totalError?.message ?? 'Unable to read order total.');

  const service = getServiceSupabase();
  const transaction = await createTransactionRecord(service, {
    userId: user.id,
    orderId: order.id,
    type: 'payment',
    status: 'pending',
    amountCents: orderTotals.total_cents,
    currency: orderTotals.currency,
    provider: orderTotals.payment_provider_route ?? 'bank_manual',
    paymentProviderRoute: orderTotals.payment_provider_route ?? 'bank_manual',
    exchangeRateContext: orderTotals.exchange_rate_context,
    metadata: {
      source: 'checkout_review',
      paymentProviderRoute: orderTotals.payment_provider_route ?? 'bank_manual',
      subtotalCents: orderTotals.subtotal_cents,
      shippingCents: orderTotals.shipping_cents,
    },
    createdBy: user.id,
  });

  const { error: transactionLinkError } = await service
    .from('orders')
    .update({ transaction_id: transaction.id })
    .eq('id', order.id)
    .eq('user_id', user.id);

  if (transactionLinkError) throw new Error(transactionLinkError.message);

  revalidatePath('/cart');
  revalidatePath('/checkout');
  revalidatePath('/orders');

  if (orderTotals.payment_provider_route !== 'ameria') {
    redirect(`/orders/${order.id}?checkout=bank_pending`);
  }

  const { redirectUrl } = await initiateAmeriaPayment(service, {
    transactionId: transaction.id,
    amountCents: orderTotals.total_cents,
    currency: orderTotals.currency,
    description: `Uniqraft order ${order.id.slice(0, 8)}`,
    locale: parsed.data.locale || null,
  });
  redirect(redirectUrl);
}
