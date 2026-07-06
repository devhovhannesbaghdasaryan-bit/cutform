'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { createTransactionRecord, writeAdminAuditLog } from '@/lib/transactions';
import { settleAmeriaPayment } from '@/lib/payments/fulfillment';
import { getServiceSupabase } from '@/lib/supabase/server';

const transactionActionSchema = z.object({
  transactionId: z.string().uuid(),
  actionType: z.enum(['note', 'manual_refund', 'reversal', 'reconcile', 'ameria_check']),
  status: z
    .enum(['pending', 'succeeded', 'failed', 'cancelled', 'reversed'])
    .optional()
    .or(z.literal('')),
  amountCents: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().min(3, 'Note or reason is required.'),
});

export async function adminTransactionAction(formData: FormData) {
  const parsed = transactionActionSchema.safeParse({
    transactionId: formData.get('transactionId'),
    actionType: formData.get('actionType'),
    status: formData.get('status') || '',
    amountCents: formData.get('amountCents') || undefined,
    note: formData.get('note'),
  });

  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid transaction action.');

  const { supabase, user } = await requireAdminPermission('transactions_manage');
  const values = parsed.data;
  const { data: transaction, error } = await supabase
    .from('transactions')
    .select(
      'id, user_id, order_id, type, status, amount_cents, currency, provider, payment_provider_route, provider_reference, exchange_rate_context, metadata',
    )
    .eq('id', values.transactionId)
    .maybeSingle<{
      id: string;
      user_id: string | null;
      order_id: string | null;
      type: string;
      status: string;
      amount_cents: number;
      currency: string;
      provider: string | null;
      payment_provider_route: string | null;
      provider_reference: string | null;
      exchange_rate_context: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }>();

  if (error || !transaction) throw new Error(error?.message ?? 'Transaction not found.');

  if (values.actionType === 'note') {
    await writeAdminAuditLog(supabase, {
      actorUserId: user.id,
      targetUserId: transaction.user_id,
      action: 'transaction_review_note',
      entityType: 'transaction',
      entityId: transaction.id,
      reason: values.note,
      metadata: { transactionStatus: transaction.status },
    });
  }

  if (values.actionType === 'manual_refund' || values.actionType === 'reversal') {
    const amountCents = values.amountCents ?? transaction.amount_cents;
    const correction = await createTransactionRecord(supabase, {
      userId: transaction.user_id,
      orderId: transaction.order_id,
      type: values.actionType === 'manual_refund' ? 'refund' : 'reversal',
      status: 'succeeded',
      amountCents,
      currency: transaction.currency,
      provider: 'manual_admin',
      paymentProviderRoute: transaction.payment_provider_route ?? transaction.provider,
      exchangeRateContext: transaction.exchange_rate_context,
      adminReason: values.note,
      createdBy: user.id,
      metadata: {
        originalTransactionId: transaction.id,
        originalType: transaction.type,
        originalStatus: transaction.status,
        originalProvider: transaction.provider,
        originalProviderReference: transaction.provider_reference,
      },
    });

    await writeAdminAuditLog(supabase, {
      actorUserId: user.id,
      targetUserId: transaction.user_id,
      action:
        values.actionType === 'manual_refund'
          ? 'transaction_manual_refund'
          : 'transaction_reversal_created',
      entityType: 'transaction',
      entityId: correction.id,
      reason: values.note,
      metadata: { originalTransactionId: transaction.id, amountCents },
    });
  }

  if (values.actionType === 'reconcile') {
    if (!values.status) throw new Error('Choose a reconciliation status.');
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: values.status,
        metadata: {
          ...(transaction.metadata ?? {}),
          reconciledBy: user.id,
          reconciledAt: new Date().toISOString(),
          reconciliationNote: values.note,
        },
      })
      .eq('id', transaction.id);

    if (updateError) throw new Error(updateError.message);

    await writeAdminAuditLog(supabase, {
      actorUserId: user.id,
      targetUserId: transaction.user_id,
      action: 'transaction_status_reconciled',
      entityType: 'transaction',
      entityId: transaction.id,
      reason: values.note,
      metadata: { before: transaction.status, after: values.status },
    });
  }

  if (values.actionType === 'ameria_check') {
    if (transaction.provider !== 'ameria' && transaction.payment_provider_route !== 'ameria') {
      throw new Error('This transaction did not go through Ameriabank.');
    }
    if (!transaction.provider_reference) {
      throw new Error('Transaction has no Ameriabank PaymentID to check.');
    }

    const result = await settleAmeriaPayment(getServiceSupabase(), transaction.provider_reference);

    await writeAdminAuditLog(supabase, {
      actorUserId: user.id,
      targetUserId: transaction.user_id,
      action: 'transaction_ameria_checked',
      entityType: 'transaction',
      entityId: transaction.id,
      reason: values.note,
      metadata: { before: transaction.status, outcome: result.outcome },
    });
  }

  revalidatePath('/admin/transactions');
  revalidatePath(`/admin/transactions/${transaction.id}`);
}
