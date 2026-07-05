import type { AppLocale } from '@/lib/i18n';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { writeAdminAuditLog } from '@/lib/transactions';

export interface AdminUserFilters {
  q?: string;
  role?: string;
  status?: string;
}

export interface AdminUserUpdateInput {
  targetUserId: string;
  actorUserId: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'disabled';
  preferredLocale?: AppLocale | null;
  internalNotes?: string | null;
}

export async function listAdminUsers(
  supabase: TypedSupabaseClient,
  filters: AdminUserFilters = {},
) {
  let query = supabase
    .from('profiles')
    .select('user_id, role, status, display_name, preferred_locale, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.status) query = query.eq('status', filters.status);

  const { data: users, error } = await query;
  const search = filters.q?.trim().toLowerCase();
  const filteredUsers = (users ?? []).filter((user) => {
    if (!search) return true;
    return (
      user.user_id.toLowerCase().includes(search)
      || user.display_name?.toLowerCase().includes(search)
    );
  });

  const userIds = filteredUsers.map((user) => user.user_id);
  const { data: balances } = userIds.length
    ? await supabase
        .from('credit_accounts')
        .select('user_id, balance')
        .in('user_id', userIds)
    : { data: [] };
  const { data: orderOwners } = userIds.length
    ? await supabase.from('orders').select('user_id').in('user_id', userIds)
    : { data: [] };

  const balanceByUser = new Map((balances ?? []).map((row) => [row.user_id, row]));
  const orderCountByUser = new Map<string, number>();
  for (const row of orderOwners ?? []) {
    orderCountByUser.set(row.user_id, (orderCountByUser.get(row.user_id) ?? 0) + 1);
  }

  return { users: filteredUsers, error, balanceByUser, orderCountByUser };
}

export async function getAdminUserDetail(supabase: TypedSupabaseClient, userId: string) {
  const [
    { data: profile, error },
    { data: balance },
    { data: orders },
    { data: generatedItems },
    { data: transactions },
    { data: auditRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, role, status, display_name, preferred_locale, internal_notes, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('credit_accounts')
      .select('balance, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, status, payment_status, subtotal_cents, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('generated_items')
      .select('id, title, product_type, review_status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('transactions')
      .select('id, type, status, amount_cents, currency, provider, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('admin_audit_log')
      .select('id, action, reason, created_at')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  if (error || !profile) return null;

  return {
    profile,
    balance,
    orders: orders ?? [],
    generatedItems: generatedItems ?? [],
    transactions: transactions ?? [],
    auditRows: auditRows ?? [],
  };
}

export async function updateAdminUserProfile(
  supabase: TypedSupabaseClient,
  input: AdminUserUpdateInput,
) {
  const { data: before } = await supabase
    .from('profiles')
    .select('role, status, preferred_locale, internal_notes')
    .eq('user_id', input.targetUserId)
    .maybeSingle();

  const { error } = await supabase
    .from('profiles')
    .update({
      role: input.role,
      status: input.status,
      preferred_locale: input.preferredLocale ?? null,
      internal_notes: input.internalNotes ?? null,
    })
    .eq('user_id', input.targetUserId);

  if (error) throw new Error(error.message);

  await writeAdminAuditLog(supabase, {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    action: 'admin_user_profile_updated',
    entityType: 'profile',
    entityId: input.targetUserId,
    reason: 'Admin profile update',
    metadata: {
      before,
      after: {
        role: input.role,
        status: input.status,
        preferredLocale: input.preferredLocale ?? null,
        internalNotes: input.internalNotes ?? null,
      },
    },
  });
}
