'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { APP_CURRENCIES, normalizeCurrency } from '@/lib/currency';
import { PAYMENT_ROUTES, type PaymentRoute } from '@/lib/payments/types';
import { writeAdminAuditLog } from '@/lib/transactions';

const currencySettingsSchema = z.object({
  enabledCurrencies: z.array(z.enum(APP_CURRENCIES)).min(1, 'At least one currency must remain enabled.'),
  // Zod v4's z.record with an enum key schema requires every enum member to be present,
  // which would reject a payload that omits a currency. z.partialRecord tolerates missing
  // entries while still restricting keys to APP_CURRENCIES and values to PAYMENT_ROUTES.
  paymentRoutes: z.partialRecord(z.enum(APP_CURRENCIES), z.enum(PAYMENT_ROUTES)),
});

export async function updateCurrencySettingsAction(formData: FormData) {
  const enabledCurrencies = formData
    .getAll('enabledCurrencies')
    .map((value) => normalizeCurrency(value))
    .filter((value): value is (typeof APP_CURRENCIES)[number] => Boolean(value));

  const paymentRoutes: Record<string, string> = {};
  for (const currency of APP_CURRENCIES) {
    const value = formData.get(`paymentRoute:${currency}`);
    if (typeof value === 'string' && value) paymentRoutes[currency] = value;
  }

  const parsed = currencySettingsSchema.safeParse({ enabledCurrencies, paymentRoutes });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid currency settings.');

  const { supabase, user } = await requireAdmin();

  for (const currency of APP_CURRENCIES) {
    const route: PaymentRoute | undefined = parsed.data.paymentRoutes[currency];
    const { error } = await supabase
      .from('currencies')
      .update({
        is_enabled: parsed.data.enabledCurrencies.includes(currency),
        ...(route ? { payment_route: route } : {}),
      })
      .eq('code', currency);
    if (error) throw new Error(error.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: 'admin_currency_settings_updated',
    entityType: 'currency_settings',
    reason: 'Updated enabled marketplace currencies.',
    metadata: {
      enabledCurrencies: parsed.data.enabledCurrencies,
      paymentRoutes: parsed.data.paymentRoutes,
    },
  });

  revalidatePath('/admin/currencies');
  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/cart');
  revalidatePath('/checkout');
  revalidatePath('/credits');
}
