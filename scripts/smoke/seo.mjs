import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'app/robots.ts',
  'app/sitemap.ts',
  'lib/seo.ts',
  'lib/supabase/middleware.ts',
];
for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing SEO file: ${file}`);
}

const seoSource = readFileSync('lib/seo.ts', 'utf8');
for (const symbol of [
  'resolveCatalogMetadata',
  'getAlternateLanguages',
  'createProductStructuredData',
]) {
  if (!seoSource.includes(symbol)) throw new Error(`Missing SEO helper: ${symbol}`);
}
if (!seoSource.includes("`/${locale}${cleanPath === '/' ? '' : cleanPath}`")) {
  throw new Error('Canonical paths must include clean locale prefixes');
}

const middlewareSource = readFileSync('lib/supabase/middleware.ts', 'utf8');
for (const required of ['getLocalePrefixedPath', 'NextResponse.rewrite', 'LOCALE_COOKIE']) {
  if (!middlewareSource.includes(required)) {
    throw new Error(`Locale-prefixed SEO URLs are not backed by middleware support: ${required}`);
  }
}

const sitemapSource = readFileSync('app/sitemap.ts', 'utf8');
for (const required of [
  'APP_LOCALES',
  'listCategories',
  'listPublishedCatalogItems',
  'getCanonicalUrl',
]) {
  if (!sitemapSource.includes(required)) throw new Error(`Sitemap does not include ${required}`);
}

const robotsSource = readFileSync('app/robots.ts', 'utf8');
for (const disallowed of ['/admin', '/cart', '/checkout', '/dashboard', '/orders', '/api']) {
  if (!robotsSource.includes(disallowed))
    throw new Error(`Robots file does not disallow ${disallowed}`);
}
if (!robotsSource.includes('sitemap')) throw new Error('Robots file does not expose sitemap');

const landingPage = readFileSync('app/page.tsx', 'utf8');
if (!landingPage.includes('generateMetadata'))
  throw new Error('Landing page is missing generateMetadata');
if (!landingPage.includes('resolveCatalogMetadata')) {
  throw new Error('Landing page is missing localized metadata helper usage');
}

const catalogPage = readFileSync('app/catalog/page.tsx', 'utf8');
if (!catalogPage.includes('generateMetadata'))
  throw new Error('Catalog page is missing generateMetadata');
if (!catalogPage.includes('category') || !catalogPage.includes('subcategory')) {
  throw new Error('Catalog metadata does not account for category/subcategory views');
}

const itemPage = readFileSync('app/items/[slug]/page.tsx', 'utf8');
if (!itemPage.includes('generateMetadata'))
  throw new Error('Item page is missing generateMetadata');
if (!itemPage.includes('application/ld+json'))
  throw new Error('Item page is missing product structured data');
if (!itemPage.includes('getCatalogItemSeoMetadata') || !itemPage.includes('imagePath')) {
  throw new Error('Item page does not resolve reviewed SEO/social image metadata');
}

const adminItemForm = readFileSync('app/admin/items/item-form/seo-section.tsx', 'utf8');
if (!adminItemForm.includes('validateSeoMetadata')) {
  throw new Error('Admin item form does not surface SEO launch warnings');
}

console.log('SEO smoke passed');
