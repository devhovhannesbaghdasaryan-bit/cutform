export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { MCP_OAUTH_SCOPE } from '@/lib/mcp/oauth-store';

export async function GET() {
  const baseUrl = getServerEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return NextResponse.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
    token_endpoint: `${baseUrl}/api/mcp/token`,
    registration_endpoint: `${baseUrl}/api/mcp/register`,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    scopes_supported: [MCP_OAUTH_SCOPE],
  });
}
