import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { APP_LOCALES, LOCALE_COOKIE, normalizeLocale } from '@/lib/i18n';

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
  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
