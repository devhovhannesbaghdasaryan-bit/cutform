// Client-safe locale constants and helpers. This module must not import
// anything server-only: it is consumed by client components (e.g. the
// language switcher) and the middleware.

export const APP_LOCALES = ['en', 'ru', 'am'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_COOKIE = 'snip_locale';

const REGION_LOCALE_DEFAULTS: Record<string, AppLocale> = {
  AM: 'am',
  RU: 'ru',
  BY: 'ru',
  KZ: 'ru',
  KG: 'ru',
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && APP_LOCALES.includes(value as AppLocale);
}

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'hy' || normalized === 'hy-am') return 'am';
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('en')) return 'en';
  return isAppLocale(normalized) ? normalized : null;
}

export function getDefaultLocaleForRegion(regionCode: string | null | undefined): AppLocale {
  if (!regionCode) return DEFAULT_LOCALE;
  return REGION_LOCALE_DEFAULTS[regionCode.toUpperCase()] ?? DEFAULT_LOCALE;
}

export function getLocaleForFormatting(locale: AppLocale) {
  // Internal code 'am' means Armenian here; ISO 639-1 'am' is Amharic —
  // never feed raw 'am' to Intl, always map it to 'hy-AM'.
  if (locale === 'am') return 'hy-AM';
  if (locale === 'ru') return 'ru-RU';
  return 'en-US';
}
