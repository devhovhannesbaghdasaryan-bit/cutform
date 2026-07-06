'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { APP_CURRENCIES } from '@/lib/currency';

const optionalCurrency = z.union([z.enum(APP_CURRENCIES), z.literal('')]);

export async function createMarketRegionAction(formData: FormData) {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    })
    .safeParse({ name: formData.get('name'), slug: formData.get('slug') });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid region.');
  const { supabase } = await requireAdminPermission('catalog_manage');
  const { error } = await supabase.from('market_regions').insert(parsed.data);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/markets');
}

export async function updateMarketRegionAction(formData: FormData) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(80),
      defaultCurrency: optionalCurrency,
      sortOrder: z.coerce.number().int(),
      isActive: z.boolean(),
    })
    .safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      defaultCurrency: formData.get('defaultCurrency') ?? '',
      sortOrder: formData.get('sortOrder'),
      isActive: formData.get('isActive') === 'on',
    });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid region.');
  const { supabase } = await requireAdminPermission('catalog_manage');
  if (!parsed.data.isActive) {
    const { count } = await supabase
      .from('countries')
      .select('code', { count: 'exact', head: true })
      .eq('region_id', parsed.data.id)
      .eq('is_active', true);
    if (count) throw new Error('Move active countries before deactivating this region.');
  }
  const { error } = await supabase
    .from('market_regions')
    .update({
      name: parsed.data.name,
      default_currency_code: parsed.data.defaultCurrency || null,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .eq('id', parsed.data.id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/markets');
  revalidatePath('/catalog');
}

export async function updateCountryMarketAction(formData: FormData) {
  const parsed = z
    .object({
      code: z.string().regex(/^[A-Z]{2}$/),
      regionId: z.string().uuid(),
      defaultCurrency: optionalCurrency,
    })
    .safeParse({
      code: formData.get('code'),
      regionId: formData.get('regionId'),
      defaultCurrency: formData.get('defaultCurrency') ?? '',
    });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid country.');
  const { supabase } = await requireAdminPermission('catalog_manage');
  const { data: region } = await supabase
    .from('market_regions')
    .select('id')
    .eq('id', parsed.data.regionId)
    .eq('is_active', true)
    .maybeSingle<{ id: string }>();
  if (!region) throw new Error('Choose an active region.');
  const { error } = await supabase
    .from('countries')
    .update({
      region_id: parsed.data.regionId,
      default_currency_code: parsed.data.defaultCurrency || null,
    })
    .eq('code', parsed.data.code);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/markets');
  revalidatePath('/catalog');
}
