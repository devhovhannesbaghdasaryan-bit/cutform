import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { mergeSessionCartIntoUserCart } from '@/lib/cart';
import { clearCartSessionId, getCartSessionId } from '@/lib/cart-session';

const callbackParamsSchema = z.object({
  // Missing or empty code normalizes to null → the missing_code redirect.
  code: z.string().min(1).nullable().catch(null),
  // Open-redirect guard: `next` must be a local path ('/...', not '//...');
  // anything else (including absolute URLs) falls back to /dashboard.
  next: z
    .string()
    .refine((value) => value.startsWith('/') && !value.startsWith('//'))
    .catch('/dashboard'),
});

/**
 * Supabase email verification + OAuth redirect target.
 * Exchanges the `code` query param for a session, then sends the user
 * to /dashboard (or `?next=...` if provided).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const { code, next } = callbackParamsSchema.parse({
    code: url.searchParams.get('code'),
    next: url.searchParams.get('next'),
  });
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
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
