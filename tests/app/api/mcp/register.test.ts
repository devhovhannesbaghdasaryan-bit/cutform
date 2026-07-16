import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/oauth-store', () => ({ registerOauthClient: vi.fn() }));

import { registerOauthClient } from '@/lib/mcp/oauth-store';
import { POST } from '@/app/api/mcp/register/route';

describe('POST /api/mcp/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request with no redirect_uris', async () => {
    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({ client_name: 'Claude' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects an insecure redirect_uri', async () => {
    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({ client_name: 'Claude', redirect_uris: ['http://claude.ai/callback'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('registers a public client and returns the DCR response shape', async () => {
    vi.mocked(registerOauthClient).mockResolvedValue({
      clientId: 'client-1',
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    });

    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Claude',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({
      client_id: 'client-1',
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  });

  it('allows an http loopback redirect_uri for native clients', async () => {
    vi.mocked(registerOauthClient).mockResolvedValue({
      clientId: 'client-2',
      clientName: 'Claude Code',
      redirectUris: ['http://127.0.0.1:9876/callback'],
    });
    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Claude Code',
        redirect_uris: ['http://127.0.0.1:9876/callback'],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
