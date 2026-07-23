import { createElement } from 'react';
import { render } from 'react-email';
import { describe, expect, it } from 'vitest';
import type { CreditsReceiptModel, OrderReceiptModel } from '@/lib/email/receipt-core';
import { RECEIPT_STRINGS } from '@/lib/email/translations';
import { CreditsReceiptEmail } from '@/emails/credits-receipt';
import { OrderReceiptEmail } from '@/emails/order-receipt';

const orderModel: OrderReceiptModel = {
  locale: 'en',
  orderIdShort: 'abcd1234',
  items: [{ title: 'Neon sign', quantity: 2, total: 'AMD 50,000.00' }],
  subtotal: 'AMD 50,000.00',
  shipping: 'AMD 2,000.00',
  total: 'AMD 52,000.00',
  orderUrl: 'https://uniqraft.example/orders/abcd1234-full-id',
  logoUrl: 'https://uniqraft.example/brand/uniqraft-logo-light.png',
};

const creditsModel: CreditsReceiptModel = {
  locale: 'en',
  packName: 'Starter pack',
  creditAmount: 100,
  total: 'AMD 5,000.00',
  creditsUrl: 'https://uniqraft.example/credits',
  logoUrl: 'https://uniqraft.example/brand/uniqraft-logo-light.png',
};

describe('receipt templates', () => {
  it('order receipt renders totals, items, and the order link', async () => {
    const html = await render(
      createElement(OrderReceiptEmail, { model: orderModel, strings: RECEIPT_STRINGS.en }),
    );
    expect(html).toContain('AMD 52,000.00');
    expect(html).toContain('Neon sign');
    expect(html).toContain('https://uniqraft.example/orders/abcd1234-full-id');
    expect(html).toContain('lang="en"');
  });

  it('credits receipt renders pack, amount, and the credits link', async () => {
    const html = await render(
      createElement(CreditsReceiptEmail, { model: creditsModel, strings: RECEIPT_STRINGS.en }),
    );
    expect(html).toContain('Starter pack');
    expect(html).toContain('AMD 5,000.00');
    expect(html).toContain('https://uniqraft.example/credits');
  });
});
