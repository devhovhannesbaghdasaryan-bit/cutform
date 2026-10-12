import { describe, expect, it } from 'vitest';
import {
  composeManufacturingPrompt,
  composePersonalizationPrompt,
  friendlyGenerationError,
  MANUFACTURING_ARTWORK_NOTE,
} from '@/lib/personalization-ai';

describe('composePersonalizationPrompt', () => {
  it('joins only the parts that are present', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: 'Base instructions.',
      boilerplateInstruction: null,
      personalizedText: null,
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe('Base instructions.');
  });

  it('includes boilerplate instruction, text with formatting, color, and photo note when all are present', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: 'Base instructions.',
      boilerplateInstruction: 'Rectangular UV-printed acrylic panel.',
      personalizedText: 'Happy Birthday',
      personalizedTextFormatting: 'bold emphasis, center aligned',
      colorLabel: 'Warm white',
      colorHex: '#f7d7a1',
      hasPhoto: true,
    });
    expect(prompt).toBe(
      [
        'Base instructions.',
        'Rectangular UV-printed acrylic panel.',
        'Personalized text: Happy Birthday (styling: bold emphasis, center aligned).',
        'Use color: Warm white (#f7d7a1).',
        'A customer photo is attached and is the only source of the subject: keep the result as similar to it as the product style allows, with exactly the same number of people, the same pose, identity and defining features. Never add, remove or duplicate a subject, and never copy subjects from the product template image.',
      ].join('\n\n'),
    );
  });

  it('omits the formatting parenthetical when no formatting is given', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: null,
      boilerplateInstruction: null,
      personalizedText: 'Hello',
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe('Personalized text: Hello.');
  });

  it('returns an empty string when nothing is present', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: null,
      boilerplateInstruction: null,
      personalizedText: null,
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe('');
  });
});

describe('composePersonalizationPrompt from manufacturing artwork', () => {
  it('replaces the customer photo note with the artwork note', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: 'Base instructions.',
      boilerplateInstruction: null,
      personalizedText: null,
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: true,
      fromManufacturingArtwork: true,
    });
    expect(prompt).toBe(['Base instructions.', MANUFACTURING_ARTWORK_NOTE].join('\n\n'));
  });
});

describe('composeManufacturingPrompt', () => {
  it('substitutes customer text only where the placeholder is', () => {
    expect(composeManufacturingPrompt('Line art. Add the name "{{text}}" below.', 'Ani')).toBe(
      'Line art. Add the name "Ani" below.',
    );
  });

  it('does not leak customer text into a prompt without the placeholder', () => {
    expect(composeManufacturingPrompt('  Line art only.  ', 'Ani')).toBe('Line art only.');
  });

  const sectioned =
    'Print the photo.\n\n{{#text}}Add "{{text}}" ({{textStyle}}).{{/text}}\n\nNo frame.';

  it('keeps the text section with text and styling when text is given', () => {
    expect(composeManufacturingPrompt(sectioned, 'Ani', 'bold emphasis')).toBe(
      'Print the photo.\n\nAdd "Ani" (bold emphasis).\n\nNo frame.',
    );
  });

  it('falls back to the default text style when no formatting is given', () => {
    expect(composeManufacturingPrompt(sectioned, 'Ani')).toBe(
      'Print the photo.\n\nAdd "Ani" (regular weight, centered).\n\nNo frame.',
    );
  });

  it('drops the text section entirely when there is no text', () => {
    expect(composeManufacturingPrompt(sectioned, null)).toBe('Print the photo.\n\nNo frame.');
  });
});

describe('friendlyGenerationError', () => {
  it('maps billing errors to a friendly message', () => {
    expect(friendlyGenerationError(new Error('Billing hard limit reached'))).toContain(
      'billing limit',
    );
  });

  it('falls back to a generic message', () => {
    expect(friendlyGenerationError(new Error('boom'))).toContain(
      'We could not generate your previews.',
    );
  });
});
