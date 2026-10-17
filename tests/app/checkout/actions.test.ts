import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  // Next's redirect() throws a control-flow error; mirror that so the action stops there.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key;
    t.has = () => true;
    return t;
  }),
}));
vi.mock('@/lib/orders', () => ({ createOrderFromCart: vi.fn() }));
vi.mock('@/lib/transactions', () => ({ createTransactionRecord: vi.fn() }));
vi.mock('@/lib/payments/ameria', () => ({ initiateAmeriaPayment: vi.fn() }));
vi.mock('@/lib/payments/polar', () => ({ initiatePolarCheckout: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: vi.fn(),
  getServerSupabase: vi.fn(),
  getServiceSupabase: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { createCheckoutOrderAction } from '@/app/checkout/actions';
import { idleState } from '@/lib/action-state';
import { createOrderFromCart } from '@/lib/orders';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { createTransactionRecord } from '@/lib/transactions';

function checkoutForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    contactEmail: 'buyer@example.com',
    locale: 'en',
    recipientName: 'Ani Petrosyan',
    phone: '+374 91 123456',
    addressLine1: 'Abovyan 12, apt 4',
    addressLine2: '',
    city: 'Yerevan',
    administrativeArea: '',
    postalCode: '0001',
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** Stand-in for `from('orders').select(...).eq(...).eq(...).single()`. */
function selectStub(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => result),
  };
  return query;
}

/** Stand-in for `from('orders').update(...).eq(...).eq(...)`, where the second eq() is awaited. */
function updateStub(result: unknown) {
  const terminal = { eq: vi.fn(async () => result) };
  const filtered = { eq: vi.fn(() => terminal) };
  return { update: vi.fn(() => filtered) };
}

describe('createCheckoutOrderAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a field error instead of throwing when the phone is too short', async () => {
    const state = await createCheckoutOrderAction(idleState, checkoutForm({ phone: '123' }));

    expect(state.status).toBe('error');
    if (state.status !== 'error') return;
    expect(state.error).toBe('checkout.error.form');
    expect(state.fieldErrors).toEqual({ phone: ['checkout.error.phone {"min":5}'] });
    // The rest of the form is echoed back so the buyer only has to fix the phone.
    expect(state.values).toMatchObject({ recipientName: 'Ani Petrosyan', city: 'Yerevan' });
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(createOrderFromCart).not.toHaveBeenCalled();
  });

  it('reports every invalid field at once with its own translated message', async () => {
    const state = await createCheckoutOrderAction(
      idleState,
      checkoutForm({ contactEmail: 'nope', recipientName: 'A', addressLine1: '  ', city: 'Y' }),
    );

    expect(state.status).toBe('error');
    if (state.status !== 'error') return;
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual([
      'addressLine1',
      'city',
      'contactEmail',
      'recipientName',
    ]);
    expect(state.fieldErrors?.contactEmail).toEqual(['checkout.error.contact_email']);
    expect(state.fieldErrors?.recipientName).toEqual(['checkout.error.recipient {"min":2}']);
    expect(state.fieldErrors?.addressLine1).toEqual(['checkout.error.address1 {"min":3}']);
    expect(state.fieldErrors?.city).toEqual(['checkout.error.city {"min":2}']);
  });

  it('flags an over-long value as too long rather than too short', async () => {
    const state = await createCheckoutOrderAction(
      idleState,
      checkoutForm({ postalCode: 'X'.repeat(31) }),
    );

    expect(state.status).toBe('error');
    if (state.status !== 'error') return;
    expect(state.fieldErrors).toEqual({ postalCode: ['checkout.error.too_long'] });
  });

  it('creates the order and redirects on the bank-transfer route when the form is valid', async () => {
    const orderRow = {
      subtotal_cents: 5000,
      shipping_cents: 1000,
      total_cents: 6000,
      currency: 'AMD',
      exchange_rate_context: {},
      payment_provider_route: 'bank_manual',
    };
    const supabase = { from: vi.fn(() => selectStub({ data: orderRow, error: null })) };
    const service = { from: vi.fn(() => updateStub({ error: null })) };
    vi.mocked(getServerSupabase).mockResolvedValue(supabase as never);
    vi.mocked(getServiceSupabase).mockReturnValue(service as never);
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'buyer@example.com',
    } as never);
    vi.mocked(createOrderFromCart).mockResolvedValue({ id: 'order-1' } as never);
    vi.mocked(createTransactionRecord).mockResolvedValue({ id: 'tx-1' } as never);

    await expect(
      createCheckoutOrderAction(idleState, checkoutForm({ phone: '  +374 91 123456  ' })),
    ).rejects.toThrow('NEXT_REDIRECT /orders/order-1?checkout=bank_pending');

    expect(createOrderFromCart).toHaveBeenCalledWith(
      supabase,
      'user-1',
      expect.objectContaining({
        contactEmail: 'buyer@example.com',
        locale: 'en',
        shippingAddress: expect.objectContaining({
          phone: '+374 91 123456',
          addressLine2: null,
          administrativeArea: null,
          postalCode: '0001',
          countryCode: 'AM',
        }),
      }),
    );
    expect(createTransactionRecord).toHaveBeenCalledWith(
      service,
      expect.objectContaining({ orderId: 'order-1', amountCents: 6000, provider: 'bank_manual' }),
    );
    expect(redirect).toHaveBeenCalledWith('/orders/order-1?checkout=bank_pending');
  });
});
