import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductType } from '@/lib/marketplace-constants';
import type { Json, Tables } from '@/lib/supabase/types';

export type GeneratedItemRow = Omit<
  Tables<'generated_items'>,
  'generation_options' | 'manufacturing_metadata'
> & {
  generation_options: Record<string, Json | undefined>;
  manufacturing_metadata: Record<string, Json | undefined>;
};

export type PersonalizedPreviewOptionRow = Omit<Tables<'personalized_preview_options'>, 'metadata'> & {
  metadata: Record<string, Json | undefined>;
};

export type GeneratedItemAdminDetail = Omit<
  GeneratedItemRow,
  'category_id' | 'subcategory_id' | 'generated_by'
>;

export type AdminGeneratedPreviewOption = Pick<
  PersonalizedPreviewOptionRow,
  'id' | 'option_index' | 'preview_image_path' | 'manufacturing_file_path' | 'status' | 'metadata'
>;

export type GeneratedItemArtifactRow = Pick<
  Tables<'generated_item_artifacts'>,
  'id' | 'artifact_type' | 'storage_path' | 'content_text' | 'metadata' | 'created_at'
>;

export type GeneratedItemAdminListRow = Pick<
  GeneratedItemRow,
  'id' | 'user_id' | 'title' | 'product_type' | 'review_status' | 'credit_cost' | 'created_at'
>;

export interface GeneratedItemAdminListFilters {
  status?: string;
  type?: string;
}

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
  manufacturingFilePath?: string | null;
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
  manufacturingFilePath?: string | null;
  boilerplateId?: string | null;
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
      manufacturing_file_path: input.manufacturingFilePath ?? null,
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
        manufacturing_file_path: option.manufacturingFilePath,
        boilerplate_id: option.boilerplateId ?? null,
        metadata: option.metadata ?? {},
      })),
    )
    .select('id')
    .returns<{ id: string }[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listGeneratedItemsForAdminReview(
  supabase: SupabaseClient,
  filters: GeneratedItemAdminListFilters = {},
) {
  let query = supabase
    .from('generated_items')
    .select('id, user_id, title, product_type, review_status, credit_cost, created_at')
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('review_status', filters.status);
  if (filters.type) query = query.eq('product_type', filters.type);

  return query.returns<GeneratedItemAdminListRow[]>();
}

export async function getGeneratedItemAdminDetail(supabase: SupabaseClient, id: string) {
  const [{ data: item, error }, { data: options }, { data: artifacts }] = await Promise.all([
    supabase
      .from('generated_items')
      .select(
        'id, user_id, title, product_type, review_status, credit_cost, source_image_path, original_image_paths, preview_path, selected_preview_path, manufacturing_file_path, custom_text, color, multi_color, prompt, svg_content, manufacturing_metadata, generation_options, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle<GeneratedItemAdminDetail>(),
    supabase
      .from('personalized_preview_options')
      .select('id, option_index, preview_image_path, manufacturing_file_path, status, metadata')
      .eq('generated_item_id', id)
      .order('option_index', { ascending: true })
      .returns<AdminGeneratedPreviewOption[]>(),
    supabase
      .from('generated_item_artifacts')
      .select('id, artifact_type, storage_path, content_text, metadata, created_at')
      .eq('generated_item_id', id)
      .order('created_at', { ascending: false })
      .returns<GeneratedItemArtifactRow[]>(),
  ]);

  if (error || !item) return null;

  const sourcePaths = [...new Set([
    ...(item.source_image_path ? [item.source_image_path] : []),
    ...item.original_image_paths,
  ])];
  const sourceAssets = await Promise.all(sourcePaths.map(async (storagePath) => {
    const [preview, download] = await Promise.all([
      supabase.storage.from('user-uploads').createSignedUrl(storagePath, 60 * 60),
      supabase.storage.from('user-uploads').createSignedUrl(storagePath, 60 * 60, { download: fileName(storagePath) }),
    ]);
    return { storagePath, url: preview.data?.signedUrl ?? null, downloadUrl: download.data?.signedUrl ?? null };
  }));
  const optionAssets = await Promise.all((options ?? []).map(async (option) => ({
    ...option,
    previewUrl: (await supabase.storage.from('generated-assets').createSignedUrl(option.preview_image_path, 60 * 60)).data?.signedUrl ?? null,
    previewDownloadUrl: (await supabase.storage.from('generated-assets').createSignedUrl(option.preview_image_path, 60 * 60, { download: fileName(option.preview_image_path) })).data?.signedUrl ?? null,
    manufacturingFileUrl: option.manufacturing_file_path
      ? (await supabase.storage.from('generated-assets').createSignedUrl(option.manufacturing_file_path, 60 * 60)).data?.signedUrl ?? null
      : null,
    manufacturingFileDownloadUrl: option.manufacturing_file_path
      ? (await supabase.storage.from('generated-assets').createSignedUrl(option.manufacturing_file_path, 60 * 60, { download: fileName(option.manufacturing_file_path) })).data?.signedUrl ?? null
      : null,
  })));
  const parentPreviewPath = item.selected_preview_path ?? item.preview_path;
  const parentPreviewUrl = parentPreviewPath
    ? (await supabase.storage.from('generated-assets').createSignedUrl(parentPreviewPath, 60 * 60)).data?.signedUrl ?? null
    : null;
  const parentPreviewDownloadUrl = parentPreviewPath
    ? (await supabase.storage.from('generated-assets').createSignedUrl(parentPreviewPath, 60 * 60, { download: fileName(parentPreviewPath) })).data?.signedUrl ?? null
    : null;
  const parentManufacturingFileUrl = item.manufacturing_file_path
    ? (await supabase.storage.from('generated-assets').createSignedUrl(item.manufacturing_file_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const parentManufacturingFileDownloadUrl = item.manufacturing_file_path
    ? (await supabase.storage.from('generated-assets').createSignedUrl(item.manufacturing_file_path, 60 * 60, { download: fileName(item.manufacturing_file_path) })).data?.signedUrl ?? null
    : null;

  return {
    item,
    artifacts,
    sourceAssets,
    optionAssets,
    parentPreviewPath,
    parentPreviewUrl,
    parentPreviewDownloadUrl,
    parentManufacturingFileUrl,
    parentManufacturingFileDownloadUrl,
  };
}

function fileName(path: string) {
  return path.split('/').at(-1) ?? 'asset';
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
