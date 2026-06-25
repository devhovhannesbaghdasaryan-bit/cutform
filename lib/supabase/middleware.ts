import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getServerEnv } from '@/lib/env';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type AppLocale,
  getDefaultLocaleForRegion,
  isAppLocale,
  normalizeLocale,
} from '@/lib/i18n';

const PROTECTED_PREFIXES = ['/dashboard', '/create', '/products'];
const VERIFY_EMAIL_PATH = '/auth/verify-email';
const LOCALE_API_PATH = '/api/locale';

function getLocalePrefixedPath(path: string): { locale: AppLocale; routePath: string } | null {
  const [, maybeLocale, ...rest] = path.split('/');
  if (!isAppLocale(maybeLocale)) return null;

  const routePath = `/${rest.join('/')}`.replace(/\/$/, '') || '/';
  return {
    locale: maybeLocale,
    routePath,
  };
}

export async function updateSession(request: NextRequest) {
  const env = getServerEnv();
  const path = request.nextUrl.pathname;

  if (path === LOCALE_API_PATH) {
    return NextResponse.next({ request });
  }

  const localePrefixedPath = getLocalePrefixedPath(path);

  if (localePrefixedPath) {
    request.cookies.set(LOCALE_COOKIE, localePrefixedPath.locale);
  }

  const createBaseResponse = () => {
    if (!localePrefixedPath) return NextResponse.next({ request });

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = localePrefixedPath.routePath;
    return NextResponse.rewrite(rewriteUrl, { request });
  };

  let response = createBaseResponse();

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
          response = createBaseResponse();
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

  const routePath = localePrefixedPath?.routePath ?? path;
  const isProtected = PROTECTED_PREFIXES.some((p) => routePath.startsWith(p));
  const explicitLocale = normalizeLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  let activeLocale = localePrefixedPath?.locale ?? explicitLocale;

  if (!activeLocale && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_locale')
      .eq('user_id', user.id)
      .maybeSingle<{ preferred_locale: string | null }>();

    activeLocale = normalizeLocale(profile?.preferred_locale);
  }

  if (!activeLocale) {
    const regionCode = request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry');
    activeLocale = regionCode
      ? getDefaultLocaleForRegion(regionCode)
      : normalizeLocale(request.headers.get('accept-language')?.split(',')[0]) || DEFAULT_LOCALE;
  }

  response.cookies.set(LOCALE_COOKIE, activeLocale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  response.headers.set('x-snip-locale', activeLocale);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    url.searchParams.set('locale', activeLocale);
    return NextResponse.redirect(url);
  }

  if (
    user &&
    !user.email_confirmed_at &&
    isProtected &&
    routePath !== VERIFY_EMAIL_PATH
  ) {
    const url = request.nextUrl.clone();
    url.pathname = VERIFY_EMAIL_PATH;
    url.searchParams.set('locale', activeLocale);
    return NextResponse.redirect(url);
  }

  return response;
}
