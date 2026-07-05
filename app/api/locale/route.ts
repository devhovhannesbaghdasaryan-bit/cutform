import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { APP_LOCALES, LOCALE_COOKIE, normalizeLocale } from '@/lib/i18n-config';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

// Accepts anything normalizeLocale can map ('hy', 'ru-RU', 'EN', ...) and
// narrows the result to an APP_LOCALES member; everything else fails the parse.
const localeBodySchema = z.object({
  locale: z.string().transform(normalizeLocale).pipe(z.enum(APP_LOCALES)),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = localeBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid locale.' }, { status: 400 });
  }

  const { locale } = parsed.data;

  // Best-effort persistence of the saved language for logged-in users. The
  // cookie set below is the primary contract, so a failed profile update must
  // never fail the request. RLS only allows admins to update profiles rows,
  // hence the service client scoped to the authenticated user's id.
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await getServiceSupabase()
        .from('profiles')
        .update({ preferred_locale: locale })
        .eq('user_id', user.id);
    }
  } catch {
    // Swallowed: cookie-based locale switching must keep working even if the
    // profile update (or the service client) is unavailable.
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
