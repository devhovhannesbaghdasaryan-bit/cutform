import { readFileSync } from 'node:fs';

const source = readFileSync('lib/i18n.ts', 'utf8');
if (/[ÂÐÕ][^\n]*['"]/.test(source) || source.includes('�')) {
  throw new Error('Dictionary appears to contain mojibake or replacement characters');
}
const sections = Object.fromEntries(
  ['en', 'ru', 'am'].map((locale) => {
    const match = source.match(new RegExp(`${locale}: \\{([\\s\\S]*?)\\n  \\}`, 'm'));
    if (!match) throw new Error(`Missing ${locale} dictionary`);
    return [locale, new Set([...match[1].matchAll(/'([^']+)':/g)].map((item) => item[1]))];
  }),
);

const englishKeys = sections.en;
for (const key of [
  'landing.title',
  'landing.subtitle',
  'catalog.title',
  'catalog.empty',
  'categories.title',
  'category.toys.name',
  'category.banners.name',
  'subcategory.personalized.name',
]) {
  if (!englishKeys.has(key)) throw new Error(`Missing storefront translation key: ${key}`);
}
for (const locale of ['ru', 'am']) {
  for (const key of englishKeys) {
    if (!sections[locale].has(key)) throw new Error(`${locale} missing translation key: ${key}`);
  }
}

console.log(`i18n smoke passed: ${englishKeys.size} keys across en, ru, am`);
