'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { actionError, actionSuccess, type ActionState } from '@/lib/action-state';
import { requireAdminPermission } from '@/lib/admin';
import {
  attachCatalogMedia,
  type CatalogMediaUploadTicket,
  createCatalogMediaUploads,
  removeCatalogMedia,
  replaceCatalogMedia,
} from '@/lib/catalog-items/media';

// Instant gallery edits for an existing item. Files never pass through these
// actions: the browser uploads them to Storage with the tickets from
// prepareCatalogMediaUploadsAction, then reports the paths back.

const fileInfoSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().min(1),
  size: z.number().int().positive(),
});

const uploadedSchema = fileInfoSchema.extend({ path: z.string().min(1).max(512) });

function revalidateItem(itemId: string) {
  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  revalidatePath(`/admin/items/${itemId}`);
}

function failure(error: unknown, fallback: string) {
  return actionError(error instanceof Error ? error.message : fallback);
}

export async function prepareCatalogMediaUploadsAction(
  itemId: string,
  files: z.input<typeof fileInfoSchema>[],
): Promise<ActionState<CatalogMediaUploadTicket[]>> {
  const parsed = z
    .object({ itemId: z.uuid(), files: z.array(fileInfoSchema).min(1).max(20) })
    .safeParse({ itemId, files });
  if (!parsed.success) return actionError('Invalid upload request.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  try {
    const tickets = await createCatalogMediaUploads(
      supabase,
      user.id,
      parsed.data.itemId,
      parsed.data.files,
    );
    return actionSuccess(tickets);
  } catch (error) {
    return failure(error, 'Failed to prepare upload.');
  }
}

export async function attachCatalogMediaAction(
  itemId: string,
  uploads: z.input<typeof uploadedSchema>[],
): Promise<ActionState<null>> {
  const parsed = z
    .object({ itemId: z.uuid(), uploads: z.array(uploadedSchema).min(1).max(20) })
    .safeParse({ itemId, uploads });
  if (!parsed.success) return actionError('Invalid upload.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  try {
    await attachCatalogMedia(supabase, user.id, parsed.data.itemId, parsed.data.uploads);
  } catch (error) {
    return failure(error, 'Failed to add gallery media.');
  }

  revalidateItem(parsed.data.itemId);
  const count = parsed.data.uploads.length;
  return actionSuccess(null, `Added ${count} ${count === 1 ? 'file' : 'files'} to the gallery.`);
}

export async function replaceCatalogMediaAction(
  itemId: string,
  mediaId: string,
  upload: z.input<typeof uploadedSchema>,
): Promise<ActionState<null>> {
  const parsed = z
    .object({ itemId: z.uuid(), mediaId: z.uuid(), upload: uploadedSchema })
    .safeParse({ itemId, mediaId, upload });
  if (!parsed.success) return actionError('Invalid upload.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  try {
    await replaceCatalogMedia(
      supabase,
      user.id,
      parsed.data.itemId,
      parsed.data.mediaId,
      parsed.data.upload,
    );
  } catch (error) {
    return failure(error, 'Failed to replace gallery media.');
  }

  revalidateItem(parsed.data.itemId);
  return actionSuccess(null, 'Gallery media replaced.');
}

export async function removeCatalogMediaAction(
  itemId: string,
  mediaId: string,
): Promise<ActionState<null>> {
  const parsed = z.object({ itemId: z.uuid(), mediaId: z.uuid() }).safeParse({ itemId, mediaId });
  if (!parsed.success) return actionError('Invalid gallery media.');

  const { supabase } = await requireAdminPermission('catalog_manage');
  try {
    await removeCatalogMedia(supabase, parsed.data.itemId, parsed.data.mediaId);
  } catch (error) {
    return failure(error, 'Failed to remove gallery media.');
  }

  revalidateItem(parsed.data.itemId);
  return actionSuccess(null, 'Removed from the gallery.');
}
