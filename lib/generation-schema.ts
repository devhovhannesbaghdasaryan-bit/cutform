import { z } from 'zod';

/**
 * Shape returned by /api/generate via streamObject.
 * Streamed partially as the model produces it; the client can render
 * the in-progress SVG before the full object resolves.
 */
export const generationSchema = z.object({
  title: z
    .string()
    .min(1)
    .describe('Short product title, 2 to 5 words, captures the design.'),
  explanation: z
    .string()
    .describe('Brief one-or-two-sentence explanation of what you produced and any choices you made.'),
  svg: z
    .string()
    .describe(
      'Complete <svg>...</svg> markup. Use closed paths, clean curves, and stroke widths suitable for laser cutting, vinyl cutting, or CNC. Avoid raster effects, gradients with stops, and external references. Set viewBox and width/height attributes.',
    ),
});

export type GenerationObject = z.infer<typeof generationSchema>;
