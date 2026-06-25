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

const modelSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Title is required.'),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a URL-safe slug.'),
  categoryId: z.string().uuid('Choose a category.'),
  subcategoryId: z.union([z.string().uuid(), z.literal('')]),
  mockImagePath: z.string().trim().optional(),
  boilerplateImagePath: z.string().trim().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  basePriceCents: z.coerce.number().int().min(0),
  creditCost: z.coerce.number().int().min(0),
  productionNotes: z.string().trim().optional(),
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
  if (file.size > 10 * 1024 * 1024) throw new Error('Model images must be 10 MB or smaller.');

  const path = `${userId}/personalization-models/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('catalog-assets')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function savePersonalizationModelAction(formData: FormData) {
  const parsed = modelSchema.safeParse({
    id: formData.get('id') || undefined,
    title: formData.get('title'),
    slug: formData.get('slug'),
    categoryId: formData.get('categoryId'),
    subcategoryId: formData.get('subcategoryId') || '',
    mockImagePath: formData.get('mockImagePath') || undefined,
    boilerplateImagePath: formData.get('boilerplateImagePath') || undefined,
    status: formData.get('status') || 'draft',
    basePriceCents: formData.get('basePriceCents') || 0,
    creditCost: formData.get('creditCost') || 0,
    productionNotes: formData.get('productionNotes') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid model.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const values = parsed.data;
  const mockUpload = await uploadModelImage(supabase, user.id, getFile(formData, 'mockImageFile'), 'mock');
  const boilerplateUpload = await uploadModelImage(
    supabase,
    user.id,
    getFile(formData, 'boilerplateImageFile'),
    'boilerplate',
  );
  const payload = {
    category_id: values.categoryId,
    subcategory_id: values.subcategoryId || null,
    title: values.title,
    slug: values.slug,
    mock_image_path: mockUpload ?? values.mockImagePath ?? null,
    boilerplate_image_path: boilerplateUpload ?? values.boilerplateImagePath ?? null,
    form_schema: {
      basePriceCents: values.basePriceCents,
      creditCost: values.creditCost,
      productionNotes: values.productionNotes ?? null,
    },
    status: values.status,
  };

  if (values.id) {
    const { error } = await supabase.from('personalization_models').update(payload).eq('id', values.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('personalization_models').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/personalization-models');
  revalidatePath('/catalog/night-lights/personalized');
}
