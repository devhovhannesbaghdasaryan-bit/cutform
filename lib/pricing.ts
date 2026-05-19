/**
 * Pricing constants. Update here when OpenAI re-prices.
 * Current rates: GPT-4o, source https://openai.com/api/pricing
 */
export const PRICING = {
  INPUT_USD_PER_MILLION: 2.5,
  OUTPUT_USD_PER_MILLION: 10.0,
  MARKUP_CENTS: 1000,
} as const;

export interface PriceBreakdown {
  tokenCostCents: number;
  markupCents: number;
  priceCents: number;
}

export function computePriceCents(inputTokens: number, outputTokens: number): PriceBreakdown {
  const inputCents = (inputTokens / 1_000_000) * PRICING.INPUT_USD_PER_MILLION * 100;
  const outputCents = (outputTokens / 1_000_000) * PRICING.OUTPUT_USD_PER_MILLION * 100;
  const tokenCostCents = Math.round(inputCents + outputCents);
  return {
    tokenCostCents,
    markupCents: PRICING.MARKUP_CENTS,
    priceCents: tokenCostCents + PRICING.MARKUP_CENTS,
  };
}
