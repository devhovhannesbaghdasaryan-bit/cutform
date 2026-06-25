import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type AppLocale, DEFAULT_LOCALE, formatLocalizedCurrency, formatLocalizedDate } from '@/lib/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(cents: number, currency = 'AMD', locale: AppLocale = DEFAULT_LOCALE) {
  return formatLocalizedCurrency(locale, cents, currency);
}

export function formatDate(d: string | Date, locale: AppLocale = DEFAULT_LOCALE) {
  return formatLocalizedDate(locale, d);
}
