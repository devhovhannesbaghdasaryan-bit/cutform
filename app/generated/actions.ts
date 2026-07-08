'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { addItemToCart } from '@/lib/cart';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { planGeneratedItemCartAdd } from '@/lib/generated-items';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

async function requireUser(next = '/dashboard') {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

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
  const parsed = z
    .object({
      generatedItemId: z.string().uuid(),
      optionIds: z.array(z.string().uuid()).optional(),
    })
    .safeParse({
      generatedItemId: formData.get('generatedItemId'),
      optionIds: formData.getAll('optionIds'),
    });

  if (!parsed.success) throw new Error('Invalid generated item.');

  const { supabase, user } = await requireUser(`/generated/${parsed.data.generatedItemId}`);
  const { data: item, error } = await supabase
    .from('generated_items')
    .select(
      'id, title, product_type, review_status, selected_preview_path, manufacturing_file_path, generation_options, credit_cost, catalog_item:catalog_items(price_cents, currency)',
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
      catalog_item: { price_cents: number; currency: string } | null;
    }>();

  if (error || !item) throw new Error(error?.message ?? 'Generated item was not found.');
  if (item.review_status === 'rejected')
    throw new Error('Rejected generated items cannot be ordered.');
  const sourcePriceCents =
    item.catalog_item?.price_cents ?? getGeneratedSalePriceCents(item.generation_options);
  const sourceCurrency = item.catalog_item
    ? (normalizeCurrency(item.catalog_item.currency) ?? 'AMD')
    : getGeneratedSaleCurrency(item.generation_options);
  const activeCurrency = await getActiveCurrency();
  const converted = await convertMoney(
    sourcePriceCents,
    sourceCurrency,
    activeCurrency,
    getServiceSupabase(),
  );

  const optionIds = [...new Set(parsed.data.optionIds ?? [])];
  let fetchedOptions: {
    id: string;
    preview_image_path: string;
    manufacturing_file_path: string | null;
    metadata: Record<string, unknown>;
  }[] = [];

  if (optionIds.length > 0) {
    const { data: options, error: optionsError } = await supabase
      .from('personalized_preview_options')
      .select('id, preview_image_path, manufacturing_file_path, metadata')
      .eq('generated_item_id', item.id)
      .in('id', optionIds)
      .returns<
        {
          id: string;
          preview_image_path: string;
          manufacturing_file_path: string | null;
          metadata: Record<string, unknown>;
        }[]
      >();
    if (optionsError) throw new Error('One or more generated options are unavailable.');
    fetchedOptions = options ?? [];
  }

  const cartAddCalls = planGeneratedItemCartAdd({
    item: {
      id: item.id,
      title: item.title,
      productType: item.product_type,
      creditCost: item.credit_cost,
    },
    optionIds,
    fetchedOptions: fetchedOptions.map((option) => ({
      id: option.id,
      previewImagePath: option.preview_image_path,
      manufacturingFilePath: option.manufacturing_file_path,
      metadata: option.metadata,
    })),
    pricing: {
      unitPriceCents: converted.amountCents,
      currency: converted.currency,
      sourcePriceCents,
      sourceCurrency,
      exchangeRateContext: converted.exchangeRateContext,
    },
  });

  for (const call of cartAddCalls) {
    await addItemToCart(supabase, { userId: user.id }, call);
  }

  revalidatePath('/cart');
  redirect('/cart');
}
