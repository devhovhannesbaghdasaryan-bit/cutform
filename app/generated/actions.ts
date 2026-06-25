'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { addItemToUserCart } from '@/lib/cart';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { selectPersonalizedPreviewOption } from '@/lib/generated-items';
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

export async function selectGeneratedPreviewAction(formData: FormData) {
  const parsed = z.object({
    generatedItemId: z.string().uuid(),
    optionId: z.string().uuid(),
  }).safeParse({
    generatedItemId: formData.get('generatedItemId'),
    optionId: formData.get('optionId'),
  });

  if (!parsed.success) throw new Error('Invalid preview selection.');

  const { supabase } = await requireUser(`/generated/${parsed.data.generatedItemId}`);
  await selectPersonalizedPreviewOption(
    supabase,
    parsed.data.generatedItemId,
    parsed.data.optionId,
  );

  revalidatePath('/dashboard');
  revalidatePath(`/generated/${parsed.data.generatedItemId}`);
}

export async function addGeneratedItemToCartAction(formData: FormData) {
  const parsed = z.object({ generatedItemId: z.string().uuid() }).safeParse({
    generatedItemId: formData.get('generatedItemId'),
  });

  if (!parsed.success) throw new Error('Invalid generated item.');

  const { supabase, user } = await requireUser(`/generated/${parsed.data.generatedItemId}`);
  const { data: item, error } = await supabase
    .from('generated_items')
    .select(
      'id, title, product_type, review_status, selected_preview_path, hidden_svg_path, generation_options, credit_cost',
    )
    .eq('id', parsed.data.generatedItemId)
    .eq('user_id', user.id)
    .maybeSingle<{
      id: string;
      title: string | null;
      product_type: string;
      review_status: string;
      selected_preview_path: string | null;
      hidden_svg_path: string | null;
      generation_options: Record<string, unknown> | null;
      credit_cost: number;
    }>();

  if (error || !item) throw new Error(error?.message ?? 'Generated item was not found.');
  if (item.review_status === 'rejected') throw new Error('Rejected generated items cannot be ordered.');
  if (
    item.product_type === 'personalized_night_light'
    && (!item.selected_preview_path || !item.hidden_svg_path)
  ) {
    throw new Error('Select a generated preview before adding this item to cart.');
  }

  const sourcePriceCents = getGeneratedSalePriceCents(item.generation_options);
  const sourceCurrency = getGeneratedSaleCurrency(item.generation_options);
  const activeCurrency = await getActiveCurrency();
  const converted = await convertMoney(sourcePriceCents, sourceCurrency, activeCurrency, getServiceSupabase());

  await addItemToUserCart(supabase, user.id, {
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

  revalidatePath('/cart');
  redirect('/cart');
}
