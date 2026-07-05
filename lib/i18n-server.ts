import 'server-only';

import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LEGACY_LOCALE_COOKIE,
  LOCALE_COOKIE,
  type AppLocale,
  getDefaultLocaleForRegion,
  normalizeLocale,
} from '@/lib/i18n';

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const selectedLocale = normalizeLocale(
    cookieStore.get(LOCALE_COOKIE)?.value ?? cookieStore.get(LEGACY_LOCALE_COOKIE)?.value,
  );
  if (selectedLocale) return selectedLocale;

  const headerStore = await headers();
  const regionCode = headerStore.get('x-vercel-ip-country') ?? headerStore.get('cf-ipcountry');
  if (regionCode) return getDefaultLocaleForRegion(regionCode);

  const acceptLanguage = headerStore.get('accept-language');
  const preferredLocale = normalizeLocale(acceptLanguage?.split(',')[0]);
  return preferredLocale ?? DEFAULT_LOCALE;
}
