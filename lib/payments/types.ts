export const PAYMENT_ROUTES = ['ameria', 'bank_manual'] as const;
export type PaymentRoute = (typeof PAYMENT_ROUTES)[number];

export type PaymentOutcome = 'succeeded' | 'failed' | 'cancelled' | 'pending';

export interface InitiatePaymentInput {
  transactionId: string;
  amountCents: number;
  currency: string;
  description: string;
  locale?: string | null;
}

export interface InitiatePaymentResult {
  redirectUrl: string;
  providerReference: string;
}
