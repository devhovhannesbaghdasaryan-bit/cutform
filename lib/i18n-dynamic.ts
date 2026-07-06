// Helper for dynamic (runtime-built) translation keys, e.g.
// `category.${slug}.name`. next-intl types t() against the message catalog,
// which template-literal keys can never satisfy — this module owns the single
// sanctioned loose cast so call sites stay strictly typed.
//
// Mirrors the legacy translateWithFallback(): returns the translation when the
// key exists (locale catalog already deep-merged over en in i18n/request.ts),
// otherwise the provided fallback, otherwise the raw key.

// Any translator returned by getTranslations()/useTranslations() is assignable
// to this shape (never-typed parameters accept the stricter typed signatures).
type TranslatorLike = {
  (key: never): string;
  has(key: never): boolean;
};

type LooseTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

export function tDynamic(t: TranslatorLike, key: string, fallback?: string): string {
  const loose = t as LooseTranslator;
  return loose.has(key) ? loose(key) : (fallback ?? key);
}
