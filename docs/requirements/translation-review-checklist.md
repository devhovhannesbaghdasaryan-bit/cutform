# Translation Review Checklist

Use this checklist before release when updating `lib/i18n.ts` or adding new user-facing flows.

## Required Locales

- English source copy uses clear marketplace terms and avoids implementation jargon.
- Russian copy uses consistent formal product language.
- Armenian copy uses app locale `am` and platform formatting locale `hy-AM`.
- Missing translations fall back to English through `translate()`.

## Terminology

- Catalog item: product/item naming is consistent across catalog, cart, checkout, orders, and admin.
- Credits: balances, generation spending, refunds, and transaction history use distinct terms.
- Statuses: order, payment, catalog, and generation statuses match the database values.
- Production review: generated previews are described as approximations until admin/manufacturing review.
- Admin-only fields: characteristics, manufacturing notes, and internal notes are never presented as public copy.

## Flow Coverage

- Navigation and auth.
- Catalog and product cards.
- Cart, checkout, and order detail.
- AI generation upload, prompt, rights confirmation, preview, and validation messages.
- Admin common labels, item management, SEO, users, transactions, orders, and generated review queue.
