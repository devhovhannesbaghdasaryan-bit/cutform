import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { CatalogItemCard } from '@/components/catalog-item-card';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { SiteFooter } from '@/components/site-footer';
import { getTranslations } from 'next-intl/server';
import { tDynamic } from '@/lib/i18n-dynamic';
import {
  type CatalogPersonalizationFilter,
  type CatalogSort,
  listCategories,
  listPublishedCatalogItems,
  listSubcategories,
} from '@/lib/marketplace';
import { getRequestLocale } from '@/lib/i18n-server';
import { resolveCatalogMetadata } from '@/lib/seo';
import { cn } from '@/lib/utils';
import {
  applyExchangeRate,
  getActiveCurrency,
  getExchangeRates,
  normalizeCurrency,
} from '@/lib/currency';

export const dynamic = 'force-dynamic';

const PERSONALIZATION_FILTERS: CatalogPersonalizationFilter[] = ['photo', 'text', 'none'];
const SORTS: CatalogSort[] = ['popular', 'newest', 'price_asc', 'price_desc'];

type CatalogSearchParams = {
  category?: string;
  subcategory?: string;
  page?: string;
  q?: string;
  personalization?: string;
  sort?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}): Promise<Metadata> {
  const [{ category, subcategory }, locale, categories, t] = await Promise.all([
    searchParams,
    getRequestLocale(),
    listCategories().catch(() => []),
    getTranslations(),
  ]);
  const activeCategory = categories.find((item) => item.slug === category);
  const title = activeCategory
    ? t('catalog.metaTitleCategory', {
        name: tDynamic(t, `category.${activeCategory.slug}.name`, activeCategory.name),
      })
    : t('catalog.meta_title');

  return resolveCatalogMetadata({
    locale,
    path: category
      ? `/catalog?category=${category}${subcategory ? `&subcategory=${subcategory}` : ''}`
      : '/catalog',
    fallback: {
      title,
      slug: 'catalog',
      description: activeCategory
        ? tDynamic(
            t,
            `category.${activeCategory.slug}.description`,
            activeCategory.description ?? '',
          )
        : t('catalog.meta_description'),
    },
  });
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const { category, subcategory } = params;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const search = params.q?.trim() || undefined;
  const personalization = PERSONALIZATION_FILTERS.find((value) => value === params.personalization);
  const sort = SORTS.find((value) => value === params.sort) ?? 'popular';

  const [locale, categories, subcategories, t] = await Promise.all([
    getRequestLocale(),
    listCategories().catch(() => []),
    listSubcategories(category).catch(() => []),
    getTranslations(),
  ]);

  const activeCategory = categories.find((item) => item.slug === category);
  const activeSubcategory = subcategories.find((item) => item.slug === subcategory);

  const [{ items, hasMore }, activeCurrency] = await Promise.all([
    listPublishedCatalogItems(activeCategory?.id, activeSubcategory?.id, page, {
      search,
      personalization,
      sort,
    }).catch(() => ({ items: [], page, hasMore: false })),
    getActiveCurrency(),
  ]);
  const exchangeRates = await getExchangeRates(
    items.map((item) => normalizeCurrency(item.currency) ?? 'AMD'),
    activeCurrency,
  );
  const activeCategoryName = activeCategory
    ? tDynamic(t, `category.${activeCategory.slug}.name`, activeCategory.name)
    : null;
  const activeCategoryDescription = activeCategory
    ? tDynamic(t, `category.${activeCategory.slug}.description`, activeCategory.description ?? '')
    : null;
  const activeSubcategoryName = activeSubcategory
    ? tDynamic(t, `subcategory.${activeSubcategory.slug}.name`, activeSubcategory.name)
    : null;
  const activeSubcategoryDescription = activeSubcategory
    ? tDynamic(
        t,
        `subcategory.${activeSubcategory.slug}.description`,
        activeSubcategory.description ?? '',
      )
    : null;

  const hrefFor = (overrides: Partial<CatalogSearchParams>) =>
    buildCatalogHref({ category, subcategory, q: search, personalization, sort, ...overrides });
  const hasActiveFilters = Boolean(search || personalization);

  return (
    <div className="flex min-h-screen flex-col">
      <MarketplaceHeader />
      <main className="storefront-container flex flex-1 flex-col gap-6 py-7 pb-16">
        <nav
          aria-label={t('catalog.breadcrumb')}
          className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground">
            {t('product.breadcrumb_home')}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          {activeCategoryName ? (
            <>
              <Link href="/catalog" className="hover:text-foreground">
                {t('catalog.shop_title')}
              </Link>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <span className="text-foreground">{activeCategoryName}</span>
            </>
          ) : (
            <span className="text-foreground">{t('catalog.shop_title')}</span>
          )}
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0 max-w-[720px]">
            <h1 className="text-[30px] font-bold leading-[1.1] sm:text-[40px]">
              {activeSubcategoryName ?? activeCategoryName ?? t('catalog.shop_title')}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {activeSubcategoryDescription || activeCategoryDescription || t('catalog.subtitle')}
            </p>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {search
              ? t('catalog.searchResults', { query: search })
              : t('catalog.results_count', { count: items.length })}
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-8">
          {/* Filter rail */}
          <aside
            aria-label={t('catalog.filters')}
            className="hidden min-w-0 max-w-[300px] flex-[1_1_230px] flex-col gap-6 lg:flex"
          >
            <section>
              <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('catalog.categories')}
              </h2>
              <div className="flex flex-col gap-0.5">
                <FilterLink
                  href={hrefFor({ category: undefined, subcategory: undefined, page: undefined })}
                  active={!category}
                >
                  {t('catalog.all_items')}
                </FilterLink>
                {categories.map((item) => (
                  <div key={item.id} className="contents">
                    <FilterLink
                      href={hrefFor({
                        category: item.slug,
                        subcategory: undefined,
                        page: undefined,
                      })}
                      active={item.slug === category && !subcategory}
                    >
                      {tDynamic(t, `category.${item.slug}.name`, item.name)}
                    </FilterLink>
                    {item.slug === category
                      ? subcategories.map((sub) => (
                          <FilterLink
                            key={sub.id}
                            href={hrefFor({ category, subcategory: sub.slug, page: undefined })}
                            active={sub.slug === subcategory}
                            nested
                          >
                            {tDynamic(t, `subcategory.${sub.slug}.name`, sub.name)}
                          </FilterLink>
                        ))
                      : null}
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('catalog.personalization')}
              </h2>
              <div className="flex flex-col gap-0.5">
                {PERSONALIZATION_FILTERS.map((value) => (
                  <FilterLink
                    key={value}
                    href={hrefFor({
                      personalization: personalization === value ? undefined : value,
                      page: undefined,
                    })}
                    active={personalization === value}
                  >
                    {t(`catalog.personalization_${value}`)}
                  </FilterLink>
                ))}
              </div>
            </section>
            {hasActiveFilters ? (
              <Link
                href={buildCatalogHref({ category, subcategory })}
                className="inline-flex h-9 items-center justify-center self-start rounded-lg border border-input bg-card px-3.5 text-sm font-bold hover:bg-accent"
              >
                {t('catalog.clearFilters')}
              </Link>
            ) : null}
          </aside>

          {/* Results */}
          <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px]">
            {/* Below lg the rail collapses into scrollable chip rows. */}
            <nav
              aria-label={t('catalog.categories')}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
            >
              <ChipLink
                href={hrefFor({ category: undefined, subcategory: undefined, page: undefined })}
                active={!category}
              >
                {t('catalog.all_items')}
              </ChipLink>
              {categories.map((item) => (
                <ChipLink
                  key={item.id}
                  href={hrefFor({ category: item.slug, subcategory: undefined, page: undefined })}
                  active={item.slug === category && !subcategory}
                >
                  {tDynamic(t, `category.${item.slug}.name`, item.name)}
                </ChipLink>
              ))}
            </nav>
            {category && subcategories.length ? (
              <nav
                aria-label={activeCategoryName ?? t('catalog.categories')}
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
              >
                {subcategories.map((sub) => (
                  <ChipLink
                    key={sub.id}
                    href={hrefFor({ category, subcategory: sub.slug, page: undefined })}
                    active={sub.slug === subcategory}
                  >
                    {tDynamic(t, `subcategory.${sub.slug}.name`, sub.name)}
                  </ChipLink>
                ))}
              </nav>
            ) : null}
            <nav
              aria-label={t('catalog.personalization')}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
            >
              {PERSONALIZATION_FILTERS.map((value) => (
                <ChipLink
                  key={value}
                  href={hrefFor({
                    personalization: personalization === value ? undefined : value,
                    page: undefined,
                  })}
                  active={personalization === value}
                >
                  {t(`catalog.personalization_${value}`)}
                </ChipLink>
              ))}
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {search ? (
                  <Link
                    href={hrefFor({ q: undefined, page: undefined })}
                    className="inline-flex h-8 items-center gap-2 rounded-full bg-foreground pl-3 pr-2 text-[13px] font-bold text-background"
                  >
                    “{search}”
                    <span className="grid size-5 place-items-center rounded-full bg-white/20">
                      <X className="size-3" aria-hidden="true" />
                    </span>
                    <span className="sr-only">{t('catalog.clearSearch')}</span>
                  </Link>
                ) : null}
                {personalization ? (
                  <Link
                    href={hrefFor({ personalization: undefined, page: undefined })}
                    className="inline-flex h-8 items-center gap-2 rounded-full bg-foreground pl-3 pr-2 text-[13px] font-bold text-background"
                  >
                    {t(`catalog.personalization_${personalization}`)}
                    <span className="grid size-5 place-items-center rounded-full bg-white/20">
                      <X className="size-3" aria-hidden="true" />
                    </span>
                  </Link>
                ) : null}
              </div>
              <form method="get" action="/catalog" className="flex items-center gap-2.5">
                {category ? <input type="hidden" name="category" value={category} /> : null}
                {subcategory ? (
                  <input type="hidden" name="subcategory" value={subcategory} />
                ) : null}
                {search ? <input type="hidden" name="q" value={search} /> : null}
                {personalization ? (
                  <input type="hidden" name="personalization" value={personalization} />
                ) : null}
                <label htmlFor="sort" className="text-[13.5px] font-semibold text-muted-foreground">
                  {t('catalog.sort')}
                </label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={sort}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-semibold"
                >
                  {SORTS.map((value) => (
                    <option key={value} value={value}>
                      {t(`catalog.sort_${value}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="h-10 rounded-lg border border-input bg-card px-3.5 text-sm font-bold hover:bg-accent"
                >
                  {t('catalog.apply')}
                </button>
              </form>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                {search
                  ? t('catalog.empty_search', { query: search })
                  : activeSubcategoryName || activeCategoryName
                    ? t('catalog.empty_in', {
                        name: activeSubcategoryName ?? activeCategoryName ?? '',
                      })
                    : t('catalog.empty')}
              </div>
            ) : (
              <>
                <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => {
                    const fromCurrency = normalizeCurrency(item.currency) ?? 'AMD';
                    // biome-ignore lint/style/noNonNullAssertion: exchangeRates was built from these same items' currencies
                    const rate = exchangeRates.get(fromCurrency)!;
                    return (
                      <CatalogItemCard
                        key={item.id}
                        item={item}
                        locale={locale}
                        convertedPrice={applyExchangeRate(item.price_cents, rate)}
                      />
                    );
                  })}
                </div>

                {(page > 1 || hasMore) && (
                  <nav
                    aria-label={t('catalog.pagination')}
                    className="flex items-center justify-between gap-3 pt-2"
                  >
                    <p className="text-sm text-muted-foreground">
                      {t('catalog.page_label', { page })}
                    </p>
                    <div className="flex gap-2">
                      {page > 1 ? (
                        <PageLink href={hrefFor({ page: String(page - 1) })}>
                          {t('catalog.previous_page')}
                        </PageLink>
                      ) : null}
                      {hasMore ? (
                        <PageLink href={hrefFor({ page: String(page + 1) })}>
                          {t('catalog.next_page')}
                        </PageLink>
                      ) : null}
                    </div>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function buildCatalogHref({
  category,
  subcategory,
  page,
  q,
  personalization,
  sort,
}: {
  category?: string;
  subcategory?: string;
  page?: string;
  q?: string;
  personalization?: string;
  sort?: string;
}) {
  const search = new URLSearchParams();
  if (category) search.set('category', category);
  if (subcategory) search.set('subcategory', subcategory);
  if (q) search.set('q', q);
  if (personalization) search.set('personalization', personalization);
  if (sort && sort !== 'popular') search.set('sort', sort);
  if (page && page !== '1') search.set('page', page);
  const query = search.toString();
  return query ? `/catalog?${query}` : '/catalog';
}

function FilterLink({
  href,
  active,
  nested = false,
  children,
}: {
  href: string;
  active: boolean;
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-9 items-center rounded-lg px-2.5 text-[14.5px] font-semibold transition-colors',
        nested && 'pl-6 font-medium',
        active ? 'bg-foreground text-background' : 'text-foreground hover:bg-accent',
      )}
    >
      {children}
    </Link>
  );
}

function ChipLink({
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
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-input bg-card text-foreground hover:bg-accent',
      )}
    >
      {children}
    </Link>
  );
}

function PageLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-lg border border-input bg-card px-4 text-sm font-bold transition-colors hover:bg-accent"
    >
      {children}
    </Link>
  );
}
