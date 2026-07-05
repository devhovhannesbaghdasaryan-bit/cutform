// Plain module (no "use server"): server-action files may only export async
// functions, so the form schema and sync parsing helpers live here instead.
import { z } from "zod";
import { PERSONALIZED_NIGHT_LIGHT } from "@/lib/marketplace-constants";
import type { Json } from "@/lib/supabase/types";

/**
 * Structural parse of the personalized night-light generation form.
 * The schema's job is shape/narrowing only — the localized error-message
 * selection (t('errorUpload') / t('errorText') / ...) stays in the server
 * action because those messages depend on the request locale.
 */
export const generationFormSchema = z.object({
  modelId: z.string().trim().min(1),
  // Over-limit text fails the parse; the action maps it to t('errorText').
  customText: z.string().trim().max(PERSONALIZED_NIGHT_LIGHT.maxTextLength),
  // Anything that is not a known comfortable LED color falls back to the
  // default instead of failing (replaces the previous `as` cast + Set check).
  ledColor: z
    .string()
    .catch(PERSONALIZED_NIGHT_LIGHT.defaultLedColor)
    .transform((value) =>
      PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.some(
        (color) => color.value === value,
      )
        ? value
        : PERSONALIZED_NIGHT_LIGHT.defaultLedColor,
    ),
  // Wrong count fails the parse; the action maps it to t('errorUpload').
  images: z
    .array(z.instanceof(File))
    .length(PERSONALIZED_NIGHT_LIGHT.maxImages),
  // Non-string entries are dropped and duplicates removed; emptiness is
  // checked in the action (t('selectAtLeastOne')) after the model lookup.
  boilerplateIds: z
    .array(z.union([z.string(), z.instanceof(File)]))
    .transform((values) => [
      ...new Set(
        values.filter((value): value is string => typeof value === "string"),
      ),
    ]),
});

export function getImageFiles(formData: FormData) {
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function summarizeTextFormatting(value: FormDataEntryValue | null) {
  const html = typeof value === "string" ? value.slice(0, 2_000) : "";
  const styles = [
    /<(b|strong)(\s|>)/i.test(html) ? "bold emphasis" : null,
    /<(i|em)(\s|>)/i.test(html) ? "italic emphasis" : null,
    /text-align\s*:\s*center|align=["']?center/i.test(html)
      ? "center aligned"
      : "left aligned",
  ].filter(Boolean);
  return styles.join(", ");
}

export function resolveModelPriceCents(formSchema: Json) {
  const configured =
    formSchema && typeof formSchema === "object" && !Array.isArray(formSchema)
      ? Number(formSchema.basePriceCents)
      : Number.NaN;
  return Number.isFinite(configured) && configured >= 0
    ? Math.round(configured)
    : PERSONALIZED_NIGHT_LIGHT.defaultPriceCents;
}
