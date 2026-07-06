import { readFileSync } from 'node:fs';

const LOCALES = ['en', 'ru', 'am'];

function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[fullKey] = value;
    else if (value && typeof value === 'object') flatten(value, fullKey, out);
    else throw new Error(`Non-string leaf at ${fullKey}`);
  }
  return out;
}

const dictionaries = Object.fromEntries(
  LOCALES.map((locale) => {
    const raw = readFileSync(`messages/${locale}.json`, 'utf8');
    if (/[ÂÐÕ][^\n]*"/.test(raw) || raw.includes('�')) {
      throw new Error(
        `messages/${locale}.json appears to contain mojibake or replacement characters`,
      );
    }
    return [locale, flatten(JSON.parse(raw))];
  }),
);

const englishKeys = new Set(Object.keys(dictionaries.en));
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
  const keys = new Set(Object.keys(dictionaries[locale]));
  for (const key of englishKeys) {
    if (!keys.has(key)) throw new Error(`${locale} missing translation key: ${key}`);
  }
  for (const key of keys) {
    if (!englishKeys.has(key)) throw new Error(`${locale} has extra translation key: ${key}`);
  }
}

// Leaf/branch conflicts: a key that is both a leaf ('x.y') and a prefix of a
// deeper key ('x.y.z') cannot be represented in the nested message files.
const allKeys = new Set(LOCALES.flatMap((locale) => Object.keys(dictionaries[locale])));
for (const key of allKeys) {
  const prefix = `${key}.`;
  for (const other of allKeys) {
    if (other.startsWith(prefix)) {
      throw new Error(
        `Leaf/branch conflict: '${key}' is both a message and a namespace ('${other}')`,
      );
    }
  }
}

console.log(`i18n smoke passed: ${englishKeys.size} keys across en, ru, am`);
