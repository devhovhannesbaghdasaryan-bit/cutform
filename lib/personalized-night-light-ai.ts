import { z } from "zod";
import type { PersonalizationBoilerplate } from "@/lib/personalization-boilerplates";

/** Maps raw AI-provider errors to a customer-friendly generation message. */
export function friendlyGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("billing hard limit") ||
    message.includes("billing limit")
  ) {
    return "Image generation is temporarily unavailable because the AI service billing limit was reached. Please try again later or contact support. Any generation credits were refunded.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "The image service is busy right now. Please wait a moment and try again. Any generation credits were refunded.";
  }
  return "We could not generate your night-light previews. Please try again. Any generation credits were refunded.";
}

export const personalizedNightLightRequestSchema = z.object({
  modelId: z.string().uuid(),
  modelSlug: z.string().min(1),
  modelTitle: z.string().min(1),
  boilerplateImagePath: z.string().nullable(),
  userImagePaths: z.array(z.string().min(1)).length(1),
  customText: z.string().max(80),
  customTextFormatting: z.string().max(500).optional(),
  ledColor: z.string().nullable(),
  multiColor: z.boolean(),
  comfortableColors: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      hex: z.string(),
    }),
  ),
});

export type PersonalizedNightLightRequest = z.infer<
  typeof personalizedNightLightRequestSchema
>;

export function buildPersonalizedNightLightPrompt(
  input: PersonalizedNightLightRequest,
) {
  const parsed = personalizedNightLightRequestSchema.parse(input);
  const colorInstruction = parsed.multiColor
    ? "For the two UV-print options, use a restrained multi-color printed treatment with a warm, eye-comfortable edge glow. Keep the laser-engraved option strictly monochrome. Do not turn any panel into a rainbow or neon sign."
    : `Use the selected eye-comfortable LED color, ${parsed.ledColor ?? "warm_white"}, as the acrylic edge glow. Keep UV-printed artwork colors natural and harmonious with it; keep laser engraving monochrome.`;

  const exactText =
    parsed.customText ||
    "No personalized text was provided; do not invent a name, date, quote, or greeting.";

  return [
    "Generate only the single personalized acrylic LED night-light option explicitly requested at the end of the prompt; never create a collage or multiple products in one preview.",
    `Model: ${parsed.modelTitle} (${parsed.modelSlug}, ${parsed.modelId}).`,
    `Boilerplate/template image asset: ${parsed.boilerplateImagePath ?? "not provided; use the product construction described below"}. Follow it for the panel silhouette and base proportions when present.`,
    `User image assets: ${parsed.userImagePaths.join(", ")}. Treat these as the subject references, not as a background or a framed rectangular photo.`,
    `Personalized text: ${exactText}`,
    `Requested wood-engraving text styling: ${parsed.customTextFormatting || "No special formatting; use balanced typography."}`,
    "When personalized text is provided, reproduce every character exactly once as a dark laser engraving on the front face of the wooden base. Do not paraphrase it, add sample copy, or invent dates.",
    "The personalized text must never appear on the clear acrylic/glass panel, inside the printed artwork, or as glowing text. Reserve the acrylic panel exclusively for the user's image-derived artwork and decorative motifs.",
    colorInstruction,
    `Allowed comfortable colors: ${parsed.comfortableColors.map((color) => `${color.label} ${color.hex}`).join(", ")}.`,
    "",
    "PRODUCT CONSTRUCTION AND PREVIEW:",
    "- Show a real freestanding clear acrylic panel seated in a simple natural light-wood LED base. Preserve the panel and base shape shown in the boilerplate attached to the current option.",
    "- The artwork must appear printed or laser-engraved on transparent acrylic: all unprinted areas remain genuinely clear and the room is visible through them. Never render an opaque poster, screen, canvas, paper card, or solid illuminated slab.",
    "- Light enters from the base and creates a thin warm luminous edge and localized glow through engraved/printed marks. Avoid a uniformly glowing panel, harsh neon tubing, or floating artwork.",
    "- Present the complete product centered, front-facing or at a very slight three-quarter angle, fully inside a square ecommerce image. Use a tasteful bedside-table or shelf setting, shallow depth of field, soft dusk/indoor ambience, warm practical lighting, and photorealistic wood and acrylic materials.",
    "- Keep the base clean and plausible: one panel slot, stable proportions, no visible branding. Place all personalized text on the front face of the wooden base as subtle, physically plausible laser-engraved lettering.",
    "",
    "Use the attached boilerplate and the option-specific manufacturing instructions as authoritative product geometry and treatment.",
    "Do not force memorial, baby, wedding, birthday, or holiday symbolism unless supported by the inputs.",
    "",
    "SUBJECT AND DESIGN QUALITY:",
    "- Preserve the recognizable identity, defining features, pose, and relationships of people, pets, or objects in the user references. Do not add extra people, animals, limbs, faces, or unrelated objects.",
    "- Remove photographic backgrounds and translate the subject into crisp, tasteful acrylic-ready artwork. Use clean contours, controlled detail, balanced negative space, and no tiny visual noise near the panel edge or base slot.",
    "- UV-print options may use CMYK color plus a selective white-ink underbase. Keep unprinted regions transparent; do not flood-print the entire acrylic panel. Keep critical artwork away from cut edges and the base insertion zone.",
    "- Laser option must be achievable by a 100 W CO2 laser as cut, score, and engrave vectors: closed outer cut contour, no overlapping duplicate paths, no isolated floating pieces, and no bridges narrower than roughly twice the acrylic thickness unless separately approved.",
    "- Ensure the wooden-base engraving is correctly spelled, centered within safe margins, dark enough to read, and scaled to fit the available front face. Avoid text anywhere else, gibberish, watermarks, logos, price tags, packaging, hands, and duplicate products.",
    "",
    "OUTPUT:",
    "Return one polished customer-facing preview image for the requested option.",
    "Do not create, describe, or embed manufacturing SVG content in this customer preview request; production files are generated separately during admin review.",
  ].join("\n");
}

export function buildPersonalizedNightLightOpenAiPayload(
  input: PersonalizedNightLightRequest,
  selectedBoilerplates: Array<
    Pick<PersonalizationBoilerplate, "image_path" | "manufacturing_process">
  >,
) {
  const parsed = personalizedNightLightRequestSchema.parse(input);
  return {
    prompt: buildPersonalizedNightLightPrompt(parsed),
    images: [
      ...parsed.userImagePaths,
      ...(parsed.boilerplateImagePath ? [parsed.boilerplateImagePath] : []),
      ...selectedBoilerplates.map((reference) => reference.image_path),
    ],
    expectedOptions: selectedBoilerplates.length,
    outputContract: {
      previews: `${selectedBoilerplates.length} generated preview image paths or files`,
      metadata: [
        "modelId",
        "customText",
        "ledColor",
        "multiColor",
        "templateVersion",
      ],
      optionProcesses: selectedBoilerplates.map((reference, index) => ({
        optionIndex: index + 1,
        process: reference.manufacturing_process,
        publicPath: reference.image_path,
      })),
    },
  };
}
