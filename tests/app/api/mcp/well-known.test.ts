import { describe, expect, it } from 'vitest';
import { GET } from '@/app/.well-known/oauth-authorization-server/route';

describe('GET /.well-known/oauth-authorization-server', () => {
  it('advertises the three OAuth endpoints and PKCE-only, public-client support', async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.authorization_endpoint).toContain('/api/mcp/authorize');
    expect(body.token_endpoint).toContain('/api/mcp/token');
    expect(body.registration_endpoint).toContain('/api/mcp/register');
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(body.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(body.scopes_supported).toEqual(['catalog:write']);
  });
});
