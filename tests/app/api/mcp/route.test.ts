import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/verify-token', () => ({ verifyAccessToken: vi.fn() }));

import { verifyAccessToken } from '@/lib/mcp/verify-token';
import { POST } from '@/app/api/mcp/route';

function mcpRequest(headers: Record<string, string> = {}) {
  return new Request('https://uniqraft.test/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
  });
}

describe('POST /api/mcp', () => {
  it('rejects an unauthenticated request with 401, not 404 — proves the request reaches withMcpAuth', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(undefined);

    const res = await POST(mcpRequest());

    expect(res.status).toBe(401);
  });

  it('is reachable at this route file\'s actual Next.js mount path for an authenticated request — regression test for a createMcpHandler basePath/mount-point mismatch that previously made every call 404 even after passing auth', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      token: 'test-token',
      clientId: 'client-1',
      scopes: ['catalog:write'],
      extra: { userId: 'user-1' },
    });

    const res = await POST(mcpRequest({ Authorization: 'Bearer test-token' }));

    expect(res.status).not.toBe(404);
  });
});
