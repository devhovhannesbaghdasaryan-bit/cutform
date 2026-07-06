import type { SupabaseClient } from '@supabase/supabase-js';

export const TRANSACTION_TYPES = [
  'payment',
  'refund',
  'credit_purchase',
  'credit_spend',
  'credit_refund',
  'manual_adjustment',
  'reversal',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'reversed',
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface AuditLogInput {
  actorUserId: string;
  targetUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TransactionInput {
  userId?: string | null;
  orderId?: string | null;
  generatedItemId?: string | null;
  creditLedgerId?: string | null;
  type: TransactionType;
  status?: TransactionStatus;
  amountCents?: number;
  currency?: string;
  provider?: string | null;
  paymentProviderRoute?: string | null;
  providerReference?: string | null;
  adminReason?: string | null;
  exchangeRateContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
  createdBy?: string | null;
}

export async function createTransactionRecord(supabase: SupabaseClient, input: TransactionInput) {
  if (input.idempotencyKey) {
    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('id')
      .contains('metadata', { idempotencyKey: input.idempotencyKey })
      .maybeSingle<{ id: string }>();

    if (existingError) throw new Error(existingError.message);
    if (existing) return existing;
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: input.userId ?? null,
      order_id: input.orderId ?? null,
      credit_ledger_id: input.creditLedgerId ?? null,
      type: input.type,
      status: input.status ?? 'pending',
      amount_cents: input.amountCents ?? 0,
      currency: input.currency ?? 'AMD',
      provider: input.provider ?? null,
      payment_provider_route: input.paymentProviderRoute ?? input.provider ?? null,
      provider_reference: input.providerReference ?? null,
      admin_reason: input.adminReason ?? null,
      exchange_rate_context: input.exchangeRateContext ?? {},
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.generatedItemId ? { generatedItemId: input.generatedItemId } : {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      },
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) throw new Error(error?.message ?? 'Unable to create transaction.');
  return data;
}

export function createCreditPurchaseTransaction(
  supabase: SupabaseClient,
  input: Omit<TransactionInput, 'type'>,
) {
  return createTransactionRecord(supabase, { ...input, type: 'credit_purchase' });
}

export async function writeAdminAuditLog(supabase: SupabaseClient, input: AuditLogInput) {
  const { error } = await supabase.from('admin_audit_log').insert({
    actor_user_id: input.actorUserId,
    target_user_id: input.targetUserId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
}
