// Translation dictionaries + formatting helpers. Locale constants/helpers
// live in lib/i18n-config.ts (client-safe) and are re-exported here so
// existing `import { X } from '@/lib/i18n'` sites keep compiling unchanged.
// Message catalogs live in messages/{en,ru,am}.json as nested objects
// (next-intl-compatible); they are flattened once at module scope back into
// the flat dot-notation shape the translate() API expects.
import {
  DEFAULT_LOCALE,
  getLocaleForFormatting,
  type AppLocale,
} from '@/lib/i18n-config';
import enMessages from '@/messages/en.json';
import ruMessages from '@/messages/ru.json';
import amMessages from '@/messages/am.json';

export * from '@/lib/i18n-config';

type MessageTree = { [key: string]: string | MessageTree };

function flattenMessages(node: MessageTree, prefix = '', out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[fullKey] = value;
    } else {
      flattenMessages(value, fullKey, out);
    }
  }
  return out;
}

const DICTIONARIES: Record<AppLocale, Record<string, string>> = {
  en: flattenMessages(enMessages),
  ru: flattenMessages(ruMessages),
  am: flattenMessages(amMessages),
};

export function getDictionary(locale: AppLocale) {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function translate(locale: AppLocale, key: string) {
  return getDictionary(locale)[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}

export function translateTemplate(locale: AppLocale, key: string, values: Record<string, string>) {
  return translate(locale, key).replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '');
}

export function translateWithFallback(locale: AppLocale, key: string, fallback: string) {
  const value = translate(locale, key);
  return value === key ? fallback : value;
}

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
