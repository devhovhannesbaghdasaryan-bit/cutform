import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from 'react-email';
import type { OrderReceiptModel } from '@/lib/email/receipt-core';
import type { ReceiptStrings } from '@/lib/email/translations';

export function OrderReceiptEmail({
  model,
  strings,
}: {
  model: OrderReceiptModel;
  strings: ReceiptStrings;
}) {
  return (
    <Html lang={model.locale}>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Body className="bg-gray-100 font-sans">
          <Preview>{strings.preview}</Preview>
          <Container className="mx-auto my-8 max-w-[600px] rounded bg-white p-8">
            <Img src={model.logoUrl} alt="Uniqraft" width="132" height="32" />
            <Heading as="h1" className="mt-6 text-2xl text-gray-900">
              {strings.thanks}
            </Heading>
            <Text className="text-sm text-gray-500">
              {strings.orderSubject} — #{model.orderIdShort}
            </Text>
            <Hr className="my-4 border-solid border-gray-200" />
            <Row>
              <Column className="text-xs font-bold uppercase text-gray-500">
                {strings.item}
              </Column>
              <Column align="center" className="w-16 text-xs font-bold uppercase text-gray-500">
                {strings.qty}
              </Column>
              <Column align="right" className="w-32 text-xs font-bold uppercase text-gray-500">
                {strings.total}
              </Column>
            </Row>
            {model.items.map((item) => (
              <Row key={`${item.title}-${item.total}`} className="py-1">
                <Column className="text-sm text-gray-900">{item.title}</Column>
                <Column align="center" className="w-16 text-sm text-gray-900">
                  {item.quantity}
                </Column>
                <Column align="right" className="w-32 text-sm text-gray-900">
                  {item.total}
                </Column>
              </Row>
            ))}
            <Hr className="my-4 border-solid border-gray-200" />
            <Row>
              <Column className="text-sm text-gray-500">{strings.subtotal}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.subtotal}
              </Column>
            </Row>
            <Row>
              <Column className="text-sm text-gray-500">{strings.shipping}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.shipping}
              </Column>
            </Row>
            <Row className="mt-2">
              <Column className="text-base font-bold text-gray-900">{strings.total}</Column>
              <Column align="right" className="text-base font-bold text-gray-900">
                {model.total}
              </Column>
            </Row>
            <Section className="mt-8">
              <Button
                href={model.orderUrl}
                className="box-border rounded bg-[#efe000] px-5 py-3 text-center text-sm font-medium text-gray-900 no-underline"
              >
                {strings.viewOrder}
              </Button>
            </Section>
            <Hr className="my-6 border-solid border-gray-200" />
            <Text className="text-xs text-gray-400">{strings.footerNote}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

OrderReceiptEmail.PreviewProps = {
  model: {
    locale: 'en',
    orderIdShort: 'abcd1234',
    items: [{ title: 'Neon sign', quantity: 2, total: 'AMD 50,000.00' }],
    subtotal: 'AMD 50,000.00',
    shipping: 'AMD 2,000.00',
    total: 'AMD 52,000.00',
    orderUrl: 'https://example.com/orders/abcd1234',
    logoUrl: 'https://example.com/brand/uniqraft-logo-light.png',
  },
  strings: {
    orderSubject: 'Your Uniqraft order receipt',
    creditsSubject: 'Your Uniqraft credits receipt',
    preview: 'Thanks for your purchase — your receipt is inside.',
    thanks: 'Thanks for your purchase!',
    item: 'Item',
    qty: 'Qty',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    total: 'Total',
    creditsAdded: 'Credits added',
    viewOrder: 'View your order',
    viewCredits: 'View your credits',
    footerNote: 'You are receiving this email because you made a purchase on Uniqraft.',
  },
};
