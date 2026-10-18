import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin';
import { listGeneratedItemsForAdminReview } from '@/lib/generated-items';
import { tDynamic } from '@/lib/i18n-dynamic';
import { getRequestLocale } from '@/lib/i18n-server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES = [
  'draft',
  'preview_ready',
  'review_required',
  'approved',
  'rejected',
] as const;

const PRODUCT_TYPES = [
  'night_light',
  'personalized_night_light',
  'laser_cut_2d_toy',
  'laser_cut_2d_decoration',
  'laser_cut_2d_constructor',
  'banner',
] as const;

export default async function AdminGeneratedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const [{ supabase }, t, locale] = await Promise.all([
    requireAdmin(),
    getTranslations(),
    getRequestLocale(),
  ]);

  const { data: items, error } = await listGeneratedItemsForAdminReview(supabase, params);

  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('adminGenerated.list.title')}</h1>
        <p className="text-muted-foreground">{t('adminGenerated.list.subtitle')}</p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[220px_260px_auto]">
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminGenerated.list.allStatuses')}</option>
          {REVIEW_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={params.type ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('adminGenerated.list.allTypes')}</option>
          {PRODUCT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`generated.productType.${value}`)}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          {t('adminGenerated.list.filter')}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !items?.length ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          {t('adminGenerated.list.empty')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t('adminGenerated.list.colItem')}</th>
                <th className="px-4 py-3 font-medium">{t('adminGenerated.list.colUser')}</th>
                <th className="px-4 py-3 font-medium">{t('adminGenerated.list.colType')}</th>
                <th className="px-4 py-3 font-medium">{t('adminGenerated.list.colStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('adminGenerated.list.colCost')}</th>
                <th className="px-4 py-3 font-medium">{t('adminGenerated.list.colCreated')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/generated/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.title ?? item.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{item.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    {tDynamic(t, `generated.productType.${item.product_type}`, item.product_type)}
                  </td>
                  <td className="px-4 py-3">
                    {tDynamic(t, `status.${item.review_status}`, item.review_status)}
                  </td>
                  <td className="px-4 py-3">
                    {t('adminGenerated.credits', { count: item.credit_cost })}
                  </td>
                  <td className="px-4 py-3">{formatDate(item.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
