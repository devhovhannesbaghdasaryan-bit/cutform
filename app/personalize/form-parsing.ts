// Plain module (no "use server"): server-action files may only export async
// functions, so the form schema and sync parsing helpers live here instead.
import { z } from 'zod';
import { COMFORTABLE_COLORS, DEFAULT_COLOR_VALUE, MAX_PERSONALIZED_PHOTOS, MAX_PERSONALIZED_TEXT_LENGTH } from '@/lib/personalization-constants';

/**
 * Structural parse of the generic personalize-item generation form. The
 * schema's job is shape/narrowing only — localized error-message selection
 * stays in the server action.
 */
export const generationFormSchema = z.object({
  catalogItemId: z.string().trim().min(1),
  customText: z.string().trim().max(MAX_PERSONALIZED_TEXT_LENGTH),
  color: z
    .string()
    .catch(DEFAULT_COLOR_VALUE)
    .transform((value) =>
      COMFORTABLE_COLORS.some((color) => color.value === value) ? value : DEFAULT_COLOR_VALUE,
    ),
  images: z.array(z.instanceof(File)).max(MAX_PERSONALIZED_PHOTOS),
  boilerplateIds: z
    .array(z.union([z.string(), z.instanceof(File)]))
    .transform((values) => [
      ...new Set(values.filter((value): value is string => typeof value === 'string')),
    ]),
});

export function getImageFiles(formData: FormData) {
  return formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function summarizeTextFormatting(value: FormDataEntryValue | null) {
  const html = typeof value === 'string' ? value.slice(0, 2_000) : '';
  const styles = [
    /<(b|strong)(\s|>)/i.test(html) ? 'bold emphasis' : null,
    /<(i|em)(\s|>)/i.test(html) ? 'italic emphasis' : null,
    /text-align\s*:\s*center|align=["']?center/i.test(html) ? 'center aligned' : 'left aligned',
  ].filter(Boolean);
  return styles.join(', ');
}
