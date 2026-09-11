import 'server-only';
import {
  type AdminSupabase,
  CATALOG_ASSET_EXTENSIONS,
  CATALOG_ASSET_MAX_BYTES,
  catalogItemMediaFolder,
} from '@/app/admin/items/item-form-parsing';
import { getCatalogMediaKind } from '@/lib/catalog-media';

const BUCKET = 'catalog-assets';
const UNSUPPORTED_FILE = 'Upload PNG, JPG, WEBP, SVG, MP4, or WEBM files only.';

export interface CatalogMediaFileInfo {
  name: string;
  type: string;
  size: number;
}

/** A file the browser has already uploaded to a path handed out by createCatalogMediaUploads. */
export interface UploadedCatalogMedia extends CatalogMediaFileInfo {
  path: string;
}

export interface CatalogMediaUploadTicket {
  path: string;
  token: string;
}

function assertSupportedFile(file: CatalogMediaFileInfo) {
  if (!CATALOG_ASSET_EXTENSIONS[file.type] || !getCatalogMediaKind(file.type)) {
    throw new Error(UNSUPPORTED_FILE);
  }
  if (file.size <= 0 || file.size > CATALOG_ASSET_MAX_BYTES) {
    throw new Error('Catalog media must be 50 MB or smaller.');
  }
}

/**
 * Only paths this module minted for this admin and item are accepted back, so
 * a client cannot attach an arbitrary object from the bucket to an item.
 */
function toMediaFileFields(userId: string, catalogItemId: string, upload: UploadedCatalogMedia) {
  assertSupportedFile(upload);
  const folder = `${userId}/${catalogItemMediaFolder(catalogItemId)}/`;
  const fileName = upload.path.startsWith(folder) ? upload.path.slice(folder.length) : '';
  const extension = CATALOG_ASSET_EXTENSIONS[upload.type];
  if (!new RegExp(`^[0-9a-f-]{36}\\.${extension}$`).test(fileName)) {
    throw new Error('Invalid upload path.');
  }

  return {
    media_type: getCatalogMediaKind(upload.type) as 'image' | 'video',
    storage_path: upload.path,
    metadata: {
      originalFileName: upload.name,
      contentType: upload.type,
      size: upload.size,
    },
  };
}

/**
 * Signed upload URLs let the browser send files straight to Storage, so
 * gallery uploads are not capped by the Server Action / proxy body limits
 * (22 MB / 10 MB) — only by the bucket's own 50 MB limit.
 */
export async function createCatalogMediaUploads(
  supabase: AdminSupabase,
  userId: string,
  catalogItemId: string,
  files: CatalogMediaFileInfo[],
): Promise<CatalogMediaUploadTicket[]> {
  for (const file of files) assertSupportedFile(file);

  return Promise.all(
    files.map(async (file) => {
      const path = `${userId}/${catalogItemMediaFolder(catalogItemId)}/${crypto.randomUUID()}.${CATALOG_ASSET_EXTENSIONS[file.type]}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new Error(error?.message ?? 'Failed to prepare upload.');
      return { path, token: data.token };
    }),
  );
}

/** Makes the first media the primary one when none is, e.g. after the primary was removed. */
export async function ensureCatalogItemPrimaryMedia(
  supabase: AdminSupabase,
  catalogItemId: string,
) {
  const { data, error } = await supabase
    .from('catalog_item_media')
    .select('id, is_primary')
    .eq('catalog_item_id', catalogItemId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<{ id: string; is_primary: boolean }[]>();
  if (error) throw new Error(error.message);
  if (!data?.length || data.some((media) => media.is_primary)) return;

  const { error: primaryError } = await supabase
    .from('catalog_item_media')
    .update({ is_primary: true })
    .eq('id', data[0].id)
    .eq('catalog_item_id', catalogItemId);
  if (primaryError) throw new Error(primaryError.message);
}

/** Appends uploaded files to the end of the item's gallery. */
export async function attachCatalogMedia(
  supabase: AdminSupabase,
  userId: string,
  catalogItemId: string,
  uploads: UploadedCatalogMedia[],
) {
  if (uploads.length === 0) return;
  const fields = uploads.map((upload) => toMediaFileFields(userId, catalogItemId, upload));

  const { data: last, error: lastError } = await supabase
    .from('catalog_item_media')
    .select('sort_order')
    .eq('catalog_item_id', catalogItemId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  if (lastError) throw new Error(lastError.message);

  const firstSortOrder = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase.from('catalog_item_media').insert(
    fields.map((field, index) => ({
      ...field,
      catalog_item_id: catalogItemId,
      alt_text: uploads[index].name.replace(/\.[^.]+$/, '').slice(0, 120) || null,
      sort_order: firstSortOrder + index,
      is_primary: false,
      created_by: userId,
    })),
  );
  if (error) throw new Error(error.message);

  await ensureCatalogItemPrimaryMedia(supabase, catalogItemId);
}

/**
 * Swaps the file under an existing media row, keeping its id, order, alt text
 * and primary flag. The old object stays in the bucket: its path may still be
 * referenced elsewhere (the item thumbnail, cart/order snapshots).
 */
export async function replaceCatalogMedia(
  supabase: AdminSupabase,
  userId: string,
  catalogItemId: string,
  mediaId: string,
  upload: UploadedCatalogMedia,
) {
  const { data, error } = await supabase
    .from('catalog_item_media')
    .update({ ...toMediaFileFields(userId, catalogItemId, upload), poster_path: null })
    .eq('id', mediaId)
    .eq('catalog_item_id', catalogItemId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Gallery media not found.');
}

/** Removes a media row from the gallery. The stored file is kept, as in replaceCatalogMedia. */
export async function removeCatalogMedia(
  supabase: AdminSupabase,
  catalogItemId: string,
  mediaId: string,
) {
  const { data, error } = await supabase
    .from('catalog_item_media')
    .delete()
    .eq('id', mediaId)
    .eq('catalog_item_id', catalogItemId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Gallery media not found.');

  await ensureCatalogItemPrimaryMedia(supabase, catalogItemId);
}
