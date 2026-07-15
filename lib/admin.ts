import { redirect } from 'next/navigation';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import type { TypedSupabaseClient } from '@/lib/supabase/types';

export const ADMIN_PERMISSIONS = [
  'catalog_manage',
  'seo_manage',
  'orders_manage',
  'generated_review',
  'users_manage',
  'transactions_manage',
  'balances_adjust',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export async function requireAdmin() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

  if (!user) redirect('/login?next=/admin');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string }>();

  if (error || profile?.role !== 'admin') redirect('/dashboard');

  return { supabase, user };
}

/**
 * `supabaseOverride` lets callers with no browser session cookie (e.g. an
 * MCP request authenticated by a Bearer token, not Supabase Auth cookies)
 * pass a service-role client instead of the cookie-bound default — without
 * it, `getServerSupabase()` resolves no `auth.uid()` for RLS to match and
 * this would incorrectly return false for every real admin.
 */
export async function hasAdminPermission(
  userId: string,
  permission: AdminPermission,
  supabaseOverride?: TypedSupabaseClient,
) {
  const supabase = supabaseOverride ?? (await getServerSupabase());

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle<{ role: string }>();

  if (profile?.role !== 'admin') return false;

  const { data, error } = await supabase
    .from('admin_permissions')
    .select('permission')
    .eq('user_id', userId)
    .eq('permission', permission)
    .maybeSingle<{ permission: AdminPermission }>();

  if (error) return false;
  return Boolean(data);
}

export async function requireAdminPermission(permission: AdminPermission) {
  const context = await requireAdmin();
  const allowed = await hasAdminPermission(context.user.id, permission);

  if (!allowed) redirect('/admin');
  return context;
}

export async function getCurrentUserRole() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string }>();

  return data?.role ?? 'user';
}
