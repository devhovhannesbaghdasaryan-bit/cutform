// Locale-aware Intl formatting helpers. Locale constants/helpers live in
// lib/i18n-config.ts (client-safe) and are re-exported here so existing
// `import { X } from '@/lib/i18n'` sites keep compiling unchanged.
// Translations are served by next-intl (see i18n/request.ts); the legacy
// translate()/getDictionary() API is gone.
import { getLocaleForFormatting, type AppLocale } from '@/lib/i18n-config';

export * from '@/lib/i18n-config';

export function formatLocalizedDate(locale: AppLocale, value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(getLocaleForFormatting(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatLocalizedCurrency(
  locale: AppLocale,
  cents: number,
  currency = 'AMD',
) {
  return new Intl.NumberFormat(getLocaleForFormatting(locale), {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
