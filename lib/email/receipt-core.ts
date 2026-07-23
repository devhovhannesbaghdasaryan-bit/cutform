// Pure receipt model builders. No env, Next, or Supabase imports — unit-tested
// outside the runtime (same convention as lib/payments/polar-core.ts).
import {
  DEFAULT_LOCALE,
  formatLocalizedCurrency,
  isAppLocale,
  normalizeLocale,
  type AppLocale,
} from '@/lib/i18n';

export function resolveReceiptLocale(
  captured: string | null | undefined,
  preferred: string | null | undefined,
): AppLocale {
  const capturedLocale = normalizeLocale(captured);
  if (capturedLocale && isAppLocale(capturedLocale)) return capturedLocale;
  const preferredLocale = normalizeLocale(preferred);
  if (preferredLocale && isAppLocale(preferredLocale)) return preferredLocale;
  return DEFAULT_LOCALE;
}

export interface OrderReceiptModel {
  locale: AppLocale;
  orderIdShort: string;
  items: { title: string; quantity: number; total: string }[];
  subtotal: string;
  shipping: string;
  total: string;
  orderUrl: string;
  logoUrl: string;
}

export interface CreditsReceiptModel {
  locale: AppLocale;
  packName: string;
  creditAmount: number;
  total: string;
  creditsUrl: string;
  logoUrl: string;
}

function logoUrl(siteUrl: string) {
  return `${siteUrl}/brand/uniqraft-logo-light.png`;
}

export function buildOrderReceiptModel(input: {
  locale: AppLocale;
  orderId: string;
  items: { title: string; quantity: number; total_price_cents: number; currency: string }[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  siteUrl: string;
}): OrderReceiptModel {
  const { locale, currency } = input;
  return {
    locale,
    orderIdShort: input.orderId.slice(0, 8),
    items: input.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      total: formatLocalizedCurrency(locale, item.total_price_cents, item.currency),
    })),
    subtotal: formatLocalizedCurrency(locale, input.subtotalCents, currency),
    shipping: formatLocalizedCurrency(locale, input.shippingCents, currency),
    total: formatLocalizedCurrency(locale, input.totalCents, currency),
    orderUrl: `${input.siteUrl}/orders/${input.orderId}`,
    logoUrl: logoUrl(input.siteUrl),
  };
}

export function buildCreditsReceiptModel(input: {
  locale: AppLocale;
  metadata: Record<string, unknown>;
  amountCents: number;
  currency: string;
  siteUrl: string;
}): CreditsReceiptModel {
  const packName =
    typeof input.metadata.packName === 'string' && input.metadata.packName.trim()
      ? input.metadata.packName
      : 'Credits';
  const rawCredits = Number(input.metadata.creditAmount ?? 0);
  return {
    locale: input.locale,
    packName,
    creditAmount: Number.isFinite(rawCredits) ? rawCredits : 0,
    total: formatLocalizedCurrency(input.locale, input.amountCents, input.currency),
    creditsUrl: `${input.siteUrl}/credits`,
    logoUrl: logoUrl(input.siteUrl),
  };
}
