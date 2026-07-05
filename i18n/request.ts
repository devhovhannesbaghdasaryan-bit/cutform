// next-intl request config ("without i18n routing" cookie mode). The active
// locale comes from getRequestLocale() — the uq_locale cookie (with a legacy
// snip_locale read fallback) that the middleware resolves and injects into the
// request — so this stays the single source of truth for locale resolution.
import { getRequestConfig } from 'next-intl/server';
import { IntlErrorCode } from 'next-intl';
import { DEFAULT_LOCALE, type AppLocale } from '@/lib/i18n-config';
import { getRequestLocale } from '@/lib/i18n-server';
import enMessages from '@/messages/en.json';
import ruMessages from '@/messages/ru.json';
import amMessages from '@/messages/am.json';

type Messages = typeof enMessages;
type MessageTree = { [key: string]: string | MessageTree };

// Deep-merge the en catalog under the active locale so a key missing from a
// locale falls back to English — the legacy translate() locale→en fallback.
function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const out: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] =
      typeof value === 'object' && typeof existing === 'object'
        ? deepMerge(existing, value)
        : value;
  }
  return out;
}

const MESSAGES: Record<AppLocale, Messages> = {
  en: enMessages,
  ru: deepMerge(enMessages, ruMessages) as Messages,
  am: deepMerge(enMessages, amMessages) as Messages,
};

export default getRequestConfig(async () => {
  const locale = await getRequestLocale();

  return {
    locale,
    messages: MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE],
    // Legacy translate() returned the raw key when a message was missing from
    // every catalog; reproduce that exactly.
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join('.');
    },
    // Legacy translate() never threw and never logged missing keys — keep
    // missing messages silent; log anything else (a genuine config/ICU bug).
    onError(error) {
      if (error.code !== IntlErrorCode.MISSING_MESSAGE) {
        console.error(error);
      }
    },
  };
});
