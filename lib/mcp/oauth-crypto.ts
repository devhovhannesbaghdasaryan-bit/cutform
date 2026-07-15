import { createHash, randomBytes } from 'node:crypto';

const OPAQUE_TOKEN_BYTES = 32;

/** A random, URL-safe opaque secret — used for authorization codes, access tokens, and refresh tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
}

/** SHA-256 hash for at-rest storage of opaque secrets; never store the raw value. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** RFC 7636 S256 PKCE verification: challenge must equal base64url(sha256(verifier)). */
export function verifyPkceChallenge(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return computed === codeChallenge;
}
