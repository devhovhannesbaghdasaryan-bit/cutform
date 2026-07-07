import { describe, expect, it } from 'vitest';
import { validatePersonalizationConfig } from '@/app/admin/items/item-form-parsing';

describe('validatePersonalizationConfig', () => {
  it('passes non-customizable items regardless of personalization fields', () => {
    expect(
      validatePersonalizationConfig({ isCustomizable: false, boilerplateIds: [] }),
    ).toBe(true);
  });

  it('fails a customizable item with no system prompt, skill id, or boilerplates', () => {
    expect(
      validatePersonalizationConfig({ isCustomizable: true, boilerplateIds: [] }),
    ).toBe(false);
  });

  it('passes when a system prompt is set', () => {
    expect(
      validatePersonalizationConfig({
        isCustomizable: true,
        systemPrompt: 'Base instructions.',
        boilerplateIds: [],
      }),
    ).toBe(true);
  });

  it('passes when a skill id is set', () => {
    expect(
      validatePersonalizationConfig({
        isCustomizable: true,
        skillId: 'skill-123',
        boilerplateIds: [],
      }),
    ).toBe(true);
  });

  it('passes when at least one boilerplate is selected', () => {
    expect(
      validatePersonalizationConfig({
        isCustomizable: true,
        boilerplateIds: ['00000000-0000-0000-0000-000000000001'],
      }),
    ).toBe(true);
  });
});
