import { cookies } from 'next/headers';

// Writes always target CART_SESSION_COOKIE; LEGACY_CART_SESSION_COOKIE exists
// only as a read fallback so pre-rename guests keep their cart (Phase 17).
export const CART_SESSION_COOKIE = 'uq_cart_session';
export const LEGACY_CART_SESSION_COOKIE = 'snip_cart_session';

export async function getCartSessionId({ create = false }: { create?: boolean } = {}) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (existing) return existing;

  const legacy = cookieStore.get(LEGACY_CART_SESSION_COOKIE)?.value;
  if (legacy) {
    // Migrate the legacy value to the new name when we are allowed to write
    // cookies (create=true call sites are Server Actions / Route Handlers;
    // create=false is also used during render, where writes would throw).
    if (create) {
      cookieStore.set(CART_SESSION_COOKIE, legacy, {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return legacy;
  }

  if (!create) return null;

  const value = crypto.randomUUID();
  cookieStore.set(CART_SESSION_COOKIE, value, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });
  return value;
}

export async function clearCartSessionId() {
  const cookieStore = await cookies();
  cookieStore.delete(CART_SESSION_COOKIE);
  cookieStore.delete(LEGACY_CART_SESSION_COOKIE);
}
