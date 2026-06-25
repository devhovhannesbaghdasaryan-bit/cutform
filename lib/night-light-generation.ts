import { z } from 'zod';

export const nightLightGenerationSchema = z.object({
  title: z.string().min(1).max(80),
  acrylicSvg: z.string().describe('SVG layer for acrylic panel engraving.'),
  woodBaseSvg: z.string().describe('SVG layer for wood base cut and engraving.'),
  previewSvg: z.string().describe('Combined approximate preview SVG.'),
  standText: z.string().max(100).optional(),
  sizePreset: z.enum(['small', 'medium', 'large']),
  manufacturabilityWarnings: z.array(z.string()).default([]),
});

export type NightLightGeneration = z.infer<typeof nightLightGenerationSchema>;

export function buildNightLightPrompt(input: {
  userPrompt: string;
  standText?: string;
  sizePreset: 'small' | 'medium' | 'large';
}) {
  return [
    'Create a manufacturable personalized night light SVG package.',
    'Convert the reference image into a clean pencil-like engraving layer.',
    'Include a transparent acrylic panel outline and an acrylic engraving layer.',
    'Include a separate wood base cut layer and a wood base engraving layer.',
    `Preserve this stand text exactly when provided: ${input.standText || 'No stand text.'}`,
    `Size preset: ${input.sizePreset}.`,
    'Return structured SVG strings and warnings for thin parts, excessive detail, missing layers, or out-of-bounds geometry.',
    `User prompt: ${input.userPrompt}`,
  ].join('\n');
}
