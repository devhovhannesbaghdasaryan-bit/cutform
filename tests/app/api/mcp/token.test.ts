import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/oauth-store', () => ({
  consumeAuthorizationCode: vi.fn(),
  issueTokenPair: vi.fn(),
  rotateRefreshToken: vi.fn(),
  MCP_OAUTH_SCOPE: 'catalog:write',
}));
vi.mock('@/lib/mcp/oauth-crypto', () => ({ verifyPkceChallenge: vi.fn() }));

import { verifyPkceChallenge } from '@/lib/mcp/oauth-crypto';
import {
  consumeAuthorizationCode,
  issueTokenPair,
  rotateRefreshToken,
} from '@/lib/mcp/oauth-store';
import { POST } from '@/app/api/mcp/token/route';

function formRequest(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new Request('https://example.test/api/mcp/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

describe('POST /api/mcp/token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown grant_type', async () => {
    const res = await POST(formRequest({ grant_type: 'password' }));
    expect(res.status).toBe(400);
  });

  it('exchanges a valid authorization_code + PKCE verifier for a token pair', async () => {
    vi.mocked(consumeAuthorizationCode).mockResolvedValue({
      userId: 'user-1',
      scope: 'catalog:write',
      codeChallenge: 'challenge-abc',
    });
    vi.mocked(verifyPkceChallenge).mockReturnValue(true);
    vi.mocked(issueTokenPair).mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresIn: 3600,
    });

    const res = await POST(
      formRequest({
        grant_type: 'authorization_code',
        code: 'code-1',
        redirect_uri: 'https://claude.ai/callback',
        client_id: 'client-1',
        code_verifier: 'verifier-1',
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      access_token: 'access-1',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-1',
      scope: 'catalog:write',
    });
  });

  it('rejects an authorization_code exchange with a bad PKCE verifier', async () => {
    vi.mocked(consumeAuthorizationCode).mockResolvedValue({
      userId: 'user-1',
      scope: 'catalog:write',
      codeChallenge: 'challenge-abc',
    });
    vi.mocked(verifyPkceChallenge).mockReturnValue(false);

    const res = await POST(
      formRequest({
        grant_type: 'authorization_code',
        code: 'code-1',
        redirect_uri: 'https://claude.ai/callback',
        client_id: 'client-1',
        code_verifier: 'wrong-verifier',
      }),
    );

    expect(res.status).toBe(400);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects an authorization_code exchange for an unknown/expired code', async () => {
    vi.mocked(consumeAuthorizationCode).mockResolvedValue(null);

    const res = await POST(
      formRequest({
        grant_type: 'authorization_code',
        code: 'bad-code',
        redirect_uri: 'https://claude.ai/callback',
        client_id: 'client-1',
        code_verifier: 'verifier-1',
      }),
    );

    expect(res.status).toBe(400);
  });

  it('exchanges a valid refresh_token for a new pair', async () => {
    vi.mocked(rotateRefreshToken).mockResolvedValue({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresIn: 3600,
      userId: 'user-1',
      scope: 'catalog:write',
      clientId: 'client-1',
    });

    const res = await POST(
      formRequest({ grant_type: 'refresh_token', refresh_token: 'refresh-1' }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.access_token).toBe('access-2');
    expect(body.refresh_token).toBe('refresh-2');
  });

  it('rejects an unknown/expired refresh_token', async () => {
    vi.mocked(rotateRefreshToken).mockResolvedValue(null);
    const res = await POST(formRequest({ grant_type: 'refresh_token', refresh_token: 'bad' }));
    expect(res.status).toBe(400);
  });
});
