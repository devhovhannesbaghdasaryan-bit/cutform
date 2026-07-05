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
  outcome: PaymentOutcome | 'not_found' | 'already_succeeded';
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
  const { data, error } = await service
    .from('transactions')
    .update({ status: 'succeeded' })
    .eq('id', transactionId)
    .eq('status', 'pending')
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
      return { outcome: 'already_succeeded', redirectPath: `${base}?checkout=success` };
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
      await service
        .from('transactions')
        .update({ status: 'pending' })
        .eq('id', transaction.id)
        .eq('status', 'succeeded');
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
