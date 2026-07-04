import Link from 'next/link';
import type { ComponentType } from 'react';
import { Blocks, Gift, Lamp, Megaphone, Puzzle } from 'lucide-react';
import type { AppLocale } from '@/lib/i18n';
import { translate, translateWithFallback } from '@/lib/i18n';
import type { MarketplaceCategory, MarketplaceSubcategory } from '@/lib/marketplace';
import { cn } from '@/lib/utils';

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  toys: Gift,
  constructors: Puzzle,
  decorations: Blocks,
  'night-lights': Lamp,
  banners: Megaphone,
};

export function CategoryNavigation({
  categories,
  subcategories = [],
  locale = 'en',
  className,
}: {
  categories: MarketplaceCategory[];
  subcategories?: MarketplaceSubcategory[];
  locale?: AppLocale;
  className?: string;
}) {
  return (
    <section className={cn('storefront-section bg-background', className)} id="categories">
      <div className="storefront-container space-y-10">
        <div className="text-center">
          <h2 className="storefront-heading">{translate(locale, 'categories.title')}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            {translate(locale, 'categories.subtitle')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = ICONS[category.slug] ?? Gift;
            const children = subcategories.filter((item) => item.category_id === category.id);
            const categoryName = translateWithFallback(locale, `category.${category.slug}.name`, category.name);
            const categoryDescription = translateWithFallback(
              locale,
              `category.${category.slug}.description`,
              category.description ?? '',
            );
            return (
              <Link
                key={category.id}
                href={`/catalog?category=${category.slug}`}
                className="group rounded-lg border bg-card p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-cyber-cyan/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{categoryName}</h3>
                {categoryDescription ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{categoryDescription}</p>
                ) : null}
                {children.length ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {children.map((child) => (
                      <span key={child.id} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        {translateWithFallback(locale, `subcategory.${child.slug}.name`, child.name)}
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
