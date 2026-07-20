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
    input.hasPhoto
      ? 'A user photo is attached as the subject reference; preserve its recognizable identity and defining features.'
      : null,
  ];
  return parts.filter((part): part is string => Boolean(part)).join('\n\n');
}
