/** Maps raw AI-provider errors to a customer-friendly generation message. */
export function friendlyGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('billing hard limit') || message.includes('billing limit')) {
    return 'Image generation is temporarily unavailable because the AI service billing limit was reached. Please try again later or contact support. Any generation credits were refunded.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'The image service is busy right now. Please wait a moment and try again. Any generation credits were refunded.';
  }
  return 'We could not generate your previews. Please try again. Any generation credits were refunded.';
}

export interface PersonalizationPromptInput {
  systemPrompt: string | null;
  boilerplateInstruction: string | null;
  personalizedText: string | null;
  personalizedTextFormatting: string | null;
  colorLabel: string | null;
  colorHex: string | null;
  hasPhoto: boolean;
  /**
   * True when the preview is rendered from an already generated manufacturing
   * artwork instead of the raw customer photo (two-step generation).
   */
  fromManufacturingArtwork?: boolean;
}

export const MANUFACTURING_ARTWORK_NOTE =
  'The customer photo has already been converted into the final production artwork, attached as MANUFACTURING ARTWORK. Wherever the instructions above refer to the customer photo as the source of the subject or artwork, use the manufacturing artwork instead: put exactly its content on the product the way the selected style produces it, without redrawing, restyling, recropping, simplifying, adding or removing anything. The preview must show precisely the item that will be produced.';

/**
 * Manufacturing prompt placeholders. `{{#text}}…{{/text}}` keeps its content
 * only when the customer entered text; inside it (or anywhere) `{{text}}` is
 * the customer's exact text and `{{textStyle}}` their styling choices.
 */
const MANUFACTURING_TEXT_SECTION = /\{\{#text\}\}([\s\S]*?)\{\{\/text\}\}/g;
export const MANUFACTURING_TEXT_PLACEHOLDER = '{{text}}';
export const MANUFACTURING_TEXT_STYLE_PLACEHOLDER = '{{textStyle}}';
const DEFAULT_TEXT_STYLE = 'regular weight, centered';

/**
 * Builds the prompt for the manufacturing PNG step from a boilerplate's
 * manufacturing prompt. Customer text reaches the artwork only where the
 * admin placed a placeholder: text produced elsewhere (e.g. engraved on a
 * wooden base) must not leak into the panel artwork.
 */
export function composeManufacturingPrompt(
  manufacturingPrompt: string,
  personalizedText: string | null,
  personalizedTextFormatting: string | null = null,
): string {
  // Style before text, so a customer's text is never itself re-substituted.
  return manufacturingPrompt
    .replace(MANUFACTURING_TEXT_SECTION, (_, section: string) => (personalizedText ? section : ''))
    .split(MANUFACTURING_TEXT_STYLE_PLACEHOLDER)
    .join(personalizedTextFormatting || DEFAULT_TEXT_STYLE)
    .split(MANUFACTURING_TEXT_PLACEHOLDER)
    .join(personalizedText ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Composes the AI generation prompt from an item's admin-authored System
 * Prompt plus whichever tag-driven inputs the customer supplied. Replaces the
 * hardcoded night-light-specific prompt builder: product domain language now
 * lives entirely in the admin-authored System Prompt.
 */
export function composePersonalizationPrompt(input: PersonalizationPromptInput): string {
  const parts = [
    input.systemPrompt?.trim() || null,
    input.boilerplateInstruction?.trim() || null,
    input.personalizedText
      ? `Personalized text: ${input.personalizedText}${input.personalizedTextFormatting ? ` (styling: ${input.personalizedTextFormatting})` : ''}.`
      : null,
    input.colorLabel
      ? `Use color: ${input.colorLabel}${input.colorHex ? ` (${input.colorHex})` : ''}.`
      : null,
    input.fromManufacturingArtwork
      ? MANUFACTURING_ARTWORK_NOTE
      : input.hasPhoto
        ? 'A customer photo is attached and is the only source of the subject: keep the result as similar to it as the product style allows, with exactly the same number of people, the same pose, identity and defining features. Never add, remove or duplicate a subject, and never copy subjects from the product template image.'
        : null,
  ];
  return parts.filter((part): part is string => Boolean(part)).join('\n\n');
}
