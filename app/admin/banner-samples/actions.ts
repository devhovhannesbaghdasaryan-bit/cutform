'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';

const imageExtByMime: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const bannerSampleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  prompt: z.string().trim().optional(),
  imagePath: z.string().trim().optional(),
  referencePaths: z.string().trim().optional(),
  sizePresetId: z.union([z.string().uuid(), z.literal('')]),
  materialAssumptions: z.string().trim().optional(),
  productionNotes: z.string().trim().optional(),
  status: z.enum(['draft', 'published', 'archived']),
});

const bannerGenerateSchema = z.object({
  prompt: z.string().trim().min(5, 'Prompt is required.'),
  sizePresetId: z.union([z.string().uuid(), z.literal('')]),
});

function getFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function parsePathList(value: string | undefined) {
  return value ? value.split(',').map((path) => path.trim()).filter(Boolean) : [];
}

async function uploadBannerAsset(
  supabase: Awaited<ReturnType<typeof requireAdminPermission>>['supabase'],
  userId: string,
  file: File | null,
  folder: string,
) {
  if (!file) return null;
  const ext = imageExtByMime[file.type];
  if (!ext) throw new Error('Upload PNG, JPG, WEBP, or SVG images only.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Banner assets must be 20 MB or smaller.');
  const path = `${userId}/banner-samples/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('banner-assets')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function uploadGeneratedBannerSvg(
  supabase: Awaited<ReturnType<typeof requireAdminPermission>>['supabase'],
  userId: string,
  prompt: string,
) {
  const safePrompt = prompt.replace(/[<>&]/g, '').slice(0, 120);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500"><rect width="1200" height="500" fill="#f8fafc"/><rect x="48" y="48" width="1104" height="404" rx="24" fill="#2563eb"/><text x="600" y="260" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${safePrompt}</text></svg>`;
  const path = `${userId}/banner-samples/generated/${crypto.randomUUID()}.svg`;
  const { error } = await supabase.storage
    .from('banner-assets')
    .upload(path, new TextEncoder().encode(svg), { contentType: 'image/svg+xml', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function saveBannerSampleAction(formData: FormData) {
  const parsed = bannerSampleSchema.safeParse({
    id: formData.get('id') || undefined,
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    prompt: formData.get('prompt') || undefined,
    imagePath: formData.get('imagePath') || undefined,
    referencePaths: formData.get('referencePaths') || undefined,
    sizePresetId: formData.get('sizePresetId') || '',
    materialAssumptions: formData.get('materialAssumptions') || undefined,
    productionNotes: formData.get('productionNotes') || undefined,
    status: formData.get('status') || 'draft',
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid banner sample.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const values = parsed.data;
  const uploadedImage = await uploadBannerAsset(supabase, user.id, getFile(formData, 'imageFile'), 'images');
  const uploadedReference = await uploadBannerAsset(supabase, user.id, getFile(formData, 'referenceFile'), 'references');
  const referencePaths = parsePathList(values.referencePaths);
  if (uploadedReference) referencePaths.push(uploadedReference);

  const payload = {
    title: values.title,
    description: values.description ?? null,
    prompt: values.prompt ?? null,
    image_path: uploadedImage ?? values.imagePath ?? '',
    reference_paths: referencePaths,
    size_preset_id: values.sizePresetId || null,
    material_assumptions: values.materialAssumptions ?? null,
    production_notes: values.productionNotes ?? null,
    status: values.status,
    created_by: user.id,
  };

  if (!payload.image_path) throw new Error('Banner image is required.');

  if (values.id) {
    const { error } = await supabase.from('banner_samples').update(payload).eq('id', values.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('banner_samples').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/banner-samples');
  revalidatePath('/banners');
}

export async function generateBannerSampleDraftAction(formData: FormData) {
  const parsed = bannerGenerateSchema.safeParse({
    prompt: formData.get('prompt'),
    sizePresetId: formData.get('sizePresetId') || '',
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid banner prompt.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const reference = await uploadBannerAsset(supabase, user.id, getFile(formData, 'referenceFile'), 'references');
  const imagePath = await uploadGeneratedBannerSvg(supabase, user.id, parsed.data.prompt);
  const { error } = await supabase.from('banner_samples').insert({
    title: parsed.data.prompt.slice(0, 70),
    description: 'Generated draft sample for admin review.',
    prompt: parsed.data.prompt,
    image_path: imagePath,
    reference_paths: reference ? [reference] : [],
    size_preset_id: parsed.data.sizePresetId || null,
    status: 'draft',
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/banner-samples');
}
