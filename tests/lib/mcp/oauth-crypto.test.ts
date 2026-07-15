import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashToken, verifyPkceChallenge } from '@/lib/mcp/oauth-crypto';

describe('generateOpaqueToken', () => {
  it('returns a url-safe, sufficiently long random string', () => {
    const token = generateOpaqueToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('never repeats across calls', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateOpaqueToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('same-input')).toBe(hashToken('same-input'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });

  it('never returns the raw input', () => {
    expect(hashToken('my-secret-token')).not.toBe('my-secret-token');
  });
});

describe('verifyPkceChallenge', () => {
  // RFC 7636 Appendix B test vector.
  it('accepts the RFC 7636 S256 example pair', () => {
    expect(
      verifyPkceChallenge(
        'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      ),
    ).toBe(true);
  });

  it('rejects a mismatched verifier', () => {
    expect(verifyPkceChallenge('wrong-verifier', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(
      false,
    );
  });
});
