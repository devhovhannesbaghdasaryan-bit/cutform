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
  apiCostCents: number;
  markupCents: number;
  priceCents: number;
}

export function computePriceCents(inputUnits: number, outputUnits: number): PriceBreakdown {
  const inputCents = (inputUnits / 1_000_000) * PRICING.INPUT_USD_PER_MILLION * 100;
  const outputCents = (outputUnits / 1_000_000) * PRICING.OUTPUT_USD_PER_MILLION * 100;
  const apiCostCents = Math.round(inputCents + outputCents);
  return {
    apiCostCents,
    markupCents: PRICING.MARKUP_CENTS,
    priceCents: apiCostCents + PRICING.MARKUP_CENTS,
  };
}
