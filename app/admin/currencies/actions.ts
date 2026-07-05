'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { APP_CURRENCIES, normalizeCurrency } from '@/lib/currency';
import { writeAdminAuditLog } from '@/lib/transactions';

const currencySettingsSchema = z.object({
  enabledCurrencies: z.array(z.enum(APP_CURRENCIES)).min(1, 'At least one currency must remain enabled.'),
});

export async function updateCurrencySettingsAction(formData: FormData) {
  const enabledCurrencies = formData
    .getAll('enabledCurrencies')
    .map((value) => normalizeCurrency(value))
    .filter((value): value is (typeof APP_CURRENCIES)[number] => Boolean(value));

  const parsed = currencySettingsSchema.safeParse({ enabledCurrencies });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid currency settings.');

  const { supabase, user } = await requireAdminPermission('transactions_manage');

  for (const currency of APP_CURRENCIES) {
    const { error } = await supabase
      .from('currencies')
      .update({ is_enabled: parsed.data.enabledCurrencies.includes(currency) })
      .eq('code', currency);
    if (error) throw new Error(error.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: 'admin_currency_settings_updated',
    entityType: 'currency_settings',
    reason: 'Updated enabled marketplace currencies.',
    metadata: { enabledCurrencies: parsed.data.enabledCurrencies },
  });

  revalidatePath('/admin/currencies');
  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/cart');
  revalidatePath('/checkout');
  revalidatePath('/credits');
}
