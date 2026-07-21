import { describe, expect, it } from 'vitest';
import { decidePolarOutcome } from '@/lib/payments/polar-core';

describe('decidePolarOutcome', () => {
  const expected = { amountCents: 5000, currency: 'USD' };

  it('succeeds when paid and amount+currency match (case-insensitive currency)', () => {
    expect(decidePolarOutcome({ amountCents: 5000, currency: 'usd', paid: true }, expected)).toEqual({
      outcome: 'succeeded',
      amountMatches: true,
    });
  });

  it('is pending when Polar has not confirmed payment', () => {
    expect(decidePolarOutcome({ amountCents: 5000, currency: 'USD', paid: false }, expected)).toEqual({
      outcome: 'pending',
      amountMatches: true,
    });
  });

  it('fails a paid event whose amount does not match', () => {
    expect(decidePolarOutcome({ amountCents: 4200, currency: 'USD', paid: true }, expected)).toEqual({
      outcome: 'failed',
      amountMatches: false,
    });
  });

  it('fails a paid event whose currency does not match', () => {
    expect(decidePolarOutcome({ amountCents: 5000, currency: 'EUR', paid: true }, expected)).toEqual({
      outcome: 'failed',
      amountMatches: false,
    });
  });
});
