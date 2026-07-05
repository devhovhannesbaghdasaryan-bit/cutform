import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getServerEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type AppLocale,
  getDefaultLocaleForRegion,
  isAppLocale,
  normalizeLocale,
} from '@/lib/i18n-config';

const PROTECTED_PREFIXES = ['/dashboard', '/products'];
const VERIFY_EMAIL_PATH = '/auth/verify-email';
const LOCALE_API_PATH = '/api/locale';

// INTENTIONAL: /en /ru /am URL prefixes are crawler-facing SEO URLs. They are
// rewritten (not redirected) to the unprefixed routes so each locale has a
// stable canonical URL (see lib/seo.ts and app/sitemap.ts). Keep this scheme.
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

  // Response cookies queued so far. Rebuilding the response (required after
  // mutating the forwarded request) replays them, so Supabase auth cookies
  // and the locale cookie survive each rebuild.
  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];
  const buildResponse = () => {
    const r = createBaseResponse();
    for (const c of pendingCookies) r.cookies.set(c.name, c.value, c.options);
    return r;
  };

  let response = buildResponse();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            pendingCookies.push({ name, value, options });
          }
          response = buildResponse();
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

  // Set the resolved locale on the forwarded request so getRequestLocale()
  // sees it on the FIRST render (previously only the response cookie was set,
  // which ignored a logged-in user's saved language until the next request).
  request.cookies.set(LOCALE_COOKIE, activeLocale);
  pendingCookies.push({
    name: LOCALE_COOKIE,
    value: activeLocale,
    options: { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 },
  });
  response = buildResponse();

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
