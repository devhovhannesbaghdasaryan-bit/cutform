'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { deleteReferenceFile, uploadReferenceImage } from '@/lib/openai-files';
import { getOpenAiClient } from '@/lib/openai-client';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';

const imageExtByMime: Record<string, string> = {
  ...IMAGE_EXTENSION_BY_MIME,
  'image/svg+xml': 'svg',
};

const boilerplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required.'),
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

export async function saveBoilerplateAction(formData: FormData) {
  const parsed = boilerplateSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
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
      path: `${user.id}/personalization-boilerplates/${crypto.randomUUID()}.${ext}`,
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
    name: values.name,
    image_path: imagePath,
    openai_file_id: openaiFileId,
    manufacturing_process: values.manufacturingProcess,
    generation_instruction: values.generationInstruction,
    sort_order: values.sortOrder,
    generate_hidden_svg: values.generateHiddenSvg,
    is_active: values.isActive,
  };

  const query = values.id
    ? supabase.from('personalization_boilerplates').update(payload).eq('id', values.id)
    : supabase.from('personalization_boilerplates').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);

  if (previousOpenaiFileId) await deleteReferenceFile(getOpenAiClient(), previousOpenaiFileId);

  revalidatePath('/admin/personalization/boilerplates');
  revalidatePath('/admin/items');
}

export async function removeBoilerplateAction(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get('id') });
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

  if (existing?.openai_file_id) await deleteReferenceFile(getOpenAiClient(), existing.openai_file_id);

  revalidatePath('/admin/personalization/boilerplates');
  revalidatePath('/admin/items');
}
