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
import type { CreditsReceiptModel } from '@/lib/email/receipt-core';
import type { ReceiptStrings } from '@/lib/email/translations';

export function CreditsReceiptEmail({
  model,
  strings,
}: {
  model: CreditsReceiptModel;
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
            <Hr className="my-4 border-solid border-gray-200" />
            <Row>
              <Column className="text-sm text-gray-500">{strings.item}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.packName}
              </Column>
            </Row>
            <Row>
              <Column className="text-sm text-gray-500">{strings.creditsAdded}</Column>
              <Column align="right" className="text-sm text-gray-900">
                {model.creditAmount}
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
                href={model.creditsUrl}
                className="box-border rounded bg-[#efe000] px-5 py-3 text-center text-sm font-medium text-gray-900 no-underline"
              >
                {strings.viewCredits}
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

CreditsReceiptEmail.PreviewProps = {
  model: {
    locale: 'en',
    packName: 'Starter pack',
    creditAmount: 100,
    total: 'AMD 5,000.00',
    creditsUrl: 'https://example.com/credits',
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
