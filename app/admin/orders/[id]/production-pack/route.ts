import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { loadOrderProductionPacks } from '@/lib/production-pack/load';
import {
  notFoundResponse,
  productionPackDownloadResponse,
  UUID_PATTERN,
} from '@/lib/production-pack/responses';

export const dynamic = 'force-dynamic';

/** Downloads the production packs of every item in the order as one zip, one folder per item. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notFoundResponse();
  const { supabase } = await requireAdmin();

  const packs = await loadOrderProductionPacks(supabase, id);
  if (!packs) return notFoundResponse('Order not found.');
  if (!packs.length) return notFoundResponse('The order has no items.');

  return productionPackDownloadResponse(supabase, packs, {
    fileName: `uniqraft-order-${id.slice(0, 8)}-production-pack.zip`,
    adminUrl: new URL(`/admin/orders/${id}`, request.nextUrl.origin).toString(),
  });
}
