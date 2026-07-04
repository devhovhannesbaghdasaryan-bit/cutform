import { ItemForm } from '@/app/admin/item-form';
import { requireAdmin } from '@/lib/admin';
import { getCountryDisplayName, listMarketGeography } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function NewAdminItemPage() {
  const { supabase } = await requireAdmin();
  const [{ data: categories, error }, { data: subcategories }, geography] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from('subcategories')
      .select('id, name, category_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<{ id: string; name: string; category_id: string }[]>(),
    listMarketGeography(supabase),
  ]);

  return (
    <main className="container max-w-4xl space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New item</h1>
        <p className="text-muted-foreground">Create a marketplace catalog item.</p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : (
        <ItemForm
          categories={categories ?? []}
          subcategories={subcategories ?? []}
          marketRegions={geography.regions}
          marketCountries={geography.countries.map((country) => ({ ...country, label: getCountryDisplayName(country.code) }))}
        />
      )}
    </main>
  );
}
