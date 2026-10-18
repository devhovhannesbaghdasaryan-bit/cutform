import { Download } from 'lucide-react';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { OrderStatusForm } from '@/app/admin/order-status-form';
import { productionPackHrefs, ProductionSummary } from '@/app/admin/production-pack-links';
import { requireAdmin } from '@/lib/admin';
import type { AppLocale } from '@/lib/i18n';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import {
  getOrderDetailForAdmin,
  type AdminOrderItem,
  type BannerManufacturingInstruction,
  type CatalogProductionInfo,
  type GeneratedOrderInfo,
} from '@/lib/orders';
import { loadOrderProductionPacks, type ProductionPack } from '@/lib/production-pack/load';
import { formatDate, formatPrice } from '@/lib/utils';
import { generateBannerManufacturingInstructionAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [t, locale] = await Promise.all([getTranslations(), getRequestLocale()]);

  const detail = await getOrderDetailForAdmin(supabase, id);

  if (!detail) notFound();

  const {
    order,
    items,
    itemsError,
    catalogInfoById,
    generatedInfoById,
    latestInstructionByItemId,
  } = detail;

  // Technical documentation per item: the same data the download routes pack,
  // so the page can show what the workshop would receive before it is sent.
  const packs = (await loadOrderProductionPacks(supabase, id).catch(() => null)) ?? [];
  const packByItemId = new Map(packs.map((pack) => [pack.orderItemId, pack]));
  const readyCount = packs.filter((pack) => pack.sheet.status === 'ready').length;

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('adminOrders.detail.title', { id: order.id.slice(0, 8) })}
          </h1>
          <p className="text-muted-foreground">
            {t('adminOrders.detail.created', { date: formatDate(order.created_at, locale) })}
          </p>
        </div>
        {packs.length ? (
          <div className="text-right">
            <a
              href={`/admin/orders/${order.id}/production-pack`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="size-4" aria-hidden="true" />
              {t('adminOrders.detail.productionPackAll')}
            </a>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('adminOrders.detail.packSummary', { count: packs.length, ready: readyCount })}
              {readyCount !== packs.length
                ? `, ${t('adminOrders.detail.packNeedsReview', { count: packs.length - readyCount })}`
                : ''}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border">
            <div className="border-b p-4">
              <h2 className="font-semibold">{t('adminOrders.detail.items')}</h2>
            </div>
            {itemsError ? (
              <p className="p-4 text-sm text-destructive">{itemsError.message}</p>
            ) : !items?.length ? (
              <p className="p-4 text-sm text-muted-foreground">{t('adminOrders.detail.noItems')}</p>
            ) : (
              <div className="divide-y">
                {items.map((item) => (
                  <OrderItemDetail
                    key={item.id}
                    item={item}
                    catalogInfo={
                      item.catalog_item_id
                        ? (catalogInfoById.get(item.catalog_item_id) ?? null)
                        : null
                    }
                    generatedInfo={
                      item.generated_item_id
                        ? (generatedInfoById.get(item.generated_item_id) ?? null)
                        : null
                    }
                    latestInstruction={latestInstructionByItemId.get(item.id) ?? null}
                    orderId={order.id}
                    pack={packByItemId.get(item.id) ?? null}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminOrders.detail.buyer')}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('adminOrders.detail.userId')}</dt>
                <dd className="break-all">{order.user_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('adminOrders.detail.contactEmail')}</dt>
                <dd>{order.contact_email ?? '-'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminOrders.detail.shippingAddress')}</h2>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
              {order.shipping_address
                ? JSON.stringify(order.shipping_address, null, 2)
                : t('adminOrders.detail.noShippingAddress')}
            </pre>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">{t('adminOrders.detail.total')}</p>
            <p className="text-4xl font-bold">
              {formatPrice(order.total_cents, order.currency, locale)}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('adminOrders.detail.merchandise')}</dt>
                <dd>{formatPrice(order.subtotal_cents, order.currency, locale)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('adminOrders.detail.shipping')}</dt>
                <dd>{formatPrice(order.shipping_cents, order.currency, locale)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('adminOrders.detail.currency')}</dt>
                <dd>{order.currency}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('adminOrders.detail.paymentRoute')}</dt>
                <dd>{order.payment_provider_route ?? '-'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('adminOrders.detail.payment')}</dt>
                <dd>
                  {tDynamic(
                    t,
                    `adminOrders.paymentStatus.${order.payment_status}`,
                    order.payment_status,
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('adminOrders.detail.production')}</dt>
                <dd>{tDynamic(t, `status.${order.status}`, order.status)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('adminOrders.detail.updated')}</dt>
                <dd>{formatDate(order.updated_at, locale)}</dd>
              </div>
            </dl>
          </div>

          <OrderStatusForm
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
          />
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminOrders.detail.exchangeRateContext')}</h2>
            <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(order.exchange_rate_context ?? {}, null, 2)}
            </pre>
          </div>
          <div className="rounded-lg border p-5">
            <h2 className="font-semibold">{t('adminOrders.detail.shippingRateContext')}</h2>
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
  pack,
  locale,
}: {
  item: AdminOrderItem;
  catalogInfo: CatalogProductionInfo | null;
  generatedInfo: GeneratedOrderInfo | null;
  latestInstruction: BannerManufacturingInstruction | null;
  orderId: string;
  pack: ProductionPack | null;
  locale: AppLocale;
}) {
  const t = useTranslations();
  const isBanner = Boolean(item.banner_size_key || generatedInfo?.product_type === 'banner');
  const packHrefs = productionPackHrefs(
    `/admin/orders/${orderId}/items/${item.id}/production-pack`,
  );

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.catalog_item_id
            ? t('adminOrders.item.catalogItem')
            : t('adminOrders.item.generatedItem')}{' '}
          - {t('adminOrders.item.quantity', { quantity: item.quantity })}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatPrice(item.total_price_cents, item.currency, locale)}</p>
        <p className="text-xs text-muted-foreground">
          {t('adminOrders.item.unitPrice', {
            price: formatPrice(item.unit_price_cents, item.currency, locale),
          })}
        </p>
      </div>
      <div className="space-y-3 sm:col-span-2">
        <div className="grid gap-3 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-2">
          <Info label={t('adminOrders.item.image')} value={item.image_path ?? '-'} />
          <Info
            label={t('adminOrders.item.selectedPreview')}
            value={item.selected_preview_path ?? '-'}
          />
          <Info
            label={t('adminOrders.item.manufacturingFile')}
            value={item.manufacturing_file_path ?? '-'}
          />
          <Info
            label={t('adminOrders.item.originalImages')}
            value={item.original_image_paths.join(', ') || '-'}
          />
          <Info label={t('adminOrders.item.text')} value={item.custom_text ?? '-'} />
          <Info
            label={t('adminOrders.item.led')}
            value={item.multi_color ? t('adminOrders.item.multiColor') : (item.led_color ?? '-')}
          />
          <Info label={t('adminOrders.item.bannerSize')} value={item.banner_size_key ?? '-'} />
          {isBanner ? (
            <Info
              label={t('adminOrders.item.manufacturingStatus')}
              value={tDynamic(
                t,
                `adminOrders.manufacturingStatus.${latestInstruction?.status ?? 'not_started'}`,
                latestInstruction?.status ?? 'not_started',
              )}
            />
          ) : null}
        </div>

        {pack ? <ProductionSummary sheet={pack.sheet} hrefs={packHrefs} /> : null}

        {isBanner ? (
          <div className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('adminOrders.item.bannerManufacturing')}</p>
                <p className="text-xs text-muted-foreground">
                  {latestInstruction
                    ? t('adminOrders.item.latestArtifact', {
                        date: formatDate(latestInstruction.created_at, locale),
                      })
                    : t('adminOrders.item.noInstructionArtifact')}
                </p>
              </div>
              <form action={generateBannerManufacturingInstructionAction}>
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="orderItemId" value={item.id} />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {latestInstruction
                    ? t('adminOrders.item.regenerateInstructions')
                    : t('adminOrders.item.generateInstructions')}
                </button>
              </form>
            </div>
            {latestInstruction ? (
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <Info
                  label={t('adminOrders.item.sourceImage')}
                  value={latestInstruction.source_image_path}
                />
                <Info
                  label={t('adminOrders.item.drawingFiles')}
                  value={latestInstruction.drawing_paths.join(', ') || '-'}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <Snapshot title={t('adminOrders.item.itemSnapshot')} value={item.item_snapshot} />
          <Snapshot
            title={t('adminOrders.item.exchangeRateContext')}
            value={item.exchange_rate_context}
          />
          <Snapshot
            title={t('adminOrders.item.personalizationSnapshot')}
            value={item.personalization_snapshot}
          />
          <Snapshot
            title={t('adminOrders.item.productionSnapshot')}
            value={item.production_snapshot}
          />
          {catalogInfo ? (
            <Snapshot
              title={t('adminOrders.item.adminCatalogCharacteristics')}
              value={catalogInfo}
            />
          ) : null}
          {latestInstruction ? (
            <Snapshot
              title={t('adminOrders.item.bannerManufacturingInstructions')}
              value={latestInstruction.instructions}
            />
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
