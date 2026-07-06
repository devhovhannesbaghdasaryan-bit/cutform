'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { addItemToCart } from '@/lib/cart';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

async function requireUser(next = '/dashboard') {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

function getGeneratedSalePriceCents(options: Record<string, unknown> | null) {
  const raw = options?.salePriceCents ?? options?.priceCents ?? options?.unitPriceCents;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 0;
}

function getGeneratedSaleCurrency(options: Record<string, unknown> | null) {
  return normalizeCurrency(options?.saleCurrency ?? options?.currency) ?? 'AMD';
}

export async function addGeneratedItemToCartAction(formData: FormData) {
  const parsed = z.object({
    generatedItemId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).optional(),
  }).safeParse({
    generatedItemId: formData.get('generatedItemId'),
    optionIds: formData.getAll('optionIds'),
  });

  if (!parsed.success) throw new Error('Invalid generated item.');

  const { supabase, user } = await requireUser(`/generated/${parsed.data.generatedItemId}`);
  const { data: item, error } = await supabase
    .from('generated_items')
    .select(
      'id, title, product_type, review_status, selected_preview_path, manufacturing_file_path, generation_options, credit_cost',
    )
    .eq('id', parsed.data.generatedItemId)
    .eq('user_id', user.id)
    .maybeSingle<{
      id: string;
      title: string | null;
      product_type: string;
      review_status: string;
      selected_preview_path: string | null;
      manufacturing_file_path: string | null;
      generation_options: Record<string, unknown> | null;
      credit_cost: number;
    }>();

  if (error || !item) throw new Error(error?.message ?? 'Generated item was not found.');
  if (item.review_status === 'rejected') throw new Error('Rejected generated items cannot be ordered.');
  const sourcePriceCents = getGeneratedSalePriceCents(item.generation_options);
  const sourceCurrency = getGeneratedSaleCurrency(item.generation_options);
  const activeCurrency = await getActiveCurrency();
  const converted = await convertMoney(sourcePriceCents, sourceCurrency, activeCurrency, getServiceSupabase());

  if (item.product_type === 'personalized_night_light') {
    const optionIds = [...new Set(parsed.data.optionIds ?? [])];
    if (!optionIds.length) throw new Error('Select at least one generated option.');
    const { data: options, error: optionsError } = await supabase
      .from('personalized_preview_options')
      .select('id, preview_image_path, manufacturing_file_path, metadata')
      .eq('generated_item_id', item.id)
      .in('id', optionIds)
      .returns<{ id: string; preview_image_path: string; manufacturing_file_path: string | null; metadata: Record<string, unknown> }[]>();
    if (optionsError || !options || options.length !== optionIds.length) throw new Error('One or more generated options are unavailable.');
    for (const option of options) {
      await addItemToCart(supabase, { userId: user.id }, {
        generatedItemId: item.id,
        title: typeof option.metadata.boilerplateName === 'string' ? option.metadata.boilerplateName : item.title ?? 'Personalized night light',
        quantity: 1,
        unitPriceCents: converted.amountCents,
        currency: converted.currency,
        configuration: {
          productType: item.product_type,
          personalizedPreviewOptionId: option.id,
          selectedPreviewPath: option.preview_image_path,
          // NOTE: 'hiddenSvgPath' is a stored jsonb key inside cart_items.configuration
          // (snapshotted into order_items.item_snapshot). Existing rows carry it, so the
          // key is intentionally NOT renamed; it holds the manufacturing file path.
          hiddenSvgPath: option.manufacturing_file_path,
          boilerplateSnapshot: option.metadata,
          creditCost: 1,
          sourcePriceCents,
          sourceCurrency,
          exchangeRateContext: converted.exchangeRateContext,
        },
      });
    }
  } else {
    await addItemToCart(supabase, { userId: user.id }, {
      generatedItemId: item.id,
      title: item.title ?? `${item.product_type} ${item.id.slice(0, 8)}`,
      quantity: 1,
      unitPriceCents: converted.amountCents,
      currency: converted.currency,
      configuration: {
        productType: item.product_type,
        creditCost: item.credit_cost,
        sourcePriceCents,
        sourceCurrency,
        exchangeRateContext: converted.exchangeRateContext,
      },
    });
  }

  revalidatePath('/cart');
  redirect('/cart');
}
