import { APP_LOCALES, type AppLocale } from '@/lib/i18n-config';

const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  ru: 'Russian',
  am: 'Armenian',
};

const CORE_FIELD_INSTRUCTIONS: Record<string, string> = {
  title: 'A short, compelling marketing product title, under 80 characters. No surrounding quotes.',
  manufacturingNotes:
    'Production-facing manufacturing notes: materials, assembly steps, finish. Plain sentences, no markdown.',
  characteristics:
    'Admin-only technical characteristics: materials, dimensions, construction details, and open unknowns that need review before publishing. Plain sentences, no markdown.',
  systemPrompt:
    'Directive instructions (not marketing copy) for an AI image-personalization step that will use this product as context.',
  laserSolidPrompt:
    'Directive instructions for generating the solid-scratched glass engraving variant of this product.',
};

const SEO_SUB_FIELDS = [
  'seoTitle',
  'seoDescription',
  'seoKeywords',
  'ogTitle',
  'ogDescription',
] as const;

const SEO_FIELD_INSTRUCTIONS: Record<
  (typeof SEO_SUB_FIELDS)[number],
  (language: string) => string
> = {
  seoTitle: (language) => `An SEO title in ${language}, 70 characters or fewer.`,
  seoDescription: (language) => `A meta description in ${language}, 170 characters or fewer.`,
  seoKeywords: (language) => `A comma-separated list of up to 10 SEO keywords in ${language}.`,
  ogTitle: (language) => `An Open Graph title in ${language}, 90 characters or fewer.`,
  ogDescription: (language) => `An Open Graph description in ${language}, 220 characters or fewer.`,
};

function buildFieldInstructions(): Record<string, string> {
  const instructions: Record<string, string> = { ...CORE_FIELD_INSTRUCTIONS };
  for (const locale of APP_LOCALES) {
    for (const sub of SEO_SUB_FIELDS) {
      instructions[`${sub}_${locale}`] = SEO_FIELD_INSTRUCTIONS[sub](LOCALE_NAMES[locale]);
    }
  }
  return instructions;
}

export const ITEM_AI_FIELD_INSTRUCTIONS = buildFieldInstructions();

export const ITEM_AI_FIELD_KEYS = Object.keys(ITEM_AI_FIELD_INSTRUCTIONS) as [string, ...string[]];
