'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { requireAdmin, requireAdminPermission } from '@/lib/admin';
import { buildBannerManufacturingInstructions } from '@/lib/banner-manufacturing';
import { uploadToBucket } from '@/lib/storage';
import type { Json } from '@/lib/supabase/types';

const generateSchema = z.object({
  orderId: z.uuid(),
  orderItemId: z.uuid(),
});

const orderStatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum([
    'draft',
    'pending_payment',
    'paid',
    'review_required',
    'approved_for_production',
    'in_production',
    'ready_to_ship',
    'shipped',
    'cancelled',
    'refunded',
  ]),
  paymentStatus: z.enum(['unpaid', 'paid', 'refunded', 'failed']),
});

export async function updateOrderStatusAction(
  _prev: ActionState<null>,
  formData: FormData,
): Promise<ActionState<null>> {
  const parsed = orderStatusSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
    paymentStatus: formData.get('paymentStatus'),
  });
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'Invalid order status.');

  const { supabase } = await requireAdmin();
  const { orderId, status, paymentStatus } = parsed.data;
  const { error } = await supabase
    .from('orders')
    .update({ status, payment_status: paymentStatus })
    .eq('id', orderId);

  if (error) return actionError(error.message);

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return actionSuccess(null);
}

interface AdminBannerOrderItem {
  id: string;
  order_id: string;
  title: string;
  quantity: number;
  generated_item_id: string | null;
  item_snapshot: Record<string, Json | undefined>;
  personalization_snapshot: Record<string, Json | undefined>;
  production_snapshot: Record<string, Json | undefined>;
  image_path: string | null;
  selected_preview_path: string | null;
  banner_size_key: string | null;
  custom_text: string | null;
}

interface GeneratedBannerSource {
  id: string;
  product_type: string;
  title: string | null;
  source_image_path: string | null;
  prompt: string | null;
  preview_path: string | null;
  selected_preview_path: string | null;
  generation_options: Record<string, Json | undefined>;
}

function requireStringPath(...values: Array<string | null | undefined>) {
  return values.find((value): value is string => Boolean(value?.trim())) ?? null;
}

export async function generateBannerManufacturingInstructionAction(formData: FormData) {
  const parsed = generateSchema.safeParse({
    orderId: formData.get('orderId'),
    orderItemId: formData.get('orderItemId'),
  });
  if (!parsed.success) throw new Error('Invalid order item.');

  const { orderId, orderItemId } = parsed.data;
  const { supabase, user } = await requireAdminPermission('orders_manage');

  const { data: item, error: itemError } = await supabase
    .from('order_items')
    .select(
      'id, order_id, title, quantity, generated_item_id, item_snapshot, personalization_snapshot, production_snapshot, image_path, selected_preview_path, banner_size_key, custom_text',
    )
    .eq('id', orderItemId)
    .eq('order_id', orderId)
    .maybeSingle<AdminBannerOrderItem>();
  if (itemError || !item) throw new Error(itemError?.message ?? 'Order item not found.');

  let generated: GeneratedBannerSource | null = null;
  if (item.generated_item_id) {
    const { data, error } = await supabase
      .from('generated_items')
      .select(
        'id, product_type, title, source_image_path, prompt, preview_path, selected_preview_path, generation_options',
      )
      .eq('id', item.generated_item_id)
      .maybeSingle<GeneratedBannerSource>();
    if (error) throw new Error(error.message);
    generated = data;
  }

  const isBanner = Boolean(item.banner_size_key || generated?.product_type === 'banner');
  if (!isBanner) throw new Error('Manufacturing instructions are available for banner items only.');

  const sourceImagePath = requireStringPath(
    item.image_path,
    item.selected_preview_path,
    generated?.selected_preview_path,
    generated?.preview_path,
    generated?.source_image_path,
  );
  if (!sourceImagePath) throw new Error('Banner source image is missing.');

  const result = await buildBannerManufacturingInstructions({
    orderId,
    orderItemId,
    generatedItemId: item.generated_item_id,
    title: item.title || generated?.title || 'Banner',
    quantity: item.quantity,
    bannerSizeKey: item.banner_size_key,
    sourceImagePath,
    selectedPreviewPath: requireStringPath(item.selected_preview_path, generated?.selected_preview_path),
    prompt: generated?.prompt ?? null,
    customText: item.custom_text,
    itemSnapshot: item.item_snapshot ?? {},
    personalizationSnapshot: item.personalization_snapshot ?? {},
    productionSnapshot: item.production_snapshot ?? {},
    generatedOptions: generated?.generation_options ?? {},
  });

  const drawingPath = `${user.id}/banner-manufacturing/${orderItemId}/${crypto.randomUUID()}.svg`;
  await uploadToBucket(supabase, {
    bucket: 'generated-assets',
    path: drawingPath,
    body: new TextEncoder().encode(result.drawingSvg),
    contentType: 'image/svg+xml',
  });

  const { error: insertError } = await supabase.from('banner_manufacturing_instructions').insert({
    order_id: orderId,
    order_item_id: orderItemId,
    generated_item_id: item.generated_item_id,
    source_image_path: sourceImagePath,
    instructions: result.instructions,
    drawing_paths: [drawingPath],
    status: result.status,
    created_by: user.id,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/admin/orders/${orderId}`);
}
