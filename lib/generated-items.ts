import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductType } from '@/lib/marketplace-constants';

export interface GeneratedItemInput {
  userId: string;
  generatedBy?: string | null;
  productType: ProductType;
  categoryId?: string | null;
  subcategoryId?: string | null;
  title?: string | null;
  sourceImagePath?: string | null;
  prompt?: string | null;
  customText?: string | null;
  svgContent?: string;
  previewPath?: string | null;
  selectedPreviewPath?: string | null;
  hiddenSvgPath?: string | null;
  originalImagePaths?: string[];
  color?: string | null;
  multiColor?: boolean;
  manufacturingMetadata?: Record<string, unknown>;
  generationOptions?: Record<string, unknown>;
  creditCost?: number;
  reviewStatus?: string;
}

export interface PersonalizedPreviewOptionInput {
  generatedItemId: string;
  optionIndex: number;
  previewImagePath: string;
  hiddenSvgPath: string;
  metadata?: Record<string, unknown>;
}

export async function createGeneratedItem(supabase: SupabaseClient, input: GeneratedItemInput) {
  const { data, error } = await supabase
    .from('generated_items')
    .insert({
      user_id: input.userId,
      generated_by: input.generatedBy ?? null,
      product_type: input.productType,
      category_id: input.categoryId ?? null,
      subcategory_id: input.subcategoryId ?? null,
      title: input.title ?? null,
      source_image_path: input.sourceImagePath ?? null,
      prompt: input.prompt ?? null,
      custom_text: input.customText ?? null,
      svg_content: input.svgContent ?? '',
      preview_path: input.previewPath ?? null,
      selected_preview_path: input.selectedPreviewPath ?? null,
      hidden_svg_path: input.hiddenSvgPath ?? null,
      original_image_paths: input.originalImagePaths ?? [],
      color: input.color ?? null,
      multi_color: input.multiColor ?? false,
      manufacturing_metadata: input.manufacturingMetadata ?? {},
      generation_options: input.generationOptions ?? {},
      credit_cost: input.creditCost ?? 0,
      review_status: input.reviewStatus ?? 'draft',
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) throw new Error(error?.message ?? 'Unable to create generated item.');
  return data;
}

export async function createPersonalizedPreviewOptions(
  supabase: SupabaseClient,
  options: PersonalizedPreviewOptionInput[],
) {
  if (options.length === 0) return [];

  const { data, error } = await supabase
    .from('personalized_preview_options')
    .insert(
      options.map((option) => ({
        generated_item_id: option.generatedItemId,
        option_index: option.optionIndex,
        preview_image_path: option.previewImagePath,
        hidden_svg_path: option.hiddenSvgPath,
        metadata: option.metadata ?? {},
      })),
    )
    .select('id')
    .returns<{ id: string }[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function selectPersonalizedPreviewOption(
  supabase: SupabaseClient,
  generatedItemId: string,
  optionId: string,
) {
  const { data: option, error: optionError } = await supabase
    .from('personalized_preview_options')
    .select('preview_image_path, hidden_svg_path')
    .eq('id', optionId)
    .eq('generated_item_id', generatedItemId)
    .maybeSingle<{ preview_image_path: string; hidden_svg_path: string }>();

  if (optionError || !option) {
    throw new Error(optionError?.message ?? 'Preview option was not found.');
  }

  const { error: discardError } = await supabase
    .from('personalized_preview_options')
    .update({ status: 'discarded' })
    .eq('generated_item_id', generatedItemId);

  if (discardError) throw new Error(discardError.message);

  const { error: selectError } = await supabase
    .from('personalized_preview_options')
    .update({ status: 'selected' })
    .eq('id', optionId);

  if (selectError) throw new Error(selectError.message);

  const { error: generatedError } = await supabase
    .from('generated_items')
    .update({
      selected_preview_path: option.preview_image_path,
      hidden_svg_path: option.hidden_svg_path,
      review_status: 'review_required',
    })
    .eq('id', generatedItemId);

  if (generatedError) throw new Error(generatedError.message);
}

export async function updateGeneratedReviewStatus(
  supabase: SupabaseClient,
  generatedItemId: string,
  reviewStatus: 'draft' | 'preview_ready' | 'review_required' | 'approved' | 'rejected',
) {
  const { error } = await supabase
    .from('generated_items')
    .update({ review_status: reviewStatus })
    .eq('id', generatedItemId);

  if (error) throw new Error(error.message);
}
