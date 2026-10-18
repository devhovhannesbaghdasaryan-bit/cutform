import { readFileSync } from 'node:fs';

// Static signals of the "Workshop" storefront redesign: one shared header and
// footer, the shared container rhythm, and the catalog built from the same
// product cards as the landing page.
const landing = readFileSync('app/page.tsx', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');

for (const token of [
  'MarketplaceHeader',
  'SiteFooter',
  'landing.popular_title',
  'landing.categories_title',
  'storefront-container',
]) {
  if (!landing.includes(token) && !globals.includes(token)) {
    throw new Error(`Missing redesign signal: ${token}`);
  }
}

const catalog = readFileSync('app/catalog/page.tsx', 'utf8');
if (!catalog.includes('CatalogItemCard'))
  throw new Error('Catalog page does not use marketplace cards');
if (!catalog.includes('MarketplaceHeader'))
  throw new Error('Catalog page is missing the marketplace header');
if (!catalog.includes('SiteFooter')) throw new Error('Catalog page is missing the site footer');
if (!catalog.includes('grid-cols-1') || !catalog.includes('lg:grid-cols-3')) {
  throw new Error('Catalog grid does not use the shared responsive product-card rhythm');
}

const banners = readFileSync('app/banners/page.tsx', 'utf8');
for (const token of [
  'MarketplaceHeader',
  'storefront-container',
  'banners.customize',
  'banners.advanced',
]) {
  if (!banners.includes(token)) throw new Error(`Banner page is missing redesign signal: ${token}`);
}

const generated = readFileSync('app/generated/[id]/page.tsx', 'utf8');
if (!generated.includes('MarketplaceHeader') || !generated.includes('grid gap-8')) {
  throw new Error('Generated detail page is not aligned with marketplace layout conventions');
}

const header = readFileSync('components/marketplace-header.tsx', 'utf8');
for (const token of ['LocaleCurrencyMenu', 'name="q"', 'MobileNavMenu', 'type="search"']) {
  if (!header.includes(token)) throw new Error(`Header is missing redesign signal: ${token}`);
}

for (const utility of [
  'storefront-container',
  'storefront-section',
  'storefront-heading',
  'product-art-frame',
]) {
  if (!globals.includes(`@utility ${utility}`)) {
    throw new Error(`Missing storefront utility: ${utility}`);
  }
}

for (const token of ['--font-display', '--gold:', '--slate:']) {
  if (!globals.includes(token)) throw new Error(`Missing design token: ${token}`);
}

console.log('Redesign smoke passed');
