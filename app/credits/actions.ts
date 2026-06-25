'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCreditPack } from '@/lib/credit-packs';
import { convertMoney, getActiveCurrency, getPaymentRouteForCurrency, normalizeCurrency } from '@/lib/currency';
import { getServerEnv } from '@/lib/env';
import { getStripe } from '@/lib/stripe';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { createCreditPurchaseTransaction } from '@/lib/transactions';

const creditPackRequestSchema = z.object({
  packKey: z.string().trim().min(1),
});

export async function requestManualCreditPackAction(formData: FormData) {
  const parsed = creditPackRequestSchema.safeParse({
    packKey: formData.get('packKey'),
  });
  if (!parsed.success) throw new Error('Choose a credit pack.');

  const pack = getCreditPack(parsed.data.packKey);
  if (!pack) throw new Error('Unknown credit pack.');

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Log in to request credits.');

  const activeCurrency = await getActiveCurrency();
  const converted = await convertMoney(
    pack.priceCents,
    normalizeCurrency(pack.currency) ?? 'AMD',
    activeCurrency,
    getServiceSupabase(),
  );

  await createCreditPurchaseTransaction(getServiceSupabase(), {
    userId: user.id,
    status: 'pending',
    amountCents: converted.amountCents,
    currency: converted.currency,
    provider: getPaymentRouteForCurrency(converted.currency),
    paymentProviderRoute: getPaymentRouteForCurrency(converted.currency),
    providerReference: `manual-credit-pack:${pack.key}`,
    exchangeRateContext: converted.exchangeRateContext,
    metadata: {
      fulfillment: 'admin_manual_credit',
      packKey: pack.key,
      packName: pack.name,
      creditAmount: pack.creditAmount,
      sourcePriceCents: pack.priceCents,
      sourceCurrency: pack.currency,
      requestedByEmail: user.email ?? null,
    },
  });

  revalidatePath('/credits');
}

export async function createCreditPackCheckoutAction(formData: FormData) {
  const parsed = creditPackRequestSchema.safeParse({
    packKey: formData.get('packKey'),
  });
  if (!parsed.success) throw new Error('Choose a credit pack.');

  const pack = getCreditPack(parsed.data.packKey);
  if (!pack) throw new Error('Unknown credit pack.');

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/credits');

  const service = getServiceSupabase();
  const activeCurrency = await getActiveCurrency();
  const converted = await convertMoney(
    pack.priceCents,
    normalizeCurrency(pack.currency) ?? 'AMD',
    activeCurrency,
    service,
  );
  const paymentRoute = getPaymentRouteForCurrency(converted.currency);

  const transaction = await createCreditPurchaseTransaction(service, {
    userId: user.id,
    status: 'pending',
    amountCents: converted.amountCents,
    currency: converted.currency,
    provider: paymentRoute,
    paymentProviderRoute: paymentRoute,
    exchangeRateContext: converted.exchangeRateContext,
    metadata: {
      packKey: pack.key,
      packName: pack.name,
      creditAmount: pack.creditAmount,
      sourcePriceCents: pack.priceCents,
      sourceCurrency: pack.currency,
      requestedByEmail: user.email ?? null,
    },
    createdBy: user.id,
  });

  if (paymentRoute !== 'stripe') {
    revalidatePath('/credits');
    redirect('/credits?checkout=bank_pending');
  }

  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: converted.currency.toLowerCase(),
          unit_amount: converted.amountCents,
          product_data: {
            name: pack.name,
            description: pack.description,
          },
        },
      },
    ],
    metadata: {
      purchaseType: 'credit_pack',
      transactionId: transaction.id,
      userId: user.id,
      packKey: pack.key,
      creditAmount: String(pack.creditAmount),
      currency: converted.currency,
    },
    success_url: `${siteUrl}/credits?checkout=success`,
    cancel_url: `${siteUrl}/credits?checkout=cancelled`,
  });

  await service
    .from('transactions')
    .update({ provider_reference: session.id })
    .eq('id', transaction.id);

  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  redirect(session.url);
}
