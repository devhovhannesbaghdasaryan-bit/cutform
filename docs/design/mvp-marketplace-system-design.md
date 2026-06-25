# Marketplace MVP System Design

Date: 2026-06-10

## Overview

The MVP should extend the current Next.js/Supabase/OpenAI app into a marketplace with two product sources:

- Catalog items created and managed by admins.
- Generated items created by users or admins through credit-gated AI workflows.

The existing app already has authentication, image upload, SVG generation, SVG sanitization, and saved products. The marketplace MVP should preserve that foundation while introducing categories, catalog products, credit balance, orders, and admin review.

## Architecture

Primary components:

- Next.js App Router for storefront, generation, account, and admin UI.
- Supabase Auth for users.
- Supabase Postgres for catalog, generated items, credit ledger, and orders.
- Supabase Storage for uploaded source images, catalog images, generated SVGs, and previews.
- OpenAI generation endpoint for image-to-SVG transformations.
- Payment provider for credit packs and purchases, added behind a payment abstraction.

High-level flow:

1. Admin publishes catalog items.
2. Landing page and catalog read published items.
3. User buys catalog item or purchases credits.
4. User spends credits to generate supported custom products.
5. Generated output is previewed and stored.
6. Admin/factory review approves output for production.
7. User orders the catalog or generated item.

## Application Areas

### Public Storefront

Routes:

- `/`: landing page with popular items and category entry points.
- `/catalog`: all published marketplace items.
- `/catalog?category=night-lights`: category filter.
- `/items/[id]`: catalog item detail.

Reads from:

- `categories`
- `catalog_items`
- catalog image storage bucket

### Generation

Routes:

- `/create`: generation type selector and upload flow.
- `/create/night-light`: night light generation flow.
- `/create/laser-cut-2d`: 2D laser-cut generation flow.
- `/generated/[id]`: generated item preview/detail.

Reads/writes:

- `credit_accounts`
- `credit_ledger`
- `generation_sessions`
- `generated_items`
- uploads and generated asset storage

### Account

Routes:

- `/dashboard`: user orders, saved generated items, credit balance.
- `/credits`: credit packs and transaction history.
- `/orders/[id]`: order detail.

### Admin

Routes:

- `/admin`: admin dashboard.
- `/admin/items`: manage catalog.
- `/admin/items/new`: create item.
- `/admin/items/[id]`: edit item.
- `/admin/generated`: review generated items.
- `/admin/orders`: manage orders.
- `/admin/create`: admin generation tools.

Admin access must be enforced by server-side role checks on every admin route and mutation.

## Data Model

### `profiles`

Stores app-specific user metadata.

Fields:

- `user_id uuid primary key references auth.users(id)`
- `role text not null default 'user'`
- `display_name text`
- `created_at timestamptz`

Allowed roles:

- `user`
- `admin`

### `categories`

Fields:

- `id uuid primary key`
- `slug text unique not null`
- `name text not null`
- `description text`
- `sort_order integer not null default 0`
- `is_active boolean not null default true`

Seed MVP categories:

- `toys`
- `constructors`
- `decorations`
- `night-lights`

### `catalog_items`

Admin-managed marketplace products.

Fields:

- `id uuid primary key`
- `category_id uuid references categories(id)`
- `title text not null`
- `slug text unique not null`
- `description text`
- `price_cents integer not null`
- `currency text not null default 'USD'`
- `status text not null default 'draft'`
- `is_popular boolean not null default false`
- `is_customizable boolean not null default false`
- `product_source text not null default 'catalog'`
- `thumbnail_path text`
- `gallery_paths text[]`
- `manufacturing_notes text`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

Statuses:

- `draft`
- `published`
- `archived`

Product sources:

- `catalog`
- `admin_generated`

### `credit_accounts`

Current user credit balance.

Fields:

- `user_id uuid primary key references auth.users(id)`
- `balance integer not null default 0`
- `updated_at timestamptz`

### `credit_ledger`

Append-only credit accounting.

Fields:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `delta integer not null`
- `reason text not null`
- `reference_type text`
- `reference_id uuid`
- `created_at timestamptz`

Reasons:

- `purchase`
- `generation_spend`
- `generation_refund`
- `admin_adjustment`

The balance in `credit_accounts` should be updated in the same transaction as each ledger entry.

### `generated_items`

Stores custom generated outputs.

Fields:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `generated_by uuid references auth.users(id)`
- `product_type text not null`
- `category_id uuid references categories(id)`
- `title text`
- `source_image_path text`
- `prompt text`
- `custom_text text`
- `svg_content text not null`
- `preview_path text`
- `manufacturing_metadata jsonb not null default '{}'`
- `credit_cost integer not null default 0`
- `review_status text not null default 'draft'`
- `created_at timestamptz`
- `updated_at timestamptz`

Product types:

- `night_light`
- `laser_cut_2d_toy`
- `laser_cut_2d_decoration`
- `laser_cut_2d_constructor`

Review statuses:

- `draft`
- `preview_ready`
- `review_required`
- `approved`
- `rejected`

### `orders`

Fields:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `status text not null default 'draft'`
- `payment_status text not null default 'unpaid'`
- `subtotal_cents integer not null`
- `currency text not null default 'USD'`
- `shipping_address jsonb`
- `contact_email text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `order_items`

Fields:

- `id uuid primary key`
- `order_id uuid references orders(id)`
- `catalog_item_id uuid references catalog_items(id)`
- `generated_item_id uuid references generated_items(id)`
- `title text not null`
- `quantity integer not null default 1`
- `unit_price_cents integer not null`
- `total_price_cents integer not null`

An order item should reference either a catalog item or generated item.

## Generation Pipelines

### Night Light Pipeline

Input:

- User image.
- User text for wooden stand.
- Optional size preset.

Steps:

1. Validate auth and credit balance.
2. Upload image to private storage.
3. Reserve or spend configured credit cost.
4. Ask AI to produce a pencil-like SVG drawing from the image.
5. Ask AI/output formatter to separate:
   - acrylic engraving layer
   - wood base engraving layer
   - optional cut outline layer
6. Sanitize SVG.
7. Validate basic manufacturability:
   - no script or external references
   - known SVG element set only
   - min stroke width
   - bounded viewBox
   - layer names present
8. Store generated item as `preview_ready` or `review_required`.
9. Render preview with acrylic panel, wooden stand, image engraving, and base text.

Output metadata example:

```json
{
  "material": {
    "panel": "acrylic",
    "base": "wood"
  },
  "layers": {
    "acrylic_engrave": true,
    "wood_engrave": true,
    "wood_cut": true
  },
  "sizePreset": "medium",
  "requiresAdminReview": true
}
```

### 2D Laser-Cut Pipeline

Input:

- User image.
- 2D product type.
- Optional notes.
- Optional size preset.

Steps:

1. Validate auth and credit balance.
2. Upload image to private storage.
3. Spend configured credit cost.
4. Generate simplified SVG suitable for laser cutting and engraving.
5. Separate cut and engrave paths.
6. Sanitize SVG.
7. Validate manufacturability:
   - closed cut paths where required
   - no extremely thin parts
   - no excessive detail for selected size
   - sheet bounds respected
8. Store generated item.
9. Render wood-style preview.

## API and Server Actions

Suggested endpoints/actions:

- `GET /api/catalog`: list published items.
- `GET /api/catalog/[id]`: item detail.
- `POST /api/admin/catalog-items`: create item.
- `PATCH /api/admin/catalog-items/[id]`: update item.
- `POST /api/credits/checkout`: create Credit purchase checkout.
- `POST /api/generate/night-light`: generate night light SVG.
- `POST /api/generate/laser-cut-2d`: generate 2D SVG.
- `POST /api/generated/[id]/approve`: user saves/approves preview for ordering.
- `POST /api/orders`: create order.
- `PATCH /api/admin/generated/[id]/review`: admin approve/reject.
- `PATCH /api/admin/orders/[id]`: update production status.

Existing server actions can be used instead of HTTP endpoints where they fit the App Router pattern. The important boundary is that credit spending, admin checks, and writes happen server-side.

## Authorization and RLS

Recommended RLS policy direction:

- Public users can read only published catalog items and active categories.
- Users can read their own generated items, Credit records, and orders.
- Users can insert generation sessions for themselves only.
- Users cannot directly modify credit balances.
- Admins can manage catalog items, generated items, and orders.
- Storage paths should be partitioned by user ID for private uploads.
- Catalog item images may live in a public bucket.

Admin role checks should be duplicated:

- In database policies where possible.
- In server-side route/action guards before privileged mutations.

## Payment Design

MVP should model two payment concepts:

- credit pack purchase.
- Product/order checkout.

Payment provider integration should update internal state only from trusted server-side confirmation, preferably webhook events.

Credit purchase confirmation:

1. Payment succeeds.
2. Server inserts `credit_ledger` row with positive delta.
3. Server increments `credit_accounts.balance`.

Order payment confirmation:

1. Payment succeeds.
2. Server updates `orders.payment_status = 'paid'`.
3. Server updates `orders.status = 'review_required'` or `paid` depending on item type.

## Preview Rendering

Preview rendering can start as React/SVG composition:

- Night light: compose generated SVG inside an acrylic panel frame and render stand text on a wood base.
- 2D item: place cut/engrave SVG over a wood texture-style background.

The generated manufacturing SVG should remain separate from the decorative preview. Preview styling must not pollute manufacturing layers.

## Admin Review

Generated items should require review before production by default.

Admin review screen should show:

- Source image.
- Generated preview.
- Raw manufacturing SVG preview.
- Product type.
- User-entered text/prompt.
- credit cost.
- Validation warnings.
- Approve/reject controls.
- Internal notes.

Approval sets `generated_items.review_status = 'approved'`.

## Implementation Phases

### Phase 1: Marketplace Foundation

- Add categories.
- Add catalog item model.
- Add landing popular items.
- Add catalog list/detail pages.
- Add admin catalog CRUD.

### Phase 2: Credits

- Add credit account and ledger.
- Add credit balance UI.
- Add manual/admin Credit adjustment for local MVP testing.
- Add payment-backed credit packs when provider is selected.

### Phase 3: Generation Update

- Split generation by product type.
- Add night light generation with stand text.
- Add 2D laser-cut generation.
- Store generated item metadata.
- Add generated preview pages.

### Phase 4: Orders and Review

- Add order/order item model.
- Add order creation from catalog and generated items.
- Add admin generated review.
- Add admin order status management.

## Key Risks

- AI-generated SVGs may look good but fail manufacturing.
- Uploaded images may contain copyrighted characters, brands, or unsafe content.
- Credit charging can frustrate users if failures are not handled clearly.
- Night light previews may overpromise exact engraving quality.
- Toy positioning may trigger child safety/compliance obligations.

## Risk Controls

- Default generated outputs to `review_required` before production.
- Keep product type constraints strict.
- Add preflight SVG validation before storage and display.
- Add image rights confirmation during upload.
- Refund Credits automatically for system failures.
- Use "preview approximation" language in UI.
- Position child-facing toys carefully until safety/compliance work is complete.
