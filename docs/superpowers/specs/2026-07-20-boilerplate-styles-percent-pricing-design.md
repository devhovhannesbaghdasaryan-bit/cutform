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

### Full revert of the laser feature (commit `20c610a5` + later integrations)

> **Scope note:** later MCP-connector and AI-autogenerate commits wove the four
> laser fields into more places than the original commit. The catalog-item write
> path also moved from `app/admin/items/actions.ts` into
> `lib/catalog-items/core.ts`. The full set of touch points below reflects the
> **current** tree, verified by grepping `laser`/`engraving` across `app/`,
> `lib/`, `tests/`, `components/`.

**Admin item form (revert):**
- **Delete** `app/admin/items/item-form/engraving-fields.tsx`.
- `app/admin/items/item-form/personalization-fields.tsx` — remove the
  `EngravingFields` import, its `<EngravingFields item={item} />` usage, and the
  widened `item` Pick.
- `app/admin/items/item-form/types.ts` — drop the four laser fields from the Pick.
- `app/admin/items/item-form-parsing.ts` — remove the laser schema fields
  (`laserContourEnabled`, `laserSolidEnabled`, `laserSolidPriceCents`,
  `laserSolidPrompt`) from `itemSchema`, remove them from `parseItemForm`,
  **delete** `validateEngravingConfig`, and revert `validatePersonalizationConfig`
  to its three-condition check (drop the `laserSolidEnabled` branch — no "Solid
  requires Contour" coupling in the new world).
- `app/admin/items/[id]/page.tsx` — drop the four laser columns from the select
  string.

**Catalog-item write path (revert — now in `lib/catalog-items/core.ts`):**
- Remove the `validateEngravingConfig` import and its call in
  `validateItemAndParseSizes`.
- Remove the four `laser_*` keys from `toCatalogItemRow`.

**MCP tools (revert — added by the connector commit):**
- `lib/mcp/tools/create-catalog-item.ts` — remove the four `laser*: false/undefined`
  keys from the `item` object it builds.
- `lib/mcp/tools/get-catalog-item.ts` — remove the four laser columns from
  `CATALOG_ITEM_COLUMNS` and the four fields from the `CatalogItemSummary`
  interface.
- `lib/mcp/tools/update-catalog-item.ts` — remove the four
  `laser*: existing.laser_*` keys from the `item` object it builds.

**AI field autogenerate (revert):**
- `lib/item-ai-fields.ts` — remove the `laserSolidPrompt` entry from
  `CORE_FIELD_INSTRUCTIONS` (drops core field count 5 → 4).

**Catalog reads (revert):**
- `lib/marketplace.ts` — drop the four laser fields from `CatalogItem` and
  `CATALOG_SELECT`.
- `app/items/[slug]/page.tsx` — drop the `item.laser_solid_enabled` condition.
- `app/personalize/[itemSlug]/page.tsx` — drop `item.laser_solid_enabled` from
  `hasUsablePersonalization`.

**Prompt + generation action (revert laser, keep pricing plumbing):**
- `lib/personalization-ai.ts` — remove the `engravingInstruction` field from
  `PersonalizationPromptInput` and from the `parts` array in
  `composePersonalizationPrompt`. A boilerplate's existing
  `generation_instruction` provides the per-style prompt once Solid and Contour
  become real boilerplates.
- `app/personalize/actions.ts` — remove the `LaserEngravingStyle` /
  `DEFAULT_SOLID_ENGRAVING_PROMPT` imports, `ActiveEngravingStyle`,
  `buildActiveEngravingStyles`, the four laser select columns, the
  `laser_solid_enabled` fallback in the coming-soon guard, the `laserStyles`
  metadata on the generated item, the nested engraving loop, and the
  `creditCost = callTargets.length * activeStyles.length` math.
- `lib/personalization-constants.ts` — remove `LASER_ENGRAVING_STYLES`,
  `LaserEngravingStyle`, and `DEFAULT_SOLID_ENGRAVING_PROMPT`.

**Results display (revert laser, keep per-option price):**
- `app/generated/[id]/page.tsx` — remove the `engravingStyle`/`styleLabel`
  composition; label reverts to
  `boilerplate.name ?? metadata.boilerplateName ?? "Option N"`. Keep `priceCents`
  wired to `previewOptionPriceCents` / `metadata.unitPriceCents`. Keep the
  `tDynamic` import (still used for product type, review status, color).
- `lib/generated-items.ts` — remove the `engravingLabel` fallback in the cart
  title (title becomes `boilerplateName ?? item.title`). Keep the per-option
  `pricing` support.
- `components/generated-preview-selector.tsx` — **no change** (already generic).
- `app/generated/actions.ts` — **no change** (per-option currency conversion of
  `metadata.unitPriceCents` stays; the one comment naming "Solid engraving" may be
  tidied but is not required).

**Translations:**
- `messages/{en,am,ru}.json` — remove the `generated.laserStyle` keys. **Keep**
  the `generated.total` key (generic, used by the per-option total display).

**Tests (revert laser fixtures):**
- `tests/lib/personalization-ai.test.ts` — remove `engravingInstruction` from all
  cases and delete the "inserts the engraving instruction" test.
- `tests/lib/catalog-items/core.test.ts` — remove the four laser fields from the
  `baseItem` fixture.
- `tests/lib/mcp/tools/update-catalog-item.test.ts` — remove the four laser fields
  from the `EXISTING` fixture, from the `toMatchObject` assertion, and the
  `laser_solid_enabled: false` override.
- `tests/lib/item-ai.test.ts` — update the count test: 4 core fields, total 19,
  remove `laserSolidPrompt` from the `arrayContaining` list.

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
  interface and to the select string in `listCatalogItemBoilerplates`. Add a
  pure helper `adjustedPriceCents(baseCents: number, pct: number | null): number`
  implementing the formula (the single home for the pricing math; unit-tested and
  consumed by `app/personalize/actions.ts`).
- `app/admin/personalization/boilerplates/actions.ts` — add
  `priceAdjustmentPercent: z.coerce.number().int().optional()` (any sign) to
  `boilerplateSchema`, parse `formData.get('priceAdjustmentPercent') || undefined`,
  and write `price_adjustment_percent: values.priceAdjustmentPercent ?? null` to
  the payload. Add `price_adjustment_percent` to the two existing
  `.select('openai_file_id, …')` reads only if needed (not needed — they select
  specific columns for file cleanup, untouched).
- `app/admin/personalization/boilerplates/page.tsx` — add `price_adjustment_percent`
  to the page's `personalization_boilerplates` select string, and add an optional
  "Price adjustment (%)" number input to the boilerplate form using new i18n keys
  `personalization.priceAdjustmentPercent` (label) and
  `personalization.priceAdjustmentHelp` (help text: *"Optional. Adjusts this
  item's base price when this boilerplate is selected — e.g. 20 adds 20%, -10
  takes off 10%."*), added to `messages/{en,am,ru}.json`.
- `app/personalize/actions.ts` — where the option's `metadata.unitPriceCents` /
  `unitCurrency` are set, compute `unitPriceCents = adjustedPriceCents(item.price_cents,
  reference?.price_adjustment_percent ?? null)` and `unitCurrency = item.currency`
  per selected boilerplate (`reference` is `null` when no boilerplate is selected
  → base price, no adjustment).
- `lib/supabase/database.types.ts` — add `price_adjustment_percent: number | null`
  to the `personalization_boilerplates` Row/Insert/Update types (additive, done
  early), and drop the four `catalog_items` laser fields (done last, after all
  usages are gone). Canonical regeneration is `pnpm db:types` against a running
  local Supabase; hand-editing is acceptable given the edits are small and exact.

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
