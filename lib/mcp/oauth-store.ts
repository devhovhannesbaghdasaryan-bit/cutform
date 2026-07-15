import 'server-only';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { getServiceSupabase } from '@/lib/supabase/server';
import { generateOpaqueToken, hashToken } from '@/lib/mcp/oauth-crypto';

export const MCP_OAUTH_SCOPE = 'catalog:write';

const AUTHORIZATION_CODE_TTL_MS = 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface McpOauthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
}

export async function registerOauthClient(input: {
  clientName: string;
  redirectUris: string[];
}): Promise<McpOauthClient> {
  const { data, error } = await getServiceSupabase()
    .from('mcp_oauth_clients')
    .insert({ client_name: input.clientName, redirect_uris: input.redirectUris })
    .select('client_id, client_name, redirect_uris')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to register client.');
  return { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris };
}

export async function getOauthClient(clientId: string): Promise<McpOauthClient | null> {
  const { data, error } = await getServiceSupabase()
    .from('mcp_oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris };
}

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}): Promise<string> {
  const code = generateOpaqueToken();
  const { error } = await getServiceSupabase()
    .from('mcp_oauth_authorization_codes')
    .insert({
      code_hash: hashToken(code),
      client_id: input.clientId,
      user_id: input.userId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      scope: input.scope,
      expires_at: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS).toISOString(),
    });
  if (error) throw new Error(error.message);
  return code;
}

export interface ConsumedAuthorizationCode {
  userId: string;
  scope: string;
  codeChallenge: string;
}

export async function consumeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
}): Promise<ConsumedAuthorizationCode | null> {
  const supabase = getServiceSupabase();
  const codeHash = hashToken(input.code);
  const { data, error } = await supabase
    .from('mcp_oauth_authorization_codes')
    .select('id, user_id, scope, code_challenge, client_id, redirect_uri, expires_at, used')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.used) return null;
  if (data.client_id !== input.clientId) return null;
  if (data.redirect_uri !== input.redirectUri) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  const { error: updateError } = await supabase
    .from('mcp_oauth_authorization_codes')
    .update({ used: true })
    .eq('id', data.id);
  if (updateError) throw new Error(updateError.message);

  return { userId: data.user_id, scope: data.scope, codeChallenge: data.code_challenge };
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueTokenPair(input: {
  clientId: string;
  userId: string;
  scope: string;
}): Promise<IssuedTokenPair> {
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();
  const now = Date.now();
  const { error } = await getServiceSupabase()
    .from('mcp_oauth_tokens')
    .insert({
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      client_id: input.clientId,
      user_id: input.userId,
      scope: input.scope,
      expires_at: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
      refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
    });
  if (error) throw new Error(error.message);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
}

export interface RotatedTokenPair extends IssuedTokenPair {
  userId: string;
  scope: string;
  clientId: string;
}

export async function rotateRefreshToken(refreshToken: string): Promise<RotatedTokenPair | null> {
  const supabase = getServiceSupabase();
  const refreshTokenHash = hashToken(refreshToken);
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('id, user_id, client_id, scope, refresh_expires_at, revoked_at')
    .eq('refresh_token_hash', refreshTokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) return null;
  if (new Date(data.refresh_expires_at).getTime() < Date.now()) return null;

  const { error: revokeError } = await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', data.id);
  if (revokeError) throw new Error(revokeError.message);

  const pair = await issueTokenPair({ clientId: data.client_id, userId: data.user_id, scope: data.scope });
  return { ...pair, userId: data.user_id, scope: data.scope, clientId: data.client_id };
}

export interface AccessTokenContext {
  userId: string;
  clientId: string;
  scope: string;
}

export async function findAccessTokenContext(accessToken: string): Promise<AccessTokenContext | null> {
  const supabase = getServiceSupabase();
  const accessTokenHash = hashToken(accessToken);
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('user_id, client_id, scope, expires_at, revoked_at')
    .eq('access_token_hash', accessTokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return { userId: data.user_id, clientId: data.client_id, scope: data.scope };
}

export interface ConnectedApp {
  tokenId: string;
  clientId: string;
  clientName: string;
  expiresAt: string;
  refreshExpiresAt: string;
}

/** Reads through the caller's own session (RLS-scoped to their own rows) — pass the cookie-bound client from requireAdmin(), not the service client. */
export async function listConnectedApps(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<ConnectedApp[]> {
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('id, client_id, expires_at, refresh_expires_at, mcp_oauth_clients(client_name)')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    tokenId: row.id,
    clientId: row.client_id,
    clientName: (row.mcp_oauth_clients as { client_name: string } | null)?.client_name ?? 'Unknown app',
    expiresAt: row.expires_at,
    refreshExpiresAt: row.refresh_expires_at,
  }));
}

/** Soft-revokes one of the caller's own token rows through their own session — see listConnectedApps. */
export async function revokeConnectedApp(
  supabase: TypedSupabaseClient,
  userId: string,
  tokenId: string,
): Promise<void> {
  const { error } = await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
