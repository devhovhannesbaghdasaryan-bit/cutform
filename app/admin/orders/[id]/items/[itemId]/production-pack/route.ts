import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { loadOrderProductionPacks } from '@/lib/production-pack/load';
import {
  notFoundResponse,
  productionPackDownloadResponse,
  techSheetHtmlResponse,
  UUID_PATTERN,
} from '@/lib/production-pack/responses';

export const dynamic = 'force-dynamic';

/**
 * Technical documentation for one ordered item: `?format=html` opens the
 * printable tech sheet, anything else downloads the full production pack
 * (sheet + production files) as a zip.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(itemId)) return notFoundResponse();
  const { supabase } = await requireAdmin();

  const packs = await loadOrderProductionPacks(supabase, id, { orderItemId: itemId });
  const pack = packs?.[0];
  if (!pack) return notFoundResponse('Order item not found.');

  const adminUrl = new URL(`/admin/orders/${id}`, request.nextUrl.origin).toString();
  if (request.nextUrl.searchParams.get('format') === 'html') {
    return techSheetHtmlResponse(supabase, pack, { adminUrl });
  }
  return productionPackDownloadResponse(supabase, [pack], {
    fileName: `uniqraft-order-${id.slice(0, 8)}-${pack.slug}.zip`,
    adminUrl,
  });
}
