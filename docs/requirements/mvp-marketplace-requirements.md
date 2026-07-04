# Marketplace MVP Requirements

Date: 2026-06-10

## Summary

Snip should become a marketplace for laser-cut and crafted products. Users can buy ready-made items from an existing catalog, and can also generate custom products in supported categories by spending purchased credits.

The MVP should focus on two revenue paths:

- Catalog purchases: users browse popular and categorized products, then buy existing items.
- Credit-gated generation and personalization: users buy credits, generate or personalize supported custom items, preview results, choose an approved option, and order the generated item after approval.

## Product Goals

- Present Snip as a commerce product, not only a generation tool.
- Let users buy existing products from a managed catalog.
- Let users generate custom night lights and 2D laser-cut items from uploaded images.
- Let users personalize supported night light models from the `Night lights > Personalized` subcategory.
- Give admins tools to manage catalog items and create generated items internally.
- Keep manufacturing output reviewable before production.

## User Roles

### Guest

- Can view landing page and popular items.
- Can browse public catalog categories.
- Can add published catalog items to a local/session cart.
- Can review and edit cart contents before sign-in.
- Must sign in before buying, generating, or saving custom items.

### Registered User

- Can browse and buy catalog items.
- Can add catalog items and selected generated items to a persistent cart.
- Can review cart totals and convert cart contents into an order.
- Can buy credit packs.
- Can upload images for supported generated product types.
- Can preview generated output before ordering.
- Can see saved generated items and orders.

### Admin

- Can create, edit, publish, unpublish, and delete marketplace items.
- Can assign categories, pricing, images, production metadata, and popularity flags.
- Can generate items using the same generation flows as users.
- Can review generated outputs before they become orderable or manufacturable.
- Can manage order statuses.
- Can manage users and view user activity needed for support.
- Can view and manage transaction records with an audit trail.

## Marketplace Categories

MVP categories:

- Toys
- Constructors
- Decorations
- Night lights
- Banners

Categories can contain subcategories. Each catalog item belongs to one primary category and may optionally belong to a subcategory under that primary category.

Initial subcategory:

- Night lights
  - Personalized

Later versions may support tags such as "popular", "new", "gift", "kids", "home", "seasonal", and "customizable".

## Admin Toy and Decoration Requirements

Admins must be able to create and manage toy and decoration catalog items from the admin panel.

Toy and decoration creation methods:

- Admin can upload a finished toy or decoration image manually.
- Admin can generate a toy or decoration image/sample with AI.
- Admin can generate toy/decoration metadata from an uploaded/generated image.

Editable public fields:

- Name.
- Description.
- Product images.
- Sizes or size presets.
- Price.
- Publish status.
- Production notes when appropriate.

Admin-only toy and decoration fields:

- Characteristics.
- Characteristics must describe materials, specifications, construction details, finish, dimensions, production assumptions, and any manufacturability notes.
- Characteristics are visible only to admins.
- Characteristics must not be shown on public product cards, catalog pages, item detail pages, cart pages, or user order pages.
- Characteristics should be copied into order/admin production metadata when a toy or decoration is ordered so admins can review production details later.

AI-assisted metadata:

- Admin can generate or regenerate name, description, sizes, and characteristics from a toy or decoration image.
- Admin can edit all AI-generated fields before saving or publishing.
- AI-generated characteristics must be treated as draft/speculative until reviewed by an admin.
- If AI cannot confidently identify materials or specifications from the image, it should mark unknowns clearly instead of inventing exact specs.

## Personalized Night Light Requirements

The `Night lights > Personalized` subcategory must support a guided personalization flow.

User flow:

1. User navigates to the Night lights category.
2. User sees the Personalized subcategory.
3. User opens the Personalized subcategory.
4. User sees existing night light models that can be personalized.
5. MVP starts with one model using a mock image until production images are ready.
6. User selects a model and opens its personalization form.
7. If the user is not authenticated and attempts to generate, the app shows a login/register prompt instead of submitting generation.

Personalization form for the first model:

- Image selector accepting up to 3 user images.
- LED color selector using eye-comfortable color options.
- `Multi color` checkbox.
- When `Multi color` is checked, the single color selector is disabled.
- Text input/editor with a hard maximum of 100 characters.
- The text editor should be simple and production-safe; MVP formatting must not create unsupported manufacturing output.

Generation behavior:

- User can upload up to 3 images, enter text, choose either a single LED color or multi-color mode, and click generate.
- The generation request must send the user images, user text, selected color or multi-color flag, selected model ID, and a boilerplate/template image to the OpenAI API.
- The boilerplate/template image will be provided later and should be modeled as a configurable asset on the personalization model.
- The API should return 3 generated preview images for the selected model.
- Alongside the user-visible preview images, AI must also generate a manufacturing SVG file for each generated option.
- The generated SVG files are hidden from the user in the personalization result UI.
- User can select one of the 3 generated images as the option to buy.
- The selected generated option should be saved with its hidden SVG and enough metadata for admin review, ordering, and future production.

Suggested eye-comfortable LED colors:

- Warm white
- Soft white
- Amber
- Soft yellow
- Soft pink
- Soft green
- Soft blue
- Lavender

## Supported Generated Product Types

### Night Light

User input:

- Uploaded image.
- Text to engrave or cut into the wooden stand.
- Optional size selection, if supported by production.

AI output:

- Pencil-like SVG drawing derived from the uploaded image.
- Preview showing the acrylic glass panel with the engraved image.
- Preview showing the wooden base with the entered text.
- Manufacturing SVG with separate layers for acrylic engraving and wood base engraving/cutting.

Manufacturing intent:

- The image is engraved or scratched into an acrylic/plexiglass panel.
- The text is written on or cut/engraved into the wooden stand.

### Marketing Banners

Banners are a marketplace category for store marketing banners such as storefront signs, promotional wall banners, sale banners, event banners, and product campaign banners.

Admin sample generation:

- Admin can generate banner samples from the admin panel.
- Admin enters a text prompt describing the banner goal, brand/store context, style, offer, and intended use.
- Admin can attach one or more reference images, such as logo, product photo, store photo, brand palette, or existing marketing material.
- Admin can select banner size before generation.
- AI generates sample banner images that can be published or attached to a banner product/template.
- Admin-generated samples should be reviewable before becoming visible to users.

User sample customization:

- User can browse the Banners category.
- User can select a sample banner.
- User can place/edit text inside the selected banner using a simple editor.
- User can select banner size from supported size presets.
- User can preview the customized banner before adding it to cart or placing an order.
- Text placement must preserve a safe area so important content is not cut off during printing/cutting/finishing.

Advanced user AI generation:

- Advanced users can generate a banner using AI.
- User enters a prompt describing the desired banner.
- User can attach image references in the prompt, such as logo, product photo, or brand/image inspiration.
- User selects banner size before generation.
- User is charged credits for banner generation.
- Credit cost should be shown before generation.
- Failed generations caused by system error should refund or avoid charging credits.
- Successful banner previews consume credits according to the configured charging policy.

Banner AI output:

- User-visible banner preview image.
- Structured metadata: prompt, source images, selected size, generated image path, credit cost, and review/order status.
- Optional print/manufacturing file when available, such as SVG, PDF, raster print file, cut/trim guides, or finishing notes.

Banner size requirements:

- Banner sizes must use admin-configured presets.
- Presets should include width, height, unit, orientation, material/finish assumptions if known, and whether the size supports shipping/production.
- Custom sizes can be added later, but MVP should prefer presets to keep manufacturing and pricing predictable.

Banner manufacturing-instruction generation:

- When a banner order exists, admin order details must include an action to generate detailed build instructions and drawings from the ordered banner image.
- This instruction generation must use the manufacturing skills and structured tool data from `docs/manufacturing/`.
- The AI should use `docs/manufacturing/ai-skills.md` for the workflow, `docs/manufacturing/tools.json` for machine/tool capabilities, `docs/manufacturing/tool-capability-schema.md` for schema rules, and `docs/manufacturing/rag-manuals.md` for RAG/manual retrieval policy.
- Output should include recommended production path, required tools, material assumptions, manufacturability warnings, drawings or drawing descriptions, print/cut/finish instructions, and an operator checklist.
- If required manufacturing details are missing or conflict with tool limits, the output must be marked `review_required` and list the missing inputs.

### 2D Laser-Cut Items

Supported categories:

- 2D toys
- 2D decorations
- 2D constructors

User input:

- Uploaded image.
- Product type selection.
- Optional text prompt or notes.
- Optional size selection, if supported by production.

AI output:

- Simplified laser-cut SVG based on the uploaded image.
- Preview showing how the final item may look after cutting and engraving/printing on wood.
- Manufacturing SVG with cut and engrave layers.

MVP constraint:

- Fully 3D construction toys are out of scope for automatic generation in the first marketplace MVP. Admin-created and catalog-listed 3D/assembled products may still be sold as existing marketplace items.

## Landing Page Requirements

The landing page must show:

- Brand/product value proposition.
- Most popular marketplace items.
- Category entry points for toys, constructors, decorations, and night lights.
- Clear path to browse catalog.
- Clear path to generate supported custom items.
- Sign in/register entry point.

Popular items can be selected manually by admins in MVP. Automated popularity ranking can come later.

## Internationalization Requirements

The app must support multiple languages from the start.

Supported app languages:

- English: `en`
- Russian: `ru`
- Armenian: `am`

Locale behavior:

- The default language should be selected by user region when no explicit language preference exists.
- Region-based language detection may use request headers, hosting geo headers, browser language, or a server-side locale detector, depending on deployment support.
- If region detection is unavailable or inconclusive, default to English.
- Users must be able to manually switch language.
- Manual language selection must persist for future visits using a cookie, profile preference, or equivalent.
- Explicit user language choice must take precedence over region detection.
- Authenticated users should store preferred language on their profile when available.

Routing and rendering:

- Public and authenticated pages must render localized UI copy for `en`, `ru`, and `am`.
- Admin UI should also be localizable, but English can remain the fallback for missing admin translations during MVP.
- URLs may use locale prefixes such as `/en`, `/ru`, `/am`, or an equivalent routing strategy, but links must preserve the active locale.
- The app must avoid mixing languages on the same page except for user/admin-entered product content.

Localized content:

- Static UI labels, navigation, forms, validation messages, empty states, auth prompts, cart/checkout copy, and order statuses must be translatable.
- Category names and system-defined option labels must be translatable.
- Admin-created catalog item names/descriptions may start as single-language content, but the data model should allow localized content later.
- AI prompts and generated descriptions should include the target language when generating user-visible text.

Formatting:

- Dates, numbers, prices, and currencies should be formatted according to active locale where possible.
- The product can use `am` as the app locale code for Armenian while mapping to platform locale `hy-AM` for date/number formatting if needed.

SEO and accessibility:

- Public localized pages should set the correct `lang` attribute.
- Public localized pages should support alternate-locale metadata when feasible.
- Language switcher labels should be accessible and understandable in the current language.

## SEO Requirements

Public marketplace pages should be built for high-value SEO, especially landing, category, subcategory, catalog item, banner, and personalized model pages.

General SEO behavior:

- Public pages must render meaningful server-side metadata.
- Public pages must have unique page titles and meta descriptions.
- Public pages must avoid duplicate metadata across different products/categories.
- Public pages should support canonical URLs.
- Localized public pages should support alternate-language metadata when feasible.
- Public product/category pages should have crawlable links between related categories, subcategories, and item detail pages.
- Unpublished, archived, private generated items, admin pages, auth pages, cart, checkout, dashboard, and order pages should not be indexed.
- Sitemap and robots rules should include only indexable public pages.

Product/item SEO metadata:

- Admin users must be able to manage SEO metadata for catalog items/products from the admin panel.
- Admin users must be able to manually edit SEO title, meta description, URL slug, keywords/tags, Open Graph title, Open Graph description, and social image where supported.
- Admin users must be able to generate SEO metadata with AI from the item name, description, category, images, characteristics where admin-only access is allowed, and production details.
- Admin users must be able to regenerate SEO metadata after changing product content or images.
- Admin users must be able to review and edit generated metadata before saving or publishing.
- SEO metadata should support localization for `en`, `ru`, and `am` when localized content is available.
- Missing localized SEO fields should fall back predictably, preferably to the item's primary language or English.

SEO quality requirements:

- Metadata generation should create concise, human-readable titles and descriptions, not keyword stuffing.
- SEO titles should stay within recommended length limits where practical.
- Meta descriptions should summarize the product value and stay within recommended length limits where practical.
- Slugs should be stable, readable, lowercase, and unique.
- Generated metadata should include category/product intent and important distinguishing attributes.
- Admin UI should warn about duplicate slugs, missing metadata, overly long titles/descriptions, missing social image, and missing localized metadata when relevant.

Structured data:

- Product detail pages should support product structured data where safe and accurate.
- Structured data should include product name, image, description, category, price/currency when available, availability, and URL.
- Structured data must not expose admin-only characteristics, hidden SVGs, private manufacturing files, private user uploads, or unsupported claims.

## Redesign Requirements

The marketplace should be redesigned to match the overall feel and layout discipline of the reference app in `C:\apps\other\easy-marketplace-main`, which is also running at `http://localhost:3300`.

Reference design direction:

- Clean, modern marketplace presentation.
- Strong monochrome base with restrained accent usage.
- Large editorial hero with bold typography and product-led visual.
- Sticky header with lightweight navigation and cart entry point.
- Repeated section rhythm with centered headings and simple content bands.
- Product/deal cards with consistent image ratio, clear pricing, and straightforward calls to action.
- Minimal visual clutter, generous spacing, and clear hierarchy.

Visual system requirements:

- Use a coherent visual language across landing, catalog, item detail, cart, generation, and admin pages.
- Prefer neutral backgrounds, black/white contrast, muted surfaces, and carefully chosen accent color rather than a noisy multicolor palette.
- Keep border radius modest and consistent.
- Use high-quality bitmap imagery or product renders instead of placeholder-heavy or decorative SVG-first layouts.
- Typography should feel deliberate, bold, and product-oriented, with stronger hierarchy than the current app.
- Section spacing, container widths, and card proportions should be standardized.

Layout requirements:

- The public header should be sticky, compact, and visually stable while scrolling.
- Landing page should have a split hero or similarly strong first viewport that immediately communicates the marketplace and shows a real product/category signal.
- Landing page should be composed from clean full-width sections such as hero, trusted/popular, categories, featured products/deals, credibility/features, and CTA/footer.
- Catalog and category pages should feel like an extension of the landing page, not a different product.
- Cart should use a lightweight drawer or panel pattern where appropriate, while preserving access to a dedicated cart page.
- Mobile and desktop layouts should preserve hierarchy and avoid collapsing into stacked generic cards everywhere.

Marketplace-specific adaptation requirements:

- Replace the reference app's software/SaaS copy patterns with crafted-product marketplace patterns suited to Snip.
- Preserve the reference app's simplicity and section rhythm, but adapt content blocks to products, categories, personalized items, banners, and generated items.
- Keep category discovery prominent.
- Keep product cards, price visibility, and add-to-cart behavior obvious.
- Use the redesign to make generation flows feel like part of the same storefront, not a disconnected tool.

Component behavior requirements:

- Product cards should use consistent image sizing, pricing emphasis, and compact secondary metadata.
- Category entry points should feel visually curated, similar in weight to the reference category section.
- Featured/popular/deals sections should use repeatable card patterns with subtle hover feedback.
- Buttons should be visually consistent, with a clear primary/secondary split.
- Empty states, forms, and admin tables should inherit the same design system even if they remain more utilitarian than the public storefront.

Quality bar:

- Avoid placeholder marketplace styling, mismatched spacing, or inconsistent shadows/borders between sections.
- Avoid decorative gradients/orbs that do not match the reference app's cleaner product aesthetic.
- Avoid visually overloading the page with too many badges, card layers, or competing accent colors.
- The redesign should feel production-ready and intentional, not like a default template with marketplace text pasted in.

## Catalog Requirements

Users must be able to:

- Browse all published items.
- Filter by category.
- Navigate from a category to its subcategories when they exist.
- Browse published/personalizable models inside a subcategory.
- Open item detail pages.
- See product image, title, category, price, short description, and production notes when needed.
- Add items to cart.
- Buy immediately when the product flow supports it.
- Continue shopping after adding to cart.

MVP checkout may begin as an internal order request or payment-provider checkout depending on implementation readiness, but product and order data should be modeled for real payments.

## Catalog Media Requirements

Catalog items must support multiple ordered media assets so products can be presented with both images and videos.

Admin media management:

- Admins can upload product images.
- Admins can upload product videos.
- Supported media types should include PNG, JPG, WEBP, SVG, MP4, and WEBM.
- Admins can reorder images and videos to control the storefront display order.
- Admins can choose the primary media item.
- Admins can edit media alt text for accessibility and SEO where applicable.
- Admins can remove media from an item without deleting the catalog item.
- Existing thumbnail image behavior should migrate into the ordered media gallery when possible.

Storefront media behavior:

- Product cards should render a media slider instead of a single static image when multiple media assets exist.
- Product detail pages should render the same ordered media gallery in a larger view.
- Video media should play muted on hover in product cards.
- Videos must not autoplay with sound.
- Slider controls must not shift layout or break add-to-cart behavior.
- If no media exists, the UI should fall back to the existing product placeholder.

Storage and safety:

- Catalog media should be stored in the catalog asset storage bucket or equivalent public product-media bucket.
- Public users can read media for published catalog items.
- Admins can manage media for draft, published, and archived catalog items.
- Video file size limits should be bounded to protect storage and page performance.
- Uploaded media metadata should preserve type, path, sort order, primary state, alt text, and upload metadata.

## Shopping Cart Requirements

The cart should make shopping feel predictable, reversible, and low-friction.

Cart behavior:

- Guests can add published catalog items to a local/session cart without creating an account.
- Registered users have a persistent cart associated with their account.
- If a guest signs in or registers, the guest cart should merge into the user's persistent cart when possible.
- Users can add catalog items from product cards and product detail pages.
- Users can add selected generated/personalized items to cart only after the required generated option is selected.
- Users can view cart contents from a header cart entry point and a dedicated cart page.
- Users can update item quantity when quantity is allowed for that item.
- Users can remove items.
- Users can clear the cart.
- Users can continue shopping from the cart.
- Cart should clearly show unavailable, archived, deleted, or price-changed items before checkout.
- Checkout/order creation requires authentication.

Cart item display:

- Product image or selected generated preview.
- Product title.
- Category/subcategory when useful.
- Selected variant or personalization summary.
- Unit price.
- Quantity.
- Line total.
- Remove action.
- Availability or review-required status when applicable.

Cart totals:

- Subtotal.
- Discounts, if supported later.
- Shipping estimate or "calculated later" state.
- Taxes, if supported later.
- Grand total or clear pending-total explanation.

## Currency Requirements

The app must support multiple money currencies for catalog prices, cart totals, orders, credit-pack purchases, transaction records, and admin financial review.

Supported currencies:

- AMD.
- EUR.
- USD.
- RUB.

Default currency:

- AMD is the default application currency.
- If the user has not explicitly selected a currency, the app should use AMD.
- Later region-based currency defaults may be added, but must not override a user's explicit currency choice.

Admin currency management:

- Admins can view the supported currency list.
- Admins can enable or disable each supported currency.
- At least one currency must remain enabled.
- AMD should be enabled by default.
- Disabled currencies must not appear as selectable checkout/display currencies for users.
- Existing historical orders and transactions must continue to show their original currency even if that currency is later disabled.

Currency selection and display:

- Users can see prices in the active currency.
- Users can switch among enabled currencies from a visible storefront control or account preference.
- Catalog cards, product detail pages, cart, checkout, order detail, credit-pack purchase screens, and transaction summaries must use the active currency for money amounts.
- Admin pages should show both the transaction/order currency and enough base/reference amount information for reconciliation when useful.
- Formatting must respect active locale conventions while preserving the selected currency code/symbol clearly.

Exchange-rate requirements:

- Exchange rates must be fetched from a public exchange-rate API.
- Rates must be cached per day.
- The exchange-rate provider should be configurable by environment variable or server configuration.
- Rate records should include base currency, target currency, rate, provider, fetched date, and fetched timestamp.
- If the public API request fails, the app may use the most recent cached rate for that pair and should expose stale-rate status to admins.
- If no valid rate is available for a required conversion, checkout must be blocked with a clear error rather than guessing.
- Rate refresh should run server-side only; provider keys, if any, must not be exposed to the browser.

Pricing and order snapshot requirements:

- Catalog item prices and credit-pack prices must support conversion into all enabled currencies.
- Order items must snapshot unit price, line total, currency, and exchange-rate context used at order creation.
- Orders must snapshot subtotal, total, currency, and payment provider route used at order creation.
- Transactions must store amount, currency, provider, provider reference when applicable, and exchange-rate context when converted.
- Refunds and reversals should use the original transaction currency unless an admin explicitly records a manual exception.

Payment routing:

- EUR and USD payments use Stripe.
- AMD and RUB payments use a future bank integration.
- Until the bank integration is implemented, AMD/RUB checkout may create pending/manual payment orders only if clearly labeled to users and admins.
- The checkout flow must not silently route AMD/RUB payments through Stripe.
- The checkout flow must not allow payment in a disabled currency.
- Credit-pack checkout follows the same currency routing rules as product/order checkout.

Comfortable shopping experience requirements:

- Adding to cart should provide immediate feedback without losing the user's place.
- The cart count in the header should update after add/remove actions.
- Users should not lose cart contents on refresh.
- Validation errors should explain the issue and point to the affected item.
- Destructive actions such as clearing the cart should require confirmation.
- Checkout should show a final review step before creating or paying for an order.
- Prices and product snapshots must be copied into order items at order creation so later catalog edits do not change historical orders.
- The UI should avoid surprise costs; unavailable shipping/tax/payment totals must be labeled clearly.

## Credit Requirements

Users need credits to generate custom items. Credits are the only user-facing generation currency in the marketplace. The product must not expose any separate generation-currency balance, pack, ledger, or cost concept to users or admins.

MVP behavior:

- User can view credit balance.
- User can buy credit packs.
- Each generation attempt reserves or spends a configured number of credits.
- Failed generations caused by system error should refund or avoid charging credits.
- Successful previews consume credits even if the user does not order the item, unless admins configure a different policy.

Credit pricing should be configurable by admins or environment configuration.

Banner generation, personalized night light generation, night light generation, and 2D laser-cut generation all use the same credits balance and ledger.

## Generation Requirements

The generation flow must:

1. Require authenticated user.
2. Require enough credit balance.
3. Ask user to choose supported generation type:
   - Night light
   - 2D laser-cut toy
   - 2D laser-cut decoration
   - 2D laser-cut constructor
   - Personalized night light model
   - Marketing banner
4. Accept image upload.
5. Accept required product-specific fields.
6. Generate an SVG and preview.
7. Save the generation record and credit usage.
8. Allow user to approve/save the generated item.
9. Allow user to start an order for the generated item.

Generated SVGs must be sanitized and stored with structured metadata:

- Product type.
- Source image path.
- Prompt and user-provided text.
- Cut paths.
- Engrave paths.
- Material assumptions.
- Credit cost.
- Review status.

Personalized night light generations must accept exactly one user image and store three generated raster preview images plus hidden manufacturing SVGs. The selected generated option must be linked to the original uploaded image, entered rich-text content and formatting intent, LED color choice, selected model, selected preview image, selected hidden SVG, boilerplate/template image version, credit cost, sale-price snapshot, and review status.

## Preview Requirements

Personalized night light generation must return one option for each approved boilerplate:

- Rectangular clear acrylic with a full-color UV-print design.
- Round clear acrylic with a full-color UV-print design.
- Contour-cut clear acrylic with monochrome CO2-laser-engraved line art.
- The matching wooden LED stand/base and selected comfortable light color.
- User-entered text and supported rich-text styling laser-engraved only on the front face of the wooden base within safe production margins; personalized text must not appear on the acrylic panel.

2D laser-cut preview should show:

- Wood material visual treatment.
- Cut outline.
- Engraved or printed details.
- Approximate final size when available.

Previews are approximations. The UI should avoid promising exact physical output before admin/factory review.

## Admin Requirements

Admin pages must support:

- Item list with search/filter by category and publish status.
- Create/edit marketplace item.
- Upload/manage item images.
- Set title, description, category, price, inventory/availability, and popularity flag.
- Set the personalized night-light model price in AMD; the initial/default price is 25,000 AMD and changes apply to future generations while generated/cart/order records retain their price snapshots.
- Manage product SEO metadata.
- Generate, regenerate, review, and manually edit product SEO metadata.
- Create toys and decorations by uploading images or generating images/samples.
- Generate and edit toy/decoration name, description, sizes, and admin-only characteristics.
- Set whether item is generated, catalog-only, or admin-generated.
- View generated items and review status.
- Generate night lights, 2D laser-cut items, and banner samples internally.
- Approve, reject, or request changes for generated manufacturing files.
- Generate banner manufacturing instructions and drawings from banner orders.
- Manage users.
- View and manage transactions.

MVP admin authorization can use a simple `admin` role/profile flag, but must be enforced server-side.

## Admin User Management Requirements

Admins need a support-oriented user management area.

Admin user list must support:

- Search by email, name, user ID, or phone when available.
- Filter by role, status, created date, and account activity when available.
- View basic user profile information.
- View user credit balance.
- View user orders.
- View user generated items.
- View user transaction history.
- View user carts only when needed for support/debugging, and never as a normal public capability.

Admin user detail must support:

- Update user role when authorized.
- Update user status, such as active, suspended, or banned if these statuses are implemented.
- Update preferred language when needed for support.
- Manually adjust credit balance with a required reason.
- Add internal admin notes.
- View audit history for admin actions affecting the user.

Safety and privacy requirements:

- Admin user actions must be server-side guarded.
- Admins must not see password hashes, auth secrets, payment card numbers, or provider secrets.
- Role changes, status changes, credit adjustments, and internal notes must be auditable.
- Destructive user deletion is out of MVP scope unless there is a documented compliance flow; use suspend/disable instead.
- Manual balance adjustments must write ledger records and never directly overwrite balances without an audit record.

## Admin Transaction Management Requirements

Admins need a transaction area for payments, credit purchases, generation spending, refunds, and manual adjustments.

Transaction list must support:

- Search by transaction ID, user, order ID, payment provider reference, or ledger reference.
- Filter by type, status, date range, user, order, and provider when available.
- Show amount, currency, user, order, transaction type, status, provider, and created date.
- Export or copy transaction identifiers for support when feasible.

Transaction types should include:

- Credit purchase.
- Credit spend.
- Credit refund.
- Manual credit adjustment.
- Catalog/generated item payment.
- Order refund.
- Payment provider webhook event.

Transaction detail must show:

- User.
- Related order or generated item when applicable.
- Amount and currency, or credit quantity.
- Payment provider and provider reference when applicable.
- Status and timestamps.
- Idempotency key or webhook event ID when applicable.
- Related ledger entries.
- Admin notes and audit history.

Admin transaction actions:

- Mark internal/manual transaction records with review notes.
- Trigger or record manual credit adjustments.
- Record manual refunds when payment provider automation is not ready.
- Reconcile payment provider webhook events.

Financial safety requirements:

- Payment-provider refunds should use the provider API when integrated; manual records must be clearly marked as manual.
- Transaction mutations must be idempotent where applicable.
- Admins cannot edit settled financial history silently; corrections must create reversing or adjustment records.
- Transaction pages must avoid exposing sensitive payment details beyond provider-safe references.
- Multi-currency transaction pages must make provider route, currency, and exchange-rate context clear enough for reconciliation.

## Order Requirements

Orders should track:

- Buyer.
- One or more order items.
- Subtotal and total amounts at time of order creation.
- Currency and exchange-rate context at time of order creation.
- Payment status.
- Payment provider route selected from the order currency.
- Production status.
- Shipping/contact fields when checkout is implemented.

Order items should track:

- Source type: catalog item, generated item, personalized generated item, or banner generated item.
- Source item ID when applicable.
- Product title snapshot.
- Product image or selected preview snapshot.
- Category/subcategory snapshot.
- Variant or personalization summary snapshot.
- Quantity.
- Unit price at time of purchase.
- Line total at time of purchase.
- Currency.
- Exchange-rate context when the price was converted from a base/reference amount.
- Production metadata needed by admins.
- Admin-only item characteristics when needed for production or review.
- Review status or production-readiness status when applicable.

For personalized night light orders, order details must also store a snapshot of:

- User-selected generated preview image.
- Hidden generated SVG for the selected option.
- Original uploaded user image.
- Selected LED color, defaulting to warm white when the user makes no change.
- User-entered personalization text and supported formatting intent.
- Selected personalization model and template image version.

These personalized order assets and inputs should be visible to admins in order details, but the hidden SVG should not be exposed in the user-facing order UI.

For banner orders, order details must also store a snapshot of:

- Selected or generated banner image.
- Banner size preset.
- User-entered text and text placement metadata.
- User prompt and attached reference images when AI-generated by the user.
- Admin sample/template source when customized from an admin sample.
- Credit cost when AI generation was used.
- Any generated print/manufacturing file, trim/cut guide, or finishing metadata when available.
- Manufacturing instruction generation status and latest generated instruction artifact.

Banner order assets, manufacturing instructions, and generated drawings should be visible to admins in order details.

Suggested production statuses:

- `draft`
- `pending_payment`
- `paid`
- `review_required`
- `approved_for_production`
- `in_production`
- `ready_to_ship`
- `shipped`
- `cancelled`
- `refunded`

## Out of Scope for MVP

- Fully automated 3D constructor generation.
- Designer marketplace with public user shops.
- Automated nesting optimization.
- Full assembly instruction booklet generation.
- Multi-vendor fulfillment.
- Real-time inventory reservation.
- Advanced personalization on every catalog item.
- Automatic compliance certification for children's toys.

## Acceptance Criteria

- Guest can land on the homepage and see popular items.
- App supports English, Russian, and Armenian locales.
- Default language is selected by region when no explicit user preference exists.
- User can manually switch language and the choice persists.
- Public pages, auth flows, catalog, cart, checkout/order pages, and core admin screens render localized UI copy with English fallback for missing admin strings.
- Public landing, category, subcategory, and product pages render SEO metadata.
- Admin can manually edit and AI-generate/regenerate SEO metadata for products/items.
- Product SEO metadata supports localized values for `en`, `ru`, and `am` with predictable fallback.
- Public product pages include safe structured data and never expose admin-only/private manufacturing data.
- Public storefront uses the redesigned visual system inspired by `C:\apps\other\easy-marketplace-main`.
- Landing page, catalog, item detail, and cart feel visually consistent and product-led.
- Sticky header, hero, featured sections, category discovery, and product cards match the intended redesign quality bar on desktop and mobile.
- Guest can browse items by category.
- User can register/sign in and view credit balance.
- User can buy or receive a credit pack through an MVP flow.
- User cannot generate without enough credits.
- User can generate a night light from uploaded image plus stand text.
- User can preview the night light result before ordering.
- Guest can navigate to `Night lights > Personalized` and view the initial personalizable model.
- Guest is prompted to log in or register when attempting to generate a personalized night light.
- The `Create personalized design` CTA opens the first personalized night-light creation page directly.
- Authenticated user can personalize the night light with exactly one image, up to 80 characters in a rich-text editor, and an optional comfortable LED color that defaults to warm white.
- Personalized night light generation returns exactly 3 preview images, one for each approved rectangular-print, round-print, and contour-engraved boilerplate.
- Personalized night light generation creates hidden SVG files for the generated options.
- Expected generation failures stay on the personalization page with a friendly message instead of exposing provider errors or a framework error overlay.
- If the user lacks generation credits, the UI opens a dialog showing the shortage and offers a direct Buy credits action; no upload or AI call starts before this check passes.
- User can select one generated personalized night light preview to buy.
- The initial personalized night-light price is 25,000 AMD, admins can change it, and the selected generated item is added to cart using the price captured when it was generated.
- When a user places a personalized night light order, the chosen preview image, hidden SVG, original uploaded images, color selection, and text are stored with the order.
- Admin can view personalized night light order assets and inputs from order details.
- Guest can add published catalog items to cart and continue browsing.
- User can review cart contents, update quantities, remove items, and proceed to checkout/order creation.
- Cart contents survive refresh and, after login/register, are merged into the user's cart when possible.
- Order items preserve product names, images/previews, prices, quantities, and personalization data at order creation time.
- User sees AMD prices by default and can switch to any enabled currency.
- Checkout routes EUR/USD payments through Stripe and blocks or marks AMD/RUB as bank/manual pending until bank integration is available.
- Admin can enable/disable supported currencies and review daily exchange-rate cache status.
- User can generate a supported 2D laser-cut item from uploaded image.
- User can preview the 2D laser-cut result before ordering.
- User can browse the Banners category.
- Admin can generate banner samples from prompt and attached images.
- User can select a banner sample, place text inside it, choose a size, preview it, and order it.
- Advanced user can generate a banner from prompt and attached image references.
- Banner AI generation charges credits and shows the credit cost before submission.
- Banner orders store selected/generated image, size, text placement, source prompt/images when applicable, and credit metadata.
- Admin can generate detailed manufacturing instructions and drawings from a banner order using `docs/manufacturing/` skills and JSON tool data.
- Admin can create and publish catalog items.
- Admin can upload or generate toy and decoration items.
- Admin can generate and edit toy/decoration name, description, sizes, and admin-only characteristics from an image.
- Toy and decoration characteristics are visible to admins only and hidden from public/user-facing pages.
- Admin can search, view, and manage users with server-side authorization.
- Admin can adjust user credit balances only with a required reason and ledger/audit entry.
- Admin can view transaction history and transaction details for payments, credit activity, refunds, and manual adjustments.
- Transaction corrections are represented as adjustment/reversal records, not silent edits.
- Admin can mark items as popular.
- Admin can generate custom items.
- Admin can review generated manufacturing files.
- Generated SVGs are sanitized before display or storage.
- Non-admin users cannot access admin pages or admin API actions.

## Open Questions

- Which bank provider will handle AMD and RUB payments?
- Should AMD/RUB pending-payment orders reserve inventory/production capacity before bank confirmation?
- Should localized routes use path prefixes (`/en`, `/ru`, `/am`) or cookie/header-based routing without URL prefixes?
- What exact region-to-language defaults should be used for Armenia, Russia/Russian-speaking regions, and all other regions?
- Should admin-created catalog content be required in all supported languages at publish time, or can it fall back to the original language?
- Which SEO fields are required before publishing an item?
- Should AI-generated SEO metadata be generated per locale automatically or only for the active/admin-selected locale?
- What sitemap route strategy should be used for localized pages?
- Which pages should be excluded from indexing beyond admin/auth/cart/checkout/account pages?
- Which parts of the reference app are mandatory to match closely: overall aesthetic only, layout structure, or specific section patterns?
- Should the redesigned public storefront keep a light-only theme in MVP, or should dark mode remain fully supported?
- What user statuses should be supported in MVP: active, suspended, banned, deleted/requested deletion?
- Which admin roles can change other users' roles or balances?
- What transaction provider fields should be stored for the selected payment provider?
- Should admin transaction export be included in MVP or deferred?
- Should guest carts be stored only in browser storage, or also in an anonymous server-side cart session?
- Which product types allow quantity greater than 1, especially generated/personalized items?
- Should cart checkout support mixed catalog and generated items in one order, or split orders by production workflow?
- What banner size presets, materials, and finishing options should launch first?
- What output format is required for banner production: print-ready PDF, SVG, raster image, cut guide, or multiple files?
- Which users count as "advanced users" for AI banner generation?
- Should admin-generated banner samples become catalog items, reusable templates, or both?
- What toy and decoration size presets and materials should be supported first?
- Should toy/decoration characteristics be free text, structured fields, or both?
- Should AI-generated toy/decoration characteristics require explicit admin approval before publishing?
- Should credits be charged per attempt, per successful preview, or per saved generated item?
- What exact materials and sizes are supported for night lights?
- What is the final boilerplate/template image for the first personalized night light model?
- What exact LED colors are supported by the hardware supplier, and which names should be user-facing?
- Should personalized night light previews cost the same number of credits as generic night light generation?
- Should the 3 generated personalized previews be produced in one OpenAI request or as three separate tracked generation attempts?
- Should the acrylic panel be called acrylic, plexiglass, or another production-specific material in user-facing copy?
- Are toys intended for children, collectors, or decoration? This affects safety/compliance requirements.
- Should generated user items become private orders only, or can users publish them to the marketplace later?
