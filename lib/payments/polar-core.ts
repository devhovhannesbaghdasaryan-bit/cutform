// Pure Polar settlement decision logic. No env or Next imports — unit-tested
// outside the Next runtime.
export function decidePolarOutcome(
  paid: { amountCents: number; currency: string; paid: boolean },
  expected: { amountCents: number; currency: string },
): { outcome: 'succeeded' | 'failed' | 'pending'; amountMatches: boolean } {
  const amountMatches =
    Number.isFinite(paid.amountCents) &&
    Math.round(paid.amountCents) === Math.round(expected.amountCents) &&
    paid.currency.toUpperCase() === expected.currency.toUpperCase();

  if (!paid.paid) return { outcome: 'pending', amountMatches };
  return { outcome: amountMatches ? 'succeeded' : 'failed', amountMatches };
}
