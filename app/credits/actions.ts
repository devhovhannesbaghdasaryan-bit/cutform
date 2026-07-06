'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCreditPack } from '@/lib/credit-packs';
import { convertMoney, getActiveCurrency, getPaymentRouteForCurrency, normalizeCurrency } from '@/lib/currency';
import { getServerEnv } from '@/lib/env';
import { createCheckoutSessionForTransaction } from '@/lib/stripe';
import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { createCreditPurchaseTransaction } from '@/lib/transactions';

const creditPackRequestSchema = z.object({
  packKey: z.string().trim().min(1),
});

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
  const checkoutUrl = await createCheckoutSessionForTransaction(service, {
    transactionId: transaction.id,
    customerEmail: user.email ?? undefined,
    currency: converted.currency,
    amountCents: converted.amountCents,
    productName: pack.name,
    productDescription: pack.description,
    metadata: {
      purchaseType: 'credit_pack',
      transactionId: transaction.id,
      userId: user.id,
      packKey: pack.key,
      creditAmount: String(pack.creditAmount),
      currency: converted.currency,
    },
    successUrl: `${siteUrl}/credits?checkout=success`,
    cancelUrl: `${siteUrl}/credits?checkout=cancelled`,
  });

  redirect(checkoutUrl);
}
