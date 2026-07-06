import type { SupabaseClient } from '@supabase/supabase-js';
import { validateCartBeforeCheckout } from '@/lib/cart';
import { normalizeCurrency } from '@/lib/currency';
import { getPaymentRoute } from '@/lib/payments/router';
import { resolveMarket } from '@/lib/market';
import { calculateOrderTotals, type ShippingAddress } from '@/lib/shipping';

interface CartItemForOrder {
  id: string;
  catalog_item_id: string | null;
  generated_item_id: string | null;
  title: string;
  quantity: number;
  unit_price_cents: number;
  currency: string;
  configuration: Record<string, unknown>;
}

interface GeneratedOrderSource {
  id: string;
  title: string | null;
  product_type: string;
  preview_path: string | null;
  selected_preview_path: string | null;
  hidden_svg_path: string | null;
  original_image_paths: string[];
  custom_text: string | null;
  color: string | null;
  multi_color: boolean;
  manufacturing_metadata: Record<string, unknown>;
  generation_options: Record<string, unknown>;
  prompt: string | null;
  credit_cost: number;
}

export function buildOrderItemSnapshot(item: CartItemForOrder, source?: GeneratedOrderSource | null) {
  return {
    itemSnapshot: {
      title: item.title,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      currency: item.currency,
      configuration: item.configuration,
    },
    personalizationSnapshot: source
      ? {
          productType: source.product_type,
          selectedPreviewPath: source.selected_preview_path,
          originalImagePaths: source.original_image_paths,
          customText: source.custom_text,
          color: source.color,
          multiColor: source.multi_color,
        }
      : {},
    productionSnapshot: source?.manufacturing_metadata ?? {},
  };
}

function getStringRecordValue(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function getRecordValue(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function createOrderFromCart(
  supabase: SupabaseClient,
  userId: string,
  options: { contactEmail?: string | null; locale?: string | null; shippingAddress?: ShippingAddress } = {},
) {
  const address = options.shippingAddress;
  if (!address) throw new Error('Shipping address is required.');
  const issues = await validateCartBeforeCheckout(supabase, userId, address.countryCode);
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? 'Cart has validation issues.');
  }

  const { data: cart, error: cartError } = await supabase
    .from('carts')
    .select('id, currency, destination_country_code')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle<{ id: string; currency: string; destination_country_code: string | null }>();

  if (cartError || !cart) throw new Error(cartError?.message ?? 'Active cart was not found.');

  const { data: cartItems, error: itemsError } = await supabase
    .from('cart_items')
    .select('id, catalog_item_id, generated_item_id, title, quantity, unit_price_cents, currency, configuration')
    .eq('cart_id', cart.id)
    .returns<CartItemForOrder[]>();

  if (itemsError) throw new Error(itemsError.message);
  if (!cartItems?.length) throw new Error('Cart is empty.');

  const cartCurrencies = new Set(cartItems.map((item) => item.currency));
  if (cartCurrencies.size > 1) {
    throw new Error('Cart contains multiple currencies. Switch currency or re-add items before checkout.');
  }

  const orderCurrency = normalizeCurrency(cartItems[0]?.currency) ?? normalizeCurrency(cart.currency) ?? 'AMD';
  const paymentProviderRoute = await getPaymentRoute(orderCurrency);
  const market = await resolveMarket({ checkoutCountryCode: address.countryCode, supabase });
  const totals = await calculateOrderTotals({
    items: cartItems,
    market,
    currency: orderCurrency,
    supabase,
  });
  const shippingByCartItem = new Map(totals.shippingLines.map((line) => [line.cartItemId, line]));
  const exchangeRateContexts = cartItems.map((item) => ({
    cartItemId: item.id,
    source: item.configuration?.exchangeRateContext ?? {},
  }));

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      status: 'pending_payment',
      payment_status: 'unpaid',
      subtotal_cents: totals.subtotalCents,
      shipping_cents: totals.shippingCents,
      total_cents: totals.totalCents,
      currency: orderCurrency,
      exchange_rate_context: { items: exchangeRateContexts },
      payment_provider_route: paymentProviderRoute,
      contact_email: options.contactEmail ?? null,
      locale: options.locale ?? null,
      cart_id: cart.id,
      destination_country_code: address.countryCode,
      shipping_address: address,
      shipping_rate_context: { lines: totals.shippingLines },
    })
    .select('id')
    .single<{ id: string }>();

  if (orderError || !order) throw new Error(orderError?.message ?? 'Unable to create order.');

  const generatedIds = cartItems
    .map((item) => item.generated_item_id)
    .filter((id): id is string => Boolean(id));
  const { data: generatedSources } = generatedIds.length
    ? await supabase
        .from('generated_items')
        .select(
          'id, title, product_type, preview_path, selected_preview_path, hidden_svg_path, original_image_paths, custom_text, color, multi_color, manufacturing_metadata, generation_options, prompt, credit_cost',
        )
        .in('id', generatedIds)
        .returns<GeneratedOrderSource[]>()
    : { data: [] as GeneratedOrderSource[] };

  const generatedById = new Map((generatedSources ?? []).map((source) => [source.id, source]));

  const { error: orderItemsError } = await supabase.from('order_items').insert(
    cartItems.map((item) => {
      const source = item.generated_item_id ? generatedById.get(item.generated_item_id) : null;
      const shipping = shippingByCartItem.get(item.id);
      const snapshot = buildOrderItemSnapshot(item, source);
      const productionSnapshot = source
        ? {
            ...snapshot.productionSnapshot,
            generationOptions: source.generation_options,
            prompt: source.prompt,
            creditCost: source.credit_cost,
          }
        : snapshot.productionSnapshot;
      return {
        order_id: order.id,
        catalog_item_id: item.catalog_item_id,
        generated_item_id: item.generated_item_id,
        title: item.title,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_price_cents: item.unit_price_cents * item.quantity,
        currency: item.currency,
        exchange_rate_context: getRecordValue(item.configuration, 'exchangeRateContext'),
        shipping_unit_cents: shipping?.unitShippingCents ?? 0,
        shipping_total_cents: shipping?.shippingTotalCents ?? 0,
        shipping_rate_context: shipping ?? {},
        item_snapshot: snapshot.itemSnapshot,
        personalization_snapshot: snapshot.personalizationSnapshot,
        production_snapshot: productionSnapshot,
        image_path: source?.selected_preview_path ?? source?.preview_path ?? null,
        selected_preview_path: source?.selected_preview_path ?? null,
        hidden_svg_path: source?.hidden_svg_path ?? null,
        original_image_paths: source?.original_image_paths ?? [],
        custom_text: source?.custom_text ?? null,
        led_color: source?.color ?? null,
        multi_color: source?.multi_color ?? false,
        banner_size_key:
          getStringRecordValue(item.configuration, 'bannerSizeKey')
          ?? getStringRecordValue(source?.generation_options, 'bannerSizeKey'),
      };
    }),
  );

  if (orderItemsError) throw new Error(orderItemsError.message);

  const { error: cartUpdateError } = await supabase
    .from('carts')
    .update({ status: 'converted', destination_country_code: address.countryCode })
    .eq('id', cart.id);

  if (cartUpdateError) throw new Error(cartUpdateError.message);
  return order;
}
