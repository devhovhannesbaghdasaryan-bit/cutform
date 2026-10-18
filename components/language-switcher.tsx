'use client';

import { usePathname, useRouter } from 'next/navigation';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n-config';

const LABELS: Record<AppLocale, string> = {
  en: 'EN',
  ru: 'RU',
  am: 'AM',
};

export function LanguageSwitcher({
  activeLocale = 'en',
  label,
}: {
  activeLocale?: AppLocale;
  label: string;
}) {
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
    <select
      aria-label={label}
      value={activeLocale}
      onChange={(event) => changeLocale(event.target.value as AppLocale)}
      className="h-8 rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {APP_LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LABELS[locale]}
        </option>
      ))}
    </select>
  );
}
