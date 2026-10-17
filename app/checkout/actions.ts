'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { CHECKOUT_FIELD_LIMITS as LIMITS } from '@/app/checkout/checkout-fields';
import type { ActionState } from '@/lib/action-state';
import { createOrderFromCart } from '@/lib/orders';
import { initiateAmeriaPayment } from '@/lib/payments/ameria';
import { initiatePolarCheckout } from '@/lib/payments/polar';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { createTransactionRecord } from '@/lib/transactions';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const checkoutSchema = z.object({
  contactEmail: z.string().trim().email().optional().or(z.literal('')),
  locale: z.enum(['en', 'ru', 'am']).optional().or(z.literal('')),
  recipientName: z.string().trim().min(LIMITS.recipientName.min).max(LIMITS.recipientName.max),
  phone: z.string().trim().min(LIMITS.phone.min).max(LIMITS.phone.max),
  addressLine1: z.string().trim().min(LIMITS.addressLine1.min).max(LIMITS.addressLine1.max),
  addressLine2: optionalText(LIMITS.addressLine2.max),
  city: z.string().trim().min(LIMITS.city.min).max(LIMITS.city.max),
  administrativeArea: optionalText(LIMITS.administrativeArea.max),
  postalCode: optionalText(LIMITS.postalCode.max),
});

const CHECKOUT_FIELDS = [
  'contactEmail',
  'locale',
  'recipientName',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'administrativeArea',
  'postalCode',
] as const;

export type CheckoutActionState = ActionState<null>;

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function createCheckoutOrderAction(
  _prev: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const values = Object.fromEntries(
    CHECKOUT_FIELDS.map((name) => [name, readField(formData, name)]),
  ) as Record<(typeof CHECKOUT_FIELDS)[number], string>;

  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) {
    // Validation failures come back as form state (never thrown): the browser
    // only enforces `required`, so a 3-digit phone or a one-letter city reaches
    // us and must render as a field error, not a server crash.
    const t = await getTranslations();
    const tooShort: Record<string, string> = {
      contactEmail: t('checkout.error.contact_email'),
      recipientName: t('checkout.error.recipient', { min: LIMITS.recipientName.min }),
      phone: t('checkout.error.phone', { min: LIMITS.phone.min }),
      addressLine1: t('checkout.error.address1', { min: LIMITS.addressLine1.min }),
      city: t('checkout.error.city', { min: LIMITS.city.min }),
    };
    const tooLong = t('checkout.error.too_long');

    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '_root');
      const message = issue.code === 'too_big' ? tooLong : (tooShort[field] ?? issue.message);
      fieldErrors[field] ??= [];
      fieldErrors[field].push(message);
    }
    return { status: 'error', error: t('checkout.error.form'), fieldErrors, values };
  }

  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/checkout');

  const countryCode = 'AM';
  const billingCountryCode = countryCode;

  const order = await createOrderFromCart(supabase, user.id, {
    contactEmail: parsed.data.contactEmail || user.email,
    locale: parsed.data.locale || null,
    billingCountryCode,
    shippingAddress: {
      recipientName: parsed.data.recipientName,
      phone: parsed.data.phone,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 || null,
      city: parsed.data.city,
      administrativeArea: parsed.data.administrativeArea || null,
      postalCode: parsed.data.postalCode || null,
      countryCode,
    },
  });

  const { data: orderTotals, error: totalError } = await supabase
    .from('orders')
    .select(
      'subtotal_cents, shipping_cents, total_cents, currency, exchange_rate_context, payment_provider_route',
    )
    .eq('id', order.id)
    .eq('user_id', user.id)
    .single<{
      subtotal_cents: number;
      shipping_cents: number;
      total_cents: number;
      currency: string;
      exchange_rate_context: Record<string, unknown>;
      payment_provider_route: 'ameria' | 'bank_manual' | 'polar' | null;
    }>();

  if (totalError || !orderTotals)
    throw new Error(totalError?.message ?? 'Unable to read order total.');

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

  const route = orderTotals.payment_provider_route ?? 'bank_manual';

  if (route === 'polar') {
    const { redirectUrl } = await initiatePolarCheckout(service, {
      transactionId: transaction.id,
      amountCents: orderTotals.total_cents,
      currency: orderTotals.currency,
      description: `Uniqraft order ${order.id.slice(0, 8)}`,
      locale: parsed.data.locale || null,
    });
    redirect(redirectUrl);
  }

  if (route === 'ameria') {
    const { redirectUrl } = await initiateAmeriaPayment(service, {
      transactionId: transaction.id,
      amountCents: orderTotals.total_cents,
      currency: orderTotals.currency,
      description: `Uniqraft order ${order.id.slice(0, 8)}`,
      locale: parsed.data.locale || null,
    });
    redirect(redirectUrl);
  }

  redirect(`/orders/${order.id}?checkout=bank_pending`);
}
