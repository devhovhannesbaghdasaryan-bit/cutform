import { describe, expect, it } from 'vitest';
import { adjustedPriceCents } from '@/lib/personalization-boilerplates';

describe('adjustedPriceCents', () => {
  it('returns the base price unchanged for a null percent', () => {
    expect(adjustedPriceCents(5000, null)).toBe(5000);
  });

  it('returns the base price unchanged for a 0 percent', () => {
    expect(adjustedPriceCents(5000, 0)).toBe(5000);
  });

  it('adds a positive percent as a surcharge', () => {
    expect(adjustedPriceCents(5000, 20)).toBe(6000);
  });

  it('subtracts a negative percent as a discount', () => {
    expect(adjustedPriceCents(5000, -10)).toBe(4500);
  });

  it('rounds to the nearest cent', () => {
    // 4999 * 1.03 = 5148.97 -> 5149
    expect(adjustedPriceCents(4999, 3)).toBe(5149);
  });

  it('floors at 0 for a percent below -100', () => {
    expect(adjustedPriceCents(5000, -150)).toBe(0);
  });
});
