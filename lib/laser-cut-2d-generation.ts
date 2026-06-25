import { z } from 'zod';

export const laserCut2DGenerationSchema = z.object({
  title: z.string().min(1).max(80),
  productType: z.enum(['laser_cut_2d_toy', 'laser_cut_2d_decoration', 'laser_cut_2d_constructor']),
  manufacturingSvg: z.string().describe('Layered SVG with cut and engrave groups.'),
  previewSvg: z.string().describe('Wood-look preview SVG for user review.'),
  material: z.string().default('plywood'),
  sizePreset: z.enum(['small', 'medium', 'large']),
  layers: z.array(z.object({
    id: z.string(),
    operation: z.enum(['cut', 'engrave', 'score']),
    notes: z.string().optional(),
  })),
  manufacturabilityWarnings: z.array(z.string()).default([]),
});

export type LaserCut2DGeneration = z.infer<typeof laserCut2DGenerationSchema>;

export function buildLaserCut2DPrompt(input: {
  userPrompt: string;
  productType: 'laser_cut_2d_toy' | 'laser_cut_2d_decoration' | 'laser_cut_2d_constructor';
  sizePreset: 'small' | 'medium' | 'large';
}) {
  return [
    'Create a manufacturable 2D laser-cut SVG from the reference image.',
    `Product type: ${input.productType}.`,
    `Size preset: ${input.sizePreset}.`,
    'Simplify the image into closed cut outlines and separate engraving details.',
    'Use explicit SVG groups or ids for cut, engrave, and score layers.',
    'Include material and size metadata.',
    'Return warnings for too much detail, thin parts, missing cut layers, and out-of-bounds geometry.',
    `User prompt: ${input.userPrompt}`,
  ].join('\n');
}
