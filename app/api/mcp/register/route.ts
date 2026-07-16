export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerOauthClient } from '@/lib/mcp/oauth-store';

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'https:') return true;
    // Native/loopback clients (e.g. Claude Code) redirect to localhost over http.
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

const registerRequestSchema = z.object({
  client_name: z.string().trim().min(1),
  redirect_uris: z
    .array(z.string())
    .min(1)
    .refine((uris) => uris.every(isAllowedRedirectUri), {
      message: 'redirect_uris must be https, or http on localhost/127.0.0.1.',
    }),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const client = await registerOauthClient({
    clientName: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
  });

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    { status: 201 },
  );
}
