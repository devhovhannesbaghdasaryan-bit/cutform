import { z } from 'zod';

export const personalizedNightLightRequestSchema = z.object({
  modelId: z.string().uuid(),
  modelSlug: z.string().min(1),
  modelTitle: z.string().min(1),
  boilerplateImagePath: z.string().nullable(),
  userImagePaths: z.array(z.string().min(1)).min(1).max(3),
  customText: z.string().max(100),
  ledColor: z.string().nullable(),
  multiColor: z.boolean(),
  comfortableColors: z.array(z.object({
    value: z.string(),
    label: z.string(),
    hex: z.string(),
  })),
});

export type PersonalizedNightLightRequest = z.infer<typeof personalizedNightLightRequestSchema>;

export function buildPersonalizedNightLightPrompt(input: PersonalizedNightLightRequest) {
  const parsed = personalizedNightLightRequestSchema.parse(input);
  const colorInstruction = parsed.multiColor
    ? 'Use multi-color LED lighting. Do not choose a single LED color.'
    : `Use the selected eye-comfortable LED color: ${parsed.ledColor ?? 'warm_white'}.`;

  return [
    'Create exactly 3 personalized night light preview options and hidden production SVGs.',
    `Model: ${parsed.modelTitle} (${parsed.modelSlug}, ${parsed.modelId}).`,
    `Boilerplate/template image asset: ${parsed.boilerplateImagePath ?? 'not provided yet'}.`,
    `User image assets: ${parsed.userImagePaths.join(', ')}.`,
    `Base text, preserve exactly: ${parsed.customText || 'No text provided'}.`,
    colorInstruction,
    `Allowed comfortable colors: ${parsed.comfortableColors.map((color) => `${color.label} ${color.hex}`).join(', ')}.`,
    'For each of the 3 options return a preview image suitable for user choice and a hidden sanitized manufacturing SVG for admin/order storage.',
    'SVGs must separate acrylic engraving, wood base cut, and wood base engraving layers.',
    'Do not expose hidden SVG content in user-facing preview copy.',
  ].join('\n');
}

export function buildPersonalizedNightLightOpenAiPayload(input: PersonalizedNightLightRequest) {
  const parsed = personalizedNightLightRequestSchema.parse(input);
  return {
    prompt: buildPersonalizedNightLightPrompt(parsed),
    images: [
      ...parsed.userImagePaths,
      ...(parsed.boilerplateImagePath ? [parsed.boilerplateImagePath] : []),
    ],
    expectedOptions: 3,
    outputContract: {
      previews: '3 generated preview image paths or files',
      hiddenSvgs: '3 hidden manufacturing SVG paths or files',
      metadata: ['modelId', 'customText', 'ledColor', 'multiColor', 'templateVersion'],
    },
  };
}
