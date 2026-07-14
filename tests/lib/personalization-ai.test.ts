import { describe, expect, it } from 'vitest';
import { composePersonalizationPrompt, friendlyGenerationError } from '@/lib/personalization-ai';

describe('composePersonalizationPrompt', () => {
  it('joins only the parts that are present', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: 'Base instructions.',
      boilerplateInstruction: null,
      engravingInstruction: null,
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
      engravingInstruction: null,
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
        'A user photo is attached as the subject reference; preserve its recognizable identity and defining features.',
      ].join('\n\n'),
    );
  });

  it('inserts the engraving instruction after the boilerplate instruction', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: 'Base instructions.',
      boilerplateInstruction: 'Panel shape.',
      engravingInstruction: 'Solid scratched fill on glass.',
      personalizedText: null,
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe(
      ['Base instructions.', 'Panel shape.', 'Solid scratched fill on glass.'].join('\n\n'),
    );
  });

  it('omits the formatting parenthetical when no formatting is given', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: null,
      boilerplateInstruction: null,
      engravingInstruction: null,
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
      engravingInstruction: null,
      personalizedText: null,
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe('');
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
