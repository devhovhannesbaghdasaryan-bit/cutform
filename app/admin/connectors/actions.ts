'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { revokeConnectedApp } from '@/lib/mcp/oauth-store';
import { writeAdminAuditLog } from '@/lib/transactions';

const revokeSchema = z.object({ tokenId: z.string().min(1) });

export async function revokeConnectorAction(formData: FormData) {
  const parsed = revokeSchema.safeParse({ tokenId: formData.get('tokenId') });
  if (!parsed.success) throw new Error('Invalid connector.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');

  await revokeConnectedApp(supabase, user.id, parsed.data.tokenId);

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: 'admin_mcp_connector_revoked',
    entityType: 'mcp_oauth_token',
    entityId: parsed.data.tokenId,
    reason: 'Admin revoked a connected MCP app from /admin/connectors.',
  });

  revalidatePath('/admin/connectors');
}
