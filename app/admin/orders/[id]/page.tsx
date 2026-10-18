import { ChevronRight, Download } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { OrderStatusForm } from '@/app/admin/order-status-form';
import { productionPackHrefs, ProductionSummary } from '@/app/admin/production-pack-links';
import { StatusBadge } from '@/components/admin/status-badge';
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
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { generateBannerManufacturingInstructionAction } from './actions';

export const dynamic = 'force-dynamic';

// The happy path through production, in order. Anything else (draft, pending
// payment, cancelled, refunded) is shown as a badge instead of a step.
const PRODUCTION_FLOW = [
  'paid',
  'review_required',
  'approved_for_production',
  'in_production',
  'ready_to_ship',
  'shipped',
] as const;

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
  const currentStep = PRODUCTION_FLOW.indexOf(order.status as (typeof PRODUCTION_FLOW)[number]);
  const shortId = order.id.slice(0, 8);
  const address = formatShippingAddress(order.shipping_address);

  return (
    <main className="container flex max-w-[1240px] flex-col gap-5 py-6 pb-12">
      <nav
        aria-label={t('adminGenerated.detail.breadcrumbLabel')}
        className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground"
      >
        <Link href="/admin/orders" className="hover:text-foreground">
          {t('adminOrders.title')}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="font-mono text-foreground">{shortId}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-bold">
              {t('adminOrders.detail.title', { id: shortId })}
            </h1>
            <StatusBadge
              status={order.payment_status}
              label={tDynamic(
                t,
                `adminOrders.paymentStatus.${order.payment_status}`,
                order.payment_status,
              )}
            />
            <StatusBadge
              status={order.status}
              label={tDynamic(t, `status.${order.status}`, order.status)}
            />
          </div>
          <p className="mt-1 text-muted-foreground">
            {t('adminOrders.detail.placed', { date: formatDate(order.created_at, locale) })}
            {order.contact_email ? ` · ${order.contact_email}` : ''} ·{' '}
            {t('adminOrders.detail.itemCount', { count: items?.length ?? 0 })} ·{' '}
            {formatPrice(order.total_cents, order.currency, locale)}
          </p>
        </div>
        {packs.length ? (
          <div className="flex flex-col items-end gap-1">
            <a
              href={`/admin/orders/${order.id}/production-pack`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="size-4" aria-hidden="true" />
              {t('adminOrders.detail.productionPackAll')}
            </a>
            <p className="text-xs text-muted-foreground">
              {t('adminOrders.detail.packSummary', { count: packs.length, ready: readyCount })}
              {readyCount !== packs.length
                ? `, ${t('adminOrders.detail.packNeedsReview', { count: packs.length - readyCount })}`
                : ''}
            </p>
          </div>
        ) : null}
      </div>

      {/* Production stepper */}
      <section className="flex flex-col gap-2.5 rounded-xl border bg-card px-[18px] py-3.5">
        {currentStep >= 0 ? (
          <ol className="flex flex-wrap gap-2" aria-label={t('adminOrders.detail.stepperLabel')}>
            {PRODUCTION_FLOW.map((step, index) => {
              const done = index < currentStep;
              const now = index === currentStep;
              return (
                <li
                  key={step}
                  aria-current={now ? 'step' : undefined}
                  className={cn(
                    'flex min-w-0 flex-[1_1_120px] flex-col gap-2 text-[12.5px] font-bold',
                    done ? 'text-success' : now ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 rounded-sm',
                      done ? 'bg-success' : now ? 'bg-gold' : 'bg-muted',
                    )}
                  />
                  {t(`status.${step}`)}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t('adminOrders.detail.offTrack')}</p>
        )}
        {packs.length && readyCount < packs.length ? (
          <p className="text-[13px] text-muted-foreground">
            {t('adminOrders.detail.docsReady', { ready: readyCount, total: packs.length })}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-[18px] py-3.5">
              <h2 className="text-base font-semibold">{t('adminOrders.detail.items')}</h2>
              {packs.length ? (
                <span className="text-[13px] text-muted-foreground">
                  {t('adminOrders.detail.docsReady', { ready: readyCount, total: packs.length })}
                </span>
              ) : null}
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

          <div className="flex flex-wrap gap-5">
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5 rounded-xl border bg-card p-[18px]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{t('adminOrders.detail.buyer')}</h2>
                <Link
                  href={`/admin/users/${order.user_id}`}
                  className="text-[13px] font-bold text-primary"
                >
                  {t('adminOrders.detail.openProfile')}
                </Link>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[13.5px]">
                <dt className="text-muted-foreground">{t('adminOrders.detail.contactEmail')}</dt>
                <dd className="font-semibold">
                  {order.contact_email ? (
                    <a href={`mailto:${order.contact_email}`} className="hover:underline">
                      {order.contact_email}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
                <dt className="text-muted-foreground">{t('adminOrders.detail.userId')}</dt>
                <dd className="break-all font-mono text-xs">{order.user_id}</dd>
                {order.locale ? (
                  <>
                    <dt className="text-muted-foreground">{t('adminOrders.detail.locale')}</dt>
                    <dd className="font-semibold">
                      {order.locale.toUpperCase()} · {order.currency}
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5 rounded-xl border bg-card p-[18px]">
              <h2 className="text-base font-semibold">{t('adminOrders.detail.shippingAddress')}</h2>
              {address ? (
                <p className="whitespace-pre-line text-[14px] font-semibold leading-relaxed">
                  {address}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('adminOrders.detail.noShippingAddress')}
                </p>
              )}
              {order.destination_country_code ? (
                <p className="text-[13px] text-muted-foreground">
                  {t('adminOrders.detail.destination', { country: order.destination_country_code })}{' '}
                  · {formatPrice(order.shipping_cents, order.currency, locale)}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-5">
          <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-[18px]">
            <h2 className="text-base font-semibold">{t('adminOrders.detail.paymentTitle')}</h2>
            <p className="text-[28px] font-extrabold leading-tight">
              {formatPrice(order.total_cents, order.currency, locale)}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[13.5px]">
              <dt className="text-muted-foreground">{t('adminOrders.detail.merchandise')}</dt>
              <dd className="font-semibold">
                {formatPrice(order.subtotal_cents, order.currency, locale)}
              </dd>
              <dt className="text-muted-foreground">{t('adminOrders.detail.shipping')}</dt>
              <dd className="font-semibold">
                {formatPrice(order.shipping_cents, order.currency, locale)}
              </dd>
              <dt className="text-muted-foreground">{t('adminOrders.detail.paymentRoute')}</dt>
              <dd className="font-semibold">{order.payment_provider_route ?? '-'}</dd>
              <dt className="text-muted-foreground">{t('adminOrders.detail.payment')}</dt>
              <dd>
                <StatusBadge
                  status={order.payment_status}
                  label={tDynamic(
                    t,
                    `adminOrders.paymentStatus.${order.payment_status}`,
                    order.payment_status,
                  )}
                />
              </dd>
              <dt className="text-muted-foreground">{t('adminOrders.detail.updated')}</dt>
              <dd className="font-semibold">{formatDate(order.updated_at, locale)}</dd>
            </dl>
            {order.transaction_id ? (
              <Link
                href={`/admin/transactions/${order.transaction_id}`}
                className="text-[13px] font-bold text-primary"
              >
                {t('adminOrders.detail.openTransaction')}
              </Link>
            ) : null}
          </div>

          <OrderStatusForm
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
          />

          <details className="rounded-xl border bg-card p-[18px]">
            <summary className="cursor-pointer text-sm font-bold">
              {t('adminOrders.detail.developerDetails')}
            </summary>
            <div className="mt-3 flex flex-col gap-3 text-[13px]">
              <p className="text-muted-foreground">{t('adminOrders.detail.exchangeRateContext')}</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-xs">
                {JSON.stringify(order.exchange_rate_context ?? {}, null, 2)}
              </pre>
              <p className="text-muted-foreground">{t('adminOrders.detail.shippingRateContext')}</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-xs">
                {JSON.stringify(order.shipping_rate_context ?? {}, null, 2)}
              </pre>
            </div>
          </details>
        </aside>
      </div>
    </main>
  );
}

function formatShippingAddress(address: Record<string, unknown> | null) {
  if (!address) return null;
  const line = (key: string) => {
    const value = address[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  };
  const lines = [
    line('recipientName'),
    line('addressLine1'),
    line('addressLine2'),
    [line('city'), line('administrativeArea'), line('postalCode')].filter(Boolean).join(', ') ||
      null,
    line('countryCode'),
    line('phone'),
  ].filter((value): value is string => Boolean(value));
  return lines.length ? lines.join('\n') : null;
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
  const isGenerated = Boolean(item.generated_item_id);
  const packHrefs = productionPackHrefs(
    `/admin/orders/${orderId}/items/${item.id}/production-pack`,
  );
  const facts = [
    item.custom_text ? { label: t('adminOrders.item.text'), value: `“${item.custom_text}”` } : null,
    item.multi_color || item.led_color
      ? {
          label: t('adminOrders.item.led'),
          value: item.multi_color
            ? t('adminOrders.item.multiColor')
            : tDynamic(t, `generated.color.${item.led_color}`, item.led_color ?? '-'),
        }
      : null,
    item.banner_size_key
      ? { label: t('adminOrders.item.bannerSize'), value: item.banner_size_key }
      : null,
    isBanner
      ? {
          label: t('adminOrders.item.manufacturingStatus'),
          value: tDynamic(
            t,
            `adminOrders.manufacturingStatus.${latestInstruction?.status ?? 'not_started'}`,
            latestInstruction?.status ?? 'not_started',
          ),
        }
      : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  return (
    <div className="flex flex-col gap-3.5 p-[18px]">
      <div className="flex flex-wrap items-start gap-3.5">
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-bold">{item.title}</p>
            <span
              className={cn(
                'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold',
                isGenerated ? 'bg-gold text-gold-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {isGenerated
                ? t('adminOrders.item.generatedItem')
                : t('adminOrders.item.catalogItem')}
            </span>
          </div>
          {facts.length ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[13.5px]">
              {facts.map((fact) => (
                <div key={fact.label} className="contents">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="font-semibold">{fact.value}</dd>
                </div>
              ))}
              {item.generated_item_id ? (
                <>
                  <dt className="text-muted-foreground">{t('adminOrders.item.generation')}</dt>
                  <dd>
                    <Link
                      href={`/admin/generated/${item.generated_item_id}`}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {item.generated_item_id.slice(0, 8)}
                    </Link>
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-extrabold">
            {formatPrice(item.total_price_cents, item.currency, locale)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('adminOrders.item.quantity', { quantity: item.quantity })} ·{' '}
            {t('adminOrders.item.unitPrice', {
              price: formatPrice(item.unit_price_cents, item.currency, locale),
            })}
          </p>
        </div>
      </div>

      {pack ? <ProductionSummary sheet={pack.sheet} hrefs={packHrefs} /> : null}

      {isBanner ? (
        <div className="rounded-lg border p-3">
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
                className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
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

      <details className="rounded-lg border bg-background/60 p-3">
        <summary className="cursor-pointer text-[13px] font-bold">
          {t('adminOrders.item.developerDetails')}
        </summary>
        <div className="mt-3 grid gap-3 rounded-lg bg-background p-3 text-xs sm:grid-cols-2">
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
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
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
      </details>
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
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{title}</p>
      <pre className="mt-2 max-h-56 overflow-auto rounded bg-background p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
