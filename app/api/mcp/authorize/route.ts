export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { hasAdminPermission } from '@/lib/admin';
import { createAuthorizationCode, getOauthClient, MCP_OAUTH_SCOPE } from '@/lib/mcp/oauth-store';
import { getCurrentUser } from '@/lib/supabase/server';

interface AuthorizeParams {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
}

function readParams(source: URLSearchParams): AuthorizeParams {
  return {
    responseType: source.get('response_type') ?? '',
    clientId: source.get('client_id') ?? '',
    redirectUri: source.get('redirect_uri') ?? '',
    codeChallenge: source.get('code_challenge') ?? '',
    codeChallengeMethod: source.get('code_challenge_method') ?? '',
    state: source.get('state') ?? '',
    scope: source.get('scope') ?? '',
  };
}

function badRequest(message: string) {
  return NextResponse.json(
    { error: 'invalid_request', error_description: message },
    { status: 400 },
  );
}

function notAuthorizedResponse() {
  return new Response(
    '<!doctype html><html><body><h1>Not authorized</h1><p>Your Uniqraft account does not have catalog management access.</p></body></html>',
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function consentHtml(clientName: string, params: AuthorizeParams) {
  const hiddenFields = Object.entries({
    response_type: params.responseType,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    state: params.state,
    scope: params.scope,
  })
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join('\n');

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Connect ${escapeHtml(clientName)} to Uniqraft</title></head>
<body style="font-family: sans-serif; max-width: 32rem; margin: 4rem auto;">
  <h1>Connect ${escapeHtml(clientName)}</h1>
  <p><strong>${escapeHtml(clientName)}</strong> wants to create and edit catalog items as you.</p>
  <form method="POST">
    ${hiddenFields}
    <button type="submit" name="decision" value="approve">Allow</button>
    <button type="submit" name="decision" value="deny">Deny</button>
  </form>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

async function resolveAuthorizedUser(
  request: Request,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(request.url);
    return {
      ok: false,
      response: NextResponse.redirect(new URL(`/login?next=${next}`, request.url), 303),
    };
  }
  const allowed = await hasAdminPermission(user.id, 'catalog_manage');
  if (!allowed) return { ok: false, response: notAuthorizedResponse() };
  return { ok: true, userId: user.id };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = readParams(url.searchParams);

  if (params.responseType !== 'code') return badRequest('response_type must be "code".');
  if (params.codeChallengeMethod !== 'S256')
    return badRequest('code_challenge_method must be "S256".');

  const client = await getOauthClient(params.clientId);
  if (!client) return badRequest('Unknown client_id.');
  if (!client.redirectUris.includes(params.redirectUri)) {
    return badRequest('redirect_uri is not registered for this client.');
  }

  const resolved = await resolveAuthorizedUser(request);
  if (!resolved.ok) return resolved.response;

  return new Response(consentHtml(client.clientName, params), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = readParams(new URLSearchParams(form as unknown as Record<string, string>));
  const decision = String(form.get('decision') ?? '');

  if (params.responseType !== 'code') return badRequest('response_type must be "code".');
  if (params.codeChallengeMethod !== 'S256')
    return badRequest('code_challenge_method must be "S256".');

  const client = await getOauthClient(params.clientId);
  if (!client?.redirectUris.includes(params.redirectUri)) {
    return badRequest('Unknown client or redirect_uri.');
  }

  const resolved = await resolveAuthorizedUser(request);
  if (!resolved.ok) return resolved.response;

  const redirectUrl = new URL(params.redirectUri);
  if (decision !== 'approve') {
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('state', params.state);
    return NextResponse.redirect(redirectUrl, 303);
  }

  const code = await createAuthorizationCode({
    clientId: params.clientId,
    userId: resolved.userId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    // This server supports exactly one scope. Grant it unconditionally
    // rather than trusting whatever the client requested (or omitted) —
    // otherwise a client that doesn't echo `catalog:write` exactly would
    // complete the OAuth dance successfully and then get 403 on every
    // subsequent tool call, with nothing in the flow surfacing why.
    scope: MCP_OAUTH_SCOPE,
  });

  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', params.state);
  return NextResponse.redirect(redirectUrl, 303);
}
