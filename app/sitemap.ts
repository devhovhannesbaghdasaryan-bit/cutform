import type { MetadataRoute } from 'next';
import { APP_LOCALES } from '@/lib/i18n';
import { listCategories, listPublishedCatalogItems } from '@/lib/marketplace';
import { getCanonicalUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, items] = await Promise.all([
    listCategories().catch(() => []),
    listPublishedCatalogItems().catch(() => []),
  ]);

  const paths = new Set<string>(['/', '/catalog']);

  for (const category of categories) {
    paths.add(`/catalog?category=${category.slug}`);
  }

  for (const item of items) {
    paths.add(`/items/${item.slug}`);
  }

  return APP_LOCALES.flatMap((locale) =>
    Array.from(paths).map((path) => ({
      url: getCanonicalUrl(locale, path),
      lastModified: new Date(),
      changeFrequency: path.startsWith('/items/') ? 'weekly' : 'daily',
      priority: path === '/' ? 1 : path === '/catalog' ? 0.8 : 0.6,
    })),
  );
}
