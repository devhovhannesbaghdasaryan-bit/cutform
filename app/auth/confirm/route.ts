import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { mergeSessionCartIntoUserCart } from '@/lib/cart';
import { clearCartSessionId, getCartSessionId } from '@/lib/cart-session';

const emailOtpTypes = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const satisfies readonly EmailOtpType[];

const confirmParamsSchema = z.object({
  tokenHash: z.string().min(1).nullable().catch(null),
  type: z.enum(emailOtpTypes).nullable().catch(null),
  // Same open-redirect guard as /auth/callback.
  next: z
    .string()
    .refine((value) => value.startsWith('/') && !value.startsWith('//'))
    .catch('/dashboard'),
});

/**
 * Email link target (`{{ .SiteURL }}/auth/confirm?token_hash=...&type=email`).
 * Verifies the token hash server-side, so the link works in any browser or
 * device — unlike the PKCE `?code=` flow, which needs the code verifier cookie
 * from the browser that signed up.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const { tokenHash, type, next } = confirmParamsSchema.parse({
    tokenHash: url.searchParams.get('token_hash'),
    type: url.searchParams.get('type'),
    next: url.searchParams.get('next'),
  });
  const origin = url.origin;

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const sessionId = await getCartSessionId();
  if (sessionId && data.user) {
    await mergeSessionCartIntoUserCart(getServiceSupabase(), sessionId, data.user.id);
    await clearCartSessionId();
  }

  return NextResponse.redirect(`${origin}${next}`);
}
