import type { SupabaseClient } from '@supabase/supabase-js';
import { validateCartBeforeCheckout } from '@/lib/cart';
import { getPaymentRouteForCurrency, normalizeCurrency } from '@/lib/currency';
import { resolveMarket } from '@/lib/market';
import { calculateOrderTotals, type ShippingAddress } from '@/lib/shipping';
import type { Json, Tables } from '@/lib/supabase/types';

export type OrderRow = Omit<Tables<'orders'>, 'shipping_address'> & {
  shipping_address: Record<string, Json | undefined> | null;
};

export type OrderItemRow = Tables<'order_items'>;

export type OrderDetailRow = Pick<
  OrderRow,
  | 'id'
  | 'status'
  | 'payment_status'
  | 'subtotal_cents'
  | 'shipping_cents'
  | 'total_cents'
  | 'currency'
  | 'shipping_address'
  | 'contact_email'
  | 'created_at'
>;

export type OrderDetailItem = Pick<
  OrderItemRow,
  | 'id'
  | 'title'
  | 'quantity'
  | 'unit_price_cents'
  | 'total_price_cents'
  | 'currency'
  | 'image_path'
  | 'selected_preview_path'
  | 'custom_text'
  | 'led_color'
  | 'multi_color'
  | 'banner_size_key'
>;

export type AdminOrderDetailRow = Pick<
  OrderRow,
  | 'id'
  | 'user_id'
  | 'status'
  | 'payment_status'
  | 'subtotal_cents'
  | 'shipping_cents'
  | 'total_cents'
  | 'shipping_rate_context'
  | 'currency'
  | 'exchange_rate_context'
  | 'payment_provider_route'
  | 'shipping_address'
  | 'contact_email'
  | 'created_at'
  | 'updated_at'
>;

export type AdminOrderItem = Omit<
  OrderItemRow,
  'order_id' | 'shipping_unit_cents' | 'shipping_total_cents' | 'shipping_rate_context'
>;

export type CatalogProductionInfo = Pick<
  Tables<'catalog_items'>,
  'id' | 'item_type' | 'characteristics' | 'sizes' | 'manufacturing_notes'
>;

export type GeneratedOrderInfo = Pick<Tables<'generated_items'>, 'id' | 'product_type'>;

export type BannerManufacturingInstruction = Pick<
  Tables<'banner_manufacturing_instructions'>,
  'id' | 'order_item_id' | 'source_image_path' | 'instructions' | 'drawing_paths' | 'status' | 'created_at'
>;

export async function getOrderDetail(
  supabase: SupabaseClient,
  orderId: string,
  opts: { userId: string },
) {
  const [{ data: order, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, payment_status, subtotal_cents, shipping_cents, total_cents, currency, shipping_address, contact_email, created_at')
      .eq('id', orderId)
      .eq('user_id', opts.userId)
      .maybeSingle<OrderDetailRow>(),
    supabase
      .from('order_items')
      .select(
        'id, title, quantity, unit_price_cents, total_price_cents, currency, image_path, selected_preview_path, custom_text, led_color, multi_color, banner_size_key',
      )
      .eq('order_id', orderId)
      .returns<OrderDetailItem[]>(),
  ]);

  if (error || !order) return null;

  return { order, items, itemsError };
}

export async function getOrderDetailForAdmin(supabase: SupabaseClient, orderId: string) {
  const [{ data: order, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, user_id, status, payment_status, subtotal_cents, shipping_cents, total_cents, shipping_rate_context, currency, exchange_rate_context, payment_provider_route, shipping_address, contact_email, created_at, updated_at',
      )
      .eq('id', orderId)
      .maybeSingle<AdminOrderDetailRow>(),
    supabase
      .from('order_items')
      .select(
        'id, title, quantity, unit_price_cents, total_price_cents, currency, exchange_rate_context, catalog_item_id, generated_item_id, item_snapshot, personalization_snapshot, production_snapshot, image_path, selected_preview_path, manufacturing_file_path, original_image_paths, custom_text, led_color, multi_color, banner_size_key',
      )
      .eq('order_id', orderId)
      .returns<AdminOrderItem[]>(),
  ]);

  if (error || !order) return null;

  const catalogIds = (items ?? [])
    .map((item) => item.catalog_item_id)
    .filter((value): value is string => Boolean(value));
  const generatedIds = (items ?? [])
    .map((item) => item.generated_item_id)
    .filter((value): value is string => Boolean(value));

  const [{ data: catalogInfo }, { data: generatedInfo }, { data: bannerInstructions }] =
    await Promise.all([
      catalogIds.length
        ? supabase
            .from('catalog_items')
            .select('id, item_type, characteristics, sizes, manufacturing_notes')
            .in('id', catalogIds)
            .returns<CatalogProductionInfo[]>()
        : Promise.resolve({ data: [] as CatalogProductionInfo[] }),
      generatedIds.length
        ? supabase
            .from('generated_items')
            .select('id, product_type')
            .in('id', generatedIds)
            .returns<GeneratedOrderInfo[]>()
        : Promise.resolve({ data: [] as GeneratedOrderInfo[] }),
      supabase
        .from('banner_manufacturing_instructions')
        .select('id, order_item_id, source_image_path, instructions, drawing_paths, status, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .returns<BannerManufacturingInstruction[]>(),
    ]);

  const catalogInfoById = new Map((catalogInfo ?? []).map((item) => [item.id, item]));
  const generatedInfoById = new Map((generatedInfo ?? []).map((item) => [item.id, item]));
  const latestInstructionByItemId = new Map<string | null, BannerManufacturingInstruction>();
  for (const instruction of bannerInstructions ?? []) {
    if (!latestInstructionByItemId.has(instruction.order_item_id)) {
      latestInstructionByItemId.set(instruction.order_item_id, instruction);
    }
  }

  return { order, items, itemsError, catalogInfoById, generatedInfoById, latestInstructionByItemId };
}

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
  manufacturing_file_path: string | null;
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
  const paymentProviderRoute = getPaymentRouteForCurrency(orderCurrency);
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
          'id, title, product_type, preview_path, selected_preview_path, manufacturing_file_path, original_image_paths, custom_text, color, multi_color, manufacturing_metadata, generation_options, prompt, credit_cost',
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
        manufacturing_file_path: source?.manufacturing_file_path ?? null,
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
