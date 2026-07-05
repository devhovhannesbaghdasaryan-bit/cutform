'use server';

import { revalidatePath } from 'next/cache';
import { generateImage } from 'ai';
import { openai, type OpenAIImageModelEditOptions } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireAdmin, requireAdminPermission } from '@/lib/admin';
import { updateGeneratedReviewStatus } from '@/lib/generated-items';
import { downloadFromBucket, uploadToBucket } from '@/lib/storage';
import { writeAdminAuditLog } from '@/lib/transactions';

const reviewSchema = z.object({
  generatedItemId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'review_required']),
  note: z.string().trim().optional(),
});

const generateManufacturingSvgSchema = z.object({
  generatedItemId: z.string().uuid(),
  optionId: z.string().uuid(),
  prompt: z.string().trim().min(40).max(20_000),
  model: z.enum(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini']),
});

export type ManufacturingSvgGenerationState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

function mediaTypeForPath(storagePath: string) {
  const extension = storagePath.split('.').at(-1)?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'svg') return 'image/svg+xml';
  return 'image/png';
}

async function downloadAsDataUrl(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  bucket: string,
  storagePath: string,
) {
  const data = await downloadFromBucket(supabase, bucket, storagePath, `Unable to load ${storagePath}.`);
  return `data:${mediaTypeForPath(storagePath)};base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`;
}

export async function generateManufacturingSvgAction(
  _previousState: ManufacturingSvgGenerationState,
  formData: FormData,
): Promise<ManufacturingSvgGenerationState> {
  const parsed = generateManufacturingSvgSchema.safeParse({
    generatedItemId: formData.get('generatedItemId'),
    optionId: formData.get('optionId'),
    prompt: formData.get('prompt'),
    model: formData.get('model'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid generation settings.' };
  }

  const { supabase, user } = await requireAdminPermission('generated_review');
  const settings = parsed.data;

  try {
    const [{ data: item, error: itemError }, { data: option, error: optionError }] = await Promise.all([
      supabase
        .from('generated_items')
        .select('id, user_id, source_image_path, original_image_paths, selected_preview_path, manufacturing_metadata')
        .eq('id', settings.generatedItemId)
        .maybeSingle<{
          id: string;
          user_id: string;
          source_image_path: string | null;
          original_image_paths: string[];
          selected_preview_path: string | null;
          manufacturing_metadata: Record<string, unknown>;
        }>(),
      supabase
        .from('personalized_preview_options')
        .select('id, generated_item_id, preview_image_path, hidden_svg_path, status, metadata')
        .eq('id', settings.optionId)
        .eq('generated_item_id', settings.generatedItemId)
        .maybeSingle<{
          id: string;
          generated_item_id: string;
          preview_image_path: string;
          hidden_svg_path: string | null;
          status: string;
          metadata: Record<string, unknown>;
        }>(),
    ]);
    if (itemError || !item) throw new Error(itemError?.message ?? 'Generated item was not found.');
    if (optionError || !option) throw new Error(optionError?.message ?? 'Preview option was not found.');

    const sourcePaths = [...new Set([
      ...(item.source_image_path ? [item.source_image_path] : []),
      ...item.original_image_paths,
    ])].slice(0, 3);
    const [previewImage, ...sourceImages] = await Promise.all([
      downloadAsDataUrl(supabase, 'generated-assets', option.preview_image_path),
      ...sourcePaths.map((storagePath) => downloadAsDataUrl(supabase, 'user-uploads', storagePath)),
    ]);
    const editableSourceImage = sourceImages.find((image) => !image.startsWith('data:image/svg+xml')) ?? previewImage;
    const imageEdit = await generateImage({
      model: openai.image(settings.model),
      prompt: { images: [editableSourceImage], text: settings.prompt },
      providerOptions: {
        openai: {
          quality: 'high',
          background: 'opaque',
          outputFormat: 'png',
          inputFidelity: 'high',
        } satisfies OpenAIImageModelEditOptions,
      },
    });
    const storagePath = `${item.user_id}/personalized-night-lights/manufacturing-png/${crypto.randomUUID()}.png`;
    await uploadToBucket(supabase, {
      bucket: 'generated-assets',
      path: storagePath,
      body: imageEdit.image.uint8Array,
      contentType: 'image/png',
    });

    const generationMetadata = {
      model: settings.model,
      prompt: settings.prompt,
      format: 'png',
      generatedAt: new Date().toISOString(),
      generatedBy: user.id,
      imageUsage: imageEdit.usage,
    };
    const { error: updateOptionError } = await supabase
      .from('personalized_preview_options')
      .update({
        hidden_svg_path: storagePath,
        metadata: {
          ...option.metadata,
          manufacturingPngStatus: 'generated',
          manufacturingPngGeneration: generationMetadata,
        },
      })
      .eq('id', option.id);
    if (updateOptionError) throw new Error(updateOptionError.message);

    const isSelected = option.status === 'selected' || item.selected_preview_path === option.preview_image_path;
    if (isSelected) {
      const { error: updateItemError } = await supabase
        .from('generated_items')
        .update({
          hidden_svg_path: storagePath,
          manufacturing_metadata: {
            ...item.manufacturing_metadata,
            manufacturingPngGeneration: generationMetadata,
          },
        })
        .eq('id', item.id);
      if (updateItemError) throw new Error(updateItemError.message);
    }

    await writeAdminAuditLog(supabase, {
      actorUserId: user.id,
      targetUserId: item.user_id,
      action: option.hidden_svg_path ? 'manufacturing_png_regenerated' : 'manufacturing_png_generated',
      entityType: 'personalized_preview_option',
      entityId: option.id,
      metadata: { storagePath, model: settings.model, format: 'png' },
    });

    revalidatePath(`/admin/generated/${settings.generatedItemId}`);
    return { status: 'success', message: 'Manufacturing PNG generated and attached to this option.' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to generate the manufacturing PNG.',
    };
  }
}

export async function reviewGeneratedItemAction(formData: FormData) {
  const parsed = reviewSchema.safeParse({
    generatedItemId: formData.get('generatedItemId'),
    decision: formData.get('decision'),
    note: formData.get('note') ?? undefined,
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid review action.');

  const { supabase, user } = await requireAdminPermission('generated_review');
  const { generatedItemId, decision, note } = parsed.data;

  await updateGeneratedReviewStatus(supabase, generatedItemId, decision);
  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: `generated_item_${decision}`,
    entityType: 'generated_item',
    entityId: generatedItemId,
    reason: note || null,
    metadata: { reviewStatus: decision },
  });

  revalidatePath('/admin/generated');
  revalidatePath(`/admin/generated/${generatedItemId}`);
}
