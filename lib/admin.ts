import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/admin');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string }>();

  if (error || profile?.role !== 'admin') redirect('/dashboard');

  return { supabase, user };
}

export async function hasAdminPermission(userId: string, permission: AdminPermission) {
  const supabase = await getServerSupabase();

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string }>();

  return data?.role ?? 'user';
}
