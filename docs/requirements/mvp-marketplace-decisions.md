# Marketplace MVP Product Decisions

> **Superseded (2026-07-06):** Payment processing now routes through Ameriabank vPOS for all currencies (with a manual bank fallback). Stripe references below are historical. See `docs/superpowers/specs/2026-07-06-ameriabank-payments-design.md`.

Date: 2026-06-16

This file records the implementation defaults used by the MVP task list.

## Payments

- Stripe is the payment provider for EUR and USD card payments.
- AMD and RUB payments are routed to a future bank integration; until that integration exists, they may use manual/pending-payment order handling.
- Checkout mode: hosted checkout for Stripe-supported credit packs and product/order payments.
- MVP interim mode: orders create a `manual_mvp` or bank-pending payment transaction until the applicable payment provider checkout/webhooks are implemented.
- Webhooks must verify provider signatures and update transactions idempotently.

## Currency

- Supported money currencies: AMD, EUR, USD, RUB.
- Default application currency: AMD.
- Internal/base reference pricing currency: AMD.
- Currency preference persistence: cookie for guests, profile preference for authenticated users, with cart rows recalculated when feasible.
- Admins can enable or disable supported currencies.
- Prices should be stored in a canonical/base amount and displayed in the user's selected or default enabled currency.
- Default exchange-rate provider: `open.er-api.com` via `https://open.er-api.com/v6/latest/{base}`, configurable by server environment.
- Exchange rates are fetched from a public exchange-rate API and cached per currency pair per day.
- If the daily exchange-rate fetch fails, the app should use the latest cached rate when available and make stale-rate state visible to admins.
- Stripe checkout is used only for enabled EUR and USD payments.
- AMD and RUB checkout uses an interim `bank_manual` route until the planned bank integration is connected.

## Internationalization

- Supported locales: `en`, `ru`, `am`.
- Routing strategy: cookie/header-based locale without path prefixes.
- Detection priority: explicit locale cookie, authenticated profile preference, browser/geo region hints, then English fallback.
- Region defaults: Armenia uses `am`, Russian-language/browser or RU region uses `ru`, everything else uses `en`.

## Localized Content

- Admin-created catalog content may publish with English source content first.
- Missing localized catalog fields fall back to English/source fields.
- AI-generated user-visible text should default to the active locale when a generation flow asks for public copy.

## SEO

- Public catalog/item pages use admin-managed metadata when present.
- Required publish-quality fields: SEO title and meta description; social image and keywords are recommended.
- Missing localized SEO falls back to English/source metadata.
- Sitemap includes only public indexable pages. Private, generated, cart, checkout, dashboard, order, auth, and admin routes are excluded/noindexed.
- AI metadata generation creates editable drafts per selected locale.

## Redesign Scope

- Reference: `C:\apps\other\easy-marketplace-main` and `http://localhost:3300`.
- Phase 1 surfaces: landing, catalog/category/subcategory, item detail, cart, checkout review, dashboard, and generation entry points.
- Public storefront is light-first for MVP; admin can stay utilitarian.

## Admin Users

- User statuses: `active`, `suspended`, `disabled`.
- Roles: `user`, `admin`.
- Scoped admin permissions control user management, role management, balance adjustment, order management, transaction access, and generated review.
- Internal admin notes are in scope on user profiles and audit logs.

## Transactions

- Canonical types: payment, refund, credit purchase/spend/refund, manual adjustment, reversal.
- Canonical statuses: pending, succeeded, failed, cancelled, reversed.
- Provider fields: provider name, provider reference, webhook event/idempotency metadata.
- Transaction export is out of MVP scope.
- Corrections must be append-only adjustment/reversal records, not silent edits to settled history.

## Credits

- Credits are the only generation currency. Do not expose or maintain a separate user generation-currency balance.
- Credit charging: charge only when a valid preview/output is produced; refund or avoid charge on system failure.
- Credit packs: 10 credits, 25 credits, and 60 credits. Pack prices must support all enabled app currencies and route checkout by currency/provider rules.
- All generation credit costs come from shared constants: night lights, personalized night lights, 2D items, admin sample generation, user banner customization, and advanced user AI generation each use deterministic configured costs.
- Failed banner generation should refund or avoid charging credits.

## Banner Production

- Presets: store-window-small, store-front-medium, promo-wide.
- Materials/finish: matte vinyl by default.
- Production outputs: generated image plus SVG/PDF/cut or trim guides when available; manufacturing instructions are stored as reviewable artifacts.

## Toys and Decorations

- Admin metadata: public name/description/sizes plus admin-only free-text characteristics.
- AI-generated characteristics require admin review before publish.
- Public item pages must not expose admin-only characteristics.
- Toys are positioned as handcrafted/decorative products unless specific compliance certification is later added.

## Generated Item Production Sizes

- Night lights use acrylic/plexiglass panel plus wooden base assumptions.
- 2D laser-cut items use wood/acrylic assumptions and shared size presets from constants.
- Final production dimensions are stored in generation/manufacturing metadata when selected.

## Personalized Night Lights

- First model: `Portrait Personalized Night Light`.
- Mock image: seeded placeholder path until final product photography is supplied.
- Boilerplate/template image source is versioned in the personalization model form schema/metadata when supplied.
- LED colors use the eye-comfortable shared list; multi-color maps to a separate hardware/SKU mode.
- One personalized generation request returns up to 3 previews and costs the configured credit amount. Failed requests refund or avoid charging.
