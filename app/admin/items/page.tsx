import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasAdminPermission, requireAdmin } from '@/lib/admin';
import { getCatalogPreviewPath } from '@/lib/catalog-media';
import { type AdminItemRow, ItemsTable } from './items-table';

export const dynamic = 'force-dynamic';

export default async function AdminItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAdmin();

  let query = supabase
    .from('catalog_items')
    .select(
      `
        id,
        title,
        slug,
        price_cents,
        status,
        is_popular,
        is_customizable,
        created_at,
        thumbnail_path,
        category:categories (name, slug),
        media:catalog_item_media (
          id,
          media_type,
          storage_path,
          alt_text,
          poster_path,
          sort_order,
          is_primary
        )
      `,
    )
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.category) query = query.eq('categories.slug', params.category);
  if (params.q) query = query.ilike('title', `%${params.q}%`);

  const [{ data: items, error }, { data: categories }, canDelete] = await Promise.all([
    query,
    supabase.from('categories').select('slug, name').order('sort_order', { ascending: true }),
    hasAdminPermission(user.id, 'catalog_manage'),
  ]);

  const rows = (items ?? [])
    .filter((item) => !params.category || item.category?.slug === params.category)
    .map((item) => ({
      ...item,
      previewPath: getCatalogPreviewPath(item),
    })) as AdminItemRow[];

  return (
    <main className="container space-y-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground">Create, publish, and manage marketplace products.</p>
        </div>
        <Button asChild>
          <Link href="/admin/items/new">
            <Plus className="mr-2 h-4 w-4" />
            New item
          </Link>
        </Button>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <input
          name="q"
          placeholder="Search title"
          defaultValue={params.q ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="category"
          defaultValue={params.category ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          No items found.
        </div>
      ) : (
        <ItemsTable items={rows} canDelete={canDelete} />
      )}
    </main>
  );
}
