import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';

/**
 * Server-side Supabase client wired to the current request's cookies.
 * Use from Server Components, server actions, and route handlers.
 */
export async function getServerSupabase() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
}

/**
 * Service-role client for privileged operations (e.g., deleting storage objects
 * during approval cleanup). Never expose to the browser.
 */
export function getServiceSupabase() {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for this operation');
  }
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
