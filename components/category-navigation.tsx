import Link from 'next/link';
import type { ComponentType } from 'react';
import { Blocks, Gift, Lamp, Megaphone, Puzzle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { tDynamic } from '@/lib/i18n-dynamic';
import type { MarketplaceCategory, MarketplaceSubcategory } from '@/lib/marketplace';
import { cn } from '@/lib/utils';

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  toys: Gift,
  constructors: Puzzle,
  decorations: Blocks,
  'night-lights': Lamp,
  banners: Megaphone,
};

export async function CategoryNavigation({
  categories,
  subcategories = [],
  className,
}: {
  categories: MarketplaceCategory[];
  subcategories?: MarketplaceSubcategory[];
  className?: string;
}) {
  const t = await getTranslations();
  return (
    <section className={cn('storefront-section bg-background', className)} id="categories">
      <div className="storefront-container space-y-10">
        <div className="text-center">
          <h2 className="storefront-heading">{t('categories.title')}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            {t('categories.subtitle')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = ICONS[category.slug] ?? Gift;
            const children = subcategories.filter((item) => item.category_id === category.id);
            const categoryName = tDynamic(t, `category.${category.slug}.name`, category.name);
            const categoryDescription = tDynamic(
              t,
              `category.${category.slug}.description`,
              category.description ?? '',
            );
            return (
              <Link
                key={category.id}
                href={`/catalog?category=${category.slug}`}
                className="group min-w-0 rounded-lg border bg-card p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-cyber-cyan/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 break-words text-base font-semibold leading-snug [overflow-wrap:anywhere] xl:text-lg">
                  {categoryName}
                </h3>
                {categoryDescription ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {categoryDescription}
                  </p>
                ) : null}
                {children.length ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {children.map((child) => (
                      <span
                        key={child.id}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {tDynamic(t, `subcategory.${child.slug}.name`, child.name)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
