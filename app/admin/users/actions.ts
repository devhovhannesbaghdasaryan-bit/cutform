'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { adjustCredits } from '@/lib/credits';
import { getServiceSupabase } from '@/lib/supabase/server';
import { writeAdminAuditLog } from '@/lib/transactions';

const userProfileSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'suspended', 'disabled']),
  preferredLocale: z.union([z.enum(['en', 'ru', 'am']), z.literal('')]),
  internalNotes: z.string().trim().optional(),
});

const creditAdjustmentSchema = z.object({
  userId: z.uuid(),
  direction: z.enum(['credit', 'debit']),
  amount: z.coerce.number().int().positive('Amount must be positive.'),
  reason: z.string().trim().min(3, 'Reason is required.'),
});

export async function updateAdminUserProfileAction(formData: FormData) {
  const parsed = userProfileSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
    status: formData.get('status'),
    preferredLocale: formData.get('preferredLocale'),
    internalNotes: formData.get('internalNotes') ?? undefined,
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid user update.');

  const { supabase, user } = await requireAdminPermission('users_manage');
  const values = parsed.data;

  const { data: before } = await supabase
    .from('profiles')
    .select('role, status, preferred_locale, internal_notes')
    .eq('user_id', values.userId)
    .maybeSingle<{
      role: string;
      status: string;
      preferred_locale: string | null;
      internal_notes: string | null;
    }>();

  const { error } = await supabase
    .from('profiles')
    .update({
      role: values.role,
      status: values.status,
      preferred_locale: values.preferredLocale || null,
      internal_notes: values.internalNotes ?? null,
    })
    .eq('user_id', values.userId);

  if (error) throw new Error(error.message);

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    targetUserId: values.userId,
    action: 'admin_user_profile_updated',
    entityType: 'profile',
    entityId: values.userId,
    reason: 'Admin profile update',
    metadata: { before, after: values },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${values.userId}`);
}

export async function adjustAdminUserCreditsAction(formData: FormData) {
  const parsed = creditAdjustmentSchema.safeParse({
    userId: formData.get('userId'),
    direction: formData.get('direction'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid credit adjustment.');
  }

  const { supabase, user } = await requireAdminPermission('balances_adjust');
  const values = parsed.data;
  const delta = values.direction === 'credit' ? values.amount : -values.amount;

  // credit_accounts/credit_ledger have no write RLS policy for any
  // authenticated role (including admins) — only the service-role client
  // bypasses RLS, so the balance mutation must go through it.
  const result = await adjustCredits(getServiceSupabase(), {
    userId: values.userId,
    delta,
    reason: 'admin_adjustment',
    createdBy: user.id,
    transactionType: 'manual_adjustment',
    transactionStatus: 'succeeded',
    metadata: {
      adminReason: values.reason,
      direction: values.direction,
      balanceType: 'credits',
    },
  });

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    targetUserId: values.userId,
    action: 'admin_credit_balance_adjusted',
    entityType: 'credit_account',
    entityId: values.userId,
    reason: values.reason,
    metadata: {
      delta,
      balanceType: 'credits',
      balance: result.balance,
      ledgerId: result.ledgerId,
    },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${values.userId}`);
  revalidatePath('/admin/transactions');
}
