import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getServerEnv } from '@/lib/env';

const PROTECTED_PREFIXES = ['/dashboard', '/create', '/products'];
const VERIFY_EMAIL_PATH = '/auth/verify-email';

export async function updateSession(request: NextRequest) {
  const env = getServerEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (
    user &&
    !user.email_confirmed_at &&
    isProtected &&
    path !== VERIFY_EMAIL_PATH
  ) {
    const url = request.nextUrl.clone();
    url.pathname = VERIFY_EMAIL_PATH;
    return NextResponse.redirect(url);
  }

  return response;
}
