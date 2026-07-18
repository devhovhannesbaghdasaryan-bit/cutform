import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/mcp/oauth-store', () => ({
  getOauthClient: vi.fn(),
  createAuthorizationCode: vi.fn(),
  MCP_OAUTH_SCOPE: 'catalog:write',
}));

import { hasAdminPermission } from '@/lib/admin';
import { createAuthorizationCode, getOauthClient } from '@/lib/mcp/oauth-store';
import { getCurrentUser } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/mcp/authorize/route';

const CLIENT = {
  clientId: 'client-1',
  clientName: 'Claude',
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
};

function authorizeUrl(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'client-1',
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: 'challenge-abc',
    code_challenge_method: 'S256',
    state: 'state-abc',
    scope: 'catalog:write',
    ...overrides,
  });
  return `https://uniqraft.test/api/mcp/authorize?${params.toString()}`;
}

describe('GET /api/mcp/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOauthClient).mockResolvedValue(CLIENT);
  });

  it('rejects an unknown client_id', async () => {
    vi.mocked(getOauthClient).mockResolvedValue(null);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(400);
  });

  it('rejects a redirect_uri not registered for the client', async () => {
    const res = await GET(
      new Request(authorizeUrl({ redirect_uri: 'https://evil.test/callback' })),
    );
    expect(res.status).toBe(400);
  });

  it('redirects to login when no user is signed in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/login?next=');
  });

  it('returns a plain not-authorized response for a non-admin user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(403);
  });

  it('shows a consent screen (200 html) for an authorized admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Claude');
  });
});

describe('POST /api/mcp/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOauthClient).mockResolvedValue(CLIENT);
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
  });

  function approvalForm(decision: 'approve' | 'deny') {
    const body = new URLSearchParams({
      decision,
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: 'challenge-abc',
      code_challenge_method: 'S256',
      state: 'state-abc',
      scope: 'catalog:write',
    });
    return new Request('https://uniqraft.test/api/mcp/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  it('mints a code and redirects back with it on approval', async () => {
    vi.mocked(createAuthorizationCode).mockResolvedValue('code-xyz');

    const res = await POST(approvalForm('approve'));

    expect(createAuthorizationCode).toHaveBeenCalledWith({
      clientId: 'client-1',
      userId: 'user-1',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      codeChallenge: 'challenge-abc',
      scope: 'catalog:write',
    });
    // Must be 303, not the NextResponse.redirect default of 307: a 307 tells
    // the browser to replay the original POST against the redirect target,
    // and claude.ai's callback only accepts GET (reproduced the "Method Not
    // Allowed" error clients hit after clicking Allow).
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.origin + location.pathname).toBe('https://claude.ai/api/mcp/auth_callback');
    expect(location.searchParams.get('code')).toBe('code-xyz');
    expect(location.searchParams.get('state')).toBe('state-abc');
  });

  it('mints the code for the session user even if a malicious form field tried to claim a different user_id', async () => {
    vi.mocked(createAuthorizationCode).mockResolvedValue('code-xyz');
    const body = new URLSearchParams({
      decision: 'approve',
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: 'challenge-abc',
      code_challenge_method: 'S256',
      state: 'state-abc',
      scope: 'catalog:write',
      user_id: 'attacker-controlled-id',
    });
    const req = new Request('https://uniqraft.test/api/mcp/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    await POST(req);

    expect(createAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('always mints the code with catalog:write, ignoring whatever scope the client requested (or omitted)', async () => {
    vi.mocked(createAuthorizationCode).mockResolvedValue('code-xyz');
    const body = new URLSearchParams({
      decision: 'approve',
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: 'challenge-abc',
      code_challenge_method: 'S256',
      state: 'state-abc',
      scope: 'openid profile',
    });
    const req = new Request('https://uniqraft.test/api/mcp/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    await POST(req);

    expect(createAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'catalog:write' }),
    );
  });

  it('mints catalog:write even when the client omits scope entirely', async () => {
    vi.mocked(createAuthorizationCode).mockResolvedValue('code-xyz');
    const body = new URLSearchParams({
      decision: 'approve',
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: 'challenge-abc',
      code_challenge_method: 'S256',
      state: 'state-abc',
    });
    const req = new Request('https://uniqraft.test/api/mcp/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    await POST(req);

    expect(createAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'catalog:write' }),
    );
  });

  it('rejects a code_challenge_method other than S256, without minting a code', async () => {
    const body = new URLSearchParams({
      decision: 'approve',
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: 'challenge-abc',
      code_challenge_method: 'plain',
      state: 'state-abc',
      scope: 'catalog:write',
    });
    const req = new Request('https://uniqraft.test/api/mcp/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(createAuthorizationCode).not.toHaveBeenCalled();
  });

  it('redirects back with access_denied on denial, without minting a code', async () => {
    const res = await POST(approvalForm('deny'));

    expect(createAuthorizationCode).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('state')).toBe('state-abc');
  });

  it('returns 403 instead of redirecting if the user is no longer an admin', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    const res = await POST(approvalForm('approve'));
    expect(res.status).toBe(403);
    expect(createAuthorizationCode).not.toHaveBeenCalled();
  });
});
