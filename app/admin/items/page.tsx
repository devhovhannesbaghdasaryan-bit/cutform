import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface AdminCatalogItem {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  status: string;
  is_popular: boolean;
  is_customizable: boolean;
  created_at: string;
  category: { name: string; slug: string } | null;
}

export default async function AdminItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

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
        category:categories (name, slug)
      `,
    )
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.category) query = query.eq('categories.slug', params.category);
  if (params.q) query = query.ilike('title', `%${params.q}%`);

  const [{ data: items, error }, { data: categories }] = await Promise.all([
    query.returns<AdminCatalogItem[]>(),
    supabase
      .from('categories')
      .select('slug, name')
      .order('sort_order', { ascending: true })
      .returns<{ slug: string; name: string }[]>(),
  ]);

  const filteredItems = (items ?? []).filter(
    (item) => !params.category || item.category?.slug === params.category,
  );

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
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          No items found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/admin/items/${item.id}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.slug}</p>
                  </td>
                  <td className="px-4 py-3">{item.category?.name ?? '-'}</td>
                  <td className="px-4 py-3">{formatPrice(item.price_cents)}</td>
                  <td className="px-4 py-3 capitalize">{item.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {[item.is_popular && 'popular', item.is_customizable && 'custom'].filter(Boolean).join(', ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
