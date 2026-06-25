import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, normalizeLocale } from '@/lib/i18n';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const locale = normalizeLocale(typeof body.locale === 'string' ? body.locale : null);

  if (!locale) {
    return NextResponse.json({ error: 'Invalid locale.' }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
