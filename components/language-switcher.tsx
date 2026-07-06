'use client';

import { usePathname, useRouter } from 'next/navigation';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n-config';

const LABELS: Record<AppLocale, string> = {
  en: 'EN',
  ru: 'RU',
  am: 'AM',
};

export function LanguageSwitcher({ activeLocale = 'en' }: { activeLocale?: AppLocale }) {
  const router = useRouter();
  const pathname = usePathname();

  async function changeLocale(locale: AppLocale) {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale }),
    });

    const localePattern = new RegExp(`^/(${APP_LOCALES.join('|')})(?=/|$)`);
    if (localePattern.test(pathname)) {
      router.push(pathname.replace(localePattern, `/${locale}`));
      return;
    }

    router.refresh();
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: div+role="group" preserves existing markup; a native fieldset's default browser chrome is not desired here
    <div
      className="inline-flex rounded-md border bg-background p-0.5"
      role="group"
      aria-label="Language"
    >
      {APP_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => changeLocale(locale)}
          className={
            locale === activeLocale
              ? 'rounded-sm bg-primary px-2 py-1 text-xs font-medium text-primary-foreground'
              : 'rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
          }
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
