import { notFound } from 'next/navigation';
import { OrderStatusForm } from '@/app/admin/order-status-form';
import { requireAdmin } from '@/lib/admin';
import { formatDate, formatPrice } from '@/lib/utils';
import { generateBannerManufacturingInstructionAction } from './actions';

export const dynamic = 'force-dynamic';

interface AdminOrderDetail {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_rate_context: Record<string, unknown>;
  currency: string;
  exchange_rate_context: Record<string, unknown>;
  payment_provider_route: string | null;
  shipping_address: Record<string, unknown> | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminOrderItem {
  id: string;
  title: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  currency: string;
  exchange_rate_context: Record<string, unknown>;
  catalog_item_id: string | null;
  generated_item_id: string | null;
  item_snapshot: Record<string, unknown>;
  personalization_snapshot: Record<string, unknown>;
  production_snapshot: Record<string, unknown>;
  image_path: string | null;
  selected_preview_path: string | null;
  hidden_svg_path: string | null;
  original_image_paths: string[];
  custom_text: string | null;
  led_color: string | null;
  multi_color: boolean;
  banner_size_key: string | null;
}

interface CatalogProductionInfo {
  id: string;
  item_type: string;
  characteristics: string | null;
  sizes: unknown[];
  manufacturing_notes: string | null;
}

interface GeneratedOrderInfo {
  id: string;
  product_type: string;
}

interface BannerManufacturingInstruction {
  id: string;
  order_item_id: string;
  source_image_path: string;
  instructions: Record<string, unknown>;
  drawing_paths: string[];
  status: string;
  created_at: string;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: order, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, user_id, status, payment_status, subtotal_cents, shipping_cents, total_cents, shipping_rate_context, currency, exchange_rate_context, payment_provider_route, shipping_address, contact_email, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle<AdminOrderDetail>(),
    supabase
      .from('order_items')
      .select(
        'id, title, quantity, unit_price_cents, total_price_cents, currency, exchange_rate_context, catalog_item_id, generated_item_id, item_snapshot, personalization_snapshot, production_snapshot, image_path, selected_preview_path, hidden_svg_path, original_image_paths, custom_text, led_color, multi_color, banner_size_key',
      )
      .eq('order_id', id)
      .returns<AdminOrderItem[]>(),
  ]);

  if (error || !order) notFound();

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
        .eq('order_id', id)
        .order('created_at', { ascending: false })
        .returns<BannerManufacturingInstruction[]>(),
    ]);

  const catalogInfoById = new Map((catalogInfo ?? []).map((item) => [item.id, item]));
  const generatedInfoById = new Map((generatedInfo ?? []).map((item) => [item.id, item]));
  const latestInstructionByItemId = new Map<string, BannerManufacturingInstruction>();
  for (const instruction of bannerInstructions ?? []) {
    if (!latestInstructionByItemId.has(instruction.order_item_id)) {
      latestInstructionByItemId.set(instruction.order_item_id, instruction);
    }
  }

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order {order.id.slice(0, 8)}</h1>
        <p className="text-muted-foreground">Created {formatDate(order.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border">
            <div className="border-b p-4">
              <h2 className="font-semibold">Items</h2>
            </div>
            {itemsError ? (
              <p className="p-4 text-sm text-destructive">{itemsError.message}</p>
            ) : !items?.length ? (
              <p className="p-4 text-sm text-muted-foreground">No order items found.</p>
            ) : (
              <div className="divide-y">
                {items.map((item) => (
                  <OrderItemDetail
                    key={item.id}
                    item={item}
                    catalogInfo={
                      item.catalog_item_id ? catalogInfoById.get(item.catalog_item_id) ?? null : null
                    }
                    generatedInfo={
                      item.generated_item_id ? generatedInfoById.get(item.generated_item_id) ?? null : null
                    }
                    latestInstruction={latestInstructionByItemId.get(item.id) ?? null}
                    orderId={order.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Buyer</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="break-all">{order.user_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contact email</dt>
                <dd>{order.contact_email ?? '-'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Shipping address</h2>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
              {order.shipping_address ? JSON.stringify(order.shipping_address, null, 2) : 'No shipping address yet.'}
            </pre>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-4xl font-bold">{formatPrice(order.total_cents, order.currency)}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Merchandise</dt>
                <dd>{formatPrice(order.subtotal_cents, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{formatPrice(order.shipping_cents, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Currency</dt>
                <dd>{order.currency}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment route</dt>
                <dd>{order.payment_provider_route ?? '-'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment</dt>
                <dd>{order.payment_status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Production</dt>
                <dd>{order.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{formatDate(order.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <OrderStatusForm
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
          />
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Exchange-rate context</h2>
            <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(order.exchange_rate_context ?? {}, null, 2)}
            </pre>
          </div>
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">Shipping-rate context</h2>
            <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(order.shipping_rate_context ?? {}, null, 2)}
            </pre>
          </div>
        </aside>
      </div>
    </main>
  );
}

function OrderItemDetail({
  item,
  catalogInfo,
  generatedInfo,
  latestInstruction,
  orderId,
}: {
  item: AdminOrderItem;
  catalogInfo: CatalogProductionInfo | null;
  generatedInfo: GeneratedOrderInfo | null;
  latestInstruction: BannerManufacturingInstruction | null;
  orderId: string;
}) {
  const isBanner = Boolean(item.banner_size_key || generatedInfo?.product_type === 'banner');

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.catalog_item_id ? 'Catalog item' : 'Generated item'} - Qty {item.quantity}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatPrice(item.total_price_cents, item.currency)}</p>
        <p className="text-xs text-muted-foreground">
          {formatPrice(item.unit_price_cents, item.currency)} each
        </p>
      </div>
      <div className="space-y-3 sm:col-span-2">
        <div className="grid gap-3 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-2">
          <Info label="Image" value={item.image_path ?? '-'} />
          <Info label="Selected preview" value={item.selected_preview_path ?? '-'} />
          <Info label="Hidden SVG" value={item.hidden_svg_path ?? '-'} />
          <Info label="Original images" value={item.original_image_paths.join(', ') || '-'} />
          <Info label="Text" value={item.custom_text ?? '-'} />
          <Info label="LED" value={item.multi_color ? 'Multi color' : item.led_color ?? '-'} />
          <Info label="Banner size" value={item.banner_size_key ?? '-'} />
          {isBanner ? (
            <Info label="Manufacturing status" value={latestInstruction?.status ?? 'not_started'} />
          ) : null}
        </div>

        {isBanner ? (
          <div className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Banner manufacturing</p>
                <p className="text-xs text-muted-foreground">
                  {latestInstruction
                    ? `Latest artifact ${formatDate(latestInstruction.created_at)}`
                    : 'No instruction artifact generated yet.'}
                </p>
              </div>
              <form action={generateBannerManufacturingInstructionAction}>
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="orderItemId" value={item.id} />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {latestInstruction ? 'Regenerate instructions' : 'Generate instructions'}
                </button>
              </form>
            </div>
            {latestInstruction ? (
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <Info label="Source image" value={latestInstruction.source_image_path} />
                <Info label="Drawing files" value={latestInstruction.drawing_paths.join(', ') || '-'} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <Snapshot title="Item snapshot" value={item.item_snapshot} />
          <Snapshot title="Exchange-rate context" value={item.exchange_rate_context} />
          <Snapshot title="Personalization snapshot" value={item.personalization_snapshot} />
          <Snapshot title="Production snapshot" value={item.production_snapshot} />
          {catalogInfo ? (
            <Snapshot title="Admin catalog characteristics" value={catalogInfo} />
          ) : null}
          {latestInstruction ? (
            <Snapshot title="Banner manufacturing instructions" value={latestInstruction.instructions} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="break-all font-medium">{value}</p>
    </div>
  );
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      <pre className="mt-2 max-h-56 overflow-auto rounded bg-muted p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
