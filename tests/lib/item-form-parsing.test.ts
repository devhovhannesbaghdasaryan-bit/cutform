import { describe, expect, it } from 'vitest';
import { parseItemForm, validatePersonalizationConfig } from '@/app/admin/items/item-form-parsing';

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

function buildValidItemFormData(): FormData {
  const formData = new FormData();
  formData.set('title', 'Night Light');
  formData.set('slug', 'night-light');
  formData.set('categoryId', '123e4567-e89b-12d3-a456-426614174000');
  formData.set('subcategoryId', '');
  formData.set('itemType', 'standard');
  formData.set('priceCents', '1000');
  formData.set('status', 'draft');
  return formData;
}

describe('parseItemForm skill fields', () => {
  it('reads the skillPath hidden field alongside skillId', () => {
    const formData = buildValidItemFormData();
    formData.set('skillId', 'file-abc123');
    formData.set('skillPath', 'user-1/personalization-skills/abc.md');
    const parsed = parseItemForm(formData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.skillId).toBe('file-abc123');
      expect(parsed.data.skillPath).toBe('user-1/personalization-skills/abc.md');
    }
  });

  it('leaves skillPath undefined when the field is absent or empty', () => {
    const formData = buildValidItemFormData();
    formData.set('skillPath', '');
    const parsed = parseItemForm(formData);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.skillPath).toBeUndefined();
  });
});
