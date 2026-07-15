'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { requireAdminPermission } from '@/lib/admin';
import { APP_LOCALES } from '@/lib/i18n';
import { createCatalogItemCore, updateCatalogItemCore } from '@/lib/catalog-items/core';
import {
  type AdminSupabase,
  getOptionalFile,
  type itemSchema,
  parseItemForm,
  uploadAdminCatalogAsset,
} from './item-form-parsing';

async function uploadCatalogFormAssets(
  supabase: AdminSupabase,
  userId: string,
  formData: FormData,
  item: z.infer<typeof itemSchema>,
) {
  const thumbnailPath = await uploadAdminCatalogAsset(
    supabase,
    userId,
    getOptionalFile(formData, 'thumbnailFile'),
    'thumbnails',
  );

  for (const locale of APP_LOCALES) {
    const socialImagePath = await uploadAdminCatalogAsset(
      supabase,
      userId,
      getOptionalFile(formData, `socialImageFile_${locale}`),
      `seo/${locale}`,
    );
    if (socialImagePath) item.seo[locale].socialImagePath = socialImagePath;
  }

  return { thumbnailPath };
}

export async function createCatalogItemAction(
  _prev: ActionState<null>,
  formData: FormData,
): Promise<ActionState<null>> {
  const parsed = parseItemForm(formData);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'Invalid item.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const item = parsed.data;

  let uploadedAssets: { thumbnailPath: string | null };
  try {
    uploadedAssets = await uploadCatalogFormAssets(supabase, user.id, formData, item);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload catalog assets.');
  }

  let created: { id: string; slug: string };
  try {
    created = await createCatalogItemCore(
      supabase,
      user,
      item,
      uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
      formData,
    );
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to create item.');
  }

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  redirect(`/admin/items/${created.id}`);
}

export async function updateCatalogItemAction(
  _prev: ActionState<null>,
  formData: FormData,
): Promise<ActionState<null>> {
  const id = String(formData.get('id') ?? '');
  const idParse = z.uuid().safeParse(id);
  if (!idParse.success) return actionError('Invalid item id.');

  const parsed = parseItemForm(formData);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'Invalid item.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const item = parsed.data;

  let uploadedAssets: { thumbnailPath: string | null };
  try {
    uploadedAssets = await uploadCatalogFormAssets(supabase, user.id, formData, item);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload catalog assets.');
  }

  try {
    await updateCatalogItemCore(
      supabase,
      id,
      user,
      item,
      uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
      formData,
    );
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to update item.');
  }

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  revalidatePath(`/admin/items/${id}`);
  return actionSuccess(null);
}
