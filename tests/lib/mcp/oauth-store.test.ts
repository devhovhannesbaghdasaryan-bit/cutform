import { beforeEach, describe, expect, it, vi } from 'vitest';

const tables: Record<string, unknown[]> = {};

function resetTables() {
  tables.mcp_oauth_clients = [];
  tables.mcp_oauth_authorization_codes = [];
  tables.mcp_oauth_tokens = [];
}

function makeQuery(tableName: string) {
  const rows = () => tables[tableName] as Record<string, unknown>[];
  const state: { filters: Array<(row: Record<string, unknown>) => boolean> } = { filters: [] };
  const query = {
    insert(values: Record<string, unknown>) {
      const row = { id: crypto.randomUUID(), client_id: crypto.randomUUID(), ...values };
      rows().push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    },
    select() {
      return query;
    },
    eq(column: string, value: unknown) {
      state.filters.push((row) => row[column] === value);
      return query;
    },
    update(values: Record<string, unknown>) {
      return {
        eq: async (column: string, value: unknown) => {
          const match = rows().find((row) => row[column] === value);
          if (match) Object.assign(match, values);
          return { error: null };
        },
      };
    },
    async maybeSingle() {
      const match = rows().find((row) => state.filters.every((f) => f(row)));
      return { data: match ?? null, error: null };
    },
  };
  return query;
}

vi.mock('@/lib/supabase/server', () => ({
  getServiceSupabase: () => ({
    from: (tableName: string) => makeQuery(tableName),
  }),
}));

import {
  MCP_OAUTH_SCOPE,
  consumeAuthorizationCode,
  createAuthorizationCode,
  findAccessTokenContext,
  issueTokenPair,
  registerOauthClient,
  rotateRefreshToken,
} from '@/lib/mcp/oauth-store';

describe('oauth-store', () => {
  beforeEach(() => {
    resetTables();
  });

  it('registers a client and returns its id', async () => {
    const client = await registerOauthClient({
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    });
    expect(client.clientName).toBe('Claude');
    expect(client.clientId).toBeTruthy();
  });

  it('round-trips an authorization code: create then consume', async () => {
    const code = await createAuthorizationCode({
      clientId: 'client-1',
      userId: 'user-1',
      redirectUri: 'https://claude.ai/callback',
      codeChallenge: 'challenge-abc',
      scope: MCP_OAUTH_SCOPE,
    });

    const consumed = await consumeAuthorizationCode({
      code,
      clientId: 'client-1',
      redirectUri: 'https://claude.ai/callback',
    });

    expect(consumed).toEqual({ userId: 'user-1', scope: MCP_OAUTH_SCOPE, codeChallenge: 'challenge-abc' });
  });

  it('refuses to consume the same code twice', async () => {
    const code = await createAuthorizationCode({
      clientId: 'client-1',
      userId: 'user-1',
      redirectUri: 'https://claude.ai/callback',
      codeChallenge: 'challenge-abc',
      scope: MCP_OAUTH_SCOPE,
    });

    await consumeAuthorizationCode({ code, clientId: 'client-1', redirectUri: 'https://claude.ai/callback' });
    const second = await consumeAuthorizationCode({
      code,
      clientId: 'client-1',
      redirectUri: 'https://claude.ai/callback',
    });

    expect(second).toBeNull();
  });

  it('refuses to consume a code for the wrong client', async () => {
    const code = await createAuthorizationCode({
      clientId: 'client-1',
      userId: 'user-1',
      redirectUri: 'https://claude.ai/callback',
      codeChallenge: 'challenge-abc',
      scope: MCP_OAUTH_SCOPE,
    });

    const consumed = await consumeAuthorizationCode({
      code,
      clientId: 'client-attacker',
      redirectUri: 'https://claude.ai/callback',
    });

    expect(consumed).toBeNull();
  });

  it('issues a token pair and finds the access token context', async () => {
    const pair = await issueTokenPair({ clientId: 'client-1', userId: 'user-1', scope: MCP_OAUTH_SCOPE });
    expect(pair.expiresIn).toBeGreaterThan(0);

    const context = await findAccessTokenContext(pair.accessToken);
    expect(context).toEqual({ userId: 'user-1', clientId: 'client-1', scope: MCP_OAUTH_SCOPE });
  });

  it('returns null for an unknown access token', async () => {
    expect(await findAccessTokenContext('not-a-real-token')).toBeNull();
  });

  it('rotates a refresh token into a new pair and revokes the old one', async () => {
    const pair = await issueTokenPair({ clientId: 'client-1', userId: 'user-1', scope: MCP_OAUTH_SCOPE });
    const rotated = await rotateRefreshToken(pair.refreshToken);

    expect(rotated?.userId).toBe('user-1');
    expect(rotated?.accessToken).not.toBe(pair.accessToken);
    expect(await findAccessTokenContext(pair.accessToken)).not.toBeNull();
    // Old access token still resolves (only the refresh token was consumed);
    // the old row's revoked_at is set, so a *second* rotation of the same
    // refresh token must fail.
    expect(await rotateRefreshToken(pair.refreshToken)).toBeNull();
  });
});
