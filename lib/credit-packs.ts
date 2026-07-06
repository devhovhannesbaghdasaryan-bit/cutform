export const CREDIT_PACKS = [
  {
    key: 'starter',
    name: 'Starter pack',
    creditAmount: 25,
    priceCents: 200000,
    currency: 'AMD',
    description: 'Enough for a few small AI generation attempts.',
  },
  {
    key: 'maker',
    name: 'Maker pack',
    creditAmount: 75,
    priceCents: 480000,
    currency: 'AMD',
    description: 'Best for iterating on night lights and 2D designs.',
  },
  {
    key: 'studio',
    name: 'Studio pack',
    creditAmount: 200,
    priceCents: 1120000,
    currency: 'AMD',
    description: 'For repeated product experiments and banner work.',
  },
] as const;

export function getCreditPack(key: string) {
  return CREDIT_PACKS.find((pack) => pack.key === key) ?? null;
}
