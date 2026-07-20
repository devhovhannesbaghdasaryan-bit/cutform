# Move per-item laser engraving styles into boilerplates, with percentage price adjustment

**Date:** 2026-07-20
**Status:** Approved, ready for planning

## Problem

Commit `20c610a5` ("Add per-item laser-on-glass engraving styles (contour + solid)")
added a bespoke, per-item feature to `catalog_items`: four columns
(`laser_contour_enabled`, `laser_solid_enabled`, `laser_solid_price_cents`,
`laser_solid_prompt`), dedicated admin UI (`engraving-fields.tsx`), a separate
`engravingInstruction` prompt channel, and generation/pricing logic that fans a
single generation out into one preview per enabled style.

This duplicates what the existing **boilerplate** system already does. A
boilerplate is a shared, reusable reference image with its own
`generation_instruction`, `manufacturing_process`, and OpenAI file, attached to
items via `catalog_item_boilerplates`. "Contour" and "Solid" are naturally just
two boilerplates.

## Goal

1. **Remove** the per-item laser engraving feature entirely (revert the schema
   columns and all bespoke code from commit `20c610a5`).
2. **Represent** the two styles as ordinary boilerplates ("Solid" and "Contour"),
   created by an admin after deploy — no code needed beyond what boilerplates
   already support.
3. **Add** one new capability to boilerplates that the styles need: an optional
   **percentage** price adjustment applied to the item's base price when that
   boilerplate is selected during generation.

## Decisions (settled during brainstorming)

- **Price semantics:** the adjustment is a **delta applied to the item's base
  price**, expressed as a **percentage** (not an absolute price override, not a
  flat cent delta).
- **Sign:** any integer, positive or negative. Surcharges (`+20`) and discounts
  (`-15`) both allowed. Final price is floored at `0`.
- **Precision:** **integer** percent (no decimals). `numeric` is a future change
  if fractional percents are ever needed.
- **Optional:** the field is nullable; `null` means no adjustment (base price).
- **Customer display:** the generation results page shows the **computed final
  price** per selected boilerplate option and sums the selection into a Total.
  The customer sees money, never the raw percentage.
- **No production backfill.** Dropping the laser columns removes that behavior
  from any item currently using it. (MCP was unavailable mid-session, so
  verifying whether any live item has the flags set is a manual pre-deploy step.)

## Formula

At generation time, per selected boilerplate:

```
final_cents = Math.max(0, Math.round(item.price_cents * (1 + pct / 100)))
```

where `pct = reference.price_adjustment_percent ?? 0`. The `Math.max(0, …)`
floor guards against a percent below `-100`. This value is stored on the preview
option's `metadata.unitPriceCents` (with `metadata.unitCurrency = item.currency`),
which the existing per-option pricing plumbing already consumes.

## Data model

### `catalog_items` — revert (forward-only migration)

Drop the four laser columns and their check constraint:

```sql
alter table "public"."catalog_items"
  drop constraint if exists "catalog_items_laser_solid_price_cents_check",
  drop column if exists "laser_contour_enabled",
  drop column if exists "laser_solid_enabled",
  drop column if exists "laser_solid_price_cents",
  drop column if exists "laser_solid_prompt";
```

### `personalization_boilerplates` — add one column

```sql
alter table "public"."personalization_boilerplates"
  add column "price_adjustment_percent" integer;
```

No sign constraint (discounts allowed). No default (`null` = no adjustment).

## Code changes

### Full revert of commit `20c610a5`

- **Delete** `app/admin/items/item-form/engraving-fields.tsx`.
- `app/admin/items/item-form/personalization-fields.tsx` — remove the
  `<EngravingFields>` usage and the widened `item` Pick.
- `app/admin/items/item-form/types.ts` — drop the four laser fields from the Pick.
- `lib/marketplace.ts` — drop the four laser fields from `CatalogItem` and
  `CATALOG_SELECT`.
- `app/admin/items/actions.ts` — remove the `validateEngravingConfig` import +
  calls and the four column writes in create/update.
- `app/admin/items/item-form-parsing.ts` — remove the laser schema fields and
  parsing, **delete** `validateEngravingConfig`, and revert
  `validatePersonalizationConfig` to its original three-condition check (drop the
  `laserSolidEnabled` branch; there is no "Solid requires Contour" coupling in
  the new world).
- `app/admin/items/[id]/page.tsx` — drop the four laser columns from the select.
- `app/items/[slug]/page.tsx` — drop the `item.laser_solid_enabled` condition
  from the customizable check.
- `app/personalize/[itemSlug]/page.tsx` — drop `item.laser_solid_enabled` from
  `hasUsablePersonalization`.
- `lib/personalization-ai.ts` + `tests/lib/personalization-ai.test.ts` — remove
  the `engravingInstruction` field entirely. A boilerplate's existing
  `generation_instruction` already provides the per-style prompt once Solid and
  Contour become real boilerplates.
- `messages/{en,am,ru}.json` — remove the `laserStyle` keys. **Keep** the `total`
  key (generic, still used by the per-option total display).
- `app/personalize/actions.ts` — remove `ActiveEngravingStyle`,
  `buildActiveEngravingStyles`, the laser select columns, the
  `laser_solid_enabled` fallback in the coming-soon guard, the `laserStyles`
  metadata written to the generated item, and the
  `creditCost = callTargets.length * activeStyles.length` math.

### Generalized (kept from the commit, repointed to boilerplates)

- **Credit cost** reverts to the pre-commit `Math.max(callTargets.length, 1)`.
  Selecting both Solid and Contour boilerplates naturally costs 2 credits, like
  any two boilerplates. No special-casing.
- **Per-option pricing plumbing** added by the commit is already
  boilerplate-agnostic (it never names "engraving"). Kept as-is:
  - `components/generated-preview-selector.tsx` — **no change**.
  - `app/generated/actions.ts` — **no change** (per-option currency conversion of
    `metadata.unitPriceCents` stays).
  - `lib/generated-items.ts` — drop only the `engravingLabel` fallback in the cart
    title (title becomes `boilerplateName ?? item.title`). Keep the per-option
    `pricing` support.
  - `app/generated/[id]/page.tsx` — drop the `engravingStyle`/`styleLabel`
    composition; the label reverts to
    `boilerplate.name ?? metadata.boilerplateName ?? "Option N"`. Keep
    `priceCents` wired to `previewOptionPriceCents` /
    `metadata.unitPriceCents`.
- **`app/personalize/actions.ts`** — where the commit set
  `metadata.unitPriceCents`/`unitCurrency` from the engraving style, compute it
  per selected boilerplate from the new percentage field using the formula above.
  When no boilerplate is selected (the `[null]` call target), no adjustment
  applies and the option carries the base price.

### New — boilerplate percentage field

- `lib/personalization-boilerplates.ts` — add
  `price_adjustment_percent: number | null` to the `PersonalizationBoilerplate`
  interface and to the select string in `listCatalogItemBoilerplates`.
- `app/admin/personalization/boilerplates/actions.ts` — add
  `priceAdjustmentPercent: z.coerce.number().int().optional()` (any sign) to
  `boilerplateSchema`, parse `formData.get('priceAdjustmentPercent') || undefined`,
  and write `price_adjustment_percent: values.priceAdjustmentPercent ?? null` to
  the payload.
- `app/admin/personalization/boilerplates/page.tsx` — add an optional
  "Price adjustment (%)" number input to the boilerplate form, helper text:
  *"Optional. Adjusts this item's base price when this boilerplate is selected —
  e.g. 20 adds 20%, -10 takes off 10%."*
- `lib/supabase/database.types.ts` — regenerate/hand-edit: drop the four
  `catalog_items` laser fields, add `price_adjustment_percent: number | null` to
  the `personalization_boilerplates` Row/Insert/Update types.

## Migrations (two new forward-only files)

1. `<timestamp>_drop_laser_glass_engraving_styles.sql` — the `catalog_items`
   revert above.
2. `<timestamp>_boilerplate_price_adjustment_percent.sql` — the
   `personalization_boilerplates` add-column above.

Never edit the shipped `20260714120000_laser_glass_engraving_styles.sql`.

## Testing

- `tests/lib/personalization-ai.test.ts` — remove `engravingInstruction` from all
  cases (revert to pre-commit shape).
- Add a unit test for the percentage price formula (base × (1 + pct/100), rounded,
  floored at 0) — covering positive, negative, null, and below-`-100` percents.
- Run the full test suite and typecheck; regenerate types so the build passes.

## Rollout (manual, surfaced — not assumed done)

1. **Deploy the two migrations to prod Supabase and verify.** Per the recurring
   "migrations merge but don't reach prod" gap: diff `list_migrations` against the
   repo after merge.
2. **Pre-deploy check:** confirm whether any live `catalog_items` row has a laser
   flag set (no backfill, so that behavior is lost on drop). Couldn't be checked
   in-session (MCP down).
3. **Create the Solid and Contour boilerplates** via the admin UI after deploy:
   upload each reference image (populates the `NOT NULL` `openai_file_id`), write
   the `generation_instruction` (the old `DEFAULT_SOLID_ENGRAVING_PROMPT` text is a
   good starting point for Solid), set `price_adjustment_percent`, and attach them
   to the relevant items. A migration cannot do this (requires a real OpenAI file
   upload). Same shape as the existing OpenAI-boilerplate go-live task.

## Out of scope

- Fractional (decimal) percentages.
- Absolute price overrides.
- Any automated data migration from the old laser columns to new boilerplate rows.
