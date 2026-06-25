import { cookies } from 'next/headers';

export const CART_SESSION_COOKIE = 'snip_cart_session';

export async function getCartSessionId({ create = false }: { create?: boolean } = {}) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (existing) return existing;
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
}
