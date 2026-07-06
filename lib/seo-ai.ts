import { Output, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { AppLocale } from '@/lib/i18n';
import { getServerEnv } from '@/lib/env';

export const seoMetadataDraftSchema = z.object({
  seoTitle: z.string().min(1).max(70),
  seoDescription: z.string().min(1).max(180),
  keywords: z.array(z.string().min(1)).max(10),
  ogTitle: z.string().min(1).max(90),
  ogDescription: z.string().min(1).max(220),
});

export type SeoMetadataDraft = z.infer<typeof seoMetadataDraftSchema>;

export interface SeoMetadataSource {
  title: string;
  description?: string | null;
  categoryName?: string | null;
  images?: string[];
  productionNotes?: string | null;
  characteristics?: string | null;
  locale: AppLocale;
}

export function buildSeoMetadataPrompt(source: SeoMetadataSource) {
  return [
    'Generate editable marketplace SEO metadata.',
    `Target locale: ${source.locale}.`,
    `Product name: ${source.title}.`,
    `Category: ${source.categoryName ?? 'Unknown'}.`,
    `Description: ${source.description ?? 'No public description provided.'}`,
    `Public production notes: ${source.productionNotes ?? 'None.'}`,
    `Allowed admin-only characteristics for context only: ${source.characteristics ?? 'None.'}`,
    `Images or image paths: ${(source.images ?? []).join(', ') || 'None.'}`,
    'Avoid keyword stuffing, unsafe claims, child-safety claims, medical claims, and exact production promises.',
    'Return concise, human-readable metadata that an admin can review before saving.',
  ].join('\n');
}

export function createFallbackSeoMetadataDraft(source: SeoMetadataSource): SeoMetadataDraft {
  const category = source.categoryName ?? 'custom product';
  const cleanTitle = source.title.trim();
  const baseDescription =
    source.description?.trim() ||
    `Shop ${cleanTitle}, a ${category.toLowerCase()} available from the Uniqraft marketplace.`;
  const seoDescription =
    baseDescription.length > 155 ? `${baseDescription.slice(0, 152).trim()}...` : baseDescription;

  return {
    seoTitle: `${cleanTitle} | Uniqraft Marketplace`.slice(0, 70),
    seoDescription,
    keywords: Array.from(
      new Set(
        [cleanTitle, category, 'laser cut', 'custom gift', 'Uniqraft']
          .map((value) => value.toLowerCase())
          .filter(Boolean),
      ),
    ).slice(0, 8),
    ogTitle: cleanTitle.slice(0, 90),
    ogDescription: seoDescription.slice(0, 220),
  };
}

export async function generateSeoMetadataDraft(source: SeoMetadataSource) {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return createFallbackSeoMetadataDraft(source);
  }

  const { output } = await generateText({
    model: openai('gpt-4o-mini'),
    output: Output.object({ schema: seoMetadataDraftSchema }),
    prompt: buildSeoMetadataPrompt(source),
  });

  return output;
}
