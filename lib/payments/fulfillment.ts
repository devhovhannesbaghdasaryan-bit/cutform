import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { adjustCredits } from '@/lib/credits';
import { decideOutcome } from '@/lib/payments/ameria-core';
import { fetchAmeriaPaymentDetails } from '@/lib/payments/ameria';
import type { PaymentOutcome } from '@/lib/payments/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SettleTransaction {
  id: string;
  user_id: string | null;
  order_id: string | null;
  type: string;
  status: string;
  amount_cents: number;
  currency: string;
  metadata: Record<string, unknown>;
}

export interface SettleResult {
  outcome: PaymentOutcome | 'not_found' | 'already_succeeded' | 'needs_attention';
  redirectPath: string;
}

function redirectBase(transaction: SettleTransaction) {
  return transaction.type === 'payment' && transaction.order_id
    ? `/orders/${transaction.order_id}`
    : '/credits';
}

export async function fulfillOrderPayment(service: SupabaseClient, transaction: SettleTransaction) {
  if (!transaction.order_id) throw new Error('Payment transaction has no linked order.');

  const { error: orderError } = await service
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'review_required',
      transaction_id: transaction.id,
    })
    .eq('id', transaction.order_id);
  if (orderError) throw new Error(orderError.message);
}

export async function fulfillCreditPurchase(service: SupabaseClient, transaction: SettleTransaction) {
  const creditAmount = Number(transaction.metadata?.creditAmount ?? 0);
  if (!transaction.user_id || !Number.isInteger(creditAmount) || creditAmount <= 0) {
    throw new Error('Credit purchase transaction is missing fulfillment metadata.');
  }

  // A ledger row for this transaction means credits were already granted on a
  // previous attempt that failed before linking the ledger id — backfill only.
  const { data: existingLedger, error: ledgerLookupError } = await service
    .from('credit_ledger')
    .select('id')
    .eq('reference_type', 'payment_transaction')
    .eq('reference_id', transaction.id)
    .maybeSingle<{ id: string }>();
  if (ledgerLookupError) throw new Error(ledgerLookupError.message);
  if (existingLedger) {
    const { error: backfillError } = await service
      .from('transactions')
      .update({ credit_ledger_id: existingLedger.id })
      .eq('id', transaction.id);
    if (backfillError) throw new Error(backfillError.message);
    return;
  }

  const ledger = await adjustCredits(service, {
    userId: transaction.user_id,
    delta: creditAmount,
    reason: 'purchase',
    referenceType: 'payment_transaction',
    referenceId: transaction.id,
    metadata: {
      transactionId: transaction.id,
      packKey: transaction.metadata?.packKey ?? null,
    },
  });

  const { error } = await service
    .from('transactions')
    .update({ credit_ledger_id: ledger.ledgerId })
    .eq('id', transaction.id);
  if (error) throw new Error(error.message);
}

async function claimTransactionSuccess(service: SupabaseClient, transactionId: string): Promise<boolean> {
  // Claims from failed/cancelled too: this runs only after the bank confirmed
  // an amount-verified success, so bank truth heals an earlier mis-verdict.
  const { data, error } = await service
    .from('transactions')
    .update({ status: 'succeeded' })
    .eq('id', transactionId)
    .in('status', ['pending', 'failed', 'cancelled'])
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function settleAmeriaPayment(
  service: SupabaseClient,
  paymentId: string,
): Promise<SettleResult> {
  const details = await fetchAmeriaPaymentDetails(paymentId);

  const transactionId = details.opaque;
  if (!transactionId || !UUID_RE.test(transactionId)) {
    return { outcome: 'not_found', redirectPath: '/?checkout=invalid' };
  }

  const { data: transaction, error } = await service
    .from('transactions')
    .select('id, user_id, order_id, type, status, amount_cents, currency, metadata')
    .eq('id', transactionId)
    .maybeSingle<SettleTransaction>();
  if (error) throw new Error(error.message);
  if (!transaction) return { outcome: 'not_found', redirectPath: '/?checkout=invalid' };

  const base = redirectBase(transaction);
  if (transaction.status === 'succeeded') {
    return { outcome: 'already_succeeded', redirectPath: `${base}?checkout=success` };
  }

  const { outcome, amountMatches } = decideOutcome(details, {
    amountCents: transaction.amount_cents,
    currency: transaction.currency,
  });

  if (outcome === 'succeeded') {
    const claimed = await claimTransactionSuccess(service, transaction.id);
    if (!claimed) {
      const { data: current, error: statusError } = await service
        .from('transactions')
        .select('status')
        .eq('id', transaction.id)
        .maybeSingle<{ status: string }>();
      if (statusError) throw new Error(statusError.message);
      if (current?.status === 'succeeded') {
        return { outcome: 'already_succeeded', redirectPath: `${base}?checkout=success` };
      }
      // e.g. status 'reversed': bank says paid but the row was administratively
      // closed — do not fulfill and do not claim success.
      return { outcome: 'needs_attention', redirectPath: `${base}?checkout=pending` };
    }
    try {
      if (transaction.type === 'credit_purchase') {
        await fulfillCreditPurchase(service, transaction);
      } else {
        await fulfillOrderPayment(service, transaction);
      }
    } catch (error) {
      // Give a later retry (callback replay or admin check) another chance
      // instead of leaving a succeeded transaction with no fulfillment.
      const { error: rollbackError } = await service
        .from('transactions')
        .update({ status: 'pending' })
        .eq('id', transaction.id)
        .eq('status', 'succeeded');
      if (rollbackError) {
        console.error('[ameria-settle] failed to roll back claim', transaction.id, rollbackError.message);
      }
      throw error;
    }
    return { outcome, redirectPath: `${base}?checkout=success` };
  }

  if (outcome === 'pending') {
    return { outcome, redirectPath: `${base}?checkout=pending` };
  }

  const { error: updateError } = await service
    .from('transactions')
    .update({
      status: outcome === 'cancelled' ? 'cancelled' : 'failed',
      metadata: {
        ...(transaction.metadata ?? {}),
        ameriaPaymentState: details.paymentState,
        ameriaResponseCode: details.responseCode,
        ameriaAmountMatches: amountMatches,
      },
    })
    .eq('id', transaction.id);
  if (updateError) throw new Error(updateError.message);

  return { outcome, redirectPath: `${base}?checkout=${outcome}` };
}
