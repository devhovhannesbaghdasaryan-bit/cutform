import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import {
  buildInitPaymentBody,
  buildPaymentDetailsBody,
  buildPaymentPageUrl,
  parseInitPaymentResponse,
  parsePaymentDetailsResponse,
  type AmeriaConfig,
  type AmeriaPaymentDetails,
} from '@/lib/payments/ameria-core';
import type { InitiatePaymentInput, InitiatePaymentResult } from '@/lib/payments/types';

export function getAmeriaConfig(): AmeriaConfig {
  const env = getServerEnv();
  if (!env.AMERIA_API_BASE_URL || !env.AMERIA_CLIENT_ID || !env.AMERIA_USERNAME || !env.AMERIA_PASSWORD) {
    throw new Error(
      'AMERIA_API_BASE_URL, AMERIA_CLIENT_ID, AMERIA_USERNAME and AMERIA_PASSWORD are required for Ameriabank payments.',
    );
  }
  return {
    baseUrl: env.AMERIA_API_BASE_URL.replace(/\/$/, ''),
    clientId: env.AMERIA_CLIENT_ID,
    username: env.AMERIA_USERNAME,
    password: env.AMERIA_PASSWORD,
  };
}

export async function nextAmeriaOrderId(service: SupabaseClient): Promise<number> {
  const { data, error } = await service.rpc('next_ameria_order_id');
  if (error || data == null) {
    throw new Error(error?.message ?? 'Unable to allocate an Ameriabank order id.');
  }
  const rawBase = getServerEnv().AMERIA_ORDER_ID_BASE;
  const base = rawBase == null ? 0 : Number(rawBase);
  if (!Number.isSafeInteger(base) || base < 0) {
    throw new Error('AMERIA_ORDER_ID_BASE must be a non-negative integer.');
  }
  return base + Number(data);
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Ameriabank request failed: HTTP ${response.status}.`);
  }
  return response.json();
}

export async function initiateAmeriaPayment(
  service: SupabaseClient,
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  const config = getAmeriaConfig();
  const orderId = await nextAmeriaOrderId(service);
  const backUrl = `${getServerEnv().NEXT_PUBLIC_SITE_URL}/api/payments/ameria/callback`;

  const { data: existing, error: readError } = await service
    .from('transactions')
    .select('metadata')
    .eq('id', input.transactionId)
    .single<{ metadata: Record<string, unknown> }>();
  if (readError || !existing) throw new Error(readError?.message ?? 'Transaction not found.');

  let paymentId: string;
  try {
    const json = await postJson(
      `${config.baseUrl}/api/VPOS/InitPayment`,
      buildInitPaymentBody(config, {
        orderId,
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        backUrl,
        opaque: input.transactionId,
      }),
    );
    paymentId = parseInitPaymentResponse(json).paymentId;
  } catch (error) {
    await service
      .from('transactions')
      .update({
        status: 'failed',
        metadata: {
          ...existing.metadata,
          ameriaOrderId: orderId,
          ameriaInitError: error instanceof Error ? error.message : 'Unknown InitPayment error.',
        },
      })
      .eq('id', input.transactionId);
    throw error;
  }

  const { error: updateError } = await service
    .from('transactions')
    .update({
      provider_reference: paymentId,
      metadata: { ...existing.metadata, ameriaOrderId: orderId },
    })
    .eq('id', input.transactionId);
  if (updateError) throw new Error(updateError.message);

  return {
    redirectUrl: buildPaymentPageUrl(config.baseUrl, paymentId, input.locale),
    providerReference: paymentId,
  };
}

export async function fetchAmeriaPaymentDetails(paymentId: string): Promise<AmeriaPaymentDetails> {
  const config = getAmeriaConfig();
  const json = await postJson(
    `${config.baseUrl}/api/VPOS/GetPaymentDetails`,
    buildPaymentDetailsBody(config, paymentId),
  );
  return parsePaymentDetailsResponse(json);
}
