import 'server-only';

import { Resend } from 'resend';
import { getServerEnv } from '@/lib/env';

// Mirrors lib/payments/polar.ts: enabled = fully configured; the client
// getter throws only if called without checking isResendEnabled() first.
export function isResendEnabled(): boolean {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM);
}

export function getResendClient(): Resend {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send email.');
  }
  return new Resend(env.RESEND_API_KEY);
}
