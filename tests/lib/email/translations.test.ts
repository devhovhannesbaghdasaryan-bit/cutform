import { describe, expect, it } from 'vitest';
import { RECEIPT_STRINGS } from '@/lib/email/translations';

const LOCALES = ['en', 'ru', 'am'] as const;

describe('RECEIPT_STRINGS', () => {
  it('has the same key set for every locale', () => {
    const enKeys = Object.keys(RECEIPT_STRINGS.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(RECEIPT_STRINGS[locale]).sort()).toEqual(enKeys);
    }
  });

  it('has non-empty values everywhere', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(RECEIPT_STRINGS[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });
});
