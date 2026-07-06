'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';
import { getOpenAiClient } from '@/lib/openai-client';
import { deleteReferenceFile, uploadReferenceImage } from '@/lib/openai-files';

const imageExtByMime: Record<string, string> = {
  ...IMAGE_EXTENSION_BY_MIME,
  'image/svg+xml': 'svg',
};

const modelSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Title is required.'),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a URL-safe slug.'),
  subcategoryId: z.union([z.string().uuid(), z.literal('')]),
  mockImagePath: z.string().trim().optional(),
  boilerplateImagePath: z.string().trim().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  basePriceAmd: z.coerce.number().int().min(0),
  creditCost: z.coerce.number().int().min(0),
  productionNotes: z.string().trim().optional(),
});

const boilerplateSchema = z.object({
  id: z.string().uuid().optional(),
  modelId: z.string().uuid(),
  adminName: z.string().trim().min(1, 'Boilerplate name is required.'),
  nameEn: z.string().trim().optional(),
  nameHy: z.string().trim().optional(),
  nameRu: z.string().trim().optional(),
  imagePath: z.string().trim().optional(),
  manufacturingProcess: z.string().trim().min(1, 'Manufacturing process is required.'),
  generationInstruction: z.string().trim().min(1, 'Generation instruction is required.'),
  sortOrder: z.coerce.number().int(),
  generateHiddenSvg: z.boolean(),
  isActive: z.boolean(),
});

function getFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function uploadModelImage(
  supabase: Awaited<ReturnType<typeof requireAdminPermission>>['supabase'],
  userId: string,
  file: File | null,
  kind: string,
) {
  if (!file) return null;
  const ext = imageExtByMime[file.type];
  if (!ext) throw new Error('Upload PNG, JPG, WEBP, or SVG images only.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Template images must be 10 MB or smaller.');

  return uploadToBucket(supabase, {
    bucket: 'catalog-assets',
    path: `${userId}/personalization-models/${kind}-${crypto.randomUUID()}.${ext}`,
    body: await file.arrayBuffer(),
    contentType: file.type,
  });
}

function revalidatePersonalization(slug?: string | null) {
  revalidatePath('/personalization/night-lights');
  revalidatePath('/catalog/night-lights/personalized');
  if (slug) revalidatePath(`/personalize/${slug}`);
}

export async function savePersonalizationModelAction(formData: FormData) {
  const parsed = modelSchema.safeParse({
    id: formData.get('id') || undefined,
    title: formData.get('title'),
    slug: formData.get('slug'),
    subcategoryId: formData.get('subcategoryId') || '',
    mockImagePath: formData.get('mockImagePath') || undefined,
    boilerplateImagePath: formData.get('boilerplateImagePath') || undefined,
    status: formData.get('status') || 'draft',
    basePriceAmd: formData.get('basePriceAmd') ?? 25000,
    creditCost: formData.get('creditCost') || 0,
    productionNotes: formData.get('productionNotes') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid model.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const values = parsed.data;
  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'night-lights')
    .maybeSingle<{ id: string }>();
  if (!category) throw new Error('Night lights category is not configured.');
  const mockUpload = await uploadModelImage(
    supabase,
    user.id,
    getFile(formData, 'mockImageFile'),
    'mock',
  );
  const boilerplateUpload = await uploadModelImage(
    supabase,
    user.id,
    getFile(formData, 'boilerplateImageFile'),
    'boilerplate',
  );
  const payload = {
    category_id: category.id,
    subcategory_id: values.subcategoryId || null,
    title: values.title,
    slug: values.slug,
    mock_image_path: mockUpload ?? values.mockImagePath ?? null,
    boilerplate_image_path: boilerplateUpload ?? values.boilerplateImagePath ?? null,
    form_schema: {
      basePriceCents: values.basePriceAmd * 100,
      creditCost: values.creditCost,
      productionNotes: values.productionNotes ?? null,
    },
    status: values.status,
  };

  if (values.id) {
    const { error } = await supabase
      .from('personalization_models')
      .update(payload)
      .eq('id', values.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('personalization_models').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePersonalization(values.slug);
}

export async function savePersonalizationBoilerplateAction(formData: FormData) {
  const parsed = boilerplateSchema.safeParse({
    id: formData.get('id') || undefined,
    modelId: formData.get('modelId'),
    adminName: formData.get('adminName'),
    nameEn: formData.get('nameEn') || undefined,
    nameHy: formData.get('nameHy') || undefined,
    nameRu: formData.get('nameRu') || undefined,
    imagePath: formData.get('imagePath') || undefined,
    manufacturingProcess: formData.get('manufacturingProcess'),
    generationInstruction: formData.get('generationInstruction'),
    sortOrder: formData.get('sortOrder') || 0,
    generateHiddenSvg: formData.get('generateHiddenSvg') === 'on',
    isActive: formData.get('isActive') === 'on',
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid boilerplate.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const values = parsed.data;
  const newImageFile = getFile(formData, 'imageFile');

  let imagePath: string;
  let openaiFileId: string;
  let previousOpenaiFileId: string | null = null;

  if (newImageFile) {
    const ext = imageExtByMime[newImageFile.type];
    if (!ext) throw new Error('Upload PNG, JPG, WEBP, or SVG images only.');
    if (newImageFile.size > 10 * 1024 * 1024)
      throw new Error('Template images must be 10 MB or smaller.');

    // OpenAI upload happens first: if it fails, nothing is persisted.
    openaiFileId = await uploadReferenceImage(getOpenAiClient(), newImageFile);
    imagePath = await uploadToBucket(supabase, {
      bucket: 'catalog-assets',
      path: `${user.id}/personalization-models/boilerplate-${crypto.randomUUID()}.${ext}`,
      body: await newImageFile.arrayBuffer(),
      contentType: newImageFile.type,
    });

    if (values.id) {
      const { data: existing } = await supabase
        .from('personalization_boilerplates')
        .select('openai_file_id')
        .eq('id', values.id)
        .maybeSingle<{ openai_file_id: string }>();
      previousOpenaiFileId = existing?.openai_file_id ?? null;
    }
  } else if (!values.id) {
    throw new Error('Upload a boilerplate image.');
  } else {
    const { data: existing } = await supabase
      .from('personalization_boilerplates')
      .select('openai_file_id, image_path')
      .eq('id', values.id)
      .maybeSingle<{ openai_file_id: string; image_path: string }>();
    if (!existing) throw new Error('Boilerplate not found.');
    openaiFileId = existing.openai_file_id;
    imagePath = existing.image_path;
  }

  const payload = {
    model_id: values.modelId,
    admin_name: values.adminName,
    name_en: values.nameEn || null,
    name_hy: values.nameHy || null,
    name_ru: values.nameRu || null,
    image_path: imagePath,
    openai_file_id: openaiFileId,
    manufacturing_process: values.manufacturingProcess,
    generation_instruction: values.generationInstruction,
    sort_order: values.sortOrder,
    generate_hidden_svg: values.generateHiddenSvg,
    is_active: values.isActive,
  };

  const query = values.id
    ? supabase
        .from('personalization_boilerplates')
        .update(payload)
        .eq('id', values.id)
        .eq('model_id', values.modelId)
    : supabase.from('personalization_boilerplates').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);

  if (previousOpenaiFileId) await deleteReferenceFile(getOpenAiClient(), previousOpenaiFileId);

  const { data: model } = await supabase
    .from('personalization_models')
    .select('slug')
    .eq('id', values.modelId)
    .maybeSingle<{ slug: string }>();
  revalidatePersonalization(model?.slug);
}

export async function removePersonalizationBoilerplateAction(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), modelId: z.string().uuid() }).safeParse({
    id: formData.get('id'),
    modelId: formData.get('modelId'),
  });
  if (!parsed.success) throw new Error('Invalid boilerplate.');

  const { supabase } = await requireAdminPermission('catalog_manage');
  const { data: existing } = await supabase
    .from('personalization_boilerplates')
    .select('openai_file_id')
    .eq('id', parsed.data.id)
    .maybeSingle<{ openai_file_id: string }>();

  const { error } = await supabase
    .from('personalization_boilerplates')
    .delete()
    .eq('id', parsed.data.id);
  if (error) throw new Error(error.message);

  if (existing?.openai_file_id)
    await deleteReferenceFile(getOpenAiClient(), existing.openai_file_id);

  const { data: model } = await supabase
    .from('personalization_models')
    .select('slug')
    .eq('id', parsed.data.modelId)
    .maybeSingle<{ slug: string }>();
  revalidatePersonalization(model?.slug);
}
