# Personalized night-light requirements

## Scope

This document replaces the fixed three-boilerplate behavior for
`/personalize/portrait-personalized-night-light`.

## Admin requirements

- Admin users with catalog-management permission can create, update, reorder,
  activate/deactivate, and remove boilerplate options for a personalization
  model.
- Every boilerplate has a stable ID, admin name, customer-facing translated
  name, image, manufacturing instructions, display order, and active state.
- Each boilerplate has an independent `generate_hidden_svg` setting. Hidden
  manufacturing SVGs are generated only when this setting is enabled. Of the
  initial three boilerplates, only `contour-laser-engraved.jpg` enables it.
- Replacing an image uploads to a new immutable storage path. Removing a
  boilerplate removes it from future generation choices without invalidating
  historical generation and order snapshots.
- Published models must have at least one active boilerplate.

## Customer requirements

- The form displays every active boilerplate as a visual selectable option.
  Customers can select one or multiple options; at least one is required.
- The customer uploads exactly one PNG, JPG, or WEBP image (maximum 20 MB).
- The customer selects one supported LED color and may enter personalized text.
  Personalized text is optional and limited to 80 characters.
- The form continuously displays the generation price: one credit per selected
  boilerplate and the total number of credits that will be charged.
- The server validates selected boilerplate IDs against the model's currently
  active boilerplates. Client-provided cost, image path, SVG behavior, or
  manufacturing instructions are never trusted.
- Credits are debited atomically for the complete selection before generation.
  If generation fails, the complete debit is refunded. No partial result is
  presented as a successful generation.
- The generation loading state explains progress, prevents duplicate submits,
  preserves the user's visible selections, and indicates that multiple options
  can take time.
- Insufficient balance shows required and available credits with actions to buy
  credits or return to the form. Upload, validation, service, and persistence
  failures show actionable translated errors.
- A successful result contains exactly one preview for each selected
  boilerplate. A hidden SVG is attached only to options whose boilerplate
  enables it.
- Customers can select one or multiple generated results and add all selected
  results to the cart. Each cart line preserves its own preview, optional hidden
  SVG, boilerplate snapshot, uploaded image, text, color, price, and generation
  credit metadata.

## Localization and accessibility

- All new customer-facing copy is available in English, Armenian, and Russian.
- Template names may fall back to the admin name when a locale-specific name is
  absent.
- Template choices are keyboard-operable checkboxes with visible selected,
  hover, focus, disabled, loading, error, and empty states.
- Upload and generation status changes are announced to assistive technology.

## Initial data

- Rectangular UV print: active, hidden SVG disabled.
- Round UV print: active, hidden SVG disabled.
- Contour laser engraved: active, hidden SVG enabled.
