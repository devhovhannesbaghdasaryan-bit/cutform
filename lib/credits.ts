import type { SupabaseClient } from '@supabase/supabase-js';
import { createTransactionRecord } from '@/lib/transactions';

export type CreditLedgerReason =
  | 'purchase'
  | 'generation_spend'
  | 'generation_refund'
  | 'admin_adjustment';

export interface CreditAdjustmentInput {
  userId: string;
  delta: number;
  reason: CreditLedgerReason;
  referenceType?: string | null;
  referenceId?: string | null;
  createdBy?: string | null;
  transactionType?: 'credit_purchase' | 'credit_spend' | 'credit_refund' | 'manual_adjustment';
  transactionStatus?: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'reversed';
  metadata?: Record<string, unknown>;
}

export async function getCreditBalance(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('credit_accounts')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle<{ balance: number }>();

  if (error) throw new Error(error.message);
  return data?.balance ?? 0;
}

/**
 * Error-tolerant balance lookup for display surfaces such as headers.
 * Returns 0 instead of throwing when the account is missing or unreadable.
 */
export async function getCreditBalanceForDisplay(supabase: SupabaseClient, userId: string) {
  try {
    return await getCreditBalance(supabase, userId);
  } catch {
    return 0;
  }
}

export async function adjustCredits(supabase: SupabaseClient, input: CreditAdjustmentInput) {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error('Credit adjustment delta must be a non-zero integer.');
  }

  const current = await getCreditBalance(supabase, input.userId);
  const nextBalance = current + input.delta;
  if (nextBalance < 0) throw new Error('Insufficient credit balance.');

  const { error: balanceError } = await supabase
    .from('credit_accounts')
    .upsert({ user_id: input.userId, balance: nextBalance }, { onConflict: 'user_id' });

  if (balanceError) throw new Error(balanceError.message);

  const { data: ledger, error: ledgerError } = await supabase
    .from('credit_ledger')
    .insert({
      user_id: input.userId,
      delta: input.delta,
      reason: input.reason,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
    })
    .select('id')
    .single<{ id: string }>();

  if (ledgerError || !ledger) {
    throw new Error(ledgerError?.message ?? 'Unable to create credit ledger entry.');
  }

  if (input.transactionType) {
    await createTransactionRecord(supabase, {
      userId: input.userId,
      creditLedgerId: ledger.id,
      type: input.transactionType,
      status: input.transactionStatus ?? 'succeeded',
      amountCents: 0,
      createdBy: input.createdBy ?? null,
      metadata: input.metadata,
    });
  }

  return { balance: nextBalance, ledgerId: ledger.id };
}

export function debitCredits(
  supabase: SupabaseClient,
  input: Omit<CreditAdjustmentInput, 'delta' | 'reason' | 'transactionType'> & { amount: number },
) {
  return adjustCredits(supabase, {
    ...input,
    delta: -input.amount,
    reason: 'generation_spend',
    transactionType: 'credit_spend',
  });
}

export function refundCredits(
  supabase: SupabaseClient,
  input: Omit<CreditAdjustmentInput, 'delta' | 'reason' | 'transactionType'> & { amount: number },
) {
  return adjustCredits(supabase, {
    ...input,
    delta: input.amount,
    reason: 'generation_refund',
    transactionType: 'credit_refund',
  });
}
