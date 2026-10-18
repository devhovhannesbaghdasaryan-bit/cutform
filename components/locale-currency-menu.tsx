'use client';

import { Check, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setCurrencyPreferenceAction } from '@/app/currency/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AppCurrency } from '@/lib/currency';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n-config';

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  ru: 'Русский',
  am: 'Հայերեն',
};

const LOCALE_SHORT: Record<AppLocale, string> = {
  en: 'EN',
  ru: 'RU',
  am: 'AM',
};

/**
 * One header control for language and currency ("EN · AMD"). Language goes
 * through the existing /api/locale cookie route; currency through the same
 * server action the old select used, so carts are re-priced the same way.
 */
export function LocaleCurrencyMenu({
  activeLocale,
  activeCurrency,
  currencies,
  labels,
}: {
  activeLocale: AppLocale;
  activeCurrency: AppCurrency;
  currencies: { code: AppCurrency }[];
  labels: { menu: string; language: string; currency: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function changeLocale(locale: AppLocale) {
    if (locale === activeLocale) return;
    startTransition(async () => {
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
    });
  }

  function changeCurrency(currency: AppCurrency) {
    if (currency === activeCurrency) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('currency', currency);
      await setCurrencyPreferenceAction(formData);
      router.refresh();
    });
  }

  const showCurrency = currencies.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={labels.menu}
          disabled={pending}
          className="px-2.5 font-bold"
        >
          {LOCALE_SHORT[activeLocale]}
          {showCurrency ? <span aria-hidden="true"> · {activeCurrency}</span> : null}
          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {labels.language}
        </DropdownMenuLabel>
        {APP_LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            className="cursor-pointer justify-between"
            onSelect={() => changeLocale(locale)}
          >
            {LOCALE_LABELS[locale]}
            {locale === activeLocale ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
        {showCurrency ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {labels.currency}
            </DropdownMenuLabel>
            {currencies.map((currency) => (
              <DropdownMenuItem
                key={currency.code}
                className="cursor-pointer justify-between"
                onSelect={() => changeCurrency(currency.code)}
              >
                {currency.code}
                {currency.code === activeCurrency ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
