'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCreditPack } from '@/lib/credit-packs';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { initiateAmeriaPayment } from '@/lib/payments/ameria';
import { getPaymentRoute } from '@/lib/payments/router';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
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

  const paymentRoute = await getPaymentRoute(converted.currency);

  await createCreditPurchaseTransaction(getServiceSupabase(), {
    userId: user.id,
    status: 'pending',
    amountCents: converted.amountCents,
    currency: converted.currency,
    provider: paymentRoute,
    paymentProviderRoute: paymentRoute,
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

  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/credits');

  const service = getServiceSupabase();
  const activeCurrency = await getActiveCurrency();
  const converted = await convertMoney(
    pack.priceCents,
    normalizeCurrency(pack.currency) ?? 'AMD',
    activeCurrency,
    service,
  );
  const paymentRoute = await getPaymentRoute(converted.currency, service);

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

  if (paymentRoute !== 'ameria') {
    revalidatePath('/credits');
    redirect('/credits?checkout=bank_pending');
  }

  const { redirectUrl } = await initiateAmeriaPayment(service, {
    transactionId: transaction.id,
    amountCents: converted.amountCents,
    currency: converted.currency,
    description: pack.name,
    locale: null,
  });
  redirect(redirectUrl);
}
