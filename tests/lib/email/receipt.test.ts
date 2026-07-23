import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('@/lib/email/resend', () => ({
  isResendEnabled: vi.fn(() => true),
  getResendClient: vi.fn(() => ({ emails: { send: sendMock } })),
}));

import { isResendEnabled } from '@/lib/email/resend';
import { sendReceiptEmail } from '@/lib/email/receipt';

// Minimal supabase stub: from(table) returns a chain whose maybeSingle()/eq()
// resolve to canned rows; auth.admin.getUserById returns a canned user.
function makeService(rows: {
  order?: Record<string, unknown> | null;
  items?: Record<string, unknown>[];
  profile?: Record<string, unknown> | null;
  user?: { email: string | null } | null;
}) {
  return {
    from(table: string) {
      const result =
        table === 'orders'
          ? { data: rows.order ?? null, error: null }
          : table === 'order_items'
            ? { data: rows.items ?? [], error: null }
            : { data: rows.profile ?? null, error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => result,
        returns: async () => result,
      };
      return chain;
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: rows.user ?? null }, error: null }),
      },
    },
  } as never;
}

const orderTransaction = {
  id: 'tx-1',
  user_id: 'user-1',
  order_id: 'order-1',
  type: 'payment',
  amount_cents: 5200000,
  currency: 'AMD',
  metadata: {},
};

const orderRow = {
  id: 'order-1',
  contact_email: 'buyer@example.com',
  locale: 'en',
  subtotal_cents: 5000000,
  shipping_cents: 200000,
  total_cents: 5200000,
  currency: 'AMD',
};

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('RESEND_FROM', 'Uniqraft <receipts@example.com>');
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  vi.mocked(isResendEnabled).mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sendReceiptEmail', () => {
  it('skips silently when resend is not configured', async () => {
    vi.mocked(isResendEnabled).mockReturnValue(false);
    await expect(
      sendReceiptEmail(makeService({}), orderTransaction),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends an order receipt with the receipt/<id> idempotency key', async () => {
    const service = makeService({
      order: orderRow,
      items: [{ title: 'Neon sign', quantity: 2, total_price_cents: 5000000, currency: 'AMD' }],
    });
    await sendReceiptEmail(service, orderTransaction);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0] ?? [];
    expect(payload.to).toEqual(['buyer@example.com']);
    expect(payload.subject).toContain('order-1'.slice(0, 8));
    expect(options).toEqual({ idempotencyKey: 'receipt/tx-1' });
  });

  it('never throws when resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    const service = makeService({ order: orderRow, items: [] });
    await expect(sendReceiptEmail(service, orderTransaction)).resolves.toBeUndefined();
  });

  it('never throws when the order fetch fails', async () => {
    const service = makeService({ order: null });
    await expect(sendReceiptEmail(service, orderTransaction)).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends a credits receipt using the auth email', async () => {
    const service = makeService({ user: { email: 'buyer@example.com' }, profile: null });
    await sendReceiptEmail(service, {
      ...orderTransaction,
      id: 'tx-2',
      order_id: null,
      type: 'credit_purchase',
      amount_cents: 500000,
      metadata: { packName: 'Starter pack', creditAmount: 100 },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0] ?? [];
    expect(payload.to).toEqual(['buyer@example.com']);
    expect(options).toEqual({ idempotencyKey: 'receipt/tx-2' });
  });
});
