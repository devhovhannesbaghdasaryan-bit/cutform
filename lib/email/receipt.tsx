import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { CreditsReceiptEmail } from '@/emails/credits-receipt';
import { OrderReceiptEmail } from '@/emails/order-receipt';
import { getServerEnv } from '@/lib/env';
import {
  buildCreditsReceiptModel,
  buildOrderReceiptModel,
  resolveReceiptLocale,
} from '@/lib/email/receipt-core';
import { getResendClient, isResendEnabled } from '@/lib/email/resend';
import { RECEIPT_STRINGS } from '@/lib/email/translations';

// Structural twin of fulfillment.ts's SettleTransaction — declared locally so
// there is no lib/email -> lib/payments import (fulfillment imports us).
export interface ReceiptTransaction {
  id: string;
  user_id: string | null;
  order_id: string | null;
  type: string;
  amount_cents: number;
  currency: string;
  metadata: Record<string, unknown>;
}

interface ReceiptOrderRow {
  id: string;
  contact_email: string | null;
  locale: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
}

interface ReceiptOrderItemRow {
  title: string;
  quantity: number;
  total_price_cents: number;
  currency: string;
}

function logSkip(transactionId: string, reason: string) {
  console.error('[receipt-email]', reason, transactionId);
}

async function fetchPreferredLocale(service: SupabaseClient, userId: string | null) {
  if (!userId) return null;
  const { data } = await service
    .from('profiles')
    .select('preferred_locale')
    .eq('user_id', userId)
    .maybeSingle<{ preferred_locale: string | null }>();
  return data?.preferred_locale ?? null;
}

// Fire-once, never-throwing receipt send. Every failure logs and returns; a
// missing receipt must never affect settlement (see the callers' own guards).
export async function sendReceiptEmail(
  service: SupabaseClient,
  transaction: ReceiptTransaction,
): Promise<void> {
  try {
    if (!isResendEnabled()) {
      console.log('[receipt-email] resend not configured; skipping', transaction.id);
      return;
    }

    const env = getServerEnv();
    const siteUrl = env.NEXT_PUBLIC_SITE_URL;
    const resend = getResendClient();
    const idempotencyKey = `receipt/${transaction.id}`;

    if (transaction.type === 'payment') {
      if (!transaction.order_id) return logSkip(transaction.id, 'payment without order_id');

      const { data: order, error: orderError } = await service
        .from('orders')
        .select(
          'id, contact_email, locale, subtotal_cents, shipping_cents, total_cents, currency',
        )
        .eq('id', transaction.order_id)
        .maybeSingle<ReceiptOrderRow>();
      if (orderError || !order) {
        return logSkip(transaction.id, `order fetch failed: ${orderError?.message ?? 'missing'}`);
      }
      if (!order.contact_email) return logSkip(transaction.id, 'order has no contact email');

      const { data: items, error: itemsError } = await service
        .from('order_items')
        .select('title, quantity, total_price_cents, currency')
        .eq('order_id', order.id)
        .returns<ReceiptOrderItemRow[]>();
      if (itemsError) {
        return logSkip(transaction.id, `order items fetch failed: ${itemsError.message}`);
      }

      // Always fetch the profile fallback: if order.locale is set but invalid,
      // the chain must still be captured -> preferred -> 'en' (spec). One extra
      // read per receipt is negligible.
      const locale = resolveReceiptLocale(
        order.locale,
        await fetchPreferredLocale(service, transaction.user_id),
      );
      const strings = RECEIPT_STRINGS[locale];
      const model = buildOrderReceiptModel({
        locale,
        orderId: order.id,
        items: items ?? [],
        subtotalCents: order.subtotal_cents,
        shippingCents: order.shipping_cents,
        totalCents: order.total_cents,
        currency: order.currency,
        siteUrl,
      });

      const { error } = await resend.emails.send(
        {
          from: env.RESEND_FROM as string,
          to: [order.contact_email],
          subject: `${strings.orderSubject} — #${model.orderIdShort}`,
          react: <OrderReceiptEmail model={model} strings={strings} />,
        },
        { idempotencyKey },
      );
      if (error) logSkip(transaction.id, `resend error: ${error.message}`);
      return;
    }

    if (transaction.type === 'credit_purchase') {
      if (!transaction.user_id) return logSkip(transaction.id, 'credit purchase without user');

      const { data: userData, error: userError } = await service.auth.admin.getUserById(
        transaction.user_id,
      );
      const recipient = userData?.user?.email ?? null;
      if (userError || !recipient) {
        return logSkip(transaction.id, `no recipient email: ${userError?.message ?? 'missing'}`);
      }

      const locale = resolveReceiptLocale(
        null,
        await fetchPreferredLocale(service, transaction.user_id),
      );
      const strings = RECEIPT_STRINGS[locale];
      const model = buildCreditsReceiptModel({
        locale,
        metadata: transaction.metadata ?? {},
        amountCents: transaction.amount_cents,
        currency: transaction.currency,
        siteUrl,
      });

      const { error } = await resend.emails.send(
        {
          from: env.RESEND_FROM as string,
          to: [recipient],
          subject: strings.creditsSubject,
          react: <CreditsReceiptEmail model={model} strings={strings} />,
        },
        { idempotencyKey },
      );
      if (error) logSkip(transaction.id, `resend error: ${error.message}`);
      return;
    }

    // Other transaction types (refunds, manual adjustments) get no receipt.
  } catch (error) {
    console.error('[receipt-email] unexpected failure', transaction.id, error);
  }
}
