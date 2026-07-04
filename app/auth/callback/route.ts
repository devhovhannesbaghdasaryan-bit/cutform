import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { mergeSessionCartIntoUserCart } from '@/lib/cart';
import { clearCartSessionId, getCartSessionId } from '@/lib/cart-session';

/**
 * Supabase email verification + OAuth redirect target.
 * Exchanges the `code` query param for a session, then sends the user
 * to /dashboard (or `?next=...` if provided).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';
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

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
