import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { translate, translateTemplate, translateWithFallback } from '@/lib/i18n';
import { listCategories, listPublishedCatalogItems, listSubcategories } from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { resolveCatalogMetadata } from '@/lib/seo';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; subcategory?: string }>;
}): Promise<Metadata> {
  const [{ category, subcategory }, locale, categories] = await Promise.all([
    searchParams,
    getRequestLocale(),
    listCategories().catch(() => []),
  ]);
  const activeCategory = categories.find((item) => item.slug === category);
  const title = activeCategory
    ? `${translateWithFallback(locale, `category.${activeCategory.slug}.name`, activeCategory.name)} ${translate(locale, 'catalog.meta_title')}`
    : translate(locale, 'catalog.meta_title');

  return resolveCatalogMetadata({
    locale,
    path: category
      ? `/catalog?category=${category}${subcategory ? `&subcategory=${subcategory}` : ''}`
      : '/catalog',
    fallback: {
      title,
      slug: 'catalog',
      description:
        activeCategory
          ? translateWithFallback(locale, `category.${activeCategory.slug}.description`, activeCategory.description ?? '')
          : translate(locale, 'catalog.meta_description'),
    },
  });
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; subcategory?: string }>;
}) {
  const { category, subcategory } = await searchParams;
  const [locale, categories, subcategories, items] = await Promise.all([
    getRequestLocale(),
    listCategories().catch(() => []),
    listSubcategories(category).catch(() => []),
    listPublishedCatalogItems(category, subcategory).catch(() => []),
  ]);

  const activeCategory = categories.find((item) => item.slug === category);
  const activeSubcategory = subcategories.find((item) => item.slug === subcategory);
  const activeCategoryName = activeCategory
    ? translateWithFallback(locale, `category.${activeCategory.slug}.name`, activeCategory.name)
    : null;
  const activeCategoryDescription = activeCategory
    ? translateWithFallback(locale, `category.${activeCategory.slug}.description`, activeCategory.description ?? '')
    : null;
  const activeSubcategoryName = activeSubcategory
    ? translateWithFallback(locale, `subcategory.${activeSubcategory.slug}.name`, activeSubcategory.name)
    : null;
  const activeSubcategoryDescription = activeSubcategory
    ? translateWithFallback(locale, `subcategory.${activeSubcategory.slug}.description`, activeSubcategory.description ?? '')
    : null;

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-8 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{translate(locale, 'catalog.title')}</h1>
            <p className="max-w-2xl text-muted-foreground">
              {translate(locale, 'catalog.subtitle')}
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/create">{translate(locale, 'catalog.generate_custom')}</Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <CategoryPill href="/catalog" active={!category}>
            {translate(locale, 'catalog.all_items')}
          </CategoryPill>
          {categories.map((item) => (
            <CategoryPill
              key={item.id}
              href={`/catalog?category=${item.slug}`}
              active={item.slug === category}
            >
              {translateWithFallback(locale, `category.${item.slug}.name`, item.name)}
            </CategoryPill>
          ))}
        </div>

        {category && subcategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <CategoryPill href={`/catalog?category=${category}`} active={!subcategory}>
              {translateTemplate(locale, 'catalog.all_category', { name: activeCategoryName ?? translate(locale, 'common.all') })}
            </CategoryPill>
            {subcategories.map((item) => (
              <CategoryPill
                key={item.id}
                href={`/catalog?category=${category}&subcategory=${item.slug}`}
                active={item.slug === subcategory}
              >
                {translateWithFallback(locale, `subcategory.${item.slug}.name`, item.name)}
              </CategoryPill>
            ))}
          </div>
        )}

        {(activeSubcategoryDescription || activeCategoryDescription) && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            {activeSubcategoryDescription ?? activeCategoryDescription}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            {activeSubcategoryName || activeCategoryName
              ? translateTemplate(locale, 'catalog.empty_in', { name: activeSubcategoryName ?? activeCategoryName ?? '' })
              : translate(locale, 'catalog.empty')}
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <CatalogItemCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function CategoryPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
      )}
    >
      {children}
    </Link>
  );
}
