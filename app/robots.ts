import type { MetadataRoute } from 'next';
import { PUBLIC_BASE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/catalog', '/items'],
        disallow: [
          '/admin',
          '/auth',
          '/cart',
          '/checkout',
          '/dashboard',
          '/orders',
          '/credits',
          '/create',
          '/api',
        ],
      },
    ],
    sitemap: `${PUBLIC_BASE_URL}/sitemap.xml`,
  };
}
