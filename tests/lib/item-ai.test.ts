import { describe, expect, it, vi } from 'vitest';
import {
  buildItemFieldsPrompt,
  extractResponseText,
  generateItemFields,
  ITEM_AI_FIELD_KEYS,
} from '@/lib/item-ai';

describe('ITEM_AI_FIELD_KEYS', () => {
  it('contains the 5 core fields and 15 localized SEO fields', () => {
    expect(ITEM_AI_FIELD_KEYS).toHaveLength(20);
    expect(ITEM_AI_FIELD_KEYS).toEqual(
      expect.arrayContaining([
        'title',
        'manufacturingNotes',
        'characteristics',
        'systemPrompt',
        'laserSolidPrompt',
        'seoTitle_en',
        'seoTitle_ru',
        'seoTitle_am',
        'ogDescription_am',
      ]),
    );
  });
});

describe('buildItemFieldsPrompt', () => {
  it('includes the source description and instructions only for requested fields', () => {
    const prompt = buildItemFieldsPrompt({
      sourceDescription: 'A laser-cut oak jewelry box with a hinged lid.',
      fields: ['title', 'characteristics'],
      context: {},
    });
    expect(prompt).toContain('A laser-cut oak jewelry box with a hinged lid.');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"characteristics"');
    expect(prompt).not.toContain('"manufacturingNotes"');
  });

  it('includes context lines when provided', () => {
    const prompt = buildItemFieldsPrompt({
      sourceDescription: 'desc',
      fields: ['title'],
      context: { title: 'Old Title', categoryName: 'Decorations', itemType: 'decoration' },
    });
    expect(prompt).toContain('Current title: Old Title');
    expect(prompt).toContain('Category: Decorations');
    expect(prompt).toContain('Item type: decoration');
  });

  it('instructs Russian output for ru SEO fields and Armenian for am SEO fields', () => {
    const prompt = buildItemFieldsPrompt({
      sourceDescription: 'desc',
      fields: ['seoTitle_ru', 'seoTitle_am', 'seoTitle_en'],
      context: {},
    });
    expect(prompt).toContain('An SEO title in Russian');
    expect(prompt).toContain('An SEO title in Armenian');
    expect(prompt).toContain('An SEO title in English');
  });

  it('throws for an unknown field key', () => {
    expect(() =>
      buildItemFieldsPrompt({ sourceDescription: 'desc', fields: ['notARealField'], context: {} }),
    ).toThrow('Unknown item AI field: notARealField');
  });
});

describe('extractResponseText', () => {
  it('extracts text from a message output_text content part', () => {
    const text = extractResponseText({
      output: [
        { type: 'reasoning' },
        { type: 'message', content: [{ type: 'output_text', text: '{"title":"Oak Box"}' }] },
      ],
    });
    expect(text).toBe('{"title":"Oak Box"}');
  });

  it('throws when no message output_text part is present', () => {
    expect(() => extractResponseText({ output: [{ type: 'reasoning' }] })).toThrow(
      'OpenAI response did not include any output text.',
    );
  });
});

describe('generateItemFields', () => {
  it('sends a strict json_schema request scoped to exactly the requested fields and returns the parsed values', async () => {
    const create = vi.fn(async () => ({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                title: 'Oak Jewelry Box',
                characteristics: 'Solid oak, brass hinges.',
              }),
            },
          ],
        },
      ],
    }));
    const client = { responses: { create } } as unknown as Parameters<typeof generateItemFields>[0];

    const values = await generateItemFields(client, {
      sourceDescription: 'A laser-cut oak jewelry box.',
      fields: ['title', 'characteristics'],
      context: {},
    });

    expect(values).toEqual({ title: 'Oak Jewelry Box', characteristics: 'Solid oak, brass hinges.' });
    // biome-ignore lint/suspicious/noExplicitAny: test double for the Responses API request body
    const requestBody = (create.mock.calls[0] as any[])[0];
    expect(requestBody.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(requestBody.text.format.schema).toEqual({
      type: 'object',
      properties: { title: { type: 'string' }, characteristics: { type: 'string' } },
      required: ['title', 'characteristics'],
      additionalProperties: false,
    });
  });

  it('throws when the model omits a requested field', async () => {
    const create = vi.fn(async () => ({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify({ title: 'Only title' }) }],
        },
      ],
    }));
    const client = { responses: { create } } as unknown as Parameters<typeof generateItemFields>[0];

    await expect(
      generateItemFields(client, {
        sourceDescription: 'desc',
        fields: ['title', 'characteristics'],
        context: {},
      }),
    ).rejects.toThrow('OpenAI response missing field: characteristics');
  });

  it('returns an empty object without calling OpenAI when no fields are requested', async () => {
    const create = vi.fn();
    const client = { responses: { create } } as unknown as Parameters<typeof generateItemFields>[0];

    const values = await generateItemFields(client, {
      sourceDescription: 'desc',
      fields: [],
      context: {},
    });

    expect(values).toEqual({});
    expect(create).not.toHaveBeenCalled();
  });
});
