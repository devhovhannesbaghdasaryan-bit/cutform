import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { loadGeneratedProductionPacks } from '@/lib/production-pack/load';
import {
  notFoundResponse,
  productionPackDownloadResponse,
  techSheetHtmlResponse,
  UUID_PATTERN,
} from '@/lib/production-pack/responses';

export const dynamic = 'force-dynamic';

/**
 * Technical documentation for a generation before (or without) an order.
 * `?option=<id>` restricts it to one preview option; `?format=html` opens the
 * printable tech sheet of that option instead of downloading the zip.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const optionId = request.nextUrl.searchParams.get('option');
  if (!UUID_PATTERN.test(id) || (optionId && !UUID_PATTERN.test(optionId))) {
    return notFoundResponse();
  }
  const { supabase } = await requireAdmin();

  const packs = await loadGeneratedProductionPacks(supabase, id, {
    optionId: optionId ?? undefined,
  });
  if (!packs) return notFoundResponse('Generation not found.');
  if (!packs.length) return notFoundResponse('Preview option not found.');

  const adminUrl = new URL(`/admin/generated/${id}`, request.nextUrl.origin).toString();
  if (request.nextUrl.searchParams.get('format') === 'html') {
    return techSheetHtmlResponse(supabase, packs[0], { adminUrl });
  }
  const suffix = optionId ? packs[0].slug : 'production-pack';
  return productionPackDownloadResponse(supabase, packs, {
    fileName: `uniqraft-generation-${id.slice(0, 8)}-${suffix}.zip`,
    adminUrl,
  });
}
