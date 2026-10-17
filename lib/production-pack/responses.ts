import 'server-only';

import { NextResponse } from 'next/server';
import type { ProductionPack } from '@/lib/production-pack/load';
import { renderTechSheetHtml } from '@/lib/production-pack/render-html';
import { buildProductionPackZip } from '@/lib/production-pack/zip';
import type { TypedSupabaseClient } from '@/lib/supabase/types';

type StorageClient = Pick<TypedSupabaseClient, 'storage'>;

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const STREAM_CHUNK_BYTES = 64 * 1024;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function notFoundResponse(message = 'Not found.') {
  return new NextResponse(message, { status: 404, headers: { 'Content-Type': 'text/plain' } });
}

/**
 * The tech sheet as a standalone page for printing. Production files are
 * linked through short-lived signed URLs, so the page works without the zip.
 */
export async function techSheetHtmlResponse(
  supabase: StorageClient,
  pack: ProductionPack,
  options: { adminUrl: string | null },
) {
  const hrefs = new Map<string, string>();
  await Promise.all(
    pack.sheet.files.map(async (file) => {
      if (!file.bucket || !file.storagePath) return;
      const { data } = await supabase.storage
        .from(file.bucket)
        .createSignedUrl(file.storagePath, SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) hrefs.set(file.fileName, data.signedUrl);
    }),
  );
  const html = renderTechSheetHtml(pack.sheet, {
    fileHref: (file) => hrefs.get(file.fileName) ?? null,
    adminUrl: options.adminUrl,
  });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}

/** Chunked body, so the platform streams the zip instead of buffering it against its response size limit. */
function toStream(bytes: Uint8Array) {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + STREAM_CHUNK_BYTES));
      offset += STREAM_CHUNK_BYTES;
    },
  });
}

export interface ProductionPackDownloadOptions {
  /** Download file name, e.g. `uniqraft-order-1a2b3c4d-item-1.zip`. */
  fileName: string;
  adminUrl: string | null;
}

/**
 * Builds the zip and streams it as an attachment. Nothing is written to
 * storage: the pack is rebuilt from the live data on every download, so it
 * always reflects the current production files.
 */
export async function productionPackDownloadResponse(
  supabase: StorageClient,
  packs: ProductionPack[],
  options: ProductionPackDownloadOptions,
) {
  const { bytes } = await buildProductionPackZip(supabase, packs, { adminUrl: options.adminUrl });
  const fileName = options.fileName.replace(/[^A-Za-z0-9._-]+/g, '-');
  return new NextResponse(toStream(bytes), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
    },
  });
}
