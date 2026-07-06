// Pure Ameriabank vPOS 3.0 request/response logic. No Next.js or env imports —
// this module is unit-tested outside the Next runtime.
import type { PaymentOutcome } from '@/lib/payments/types';

export interface AmeriaConfig {
  baseUrl: string;
  clientId: string;
  username: string;
  password: string;
}

// ISO-4217 numeric codes accepted by vPOS.
export const AMERIA_CURRENCY_CODES: Record<string, string> = {
  AMD: '051',
  USD: '840',
  EUR: '978',
  RUB: '643',
};

export function toMajorUnits(amountCents: number): number {
  return Math.round(amountCents) / 100;
}

export interface InitPaymentFields {
  orderId: number;
  amountCents: number;
  currency: string;
  description: string;
  backUrl: string;
  opaque: string;
}

export function buildInitPaymentBody(config: AmeriaConfig, input: InitPaymentFields) {
  const currencyCode = AMERIA_CURRENCY_CODES[input.currency];
  if (!currencyCode) {
    throw new Error(`Currency ${input.currency} is not supported by Ameriabank vPOS.`);
  }
  return {
    ClientID: config.clientId,
    Username: config.username,
    Password: config.password,
    OrderID: input.orderId,
    Amount: toMajorUnits(input.amountCents),
    Currency: currencyCode,
    Description: input.description,
    BackURL: input.backUrl,
    Opaque: input.opaque,
  };
}

export function parseInitPaymentResponse(json: unknown): { paymentId: string } {
  const record = (json ?? {}) as Record<string, unknown>;
  const responseCode = Number(record.ResponseCode);
  const paymentId = typeof record.PaymentID === 'string' && record.PaymentID.length > 0
    ? record.PaymentID
    : null;
  if (responseCode !== 1 || !paymentId) {
    const message = typeof record.ResponseMessage === 'string'
      ? record.ResponseMessage
      : `response code ${String(record.ResponseCode)}`;
    throw new Error(`Ameriabank InitPayment rejected: ${message}`);
  }
  return { paymentId };
}

export function buildPaymentPageUrl(baseUrl: string, paymentId: string, locale?: string | null) {
  const lang = locale === 'am' || locale === 'ru' ? locale : 'en';
  return `${baseUrl.replace(/\/$/, '')}/Payments/Pay?id=${encodeURIComponent(paymentId)}&lang=${lang}`;
}

export function buildPaymentDetailsBody(config: AmeriaConfig, paymentId: string) {
  return {
    PaymentID: paymentId,
    Username: config.username,
    Password: config.password,
  };
}

export interface AmeriaPaymentDetails {
  responseCode: string;
  paymentState: string;
  amount: number;
  currencyCode: string;
  opaque: string | null;
  orderId: number | null;
}

export function parsePaymentDetailsResponse(json: unknown): AmeriaPaymentDetails {
  const record = (json ?? {}) as Record<string, unknown>;
  return {
    responseCode: String(record.ResponseCode ?? ''),
    paymentState: String(record.PaymentState ?? '').toLowerCase(),
    amount: Number(record.Amount ?? Number.NaN),
    currencyCode: String(record.Currency ?? ''),
    opaque: typeof record.Opaque === 'string' && record.Opaque.length > 0 ? record.Opaque : null,
    orderId: record.OrderID == null ? null : Number(record.OrderID),
  };
}

export function decideOutcome(
  details: AmeriaPaymentDetails,
  expected: { amountCents: number; currency: string },
): { outcome: PaymentOutcome; amountMatches: boolean } {
  const expectedCode = AMERIA_CURRENCY_CODES[expected.currency];
  const amountMatches =
    Number.isFinite(details.amount)
    && Math.round(details.amount * 100) === Math.round(expected.amountCents)
    && (details.currencyCode === expectedCode || details.currencyCode === expected.currency);

  const state = details.paymentState;
  if (details.responseCode === '00' && state.includes('deposited')) {
    return { outcome: amountMatches ? 'succeeded' : 'failed', amountMatches };
  }
  if (state.includes('void') || state.includes('cancel')) {
    return { outcome: 'cancelled', amountMatches };
  }
  // 'approved' = authorized; treated as pending (not success) until the
  // merchant account is confirmed single-stage against the live API.
  if (state === '' || state.includes('started') || state.includes('approved')) {
    return { outcome: 'pending', amountMatches };
  }
  return { outcome: 'failed', amountMatches };
}
