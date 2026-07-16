import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/oauth-store', () => ({
  findAccessTokenContext: vi.fn(),
  MCP_OAUTH_SCOPE: 'catalog:write',
}));
vi.mock('@/lib/admin', () => ({
  hasAdminPermission: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  getServiceSupabase: vi.fn(() => 'fake-service-client'),
}));

import { hasAdminPermission } from '@/lib/admin';
import { findAccessTokenContext } from '@/lib/mcp/oauth-store';
import { verifyAccessToken } from '@/lib/mcp/verify-token';

const fakeRequest = new Request('https://example.test/api/mcp');

describe('verifyAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when no bearer token is given', async () => {
    expect(await verifyAccessToken(fakeRequest, undefined)).toBeUndefined();
    expect(findAccessTokenContext).not.toHaveBeenCalled();
  });

  it('returns undefined for an unknown/expired token', async () => {
    vi.mocked(findAccessTokenContext).mockResolvedValue(null);
    expect(await verifyAccessToken(fakeRequest, 'bad-token')).toBeUndefined();
  });

  it('returns undefined when the resolved user is no longer an admin with catalog_manage', async () => {
    vi.mocked(findAccessTokenContext).mockResolvedValue({
      userId: 'user-1',
      clientId: 'client-1',
      scope: 'catalog:write',
    });
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    expect(await verifyAccessToken(fakeRequest, 'good-token')).toBeUndefined();
    expect(hasAdminPermission).toHaveBeenCalledWith(
      'user-1',
      'catalog_manage',
      'fake-service-client',
    );
  });

  it('returns AuthInfo with the userId for a valid, authorized token', async () => {
    vi.mocked(findAccessTokenContext).mockResolvedValue({
      userId: 'user-1',
      clientId: 'client-1',
      scope: 'catalog:write',
    });
    vi.mocked(hasAdminPermission).mockResolvedValue(true);

    const result = await verifyAccessToken(fakeRequest, 'good-token');

    expect(result).toEqual({
      token: 'good-token',
      clientId: 'client-1',
      scopes: ['catalog:write'],
      extra: { userId: 'user-1' },
    });
  });
});
