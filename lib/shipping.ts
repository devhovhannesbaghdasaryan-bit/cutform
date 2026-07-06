import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppCurrency, ExchangeRateContext } from '@/lib/currency';
import { convertMoney } from '@/lib/currency';
import { resolveCatalogMarkets, type ResolvedMarket } from '@/lib/market';
import { getServiceSupabase } from '@/lib/supabase/server';

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  administrativeArea?: string | null;
  postalCode?: string | null;
  countryCode: string;
}

export interface ShippingLineTotal {
  cartItemId: string;
  catalogItemId: string;
  unitShippingCents: number;
  shippingTotalCents: number;
  currency: AppCurrency;
  ruleSource: 'country' | 'region';
  ruleId: string;
  exchangeRateContext: ExchangeRateContext;
}

export interface OrderTotals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: AppCurrency;
  shippingLines: ShippingLineTotal[];
}

export async function calculateOrderTotals({
  items,
  market,
  currency,
  supabase,
}: {
  items: Array<{
    id: string;
    catalog_item_id: string | null;
    quantity: number;
    unit_price_cents: number;
  }>;
  market: ResolvedMarket;
  currency: AppCurrency;
  supabase: SupabaseClient;
}): Promise<OrderTotals> {
  const subtotalCents = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
  const catalogItems = items.filter((item): item is typeof item & { catalog_item_id: string } =>
    Boolean(item.catalog_item_id),
  );
  const service = getServiceSupabase();
  const resolutions = await resolveCatalogMarkets(
    catalogItems.map((item) => item.catalog_item_id),
    market,
    supabase,
  );
  const shippingLines: ShippingLineTotal[] = [];

  for (const item of catalogItems) {
    // biome-ignore lint/style/noNonNullAssertion: resolutions has an entry for every catalog item id
    const resolution = resolutions.get(item.catalog_item_id)!;
    if (
      !resolution.availability.available ||
      resolution.shipping.baseAmountCents == null ||
      !resolution.shipping.ruleId
    ) {
      throw new Error('One or more catalog items cannot ship to this destination.');
    }
    const converted = await convertMoney(
      resolution.shipping.baseAmountCents,
      'AMD',
      currency,
      service,
    );
    shippingLines.push({
      cartItemId: item.id,
      catalogItemId: item.catalog_item_id,
      unitShippingCents: converted.amountCents,
      shippingTotalCents: converted.amountCents * item.quantity,
      currency,
      ruleSource: resolution.shipping.source as 'country' | 'region',
      ruleId: resolution.shipping.ruleId,
      exchangeRateContext: converted.exchangeRateContext,
    });
  }

  const shippingCents = shippingLines.reduce((sum, line) => sum + line.shippingTotalCents, 0);
  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency,
    shippingLines,
  };
}
