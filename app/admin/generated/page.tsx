import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { listGeneratedItemsForAdminReview } from '@/lib/generated-items';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminGeneratedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: items, error } = await listGeneratedItemsForAdminReview(supabase, params);

  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generated items</h1>
        <p className="text-muted-foreground">
          Review generated previews and manufacturing files before production.
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[220px_260px_auto]">
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All review statuses</option>
          <option value="draft">Draft</option>
          <option value="preview_ready">Preview ready</option>
          <option value="review_required">Review required</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          name="type"
          defaultValue={params.type ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All product types</option>
          <option value="night_light">Night light</option>
          <option value="personalized_night_light">Personalized night light</option>
          <option value="laser_cut_2d_toy">2D toy</option>
          <option value="laser_cut_2d_decoration">2D decoration</option>
          <option value="laser_cut_2d_constructor">2D constructor</option>
          <option value="banner">Banner</option>
        </select>
        <button className="h-10 rounded-md border border-input px-4 text-sm" type="submit">
          Filter
        </button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !items?.length ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          No generated items yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Created</th>
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
                  <td className="px-4 py-3">{item.product_type}</td>
                  <td className="px-4 py-3">{item.review_status}</td>
                  <td className="px-4 py-3">{item.credit_cost} credits</td>
                  <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
