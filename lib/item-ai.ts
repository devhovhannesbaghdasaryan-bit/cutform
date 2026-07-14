import 'server-only';

import type OpenAI from 'openai';
import { getServerEnv } from '@/lib/env';
import { ITEM_AI_FIELD_INSTRUCTIONS } from '@/lib/item-ai-fields';

export { ITEM_AI_FIELD_INSTRUCTIONS, ITEM_AI_FIELD_KEYS } from '@/lib/item-ai-fields';

export interface ItemAiContext {
  title?: string;
  categoryName?: string;
  itemType?: string;
}

export interface GenerateItemFieldsInput {
  sourceDescription: string;
  fields: string[];
  context: ItemAiContext;
}

export function buildItemFieldsPrompt(input: GenerateItemFieldsInput): string {
  const contextLines = [
    input.context.title ? `Current title: ${input.context.title}` : null,
    input.context.categoryName ? `Category: ${input.context.categoryName}` : null,
    input.context.itemType ? `Item type: ${input.context.itemType}` : null,
  ].filter((line): line is string => Boolean(line));

  const fieldLines = input.fields.map((field) => {
    const instruction = ITEM_AI_FIELD_INSTRUCTIONS[field];
    if (!instruction) throw new Error(`Unknown item AI field: ${field}`);
    return `- "${field}": ${instruction}`;
  });

  return [
    'You are drafting catalog fields for a laser-cut/CNC marketplace item, based on an English product description written by an admin.',
    `English description: ${input.sourceDescription}`,
    ...contextLines,
    'Generate exactly these fields, each as a single string value:',
    ...fieldLines,
    'Do not invent facts not implied by the description. Avoid unsafe, medical, or child-safety claims.',
  ].join('\n');
}

export function extractResponseText(response: {
  output: Array<{ type: string; content?: Array<{ type: string; text?: string | null }> }>;
}): string {
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  throw new Error('OpenAI response did not include any output text.');
}

function buildResponseSchema(fields: string[]) {
  const properties: Record<string, { type: 'string' }> = {};
  for (const field of fields) properties[field] = { type: 'string' };
  return {
    type: 'object' as const,
    properties,
    required: fields,
    additionalProperties: false,
  };
}

function getResponsesModel() {
  return getServerEnv().OPENAI_RESPONSES_MODEL ?? 'gpt-5-mini';
}

export async function generateItemFields(
  client: OpenAI,
  input: GenerateItemFieldsInput,
): Promise<Record<string, string>> {
  if (input.fields.length === 0) return {};

  const prompt = buildItemFieldsPrompt(input);

  const response = await client.responses.create({
    model: getResponsesModel(),
    store: false,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    text: {
      format: {
        type: 'json_schema',
        name: 'item_fields',
        strict: true,
        schema: buildResponseSchema(input.fields),
      },
    },
  });

  const parsed = JSON.parse(extractResponseText(response)) as Record<string, string>;
  const values: Record<string, string> = {};
  for (const field of input.fields) {
    const value = parsed[field];
    if (typeof value !== 'string') throw new Error(`OpenAI response missing field: ${field}`);
    values[field] = value;
  }
  return values;
}
