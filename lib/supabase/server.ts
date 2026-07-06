import { cookies } from 'next/headers';
import { cache } from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import type { Database, TypedSupabaseClient } from '@/lib/supabase/types';

/**
 * Server-side Supabase client wired to the current request's cookies.
 * Use from Server Components, server actions, and route handlers.
 *
 * Memoized with React.cache: this client is bound to the current request's
 * cookies (and therefore this user's session), so it must NOT be shared across
 * requests — a process-wide singleton would leak one user's session into
 * another's. cache() scopes memoization to a single request, so every caller
 * within one request shares one client instead of constructing a new one (and
 * a new auth sub-client) each time.
 */
export const getServerSupabase = cache(async () => {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          // In Server Components, set() throws; ignore that case.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // No-op: Server Component context — middleware will refresh.
          }
        },
      },
    },
  );
});

/**
 * Secret-key client for privileged operations. Never expose to the browser.
 * Legacy service-role keys remain supported for local Supabase compatibility.
 *
 * Stateless (fixed service key, no cookies, no session persistence), so a
 * single lazily-created instance is reused for the process lifetime rather than
 * rebuilt on every call. Unlike getServerSupabase it carries no per-user state,
 * so cross-request reuse is safe.
 */
let serviceClient: TypedSupabaseClient | null = null;

export function getServiceSupabase(): TypedSupabaseClient {
  if (serviceClient) return serviceClient;

  const env = getServerEnv();
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_SECRET_KEY is required for this operation');
  }
  serviceClient = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return serviceClient;
}
