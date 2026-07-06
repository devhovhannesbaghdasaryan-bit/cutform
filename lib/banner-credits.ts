import type { SupabaseClient } from '@supabase/supabase-js';
import { adjustCredits } from '@/lib/credits';

export async function debitBannerCredits(
  supabase: SupabaseClient,
  input: {
    userId: string;
    amount: number;
    referenceType?: string | null;
    referenceId?: string | null;
    createdBy?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return adjustCredits(supabase, {
    userId: input.userId,
    delta: -input.amount,
    reason: 'generation_spend',
    referenceType: input.referenceType ?? 'banner_generation',
    referenceId: input.referenceId ?? null,
    createdBy: input.createdBy ?? null,
    transactionType: 'credit_spend',
    transactionStatus: 'succeeded',
    metadata: input.metadata,
  });
}

export async function refundBannerCredits(
  supabase: SupabaseClient,
  input: {
    userId: string;
    amount: number;
    referenceType?: string | null;
    referenceId?: string | null;
    createdBy?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return adjustCredits(supabase, {
    userId: input.userId,
    delta: input.amount,
    reason: 'generation_refund',
    referenceType: input.referenceType ?? 'banner_generation',
    referenceId: input.referenceId ?? null,
    createdBy: input.createdBy ?? null,
    transactionType: 'credit_refund',
    transactionStatus: 'succeeded',
    metadata: input.metadata,
  });
}
