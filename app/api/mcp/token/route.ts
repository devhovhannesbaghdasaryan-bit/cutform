export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { verifyPkceChallenge } from '@/lib/mcp/oauth-crypto';
import {
  consumeAuthorizationCode,
  issueTokenPair,
  rotateRefreshToken,
} from '@/lib/mcp/oauth-store';

function tokenResponse(
  pair: { accessToken: string; refreshToken: string; expiresIn: number },
  scope: string,
) {
  return NextResponse.json({
    access_token: pair.accessToken,
    token_type: 'Bearer',
    expires_in: pair.expiresIn,
    refresh_token: pair.refreshToken,
    scope,
  });
}

function errorResponse(error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const grantType = String(form.get('grant_type') ?? '');

  if (grantType === 'authorization_code') {
    const code = String(form.get('code') ?? '');
    const redirectUri = String(form.get('redirect_uri') ?? '');
    const clientId = String(form.get('client_id') ?? '');
    const codeVerifier = String(form.get('code_verifier') ?? '');

    const consumed = await consumeAuthorizationCode({ code, clientId, redirectUri });
    if (!consumed) return errorResponse('invalid_grant', 'Unknown, expired, or already-used code.');
    if (!verifyPkceChallenge(codeVerifier, consumed.codeChallenge)) {
      return errorResponse('invalid_grant', 'PKCE verification failed.');
    }

    const pair = await issueTokenPair({ clientId, userId: consumed.userId, scope: consumed.scope });
    return tokenResponse(pair, consumed.scope);
  }

  if (grantType === 'refresh_token') {
    const refreshToken = String(form.get('refresh_token') ?? '');
    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated)
      return errorResponse('invalid_grant', 'Unknown, expired, or revoked refresh token.');
    return tokenResponse(rotated, rotated.scope);
  }

  return errorResponse('unsupported_grant_type', `Unsupported grant_type: ${grantType}`);
}
