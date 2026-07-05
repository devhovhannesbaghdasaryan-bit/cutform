import type { Metadata } from 'next';
import type { AppLocale } from '@/lib/i18n';

export interface CatalogSeoMetadata {
  seo_title: string | null;
  seo_description: string | null;
  seo_slug: string | null;
  keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  social_image_path: string | null;
  noindex: boolean;
}

export interface SeoFallbackSource {
  title: string;
  slug: string;
  description?: string | null;
  imagePath?: string | null;
}

export const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export function getCanonicalPath(locale: AppLocale, path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}

export function getCanonicalUrl(locale: AppLocale, path: string) {
  return `${PUBLIC_BASE_URL}${getCanonicalPath(locale, path)}`;
}

export function getAlternateLanguages(path: string) {
  return {
    en: getCanonicalUrl('en', path),
    ru: getCanonicalUrl('ru', path),
    am: getCanonicalUrl('am', path),
  };
}

export function resolveCatalogMetadata({
  locale,
  path,
  seo,
  fallback,
}: {
  locale: AppLocale;
  path: string;
  seo?: CatalogSeoMetadata | null;
  fallback: SeoFallbackSource;
}): Metadata {
  const title = seo?.seo_title || fallback.title;
  const description = seo?.seo_description || fallback.description || 'Custom wooden products and AI-assisted designs.';
  const image = seo?.social_image_path || fallback.imagePath || undefined;
  const canonical = getCanonicalUrl(locale, path);

  return {
    title,
    description,
    keywords: seo?.keywords ?? undefined,
    alternates: {
      canonical,
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title: seo?.og_title || title,
      description: seo?.og_description || description,
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
    robots: seo?.noindex ? { index: false, follow: false } : undefined,
  };
}

export function createProductStructuredData({
  locale,
  name,
  description,
  image,
  slug,
  priceCents,
  currency = 'USD',
}: {
  locale: AppLocale;
  name: string;
  description?: string | null;
  image?: string | null;
  slug: string;
  priceCents: number;
  currency?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description ?? undefined,
    image: image ? [image] : undefined,
    // Locale-prefixed to match the page canonical (was an unprefixed
    // /items/{slug} URL that never matched any canonical).
    url: getCanonicalUrl(locale, `/items/${slug}`),
    offers: {
      '@type': 'Offer',
      priceCurrency: currency,
      price: (priceCents / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };
}
