import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { ProductCard, type ProductCardItem } from '@/components/product-card';
import { EmptyState } from '@/components/empty-state';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, svg_content, price_cents, created_at')
    .order('created_at', { ascending: false })
    .returns<ProductCardItem[]>();

  if (error) {
    return (
      <>
        <SiteHeader email={user.email ?? ''} />
        <main className="container py-10">
          <p className="text-destructive">Failed to load products: {error.message}</p>
        </main>
      </>
    );
  }

  const items = products ?? [];

  return (
    <>
      <SiteHeader email={user.email ?? ''} />
      <main className="container space-y-6 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your products</h1>
          <p className="text-sm text-muted-foreground">
            Everything you&apos;ve approved, newest first.
          </p>
        </div>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
