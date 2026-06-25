# SEO launch readiness

Run `pnpm smoke:seo` before launch. The static smoke check verifies:

- `app/sitemap.ts` generates localized URLs for landing, catalog, category filters, and item pages.
- `app/robots.ts` exposes the sitemap and blocks private app areas.
- Landing, catalog, and item pages define route metadata.
- Item pages emit Product structured data.
- Admin item editing surfaces metadata warnings, including missing social image warnings.

Manual review before publishing seed items:

- Every published catalog item has reviewed metadata for `en`, `ru`, and `am`.
- SEO titles are unique, useful, and no longer than 70 characters.
- Meta descriptions are useful, unique, and no longer than 170 characters.
- Public metadata does not expose admin-only characteristics.
- Social images are present and use a share-friendly 1200x630 composition.
