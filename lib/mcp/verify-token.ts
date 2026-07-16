import 'server-only';
import { hasAdminPermission } from '@/lib/admin';
import { findAccessTokenContext } from '@/lib/mcp/oauth-store';
import { getServiceSupabase } from '@/lib/supabase/server';

export interface AuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  extra: { userId: string };
}

/**
 * Verifier passed to mcp-handler's withMcpAuth. Re-checks catalog_manage
 * live (not just at token-issuance time) so demoting an admin's role cuts
 * off their connector on the very next call.
 */
export async function verifyAccessToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const context = await findAccessTokenContext(bearerToken);
  if (!context) return undefined;

  const allowed = await hasAdminPermission(context.userId, 'catalog_manage', getServiceSupabase());
  if (!allowed) return undefined;

  return {
    token: bearerToken,
    clientId: context.clientId,
    scopes: context.scope.split(' '),
    extra: { userId: context.userId },
  };
}
