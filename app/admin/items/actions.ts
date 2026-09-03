'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { actionError, actionSuccess, type ActionState, zodErrorToState } from '@/lib/action-state';
import { requireAdminPermission } from '@/lib/admin';
import { APP_LOCALES } from '@/lib/i18n';
import {
  createCatalogItemCore,
  type DeleteCatalogItemsResult,
  deleteCatalogItemsCore,
  updateCatalogItemCore,
} from '@/lib/catalog-items/core';
import { deleteSkillArtifact } from '@/lib/openai-skills';
import { getOpenAiClient } from '@/lib/openai-client';
import { applyItemSkillFields } from '@/lib/skill-files';
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

  let previousSkillFileId: string | null = null;
  try {
    previousSkillFileId = await applyItemSkillFields(
      getOpenAiClient,
      supabase,
      user.id,
      formData,
      item,
    );
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload skill file.');
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

  if (previousSkillFileId) {
    await deleteSkillArtifact(getOpenAiClient(), previousSkillFileId);
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

  let previousSkillFileId: string | null = null;
  try {
    previousSkillFileId = await applyItemSkillFields(
      getOpenAiClient,
      supabase,
      user.id,
      formData,
      item,
    );
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload skill file.');
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

  if (previousSkillFileId) {
    await deleteSkillArtifact(getOpenAiClient(), previousSkillFileId);
  }

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  revalidatePath(`/admin/items/${id}`);
  return actionSuccess(null);
}

const deleteItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, 'Select at least one item to delete.'),
});

function describeDeleteResult({ deleted, blocked }: DeleteCatalogItemsResult) {
  const deletedPart = `Deleted ${deleted} ${deleted === 1 ? 'item' : 'items'}.`;
  if (blocked.length === 0) return deletedPart;

  const names = blocked.map((item) => item.title).join(', ');
  const kept = `${blocked.length} ${blocked.length === 1 ? 'item is' : 'items are'} used in an order and ${blocked.length === 1 ? 'was' : 'were'} kept: ${names}.`;
  return `${deletedPart} ${kept}`;
}

/** Bulk hard-delete from the admin items table. Items used in an order are kept. */
export async function deleteCatalogItemsAction(
  _prev: ActionState<DeleteCatalogItemsResult>,
  formData: FormData,
): Promise<ActionState<DeleteCatalogItemsResult>> {
  const parsed = deleteItemsSchema.safeParse({ itemIds: formData.getAll('itemIds') });
  if (!parsed.success) return zodErrorToState(parsed.error);

  const { supabase } = await requireAdminPermission('catalog_manage');

  let result: DeleteCatalogItemsResult;
  try {
    result = await deleteCatalogItemsCore(supabase, parsed.data.itemIds);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to delete items.');
  }

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  return actionSuccess(result, describeDeleteResult(result));
}
