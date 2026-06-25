# Marketplace MVP Task List

Date: 2026-06-10

Source docs:

- `docs/requirements/mvp-marketplace-requirements.md`
- `docs/design/mvp-marketplace-system-design.md`

## Milestone 0: Product Decisions

These tasks unblock implementation details that affect schema, UI copy, pricing, and checkout.

- [x] Decide payment provider for MVP.
  - EUR and USD payments use Stripe.
  - AMD and RUB payments use a future bank integration; before that integration exists, use clearly labeled manual/pending payment handling.
  - Output: payment provider routes, checkout mode, webhook requirements, and manual/bank-pending fallback.
  - Acceptance: credit packs and product checkout can be designed against deterministic currency-to-provider routing.

- [x] Decide multi-currency implementation details.
  - Choose the first public exchange-rate API provider.
  - Decide internal/base reference currency for authored catalog and credit-pack prices.
  - Decide whether user currency preference is stored only in cookie/profile or also snapshotted on carts before checkout.
  - Confirm the bank provider for AMD and RUB payments when ready.
  - Acceptance: Milestone 12A can be implemented without guessing conversion source, base pricing, or bank-provider contract.
  - Decision: use AMD as base/reference currency, `open.er-api.com` as default configurable provider, cookie/profile preference storage, and interim `bank_manual` routing for AMD/RUB until the bank provider is connected.

- [x] Decide internationalization routing and detection strategy.
  - Confirm supported app locales: `en`, `ru`, `am`.
  - Decide whether localized routes use path prefixes (`/en`, `/ru`, `/am`) or cookie/header-based routing.
  - Define region-to-language default rules.
  - Decide fallback locale behavior.
  - Acceptance: routing, middleware, links, and SEO can be implemented against one locale strategy.

- [x] Decide localized content policy.
  - Decide whether admin-created catalog content must be translated before publish.
  - Decide fallback behavior for catalog items missing a localized name/description.
  - Decide whether AI-generated user-visible text should generate in active locale by default.
  - Acceptance: data model and admin forms can handle localized and fallback content consistently.

- [x] Decide SEO metadata policy.
  - Decide required SEO fields before item publish.
  - Decide localized SEO requirements for `en`, `ru`, and `am`.
  - Decide fallback behavior for missing localized SEO metadata.
  - Decide sitemap and robots indexing rules.
  - Decide whether AI generates metadata per locale or per selected locale.
  - Acceptance: product SEO fields, validation, and public metadata rendering use one policy.

- [x] Decide redesign scope from the reference app.
  - Use `C:\apps\other\easy-marketplace-main` and `http://localhost:3300` as the visual reference.
  - Decide which public surfaces are included in phase 1: landing, catalog, product detail, cart, category pages, generation entry points.
  - Decide whether dark mode stays in MVP or public storefront ships light-first.
  - Acceptance: redesign work has clear scope and does not drift into unbounded restyling.

- [x] Decide admin user management policy.
  - Decide user statuses for MVP.
  - Decide which admins can update roles, suspend users, and adjust balances.
  - Decide whether internal admin notes are in scope.
  - Acceptance: admin user pages can enforce one support policy without ad hoc permissions.

- [x] Decide transaction management policy.
  - Decide canonical transaction types and statuses.
  - Decide payment provider reference fields.
  - Decide whether transaction export is included in MVP.
  - Decide refund and reversal behavior before payment provider automation is ready.
  - Acceptance: transaction records and admin actions can be modeled without silent financial edits.

- [x] Decide MVP credit charging policy.
  - Suggested default: charge credits only when a valid preview is produced; refund/avoid charge on system failures.
  - Output: credit spend rules for night lights and 2D laser-cut items.
  - Acceptance: generation code can implement deterministic debit/refund behavior.

- [x] Decide credit pack sizes and prices.
  - Example packs: 10, 25, 60 credits.
  - Output: pack list with price, currency, and bonus rules if any.
  - Acceptance: `/credits` page and checkout payloads can be implemented.

- [x] Decide banner credit policy.
  - Decide whether banner credits reuse the existing credit ledger or use a separate credit account.
  - Decide credit cost for admin sample generation, user sample customization, and advanced user AI generation.
  - Decide refund/avoid-charge behavior for failed banner generations.
  - Acceptance: banner generation can show deterministic credit cost and write a clear ledger entry.

- [x] Decide banner production presets.
  - Supported size presets.
  - Supported materials and finishes.
  - Supported output files for production: image, PDF, SVG, cut/trim guides, or layered source.
  - Acceptance: banner UI, pricing, and manufacturing instruction prompts can use real presets.

- [x] Decide toy and decoration admin metadata model.
  - Decide supported toy and decoration size presets.
  - Decide whether toy/decoration characteristics are free text, structured JSON, or both.
  - Decide whether AI-generated characteristics require explicit admin approval before publish.
  - Acceptance: toy and decoration admin forms and schema can model public fields separately from admin-only characteristics.

- [x] Decide supported production sizes for generated items.
  - Night light size presets.
  - 2D laser-cut item size presets.
  - Material assumptions for acrylic/plexiglass and wood.
  - Acceptance: generation prompts and preview dimensions use real production presets.

- [x] Decide personalized night light model inputs.
  - Confirm first model name and mock image.
  - Confirm boilerplate/template image source and versioning approach.
  - Confirm supported LED colors and user-facing labels.
  - Confirm whether multi-color mode maps to a fixed hardware SKU.
  - Acceptance: first `Night lights > Personalized` model can be seeded without placeholder product decisions except the final production image asset.

- [x] Decide personalized generation charging policy.
  - Decide credit cost for one request that returns 3 generated images.
  - Decide whether failed partial results are charged, refunded, or retried.
  - Acceptance: personalized generation can share credit ledger behavior with the rest of generation.

- [x] Decide toy positioning and compliance language.
  - Clarify whether products are toys for children, decorative models, or collector items.
  - Output: user-facing safety/compliance copy.
  - Acceptance: product pages do not accidentally overclaim child safety.

## Milestone 1: Database and Security Foundation

### Schema

- [x] Create a new Supabase migration for marketplace MVP tables.
  - Add `profiles`.
  - Add user preferred locale field to `profiles`.
  - Add user status and support/admin notes fields or a related user admin notes table.
  - Add `categories`.
  - Add support for category hierarchy through `categories.parent_id` or an equivalent subcategory model.
  - Add `catalog_items`.
  - Add support for catalog items/models belonging to both category and optional subcategory.
  - Add SEO metadata fields for catalog items or an item SEO metadata table.
  - Add localized SEO metadata support for `en`, `ru`, and `am` if required by policy.
  - Add admin-only toy/decoration characteristics support on catalog items or category-specific metadata tables.
  - Add toy and decoration size metadata or presets.
  - Add `personalization_models` or equivalent fields for personalizable catalog models.
  - Add generated preview option storage for multi-result personalization requests.
  - Add `banner_samples` or equivalent generated sample/template storage.
  - Add `banner_manufacturing_instructions` or equivalent order-item instruction artifact storage.
  - Add `carts`.
  - Add `cart_items`.
  - Add `credit_accounts`.
  - Add `credit_ledger`.
  - Add `transactions` or equivalent payment/credit transaction table.
  - Add `admin_audit_log`.
  - Add `generated_items`.
  - Add `orders`.
  - Add `order_items`.
  - Acceptance: migration applies cleanly after `supabase db reset`.

- [x] Seed MVP categories.
  - `toys`
  - `constructors`
  - `decorations`
  - `night-lights`
  - `banners`
  - `personalized` as a subcategory of `night-lights`
  - Acceptance: categories exist after migration reset and are ordered consistently.

- [x] Seed first personalized night light model.
  - Use mock model image until final product image is available.
  - Include model ID/slug, title, category, subcategory, base price, personalizable flag, and placeholder template image reference.
  - Acceptance: `Night lights > Personalized` has one visible model in local/demo data.

- [x] Add enum-like check constraints for stable status fields.
  - `profiles.role`: `user`, `admin`
  - `profiles.status`: `active`, `suspended`, `banned` if implemented.
  - `catalog_items.status`: `draft`, `published`, `archived`
  - `catalog_items.product_source`: `catalog`, `admin_generated`
  - Personalization model status: `draft`, `published`, `archived`
  - Personalized preview option status: `generated`, `selected`, `discarded`
  - `carts.status`: `active`, `converted`, `abandoned`
  - `cart_items.source_type`: `catalog_item`, `generated_item`, `personalized_generated_item`, `banner_generated_item`
  - `generated_items.product_type`
  - Banner generation status.
  - Banner manufacturing instruction status: `not_started`, `generating`, `ready`, `review_required`, `failed`
  - `generated_items.review_status`
  - `orders.status`
  - `orders.payment_status`
  - `transactions.type`
  - `transactions.status`
  - `admin_audit_log.action_type`
  - `credit_ledger.reason`
  - Acceptance: invalid statuses are rejected at database level.

- [x] Add timestamps and update triggers where needed.
  - `catalog_items.updated_at`
  - `credit_accounts.updated_at`
  - `generated_items.updated_at`
  - `orders.updated_at`
  - Acceptance: updates modify `updated_at` automatically.

- [x] Add indexes for expected access patterns.
  - Published catalog by category.
  - Published catalog/personalization models by subcategory.
  - Popular published catalog items.
  - Personalized preview options by generated item/request.
  - Active cart by user.
  - Cart items by cart and created date.
  - User generated items by created date.
  - Admin generated review queue by review status.
  - User orders by created date.
  - Admin users by role/status/created date.
  - Transactions by user, order, provider reference, type, status, and created date.
  - Admin audit log by target user/entity and created date.
  - credit ledger by user and created date.
  - Acceptance: key list pages avoid unindexed full scans for normal filters.

### Profiles and Admin Roles

- [x] Add profile creation on user signup.
  - Use database trigger or server-side profile creation after signup.
  - Default role must be `user`.
  - Store preferred locale when known during signup.
  - Acceptance: new registered users receive a profile and credit account.

- [x] Add a documented local process to promote an admin.
  - Example SQL snippet in docs or seed script.
  - Acceptance: developer can make a test admin locally without editing app code.

- [x] Add server-side admin guard helper.
  - Example: `requireAdmin()`.
  - Must read authenticated user and profile role server-side.
  - Acceptance: all admin pages/actions can share one role check.

- [x] Add scoped admin permission helpers.
  - Check whether admin can manage users.
  - Check whether admin can change roles.
  - Check whether admin can adjust credit balances.
  - Check whether admin can view transaction details.
  - Acceptance: sensitive admin actions are not guarded only by UI visibility.

### Internationalization Routing

- [x] Add locale middleware or routing layer.
  - Detect persisted manual locale preference first.
  - Detect authenticated profile locale when available.
  - Detect region/browser locale when no explicit preference exists.
  - Fall back to English.
  - Preserve locale through redirects, auth callbacks, and protected routes.
  - Acceptance: first visit gets a sensible locale and explicit user choice wins afterward.

- [x] Add localized metadata support.
  - Set page `lang` attribute from active locale.
  - Add alternate-locale metadata for public pages when feasible.
  - Ensure canonical URLs follow chosen routing strategy.
  - Acceptance: public localized pages expose correct language metadata.

- [x] Add SEO indexing controls.
  - Add robots rules for public and private/admin routes.
  - Add sitemap generation for indexable public pages.
  - Exclude unpublished, archived, private generated, admin, auth, cart, checkout, dashboard, and order pages.
  - Acceptance: search engines can discover public pages and avoid private/non-indexable pages.

### RLS and Storage

- [x] Add RLS policies for categories.
  - Public can read active categories.
  - Admins can manage categories if category management is exposed.
  - Acceptance: guests can browse categories; non-admin cannot mutate them.

- [x] Add RLS policies for catalog items.
  - Public can read only `published`.
  - Admins can read and mutate all.
  - Acceptance: draft/archived items are hidden from guests and regular users.

- [x] Add RLS policies for personalization models and generated preview options.
  - Public can read only published personalization models.
  - Users can read their own generated preview options.
  - Admins can read and review all generated preview options.
  - Users cannot select another user's generated preview option.
  - Acceptance: public browsing works, but generated personalized results remain owner/admin-only.

- [x] Add RLS policies for generated items.
  - Users can read their own generated items.
  - Admins can read and review all.
  - Users can insert/update only allowed own records through server flow.
  - Acceptance: one user cannot access another user's generated item URL.

- [x] Add RLS policies for credit tables.
  - Users can read own credit account and ledger.
  - Users cannot directly insert/update credit balances.
  - Server/admin can mutate through service role or guarded RPC.
  - Acceptance: client-side calls cannot grant Credits.

- [x] Add RLS policies for transactions and admin audit logs.
  - Users can read their own safe transaction summaries when exposed.
  - Admins can read transaction records through guarded admin paths.
  - Non-admin users cannot read other users' transactions.
  - Admin audit logs are admin-only.
  - Transaction corrections require insert-only adjustment/reversal records.
  - Acceptance: transaction history and audit data cannot be silently mutated or exposed to the wrong user.

- [x] Add RLS policies for carts and cart items.
  - Users can read and mutate their own active cart.
  - Users cannot read or mutate another user's cart.
  - Cart-to-order conversion runs through a server-side action.
  - Admins can read cart-derived order data, not arbitrary active user carts unless explicitly needed.
  - Acceptance: cart privacy is enforced and order creation cannot be spoofed from client-only totals.

- [x] Add RLS policies for orders and order items.
  - Users can read own orders.
  - Admins can read/update all orders.
  - Order creation uses server-side action.
  - Acceptance: one user cannot read another user's order.

- [x] Add storage buckets and policies.
  - Private bucket for user uploads.
  - Public or signed-read bucket for catalog images.
  - Optional private/generated bucket for previews and manufacturing assets.
  - Toy and decoration image support for uploaded and AI-generated admin assets.
  - Banner bucket/path support for sample images, user references, generated banner images, and manufacturing instruction artifacts.
  - Acceptance: uploads are partitioned by user ID; catalog/banner public assets render safely; private manufacturing artifacts stay protected.

## Milestone 2: Shared Domain Code

- [x] Create shared type constants for marketplace categories and statuses.
  - Keep database status values and UI options aligned.
  - Acceptance: UI does not duplicate magic strings across pages.

- [x] Create redesign visual system foundation.
  - Define shared spacing scale, container widths, border radius, shadows, surface colors, and emphasis colors.
  - Define storefront typography scale and heading/body/button styles.
  - Define product card image ratios and section spacing rules.
  - Acceptance: public pages share one coherent visual system instead of ad hoc styling.

- [x] Create i18n foundation.
  - Define supported locales: `en`, `ru`, `am`.
  - Define default/fallback locale.
  - Add locale detection helper using persisted preference, authenticated profile preference, request/browser/geo signals, then fallback.
  - Add locale-aware route/link helper.
  - Add translation loading helper.
  - Acceptance: server and client components can read active locale and translations consistently.

- [x] Create translation dictionaries.
  - Add base dictionaries for `en`, `ru`, and `am`.
  - Cover navigation, auth, catalog, product cards, cart, checkout/order, generation flows, validation messages, statuses, and admin common UI.
  - Add English fallback for missing keys.
  - Acceptance: core UI does not hardcode user-visible strings outside translation dictionaries.

- [x] Add localized formatting helpers.
  - Format dates by active locale.
  - Format numbers and currency by active locale.
  - Map app locale `am` to platform locale `hy-AM` where required.
  - Acceptance: shared UI uses common formatting helpers instead of ad hoc formatting.

- [x] Create SEO metadata helpers.
  - Resolve page title and meta description by active locale.
  - Resolve canonical URL.
  - Resolve alternate-locale URLs.
  - Resolve Open Graph/Twitter metadata.
  - Generate product structured data from safe public fields.
  - Apply noindex rules for private/non-indexable routes.
  - Acceptance: public pages use shared metadata helpers instead of page-specific ad hoc metadata.

- [x] Create SEO validation helpers.
  - Check missing title/description.
  - Check duplicate slug.
  - Check recommended title and description length ranges.
  - Check missing social image.
  - Check missing localized metadata when required.
  - Check unsafe private/admin fields are not included in public structured data.
  - Acceptance: admin forms can show actionable SEO quality warnings.

- [x] Create SEO AI generation helpers.
  - Generate SEO title, meta description, keywords/tags, Open Graph title, and Open Graph description.
  - Use item name, description, category, images, public production notes, and allowed admin-only characteristics as source context.
  - Support target locale.
  - Avoid keyword stuffing and unsupported claims.
  - Return generated fields as editable drafts.
  - Acceptance: AI-generated metadata is reviewable before saving.

- [x] Create shared constants for personalized night light inputs.
  - Eye-comfortable LED color labels and values.
  - `multi_color` mode value.
  - Max image count of 3.
  - Max personalization text length of 100 characters.
  - Acceptance: form validation, API validation, and prompt building use the same constraints.

- [x] Create shared constants for banners.
  - Banner category slug.
  - Supported banner size presets.
  - Banner material/finish assumptions.
  - Banner generation credit costs.
  - Text safe-area rules.
  - Acceptance: admin generation, user customization, checkout, and manufacturing instruction prompts share one source of truth.

- [x] Create shared constants/types for toys and decorations.
  - Toy and decoration category slugs.
  - Supported size presets.
  - Characteristics field schema if structured.
  - AI metadata generation statuses.
  - Acceptance: admin forms, validation, and metadata generation use consistent toy/decoration field definitions.

- [x] Create catalog data access helpers.
  - List published items.
  - Get item by slug/id.
  - List popular items.
  - List subcategories for a category.
  - List published personalizable models for a category/subcategory.
  - Admin list with filters.
  - Acceptance: storefront and admin do not duplicate query logic.

- [x] Create cart service helpers.
  - Get or create active user cart.
  - Add catalog item to cart.
  - Add selected generated/personalized item to cart.
  - Update quantity.
  - Remove item.
  - Clear cart.
  - Merge guest cart into user cart after login/register.
  - Revalidate price, availability, ownership, and review status before checkout.
  - Acceptance: cart operations are centralized and do not trust client-provided prices or ownership.

- [x] Create credit service helpers.
  - Get balance.
  - Debit Credits transactionally.
  - Credit/refund Credits transactionally.
  - Write ledger entries.
  - Link ledger entries to transaction records when applicable.
  - Acceptance: generation can spend/refund Credits atomically.

- [x] Create admin user service helpers.
  - Search/list users.
  - Fetch user detail with orders, generated items, balances, and transactions.
  - Update user role through a guarded action.
  - Update user status through a guarded action.
  - Update preferred locale for support.
  - Add internal admin note.
  - Write admin audit log entries for all sensitive actions.
  - Acceptance: admin user mutations are centralized and auditable.

- [x] Create transaction service helpers.
  - Create transaction record for credit purchase.
  - Create transaction record for credit spend.
  - Create transaction record for credit refund.
  - Create transaction record for manual adjustment.
  - Create transaction record for order payment/refund.
  - Link transactions to users, orders, generated items, credit ledger entries, and provider references.
  - Support idempotency keys for provider/webhook events.
  - Acceptance: all money/credit movement has a queryable transaction record.

- [x] Create banner credit service helpers.
  - Use the shared credit service for banner generation and customization.
  - Support banner-specific ledger reasons.
  - Link credit ledger entries to transaction records when applicable.
  - Acceptance: banner generation spends/refunds credits atomically and leaves an audit trail.

- [x] Create order service helpers.
  - Create order from catalog item.
  - Create order from generated item.
  - Create order from cart.
  - Create order item snapshots from cart items.
  - Update payment status.
  - Update production status.
  - Acceptance: all order writes preserve price, title, image/preview, quantity, currency, source, and personalization snapshots at time of order creation.

- [x] Create generated item service helpers.
  - Create generated item record.
  - Create personalized generation request with 3 preview options.
  - Mark one preview option as selected.
  - Create banner generation record.
  - Store banner sample/template source metadata.
  - Store banner text placement metadata.
  - Create admin-generated toy/decoration asset/record.
  - Store AI-generated toy/decoration metadata drafts.
  - Update review status.
  - Fetch by owner.
  - Fetch admin review queue.
  - Acceptance: generated item ownership and admin access are consistently enforced.

- [x] Expand SVG validation/preflight utilities.
  - Sanitize SVG before storage/display.
  - Validate `viewBox`.
  - Reject scripts/external references.
  - Check required layer markers for generated types.
  - Return warnings for manufacturability issues.
  - Acceptance: invalid SVGs cannot be saved as generated items.

## Milestone 3: Marketplace Storefront

### Landing Page

- [x] Redesign `/` as marketplace landing page.
  - Show value proposition.
  - Show popular items.
  - Show category entry points.
  - Provide links to catalog and generation.
  - Render localized copy and preserve active locale in links.
  - Render localized SEO metadata.
  - Match the reference app's clean hero-first, sectioned marketplace rhythm while adapting content to Snip.
  - Acceptance: guest can understand the store and reach main flows from first screen, and the page visually aligns with the redesign target.

- [x] Add popular item section.
  - Pull published `is_popular` catalog items.
  - Show image, title, category, price, and detail link.
  - Empty state if no popular items exist.
  - Style the section as a curated storefront band rather than a raw list.
  - Acceptance: admins control landing popularity manually.

- [x] Add category navigation component.
  - Toys.
  - Constructors.
  - Decorations.
  - Night lights.
  - Banners.
  - Show subcategory links when a category has children.
  - Render translated category/subcategory labels.
  - Style the section with curated icon/visual entry points inspired by the reference app.
  - Acceptance: each category links to filtered catalog.

- [x] Add language switcher.
  - Support `en`, `ru`, and `am`.
  - Persist manual language choice.
  - Preserve current page when switching language where possible.
  - Keep active locale visible.
  - Acceptance: user can switch language and the choice survives refresh/new visit.

- [x] Add header cart entry point.
  - Show cart icon/link with item count.
  - Update count after add/remove actions.
  - Link to `/cart`.
  - Use a compact sticky-header treatment inspired by the reference app.
  - Acceptance: user always has a visible path back to cart contents.

### Catalog

- [x] Create `/catalog` page.
  - List published items.
  - Support category query filter.
  - Support subcategory query filter.
  - Include responsive product grid.
  - Render localized UI labels, filters, empty states, and formatting.
  - Render canonical, localized metadata for catalog/category/subcategory views.
  - Match the storefront visual system from landing through cards, spacing, and section framing.
  - Acceptance: guest can browse all published marketplace items.

- [x] Create Banners category page.
  - Show banner category entry point.
  - Show available admin-generated banner samples/templates.
  - Show advanced AI generation entry point for eligible users.
  - Show supported size presets or a link into the banner flow.
  - Fit the same redesigned storefront system instead of reading like a tool page.
  - Acceptance: user can discover both sample-based and AI-generated banner paths.

- [x] Create Night lights category/subcategory navigation.
  - Show `Personalized` under Night lights.
  - Link to a filtered page or route for `Night lights > Personalized`.
  - Acceptance: guest can discover the personalized night light flow from catalog navigation.

- [x] Create personalized night light model listing.
  - Show published models in `Night lights > Personalized`.
  - Include mock image for the first model.
  - Show model title, starting price or Credit requirement if known, and personalize action.
  - Acceptance: guest can view the first personalizable model before signing in.

- [x] Create `/items/[id]` or `/items/[slug]` detail page.
  - Show gallery/thumbnail.
  - Show title, category, price, description, production notes.
  - Show add-to-cart action.
  - Show buy-now action only when the flow can safely create an immediate order/checkout.
  - Render admin-managed SEO metadata.
  - Render safe product structured data.
  - Follow the redesigned product-first visual hierarchy.
  - Acceptance: guest can view details and add published catalog items to cart; authenticated user can start checkout/order.

- [x] Update product card component for marketplace fields.
  - Support catalog item image.
  - Support personalizable model mock image.
  - Support category label.
  - Support subcategory label.
  - Support formatted price.
  - Support popular/customizable badges if needed.
  - Support add-to-cart action without navigating away from the current page.
  - Match the reference app's clean card proportions, hover behavior, and price emphasis.
  - Acceptance: same card works on landing, catalog, and admin previews.

### Shopping Cart

- [x] Create `/cart` page.
  - Show cart item list.
  - Show product image or selected generated preview.
  - Show title, category/subcategory, variant or personalization summary, unit price, quantity, and line total.
  - Show subtotal and clear explanation for shipping/tax/payment totals that are not known yet.
  - Provide continue-shopping action.
  - Align cart layout and drawer/panel styling with the redesigned storefront.
  - Acceptance: user can understand what will be ordered before checkout.

- [x] Implement add-to-cart interactions.
  - Add from product cards.
  - Add from item detail page.
  - Add selected generated/personalized item after option selection.
  - Show immediate feedback after adding.
  - Do not move the user away from their browsing context unless they choose to open cart.
  - Acceptance: adding an item feels reversible and does not interrupt browsing.

- [x] Implement cart item editing.
  - Quantity stepper/input where quantity is allowed.
  - Remove item action.
  - Clear cart action with confirmation.
  - Disable quantity changes for generated/personalized one-off items if production requires quantity 1.
  - Acceptance: user can correct cart contents without starting over.

- [x] Implement guest cart persistence.
  - Store guest cart in browser storage or anonymous session.
  - Keep cart through refresh.
  - Merge guest cart into persistent user cart after login/register.
  - Resolve duplicates and unavailable items predictably.
  - Acceptance: guest shopping intent survives authentication.

- [x] Add cart validation states.
  - Price changed.
  - Item unavailable, unpublished, or archived.
  - Generated item no longer orderable.
  - Personalized selected option missing required production asset.
  - Acceptance: checkout is blocked only with item-level messages that explain the required user action.

## Milestone 4: Admin Catalog Management

- [x] Create `/admin` dashboard.
  - Show links to items, generated review, orders, users, transactions, and admin create.
  - Show basic counts if cheap to query.
  - Inherit the redesign system where reasonable, while staying more utilitarian than the public storefront.
  - Acceptance: admin has a clear control center.

- [x] Create `/admin/users` list page.
  - Search by email, name, user ID, or phone when available.
  - Filter by role, status, created date, and account activity when available.
  - Show role, status, created date, order count, and balance summary.
  - Acceptance: admin can find users for support without touching database tools.

- [x] Create `/admin/users/[id]` detail page.
  - Show profile, role, status, preferred locale, balances, orders, generated items, carts when needed for support, and transaction history.
  - Show internal admin notes.
  - Show admin audit history affecting the user.
  - Acceptance: admin has one support view for a user's account state.

- [x] Add admin user mutations.
  - Update role when permitted.
  - Update status when permitted.
  - Update preferred locale for support.
  - Add internal admin note.
  - Require server-side authorization.
  - Write audit log entry for every mutation.
  - Acceptance: user management actions are guarded and auditable.

- [x] Add admin manual credit adjustment action.
  - Require amount, direction, currency/unit, and reason.
  - Require privileged admin permission.
  - Write credit ledger entry.
  - Write transaction record.
  - Write admin audit log entry.
  - Acceptance: admins can support users without direct balance edits or missing audit history.

- [x] Create `/admin/transactions` list page.
  - Search by transaction ID, user, order ID, provider reference, ledger reference.
  - Filter by type, status, date range, user, order, and provider when available.
  - Show amount/currency or credit quantity, user, order, type, status, provider, and created date.
  - Acceptance: admin can inspect financial and credit activity across the marketplace.

- [x] Create `/admin/transactions/[id]` detail page.
  - Show user, related order/generated item, amount/currency or credit quantity, provider, provider reference, status, timestamps, idempotency key/webhook event ID, ledger links, admin notes, and audit history.
  - Hide sensitive payment details such as card data and secrets.
  - Acceptance: admin can reconcile a transaction using safe references.

- [x] Add admin transaction actions.
  - Add internal review note.
  - Record manual refund when provider automation is not ready.
  - Create adjustment/reversal transaction instead of editing settled history.
  - Reconcile webhook/provider event status.
  - Acceptance: transaction corrections are visible and append-only.

- [x] Create `/admin/items` list page.
  - Search by title.
  - Filter by category.
  - Filter by status.
  - Show popular flag and price.
  - Acceptance: admin can find and manage catalog items.

- [x] Create `/admin/items/new` page.
  - Fields: title, slug, category, description, price, status, popular flag, customizable flag, production notes.
  - Allow localized catalog content fields when localized content policy requires it.
  - Include SEO metadata fields.
  - Support optional subcategory selection.
  - When category is Toys or Decorations, show size and admin-only characteristics fields.
  - Image upload.
  - Acceptance: admin can create a draft or published catalog item.

- [x] Create `/admin/items/[id]` edit page.
  - Update all catalog fields.
  - Update localized catalog content fields when available.
  - Update SEO metadata fields.
  - Update optional subcategory.
  - When category is Toys or Decorations, update sizes and admin-only characteristics.
  - Replace thumbnail/gallery images.
  - Publish/unpublish/archive.
  - Acceptance: admin can manage catalog lifecycle.

- [x] Add ordered catalog item media management.
  - Add item media schema for ordered images and videos.
  - Allow admins to upload PNG, JPG, WEBP, SVG, MP4, and WEBM media.
  - Allow admins to edit media alt text.
  - Allow admins to reorder media.
  - Allow admins to choose primary media.
  - Allow admins to remove media from an item.
  - Migrate existing thumbnail paths into the ordered media gallery.
  - Acceptance: admin can control the exact image/video order shown on product cards and item detail pages.

- [x] Add storefront media sliders.
  - Product cards render an ordered media slider.
  - Product detail pages render the ordered media gallery in a larger view.
  - Videos play muted on hover on product cards.
  - Slider controls preserve stable dimensions and do not break add-to-cart.
  - Acceptance: published items can present images and videos in admin-defined order.
  - Evidence: `pnpm exec supabase db reset`, `pnpm typecheck`, `pnpm lint`, `pnpm smoke:catalog-media`, and `pnpm smoke` passed.

- [x] Add admin SEO metadata editor for catalog items.
  - Edit SEO title.
  - Edit meta description.
  - Edit slug.
  - Edit keywords/tags.
  - Edit Open Graph title and description.
  - Select or upload social image.
  - Support localized SEO fields for `en`, `ru`, and `am` when required.
  - Show SEO preview snippet.
  - Show SEO quality warnings.
  - Acceptance: admin can manually manage product metadata without code changes.

- [x] Add AI SEO metadata generation for catalog items.
  - Generate metadata from item name, description, category, images, production notes, and allowed admin-only characteristics.
  - Support target locale.
  - Save generated output as editable draft.
  - Do not publish generated SEO metadata without admin review/save.
  - Acceptance: admin can generate product SEO metadata and edit it before saving.

- [x] Add AI SEO metadata regeneration.
  - Regenerate all SEO fields.
  - Regenerate only selected fields.
  - Warn when existing manual metadata will be overwritten.
  - Keep prior saved metadata until admin confirms.
  - Acceptance: admin can safely regenerate stale metadata after product changes.

- [x] Create admin toy/decoration upload flow.
  - Admin uploads toy or decoration image.
  - Admin enters or edits name, description, sizes, price, status, and production notes.
  - Admin enters admin-only characteristics.
  - Acceptance: admin can create a toy or decoration catalog item without AI generation.

- [x] Create admin toy/decoration generation flow.
  - Admin enters prompt and optional reference images.
  - Admin selects Toys or Decorations as the target category.
  - AI generates toy or decoration image/sample.
  - Admin can save generated output as a draft catalog item.
  - Acceptance: admin can generate a toy or decoration candidate and continue editing before publishing.

- [x] Create toy/decoration metadata generation from image.
  - Accept uploaded or generated toy/decoration image.
  - Generate draft name, description, sizes, and characteristics.
  - Characteristics must include materials, specifications, dimensions, finish, construction details, production assumptions, and unknowns.
  - Mark uncertain material/specification claims as unknown or review-required.
  - Acceptance: admin can generate metadata from image and edit every generated field before save.

- [x] Enforce admin-only characteristics visibility.
  - Show characteristics only in admin item forms/detail views and admin order/production views.
  - Hide characteristics from public catalog, item detail pages, product cards, cart, checkout, and user order pages.
  - Acceptance: non-admin users cannot see toy/decoration characteristics in UI or API responses.

- [x] Create admin personalized model management.
  - Allow admin to create/edit personalizable night light models.
  - Fields: title, slug, category, subcategory, mock/model image, boilerplate/template image, status, base price, credit cost, production notes.
  - Acceptance: admin can publish the first `Night lights > Personalized` model and later replace the mock/template assets.

- [x] Create admin banner sample generation UI.
  - Admin enters prompt.
  - Admin attaches reference images.
  - Admin selects banner size preset.
  - Admin starts sample generation.
  - Admin can review generated samples before publishing.
  - Acceptance: admin can create reusable banner samples/templates from the admin panel.

- [x] Create admin banner sample management.
  - List generated banner samples.
  - Publish/unpublish/archive samples.
  - Attach sample to Banners category.
  - Edit title, description, size, material assumptions, and production notes.
  - Acceptance: only reviewed/published banner samples are visible to users.

- [x] Add admin catalog mutations.
  - Create item.
  - Update item.
  - Archive item.
  - Toggle popular.
  - Acceptance: mutations reject non-admin users server-side.

- [x] Add basic catalog item validation.
  - Required title.
  - Unique slug.
  - Valid category.
  - Valid subcategory belongs to selected parent category.
  - Non-negative price.
  - Valid status.
  - Validate required localized fields according to localized content policy.
  - Validate SEO fields according to SEO metadata policy.
  - Acceptance: invalid admin forms show actionable errors.

## Milestone 5: Credits

- [x] Add credit balance display to authenticated header/dashboard.
  - Acceptance: signed-in user can see current credit balance.

- [x] Create `/credits` page.
  - Show current balance.
  - Show credit packs.
  - Show ledger/history.
  - Acceptance: user can understand credit usage and purchase options.

- [x] Implement MVP credit pack flow.
  - If payment provider is not ready, implement admin/manual local credit flow clearly marked as temporary.
  - If payment provider is ready, create checkout session and webhook handler.
  - Acceptance: user can receive credits through the selected MVP flow.

- [x] Add admin credit adjustment action for testing/support.
  - Requires admin.
  - Writes ledger reason `admin_adjustment`.
  - Writes transaction record and admin audit log entry.
  - Acceptance: admin can credit/debit credits with transaction history and an audit trail.

- [x] Add credit spending tests.
  - Successful generation debits expected credits.
  - Failed system generation refunds or does not debit.
  - Non-owner cannot mutate credit account.
  - Acceptance: credit behavior is covered by automated or smoke tests.

## Milestone 5A: Credits-Only Refactor

This change request supersedes the earlier split token/credit model. Credits are now the only generation currency.

- [x] Create a credits-only migration.
  - Rename or replace `token_accounts` with `credit_accounts`.
  - Rename or replace `token_ledger` with `credit_ledger`.
  - Migrate existing local balances into one `balance` field.
  - Remove any separate token balance and banner-only `credit_balance` split.
  - Rename generated item `token_cost` fields to `credit_cost` or migrate usage into a unified cost field.
  - Acceptance: `supabase db reset` produces a schema with no user-facing token tables, columns, policies, or ledger reasons.

- [x] Update transaction types and accounting records to credits only.
  - Replace purchase/spend/refund transaction types with `credit_purchase`, `credit_spend`, and `credit_refund`.
  - Keep payment, refund, manual adjustment, reversal, and provider webhook records.
  - Update manual balance adjustments to write credit ledger entries only.
  - Acceptance: transaction history can represent all purchases, generation spends, refunds, and manual adjustments without token-specific records.

- [x] Replace token service code with credit service code.
  - Rename or replace token pack constants, token account helpers, token debit/refund helpers, and token tests.
  - Keep all generation flows on the same credit balance.
  - Acceptance: night lights, personalized night lights, 2D generation, and banners call one credit debit/refund service.

- [x] Replace `/tokens` UI with `/credits`.
  - Rename route, navigation labels, dashboard/header balance labels, and checkout copy.
  - Add a redirect from `/tokens` to `/credits` only if needed for local/backward compatibility.
  - Acceptance: users never see token terminology in navigation, balance cards, purchase pages, generation pages, or errors.

- [x] Update payment checkout and webhooks for credit packs.
  - Rename token-pack checkout payloads and metadata to credit-pack equivalents.
  - Ensure webhook idempotency credits the unified credit account.
  - Acceptance: repeated webhook delivery does not duplicate credits and no token metadata is written.

- [x] Update generation costs to credits.
  - Personalized night light request cost.
  - Night light request cost.
  - 2D laser-cut request cost.
  - Banner advanced generation cost.
  - Admin/user banner sample customization cost if configured.
  - Acceptance: every generation screen shows required credits before submit and blocks generation without enough credits.

- [x] Update admin user and transaction management to credits only.
  - User detail shows credit balance only.
  - Admin adjustment form adjusts credits only.
  - Transaction filters/details use credit purchase/spend/refund language.
  - Acceptance: admin support workflows no longer expose token fields or mixed token/credit terminology.

- [x] Update tests, smoke scripts, docs, and README for credits only.
  - Update database, generation, admin, runtime, UI, and payment smoke coverage.
  - Update QA evidence wording after rerunning affected checks.
  - Acceptance: outside this legacy-removal checklist, `rg "token|Token|tokens|Tokens"` returns only unrelated technical references such as LLM context sizing, not product/accounting terminology.
  - Evidence: `pnpm exec supabase db reset`, public schema credit/token column audit, `pnpm typecheck`, `pnpm lint`, `pnpm smoke`, `pnpm smoke:db-workflows`, and `pnpm smoke:ui-workflows` passed.

## Milestone 6: Generation Type Split

- [x] Replace generic create flow with product type selection.
  - Night light.
  - Personalized night light model.
  - Marketing banner.
  - 2D toy.
  - 2D decoration.
  - 2D constructor.
  - Acceptance: user chooses a supported generation type before upload.

- [x] Add unauthenticated generation gate.
  - Allow guests to browse personalizable models.
  - When a guest clicks generate from the personalization form, show login/register prompt.
  - Preserve enough intended action state to return after auth if feasible.
  - Acceptance: guest cannot call generation API, and the UI clearly offers sign in/register.

- [x] Add generation cost display before submit.
  - Show required Credits.
  - Show required credits for banner generation.
  - Show current balance.
  - Disable submit when balance is too low.
  - Acceptance: user cannot accidentally start a generation without enough credits.

- [x] Preserve existing upload and SVG streaming where useful.
  - Adapt existing `/create` and `/api/generate` code instead of rebuilding from scratch.
  - Acceptance: old image-to-SVG capability is reused behind typed flows.

- [x] Store outputs as `generated_items`.
  - Product type.
  - Source image.
  - Prompt/custom text.
  - Sanitized SVG.
  - Banner generated image and size metadata when product type is banner.
  - credit cost.
  - Manufacturing metadata.
  - Review status.
  - Acceptance: generated outputs survive refresh and appear in dashboard.

- [x] Store generated personalized preview options.
  - Persist 3 generated preview image URLs or storage paths.
  - Persist hidden generated SVG URL/path for each generated option.
  - Store selected model, source user images, text, LED color or multi-color mode, template image version, credit cost, and OpenAI request metadata.
  - Acceptance: user can refresh after generation and still select one preview option to buy, while generated SVGs remain hidden from the user UI.

## Milestone 7: Night Light Generation

- [x] Create `/catalog/night-lights/personalized` or equivalent filtered route.
  - Show the Personalized subcategory page.
  - List published personalizable night light models.
  - Start with one model using a mock image.
  - Acceptance: guest can navigate to Personalized and open the first model.

- [x] Create personalized model detail/form route.
  - Route can be `/personalize/night-lights/[slug]`, `/create/night-light/[model]`, or equivalent.
  - Show selected model image and personalization controls.
  - Acceptance: user can inspect the model and fill all required personalization fields.

- [x] Build personalized night light form.
  - Image selector accepts up to 3 images.
  - LED color selector uses eye-comfortable colors.
  - `Multi color` checkbox disables the single color selector when checked.
  - Text editor/input enforces max 100 characters.
  - Submit button starts generation for authenticated users.
  - Acceptance: invalid image count, missing required fields, and over-limit text are blocked before submit.

- [x] Add login/register prompt for personalized generation.
  - Trigger only when a guest tries to generate.
  - Offer login and register actions.
  - Do not hide public browsing of the model.
  - Acceptance: unauthenticated user sees a prompt instead of an API error or silent redirect.

- [x] Create personalized night light OpenAI request builder.
  - Include up to 3 user images.
  - Include user text.
  - Include selected LED color or multi-color flag.
  - Include selected model ID/slug.
  - Include boilerplate/template image asset.
  - Ask for 3 generated preview images.
  - Ask for hidden manufacturing SVG output for each generated preview option.
  - Acceptance: request payload is deterministic and includes all production-relevant personalization inputs.

- [x] Implement personalized night light generation endpoint/action.
  - Validate auth.
  - Validate credit balance.
  - Validate model is published.
  - Upload/store user images.
  - Spend/refund Credits according to policy.
  - Call OpenAI image generation/edit API.
  - Store 3 generated preview images.
  - Store hidden generated SVG files for the 3 preview options.
  - Validate and sanitize generated SVG files before storage or before marking an option usable.
  - Save generated item/request metadata.
  - Acceptance: successful generation returns a persisted set of 3 preview choices and hidden production SVG assets.

- [x] Build generated preview selection UI.
  - Display 3 generated images.
  - Allow user to select exactly one image.
  - Show selected state clearly.
  - Do not display or link the hidden generated SVG to the user.
  - Provide buy/order action for the selected result.
  - Acceptance: user can select one generated image to proceed to purchase.

- [x] Add generated personalized night light detail page.
  - Show selected model.
  - Show uploaded images.
  - Show entered text and LED color/multi-color choice.
  - Show all 3 previews and selected preview.
  - Hide generated SVG assets from user-facing views.
  - Show review/order status.
  - Acceptance: user and admin can audit what was generated and selected.

- [x] Create `/create/night-light` UI.
  - Image upload.
  - Text field for wooden stand text.
  - Optional size selector.
  - credit cost display.
  - Acceptance: user can submit all required night light inputs.

- [x] Create night light prompt/schema.
  - Convert image into pencil-like SVG.
  - Include acrylic engraving layer.
  - Include wood base engraving/cut layer.
  - Preserve user stand text.
  - Acceptance: AI response contains structured SVG and metadata.

- [x] Implement night light generation endpoint/action.
  - Validate auth.
  - Validate credit balance.
  - Upload source image.
  - Spend/refund Credits correctly.
  - Sanitize and validate SVG.
  - Save `generated_items` record.
  - Acceptance: successful generation creates a preview-ready generated item.

- [x] Build night light preview component.
  - Acrylic panel outline.
  - Engraved image area.
  - Wood stand/base.
  - User text on base.
  - Acceptance: preview clearly communicates approximate final product.

- [x] Add night light preview/detail page.
  - Show source image, preview, manufacturing SVG, credit cost, review status.
  - Provide order action or "review required" state.
  - Acceptance: user can review result before ordering.

## Milestone 8: 2D Laser-Cut Generation

- [x] Create `/create/laser-cut-2d` UI.
  - Image upload.
  - Product type selector: toy, decoration, constructor.
  - Optional notes/prompt.
  - Optional size selector.
  - credit cost display.
  - Acceptance: user can submit a supported 2D generation request.

- [x] Create 2D laser-cut prompt/schema.
  - Simplify image into laser-cut SVG.
  - Separate cut and engrave layers.
  - Include material and size metadata.
  - Acceptance: AI response has manufacturing-oriented layer structure.

- [x] Implement 2D generation endpoint/action.
  - Validate auth and credit balance.
  - Upload source image.
  - Spend/refund Credits correctly.
  - Sanitize and validate SVG.
  - Save generated item.
  - Acceptance: generated 2D item is saved and previewable.

- [x] Build 2D wood preview component.
  - Wood material visual treatment.
  - Cut outline.
  - Engraved/printed details.
  - Approximate size.
  - Acceptance: preview is visually distinct from raw manufacturing SVG.

- [x] Add manufacturability warnings.
  - Too much detail.
  - Thin parts.
  - Missing cut layer.
  - Out-of-bounds SVG.
  - Acceptance: warnings are visible to user/admin without blocking every draft.

## Milestone 8A: Banner Generation

- [x] Create `/banners` or `/catalog?category=banners` banner landing page.
  - Show marketing banner positioning for stores.
  - Show admin-published sample banners/templates.
  - Show banner size presets.
  - Show advanced AI generation entry point for eligible users.
  - Acceptance: user can choose between customizing a sample and generating a new banner.

- [x] Create banner sample customization UI.
  - User selects a sample banner.
  - User selects size preset.
  - User places/edits text inside the banner.
  - Enforce text safe areas.
  - Show live preview.
  - Acceptance: user can customize a sample banner and produce an orderable preview.

- [x] Create simple banner text editor.
  - Support text content, position, alignment, size, and color if production supports it.
  - Keep controls constrained to manufacturable output.
  - Prevent text from leaving safe area.
  - Acceptance: text placement metadata can be stored and reconstructed later.

- [x] Create advanced banner AI generation UI.
  - Eligible/advanced user enters prompt.
  - User attaches reference images.
  - User selects size preset.
  - Show credit cost before submit.
  - Acceptance: advanced user can submit all required inputs for AI banner generation.

- [x] Implement banner generation endpoint/action.
  - Validate auth.
  - Validate advanced-user access when using AI generation.
  - Validate credit balance.
  - Validate size preset.
  - Upload/store reference images.
  - Spend/refund credits according to policy.
  - Call AI image generation with prompt, references, and size.
  - Store generated banner image and metadata.
  - Acceptance: successful banner generation creates a preview-ready generated banner record.

- [x] Implement admin banner sample generation endpoint/action.
  - Validate admin.
  - Accept prompt, attached images, and size preset.
  - Generate sample banner images.
  - Store generated samples as reviewable admin assets.
  - Acceptance: admin can generate unpublished samples and later publish approved ones.

- [x] Build banner preview/detail page.
  - Show selected/generated banner image.
  - Show size preset.
  - Show text placement summary.
  - Show source prompt/reference images when AI-generated by the user.
  - Show credit cost.
  - Provide add-to-cart/order action.
  - Acceptance: user can review the banner before purchase.

- [x] Add banner generated item storage.
  - Store sample/template source when customized from admin sample.
  - Store prompt and reference images when AI-generated.
  - Store selected size preset.
  - Store generated/customized banner image.
  - Store text placement metadata.
  - Store credit cost and ledger reference.
  - Acceptance: banner outputs survive refresh and can be attached to cart/order items.

## Milestone 9: User Dashboard and Generated Items

- [x] Update `/dashboard`.
  - Show credit balance.
  - Show user orders.
  - Show saved/generated items.
  - Keep empty states useful for new users.
  - Acceptance: user has one place to resume work.

- [x] Create `/generated/[id]` route.
  - Owner-only access.
  - Show preview and raw SVG.
  - Show review status.
  - Show order action when allowed.
  - Acceptance: another user receives 404 or access denied.

- [x] Add save/approve generated preview action.
  - User can accept preview for ordering/review.
  - Generated item moves to `review_required` if production review is needed.
  - Acceptance: user can intentionally move from generation to order intent.

## Milestone 10: Orders

- [x] Add cart-to-order checkout review.
  - Auth required before order creation.
  - Show final cart review before creating order.
  - Revalidate every cart item server-side.
  - Show item-level errors for unavailable, changed, or invalid items.
  - Acceptance: user confirms a valid cart before an order is created.

- [x] Create order item snapshot builder.
  - Copy source type and source ID.
  - Copy title, category/subcategory, image/preview, quantity, unit price, line total, and currency.
  - Copy variant/personalization summary.
  - Copy production metadata needed by admin.
  - Copy toy/decoration admin-only characteristics into admin production metadata when applicable.
  - Copy personalized night light selected preview, hidden SVG, original uploaded images, color/multi-color mode, text, model, and template version when applicable.
  - Copy banner image, size preset, text placement metadata, source prompt/reference images, sample/template source, credit cost, and production metadata when applicable.
  - Acceptance: historical orders remain accurate after catalog item or generated item changes.

- [x] Add create-order flow for catalog items.
  - Auth required.
  - Preserve price at time of purchase.
  - Create `orders` and `order_items`.
  - Acceptance: user can create an order from a published item.

- [x] Add create-order flow for generated items.
  - Auth required.
  - Owner-only generated item.
  - Personalized night light orders require exactly one selected generated preview option.
  - Snapshot selected preview image, hidden SVG, original uploaded images, LED color or multi-color mode, personalization text, model, and template image version into the order/order item metadata.
  - Respect review status.
  - Preserve generated item price when pricing exists.
  - Acceptance: user can start order for approved/reviewable generated item and admin can later inspect the exact production inputs from the order.

- [x] Add minimal order detail page `/orders/[id]`.
  - Show items.
  - Show each order item title, image/preview, quantity, unit price, line total, and personalization summary.
  - Show payment status.
  - Show production status.
  - For personalized night lights, show the selected preview image and personalization summary but do not expose the hidden SVG.
  - For banners, show selected/generated image, size, text summary, and production status.
  - Acceptance: user can track an order after creation.

- [x] Add admin order list `/admin/orders`.
  - Search/filter by status and payment status.
  - Show buyer, amount, created date.
  - Show item count and order total.
  - Acceptance: admin can see production queue.

- [x] Add admin order detail asset view for personalized night lights.
  - Show selected generated preview image.
  - Show hidden generated SVG for the selected option.
  - Show original uploaded user image or images.
  - Show selected LED color or multi-color mode.
  - Show user-entered personalization text.
  - Show selected model and template image version.
  - Acceptance: admin can review all assets and inputs needed to produce the ordered personalized night light from the order details page.

- [x] Add admin order detail asset view for banners.
  - Show selected/generated banner image.
  - Show banner size preset.
  - Show text placement metadata.
  - Show source prompt and attached reference images when AI-generated.
  - Show admin sample/template source when customized from a sample.
  - Show credit cost and generation ledger reference when applicable.
  - Show generated print/manufacturing files when available.
  - Acceptance: admin can review all assets and inputs needed to produce the ordered banner from the order details page.

- [x] Add admin order detail characteristics view for toys and decorations.
  - Show toy/decoration characteristics copied into order item production metadata.
  - Show materials, specifications, size, finish, and production assumptions.
  - Keep characteristics hidden from user-facing order detail.
  - Acceptance: admin can review toy/decoration production specs from order details without exposing internal characteristics to customers.

- [x] Add banner manufacturing instruction generation action.
  - Available from admin order detail for banner order items.
  - Use ordered banner image and order item metadata as input.
  - Load manufacturing workflow guidance from `docs/manufacturing/ai-skills.md`.
  - Load structured tool capabilities from `docs/manufacturing/tools.json`.
  - Apply schema rules from `docs/manufacturing/tool-capability-schema.md`.
  - Apply RAG/manual retrieval policy from `docs/manufacturing/rag-manuals.md`.
  - Generate recommended production path, drawings or drawing descriptions, material assumptions, tool chain, print/cut/finish instructions, manufacturability warnings, and operator checklist.
  - Mark output `review_required` when required dimensions, materials, finishing details, or tool constraints are missing/conflicting.
  - Acceptance: admin can generate a reviewable production instruction artifact for a banner order.

- [x] Store banner manufacturing instruction artifacts.
  - Link artifact to order item.
  - Store generated instructions, warnings, selected tools, source manufacturing data version, and generated drawings/files.
  - Track status: `not_started`, `generating`, `ready`, `review_required`, `failed`.
  - Acceptance: admin can revisit the latest generated instructions from order details.

- [x] Add admin order status updates.
  - Move through production statuses.
  - Prevent invalid status values.
  - Acceptance: admin can update order lifecycle server-side.

## Milestone 11: Admin Generated Review

- [x] Create `/admin/generated` review queue.
  - Filter by review status.
  - Filter by product type.
  - Show user, generated date, credit cost.
  - Acceptance: admin can find items requiring review.

- [x] Create admin generated item detail/review page.
  - Source image.
  - Personalized night light model, uploaded images, selected LED color/multi-color mode, text, and all generated preview options when applicable.
  - Final preview.
  - Raw manufacturing SVG.
  - Metadata and validation warnings.
  - Prompt/custom text.
  - Internal notes.
  - Acceptance: admin has enough context to approve/reject.

- [x] Add approve/reject/request-changes actions.
  - Approve sets `review_status = approved`.
  - Reject sets `review_status = rejected`.
  - Request changes can be represented as `review_required` plus notes in MVP if no status exists.
  - Acceptance: non-admin cannot call review mutations.

- [x] Add admin create flow `/admin/create`.
  - Allows admin to generate night lights and 2D items internally.
  - Allows generated output to become admin-generated catalog item later.
  - Acceptance: admin can create production-ready assets without using a regular user's account.

## Milestone 12: Payment Integration

Only implement this milestone when payment provider is selected.

- [x] Add payment provider SDK/config.
  - Environment variables documented.
  - Server-only secret usage.
  - Acceptance: app starts with validated payment config.

- [x] Implement credit pack checkout.
  - Create checkout session.
  - Attach user ID and pack metadata.
  - Create pending transaction record with provider reference/idempotency metadata.
  - Redirect user to payment provider.
  - Acceptance: successful checkout can be linked to a user and pack.

- [x] Implement credit checkout webhook.
  - Verify signature.
  - Idempotently credit Credits.
  - Write ledger entry.
  - Update transaction record from pending to paid/failed/refunded as appropriate.
  - Acceptance: repeated webhook delivery does not duplicate credits.

- [x] Implement product/order checkout.
  - Create checkout from order created from a validated cart.
  - Preserve order amount.
  - Preserve order item line amounts.
  - Create pending order payment transaction record.
  - Redirect to provider.
  - Acceptance: user can pay for a catalog/generated item order.

- [x] Implement order payment webhook.
  - Verify signature.
  - Idempotently update payment status.
  - Update order payment transaction record.
  - Move order to next production status.
  - Acceptance: paid orders enter admin production/review queue.

## Milestone 12A: Multi-Currency Support

This milestone adds money-currency support for catalog prices, credit packs, cart totals, orders, payments, transactions, and admin reconciliation. Credits remain the only generation currency.

- [x] Add currency schema and configuration.
  - Add supported currency records for `AMD`, `EUR`, `USD`, and `RUB`.
  - Store enabled/disabled state per currency.
  - Default AMD to enabled and default app currency.
  - Enforce that at least one currency remains enabled.
  - Acceptance: admin/server code can query enabled currencies and the app always has a valid default currency.

- [x] Add admin currency management UI.
  - Create an admin page or settings section for currencies.
  - Allow admins to enable/disable supported currencies.
  - Show default currency, payment route, latest exchange-rate date, and stale/missing-rate status.
  - Prevent disabling the last enabled currency.
  - Acceptance: admin can manage currency availability without direct database edits.

- [x] Add exchange-rate provider service.
  - Fetch rates from a public exchange-rate API.
  - Make provider URL/key configurable through server-only environment/config.
  - Cache rates per day by base currency and target currency.
  - Store provider, rate date, fetched timestamp, and stale status.
  - Use latest cached rate if the daily fetch fails.
  - Block conversion when no usable rate exists.
  - Acceptance: repeated same-day conversions use cached rates and do not call the provider repeatedly.

- [x] Add currency preference and display helpers.
  - Store guest currency preference in a cookie.
  - Store authenticated user preference on profile or equivalent account settings.
  - Use AMD when no explicit preference exists.
  - Ignore disabled preferred currencies and fall back to AMD or the first enabled currency.
  - Format amounts by active locale and selected currency.
  - Acceptance: user-selected currency persists across navigation and auth where feasible.

- [x] Update catalog, cart, checkout, and order pricing.
  - Convert catalog item prices into the active enabled currency for display.
  - Show active currency on product cards, item detail, cart, checkout review, and order detail.
  - Snapshot order/item unit price, line total, total, currency, and exchange-rate context at order creation.
  - Prevent checkout in a disabled currency.
  - Block checkout if a required conversion has no usable rate.
  - Acceptance: historical orders remain stable after catalog prices, enabled currencies, or exchange rates change.

- [x] Update credit-pack pricing for multi-currency.
  - Define credit-pack prices for the default/base currency and conversion rules for enabled currencies.
  - Display credit-pack prices in the active currency.
  - Store selected currency and exchange-rate context on pending credit-purchase transactions.
  - Acceptance: credit-pack checkout creates auditable records in the selected enabled currency.

- [x] Route payments by currency.
  - Use Stripe checkout only for enabled `EUR` and `USD` payments.
  - Route `AMD` and `RUB` to bank/manual pending payment flow until bank integration is implemented.
  - Label AMD/RUB pending-payment behavior clearly in checkout and admin transaction views.
  - Do not silently route AMD/RUB through Stripe.
  - Acceptance: checkout provider selection is deterministic from currency and cannot use a disabled currency.

- [x] Update transactions and admin reconciliation.
  - Store amount, currency, provider route, provider reference, and exchange-rate context on payment transactions.
  - Show currency/provider route in transaction lists and details.
  - Filter transactions by currency when useful.
  - Ensure refunds/reversals default to original transaction currency.
  - Acceptance: admin can reconcile Stripe EUR/USD payments and bank/manual AMD/RUB payments without ambiguous currency data.

- [x] Add tests and smoke coverage for multi-currency.
  - Currency enable/disable rules.
  - Daily exchange-rate cache behavior.
  - User currency preference fallback.
  - Catalog/cart/order amount snapshots.
  - Stripe routing for EUR/USD.
  - Bank/manual pending routing for AMD/RUB.
  - Disabled currency checkout blocking.
  - Acceptance: currency behavior is covered by automated or smoke tests before release.
  - Evidence: `pnpm exec supabase db reset`, currency schema queries, `pnpm typecheck`, `pnpm lint`, `pnpm smoke`, `pnpm smoke:db-workflows`, and `pnpm build` passed.

## Milestone 13: QA, Tests, and Smoke Scripts

- [x] Add database/RLS smoke tests or scripts.
  - Public reads published catalog only.
  - Public and regular users cannot read admin-only toy/decoration characteristics.
  - User cannot read or mutate another user's active cart.
  - Regular user cannot read another user's generated items/orders.
  - Regular user cannot read another user's transactions.
  - Non-privileged admin cannot perform restricted user/financial actions if scoped admin permissions are implemented.
  - Non-admin cannot mutate admin resources.
  - Acceptance: security assumptions are executable checks.

- [x] Add i18n smoke tests.
  - First visit chooses locale by configured region/default rules.
  - Manual language switch persists.
  - Explicit language choice overrides region detection.
  - Locale survives auth redirects and protected route redirects.
  - Missing translations fall back to English without crashing.
  - Acceptance: locale behavior is deterministic and covered by automated or smoke checks.

- [x] Add SEO smoke tests.
  - Landing, catalog, category, subcategory, and item detail pages render title and meta description.
  - Product detail pages use admin-managed SEO metadata.
  - Localized pages render correct canonical and alternate-locale metadata.
  - Product pages render safe structured data.
  - Private/admin/auth/cart/checkout/account/order pages are noindexed or excluded according to policy.
  - Sitemap includes only indexable public pages.
  - Robots rules do not block intended public catalog pages.
  - Acceptance: core SEO behavior can be verified without manual browser inspection only.

- [x] Add redesign smoke tests.
  - Sticky header remains usable across landing, catalog, product detail, and cart flows.
  - Hero, category section, featured sections, product cards, and cart drawer/page render correctly on desktop and mobile.
  - Product cards keep stable image ratios and spacing.
  - Section spacing and typography hierarchy are consistent across public pages.
  - Acceptance: redesign regressions are easy to catch before launch.

- [x] Add generation smoke tests.
  - Night light generation with sample image.
  - Admin toy image generation.
  - Admin decoration image generation.
  - Toy/decoration metadata generation from image.
  - Personalized night light generation with up to 3 sample images.
  - Personalized generation returns 3 preview images.
  - Personalized generation stores hidden SVG files for generated options.
  - Guest personalized generation attempt shows login/register gate.
  - Personalized generated preview selection persists and is owner-only.
  - Admin banner sample generation with prompt and reference image.
  - Advanced user banner generation with prompt, reference image, size preset, and credit debit.
  - Failed banner generation refunds or avoids charging credits.
  - 2D generation with sample image.
  - Credit debit/refund behavior.
  - SVG sanitize validation.
  - Acceptance: main custom product flows can be verified locally.

- [x] Add admin smoke tests.
  - Create catalog item.
  - Manually edit product SEO metadata.
  - Generate product SEO metadata with AI and save reviewed draft.
  - Regenerate selected SEO fields and confirm overwrite behavior.
  - Search user in admin users list.
  - Update user status/role with audit log entry when permitted.
  - Add admin note to user.
  - Manually adjust user credit balance and verify ledger, transaction, and audit records.
  - Search transaction list and open transaction detail.
  - Record transaction review note or manual adjustment/reversal.
  - Upload toy image and publish toy item.
  - Upload decoration image and publish decoration item.
  - Generate toy/decoration image and save as draft catalog item.
  - Generate toy/decoration name, description, sizes, and characteristics from image.
  - Verify toy/decoration characteristics are visible in admin item/order views only.
  - Mark item popular.
  - Create order from cart and verify order item snapshots.
  - Generate and publish a banner sample.
  - Review generated item.
  - Open a banner order and generate manufacturing instructions from the ordered banner image using `docs/manufacturing/` data.
  - Open a personalized night light order and verify selected preview, hidden SVG, original images, color, and text are visible to admin.
  - Update order status.
  - Acceptance: admin workflow is verified end to end.

- [x] Run lint/typecheck.
  - `pnpm lint`
  - `pnpm tsc --noEmit` or project equivalent.
  - Acceptance: no blocking type/lint errors from MVP changes.

- [ ] Run local end-to-end manual QA.
  - Guest landing and catalog.
  - Compare landing, catalog, product detail, and cart against the reference aesthetic from `C:\apps\other\easy-marketplace-main`.
  - Verify redesigned public pages feel consistent across desktop and mobile.
  - Inspect SEO metadata for landing, category, subcategory, product detail, and localized product detail pages.
  - Admin edits/generates/regenerates product SEO metadata and verifies public page output.
  - Switch between `en`, `ru`, and `am` and verify landing, catalog, item detail, cart, checkout/order, auth, and admin common screens.
  - Verify region/default locale behavior in a controlled local/test setup.
  - Admin searches users, opens user detail, reviews orders/generated items/transactions, and performs a guarded support action.
  - Admin reviews transactions, opens transaction detail, and verifies provider-safe references only.
  - Admin performs manual credit adjustment and confirms ledger, transaction, and audit records are created.
  - Admin uploads toy, edits name/description/sizes/characteristics, publishes, and verifies public page hides characteristics.
  - Admin uploads decoration, edits name/description/sizes/characteristics, publishes, and verifies public page hides characteristics.
  - Admin generates toy/decoration and image-based metadata, edits fields, and publishes.
  - Guest adds catalog item to cart, refreshes, updates quantity, removes item, and continues shopping.
  - Guest cart merges after login/register.
  - User browses Banners category.
  - User selects banner sample, places text, chooses size, previews, adds to cart, and orders.
  - Advanced user generates banner with prompt and attached image, spending credits.
  - Admin opens banner order and generates manufacturing instructions/drawings.
  - Guest reaches `Night lights > Personalized`.
  - Guest sees first model with mock image.
  - Guest receives login/register prompt when attempting personalized generation.
  - Register/sign in.
  - credit balance visible.
  - Generate personalized night light and select one of 3 previews.
  - Add selected personalized night light to cart.
  - Place personalized night light order and verify admin order details include selected preview, hidden SVG, original images, color, and text.
  - Generate night light.
  - Generate 2D item.
  - Admin creates catalog item.
  - Admin reviews generated item.
  - User creates order.
  - Automated route health check passed for `/`, `/catalog`, `/banners`, `/catalog/night-lights/personalized`, `/cart`, `/credits`, `/robots.txt`, and `/sitemap.xml`.
  - Automated metadata check passed for landing, catalog, banners, and personalized night light listing pages.
  - Automated locale render check passed for landing and catalog in `en`, `ru`, and `am`.
  - Automated sitemap URL check passed for localized landing, catalog, category, and item detail URLs under `/en`, `/ru`, and `/am`.
  - `SNIP_SMOKE_BASE_URL=http://localhost:3320 pnpm smoke:runtime` passed against a production-mode local app server with 8 route checks and 45 sitemap URL checks.
  - `pnpm smoke:db-workflows` passed against local Supabase with disposable users, guest cart merge, credit ledger, admin audit, transaction, generated personalized item, order, and order item snapshot checks.
  - `SNIP_SMOKE_BASE_URL=http://localhost:3320 pnpm smoke:ui-workflows` passed against a production-mode local app server after adding disposable confirmed customer/admin login coverage. Covered landing render, language switching, guest cart creation, password login, guest cart merge, credit balance visibility, authenticated cart editing/removal, banners entry, personalized model detail/form entry, and protected admin dashboard/users/transactions/items/orders/generated/banner-samples/personalized-model pages.
  - `scripts/smoke/ui-workflows.mjs` was expanded further for customized banner generation, generated-banner cart insertion, checkout review, and advanced banner credit spending. The expanded run is still unverified because the command escalation reviewer returned a usage-limit rejection when rerunning `SNIP_SMOKE_BASE_URL=http://localhost:3320 pnpm smoke:ui-workflows`.
  - Production-mode desktop/mobile screenshots were captured under `docs/qa/screenshots/` and summarized in `docs/qa/local-e2e-qa.md`.
  - Chrome DevTools Protocol mobile checks confirmed `scrollWidth === viewportWidth` for landing, catalog, and cart at `390x844`.
  - `pnpm lint`, `pnpm typecheck`, `pnpm smoke`, `pnpm build`, and `git diff --check` passed after final MVP changes.
  - Manual provider-backed browser click-through remains pending for register/email verification, Stripe checkout/webhooks, OpenAI-backed generations, and rendered admin mutation workflows. The in-app Browser runner failed locally with Windows sandbox permission error `CreateProcessAsUserW failed: 5`.
  - Acceptance: acceptance criteria from requirements doc pass.

## Milestone 14: Content and Launch Readiness

- [x] Add initial marketplace seed data.
  - At least 2 items per category.
  - At least 2 banner samples/templates.
  - At least 4 popular items.
  - Realistic prices and descriptions.
  - Acceptance: landing/catalog do not feel empty in demos.

- [x] Add product image requirements for admins.
  - Recommended aspect ratio.
  - Minimum size.
  - File type limits.
  - Acceptance: admin-created catalog items render consistently.

- [x] Add upload rights confirmation.
  - User confirms they have rights to uploaded image.
  - Acceptance: generation flow records or requires image-rights confirmation.

- [x] Add preview disclaimer copy.
  - Previews are approximations before production review.
  - Acceptance: night light and 2D previews avoid exact-output promises.

- [x] Add initial translation content.
  - English source strings.
  - Russian translations.
  - Armenian translations using app locale `am`.
  - Translation review checklist for product/category/order/status terminology.
  - Acceptance: MVP user-facing flows have complete `en`, `ru`, and `am` translation coverage.

- [x] Add SEO launch readiness checks.
  - Generate sitemap.
  - Verify robots rules.
  - Review default metadata for landing/catalog/category pages.
  - Review metadata for seed catalog items.
  - Verify social images render for important pages.
  - Acceptance: public marketplace pages have indexable, unique, useful metadata before launch.

- [x] Add redesign launch readiness checks.
  - Review spacing, typography, and card consistency across all public marketplace pages.
  - Replace placeholder imagery on redesigned public sections.
  - Check that redesigned generation entry points still feel connected to the storefront.
  - Acceptance: the public app no longer looks like a collection of mismatched pages.

- [x] Update README with marketplace setup notes.
  - New migrations.
  - Admin promotion.
  - Credit/payment config.
  - I18n routing, locale detection, and translation workflow.
  - SEO metadata, sitemap, robots, and admin metadata workflow.
  - Redesign system conventions for future page additions.
  - Seed data.
  - Acceptance: a developer can run the marketplace MVP locally.

## Suggested Build Order

1. Milestone 0: resolve product decisions that affect code.
2. Milestone 1: database, profiles, roles, RLS, and locale routing.
3. Milestone 2: shared domain and i18n helpers.
4. Milestone 3: localized public storefront.
5. Milestone 4: admin catalog management.
6. Milestone 5: credit accounting.
7. Milestone 5A: credits-only refactor.
8. Milestone 6: generation type split.
9. Milestone 7: night light generation, including personalized model generation.
10. Milestone 8: 2D laser-cut generation.
11. Milestone 8A: banner generation.
12. Milestone 9: dashboard and generated item detail.
13. Milestone 10: carts, order item snapshots, and orders.
14. Milestone 11: admin generated review.
15. Milestone 12: payments, if not deferred.
16. Milestone 12A: multi-currency support.
17. Milestone 13 and 14: QA, seed data, launch readiness.

## Priority Execution Plan

### P0: Start Here

These tasks should start first because they define contracts that many later features depend on.

1. Finish Milestone 0 product decisions.
   - Payment provider for MVP.
   - Exchange-rate API provider and base/reference pricing currency.
   - Currency preference persistence rules and AMD/RUB bank-payment interim behavior.
   - Locale routing and region default rules.
   - Localized content and SEO fallback policy.
   - Redesign phase-1 scope.
   - Admin user and transaction permission policy.
   - Credit charging/refund rules.
   - Banner size/material/output presets.
   - Acceptance: there are no open product decisions that block schema or shared service implementation.

2. Implement Milestone 1 schema and security foundations.
   - Profiles, roles, admin permissions, and audit-log-ready actor references.
   - Categories, subcategories, catalog items, localized content fields, SEO metadata storage.
   - Carts, cart items, orders, and order item snapshots.
   - Generated item storage for previews, hidden SVGs, reference uploads, and banner assets.
   - Credit ledger, transactions, and manual adjustment records.
   - Storage buckets/policies and RLS/server guard enforcement.
   - Acceptance: the core data model exists and is protected correctly.

3. Implement Milestone 2 shared platform code.
   - Locale helpers, dictionary loading, and persistence of manual language choice.
   - SEO helpers for canonical, alternate locales, noindex rules, and admin-managed metadata.
   - Shared services for catalog, cart, orders, generated items, credits, transactions, and admin permissions.
   - Shared generation contracts so feature teams use one artifact model.
   - Acceptance: later UI work can call stable shared APIs instead of inventing local logic.

### P1: Build the Core User and Admin Experience

These tasks establish the experience users and admins will interact with every day.

4. Build Milestone 3 public storefront with redesign direction.
   - Landing page, header, footer, category sections, catalog grid, product detail, and cart.
   - Localized routes and metadata.
   - Cart persistence for guest and signed-in users.
   - Acceptance: the storefront looks coherent, works in `en|ru|am`, and supports shopping basics.

5. Build Milestone 4 admin catalog management.
   - Catalog item create/edit/publish flows.
   - SEO metadata create/generate/regenerate flows.
   - Toy and decoration admin flows including admin-only characteristics.
   - Banner sample creation and publishing workflow.
   - Acceptance: admins can create and maintain sellable catalog content without direct database work.

6. Build Milestone 5 credits, Milestone 5A credits-only refactor, and Milestone 6 generation type split.
   - Credit balance display and ledger behavior.
   - Removal of split or legacy generation-currency terminology.
   - Shared pricing/debit/refund logic.
   - Separate generation entry paths and internal handling for night lights, personalized night lights, 2D items, and banners.
   - Acceptance: generation features have a consistent accounting model and routing model.

### P2: Build Revenue-Critical Customization Flows

These tasks unlock the differentiating custom-product workflows.

7. Build Milestone 7 personalized night lights.
   - `Night lights > Personalized` browsing.
   - First personalizable model with mock image.
   - Personalization form with up to 3 images, text, color, and `Multi color`.
   - Login/register gate before generation.
   - Generate 3 previews plus hidden SVG files and allow selection for purchase.
   - Acceptance: selected preview and production data persist through order creation and admin review.

8. Build Milestone 8 2D laser-cut generation.
   - Shared upload and generation flow.
   - Credit charging behavior based on finalized Milestone 0 policy.
   - Acceptance: generated 2D previews are stored, sanitized, and reviewable.

9. Build Milestone 8A banner generation.
   - User banner sample customization with text and size.
   - Advanced user AI banner generation with prompt and image references.
   - Admin sample generation from prompt and attached images.
   - Credit charging and refund/avoid-charge behavior.
   - Acceptance: banner generation works with deterministic pricing and reusable assets.

### P3: Complete Order Operations and Production Review

These tasks connect generation and shopping into fulfillable operations.

10. Build Milestone 9 dashboard and generated item history.
    - User access to owned generated items and selected previews.
    - Acceptance: users can revisit prior generated results safely.

11. Finish Milestone 10 orders and checkout-linked item snapshots.
    - Cart to order conversion.
    - Snapshot of chosen configuration, generated outputs, and pricing context.
    - Acceptance: orders remain stable even if catalog data later changes.

12. Build Milestone 11 admin generated review.
    - Admin review of personalized night lights, 2D outputs, and banners.
    - Banner manufacturing instruction generation from `docs/manufacturing/`.
    - Acceptance: admins have the production context needed to fulfill orders.

13. Add Milestone 12 payments when the MVP checkout contract is ready.
    - Acceptance: payments are connected only after order, ledger, and admin review flows are stable enough to support them.

14. Add Milestone 12A multi-currency support.
    - Currency admin settings, exchange-rate cache, active-currency display, order snapshots, and provider routing.
    - Acceptance: AMD is default, EUR/USD route to Stripe, and AMD/RUB are bank/manual pending until bank integration is ready.

### P4: Stabilize and Launch

15. Run Milestone 13 QA, tests, and smoke coverage.
16. Finish Milestone 14 seed data, translations, SEO readiness, redesign polish, and README updates.

### First 10 Implementation Tasks

If the team is starting immediately, these are the first 10 tasks to assign:

1. Finalize locale routing, fallback, and region-default decisions.
2. Finalize credit pricing and refund policy.
3. Finalize admin permission scope for user and transaction actions.
4. Finalize redesign scope and public pages included in phase 1.
5. Finalize currency provider, base/reference price currency, and payment routing decisions.
6. Create migrations for profiles, roles, admin permissions, and audit logs.
7. Create migrations for categories, subcategories, catalog items, localized fields, and SEO metadata.
8. Create migrations for carts, cart items, orders, and order item snapshots.
9. Create migrations for generated items/artifacts, credit ledger, transactions, and banner-specific assets.
10. Implement RLS/server authorization for admin, order, transaction, and generated-item data.

## MVP Completion Definition

The MVP is complete when:

- Guests can browse a populated marketplace by category.
- App supports `en`, `ru`, and `am`, selects default language by region when no preference exists, and preserves manual language choice.
- Public marketplace pages have localized SEO metadata, canonical/alternate metadata where appropriate, sitemap/robots support, and safe structured data.
- Public storefront visually matches the intended redesign direction inspired by `C:\apps\other\easy-marketplace-main`.
- Guests can add catalog items to cart, keep cart through refresh, and continue shopping.
- Prices default to AMD, users can switch to enabled currencies, and orders snapshot selected currency and exchange-rate context.
- Admins can enable/disable AMD, EUR, USD, and RUB and review exchange-rate cache status.
- EUR/USD payments route through Stripe, while AMD/RUB payments route to bank/manual pending flow until bank integration is implemented.
- Landing page shows admin-selected popular items.
- Admins can create and publish catalog items.
- Admins can manually edit and AI-generate/regenerate product SEO metadata.
- Admins can search/manage users and view user detail/support history with server-side authorization.
- Admins can view transactions and transaction details for payments, credit activity, refunds, and manual adjustments.
- Admin manual credit adjustments create ledger, transaction, and audit records.
- Admins can upload or generate toys and decorations, edit name/description/sizes, and manage admin-only characteristics.
- Toy and decoration characteristics remain hidden from non-admin users and available to admins for production/order review.
- Users can see credit balance and acquire Credits through the selected MVP flow.
- Users can browse Banners, customize an admin-generated sample with text and size, and order it.
- Advanced users can generate banners with prompt/image references and spend credits.
- Admins can generate banner samples from prompt/image references.
- Guests can browse `Night lights > Personalized` and see the first personalizable model.
- Guests are prompted to log in/register when attempting personalized generation.
- Users can personalize the first night light model, generate 3 previews with hidden SVGs, and select one to buy.
- Users can generate night lights from uploaded image plus stand text.
- Users can generate supported 2D laser-cut products from uploaded images.
- Generated previews are saved, sanitized, and reviewable.
- Users can review cart contents, create orders from cart, and see stable order item snapshots.
- Banner orders preserve image, size, text placement, prompt/reference images when applicable, and credit metadata.
- Admins can generate banner manufacturing instructions and drawings from banner orders using `docs/manufacturing/` skills and tool JSON data.
- Personalized night light orders preserve the chosen preview image, hidden SVG, original images, color, and text for admin review.
- Admins can review generated manufacturing files and manage order statuses.
- Admin user and transaction management actions are auditable and avoid silent edits to settled financial history.
- RLS/server guards prevent unauthorized access to admin, order, Credit, and generated item data.
