'use server';

import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { generateItemFields, ITEM_AI_FIELD_KEYS } from '@/lib/item-ai';
import { getOpenAiClient } from '@/lib/openai-client';

const generateItemFieldValuesSchema = z.object({
  sourceDescription: z.string().trim().min(1, 'Enter a description first.'),
  fields: z.array(z.enum(ITEM_AI_FIELD_KEYS)).min(1, 'Select at least one field to generate.'),
  context: z.object({
    title: z.string().trim().optional(),
    categoryName: z.string().trim().optional(),
    itemType: z.string().trim().optional(),
  }),
});

export type GenerateItemFieldValuesInput = z.input<typeof generateItemFieldValuesSchema>;
export type GenerateItemFieldValuesResult = { values: Record<string, string> } | { error: string };

export async function generateItemFieldValuesAction(
  input: GenerateItemFieldValuesInput,
): Promise<GenerateItemFieldValuesResult> {
  const parsed = generateItemFieldValuesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid generation request.' };
  }

  // Left outside the try/catch: requireAdminPermission redirects (throws a
  // Next.js-special error) on failure, and that must propagate, not become
  // a generic { error } shown inline near a button.
  await requireAdminPermission('catalog_manage');

  try {
    const client = getOpenAiClient();
    const values = await generateItemFields(client, parsed.data);
    return { values };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'AI generation failed.' };
  }
}
