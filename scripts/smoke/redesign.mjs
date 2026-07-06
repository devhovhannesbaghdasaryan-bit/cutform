import { readFileSync } from 'node:fs';

const landing = readFileSync('app/page.tsx', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');

for (const token of [
  'MarketplaceHeader',
  'CategoryNavigation',
  'landing.popular_title',
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
if (!catalog.includes('grid-cols-1') || !catalog.includes('lg:grid-cols-4')) {
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

console.log('Redesign smoke passed');
