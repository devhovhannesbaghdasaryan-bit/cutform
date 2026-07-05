import { describe, expect, it } from 'vitest';
import { LEGACY_LOCALE_COOKIE, LOCALE_COOKIE } from '@/lib/i18n-config';
import { CURRENCY_COOKIE, LEGACY_CURRENCY_COOKIE } from '@/lib/currency';
import { COUNTRY_COOKIE, LEGACY_COUNTRY_COOKIE } from '@/lib/market';
import { CART_SESSION_COOKIE, LEGACY_CART_SESSION_COOKIE } from '@/lib/cart-session';

// Phase 17 renamed every snip_* cookie to uq_* while keeping the exported
// constant names stable (smoke scripts assert the identifiers). Writes target
// the uq_* names; the snip_* names exist only as lossless read fallbacks.
describe('cookie name constants', () => {
  it('points the canonical constants at the new uq_* names', () => {
    expect(LOCALE_COOKIE).toBe('uq_locale');
    expect(CURRENCY_COOKIE).toBe('uq_currency');
    expect(COUNTRY_COOKIE).toBe('uq_country');
    expect(CART_SESSION_COOKIE).toBe('uq_cart_session');
  });

  it('keeps the legacy snip_* names available for dual-read fallback', () => {
    expect(LEGACY_LOCALE_COOKIE).toBe('snip_locale');
    expect(LEGACY_CURRENCY_COOKIE).toBe('snip_currency');
    expect(LEGACY_COUNTRY_COOKIE).toBe('snip_country');
    expect(LEGACY_CART_SESSION_COOKIE).toBe('snip_cart_session');
  });

  it('never pairs a canonical name with itself as the legacy fallback', () => {
    expect(LOCALE_COOKIE).not.toBe(LEGACY_LOCALE_COOKIE);
    expect(CURRENCY_COOKIE).not.toBe(LEGACY_CURRENCY_COOKIE);
    expect(COUNTRY_COOKIE).not.toBe(LEGACY_COUNTRY_COOKIE);
    expect(CART_SESSION_COOKIE).not.toBe(LEGACY_CART_SESSION_COOKIE);
  });
});
