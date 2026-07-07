# Generic Item Personalization — Design

**Date:** 2026-07-07
**Status:** Approved for planning

## Problem

Today, AI-driven personalization ("night-lights") is a completely separate
system from the catalog: `personalization_models` is keyed by
category/subcategory, not by `catalog_items`, and `catalog_items.is_customizable`
is a cosmetic-only flag with zero behavioral wiring (it renders a badge and
nothing else — see `app/items/[slug]/page.tsx:121-126`,
`components/catalog-item-card.tsx:68-73`). There is no way to make an
arbitrary catalog item personalizable, no tag system to control *what* can be
personalized (color/text/photo), and boilerplates belong to exactly one
personalization model instead of being reusable.

## Goal

Replace the night-lights-specific personalization system with a generic,
per-catalog-item personalization engine:

- Any catalog item can be made customizable via admin config (System Prompt
  and/or Skill ID and/or attached boilerplates).
- A predefined tag system (`personal_color`, `personal_text`, `personal_photo`)
  controls which input widgets appear on the customer-facing personalize page.
- Boilerplates become a shared, reusable library (many-to-many with items)
  instead of belonging to one model.
- Price/credit mechanics and the generation loop reuse the night-lights
  pattern (1 credit per selected boilerplate; one OpenAI generation call per
  selected boilerplate).
- Night-lights itself migrates onto this generic system — the old
  model/boilerplate-per-category system is deleted, not kept alongside.

No backfill: per the user's explicit instruction, existing data (including
`personalization_models` and today's `personalization_boilerplates` rows) is
not preserved. The migration recreates schema from scratch, same pattern as
[[openai-boilerplate-golive-pending]].

## Key decisions (settled with the user)

1. **`skillId` is an opaque reference to an OpenAI Assistant/Skill resource.**
   For this round, it is only stored/selected — generation actually *calling*
   a skill is out of scope and deferred. Items configured with only a
   `skill_id` (no `system_prompt`, no boilerplates) still show the
   "Personalize with AI" button; the generation action returns a friendly
   "personalization isn't available for this item yet" error instead of
   attempting a call.
2. **Full replace, not additive.** `personalization_models`, the
   `/personalize/[slug]`-by-model-slug route, and
   `/admin/personalization/night-lights` are deleted outright. Night-lights
   becomes just another catalog item using the new generic fields.
3. **Boilerplates are a shared many-to-many pool**, managed from a dedicated
   admin library page, attached to items via a join table. Editing a
   boilerplate from "whichever item has it open" would be confusing once
   reused across items — a single library page is the source of truth.
4. **Tags stored as `catalog_items.tags text[]`** with a `CHECK` constraint
   over the predefined set, not a separate `tags`/join-table pair. Each tag's
   *behavior* (which input widget it unlocks) is hardcoded in app logic
   regardless of storage shape, so a fully relational tags table buys no real
   extensibility — it's the same pattern already used for `item_type_check`.
5. **Credit/price model mirrors night-lights exactly:** credit cost = number
   of selected boilerplates (minimum 1 if the item has none configured).
   Color and text selections never add cost. Cash sale price is the item's
   existing `price_cents` — no more duplicating price into a jsonb blob like
   the old `form_schema.basePriceCents`.
6. **Personal Color palette is the existing fixed global palette** (5 named
   LED colors) reused as-is, not per-item configurable.
7. **Personal Text is real rich text** (bold/italic/underline captured and
   passed to the generation prompt as styling instructions), not plain text.
8. **Boilerplate selection is mandatory when boilerplates exist.** If an item
   has ≥1 configured boilerplate, the customer must select ≥1 to generate. If
   an item has zero boilerplates (relying on `system_prompt`/`skill_id`
   alone), the personalize page skips boilerplate selection entirely and
   generation is a single call.
9. **Customer photo upload is tag-gated**, not implicit. A new predefined tag,
   `personal_photo`, controls whether the photo uploader appears — it is not
   automatically present just because an item is customizable.

## Data model

Squashed into the existing baseline migration (`supabase/migrations/0001_init.sql`),
no backfill:

### `catalog_items` — new columns

```
system_prompt text                -- nullable
skill_id text                     -- nullable, opaque OpenAI Assistant/Skill reference
tags text[] not null default '{}' -- CHECK: every element in
                                   -- ('personal_color','personal_text','personal_photo')
```

`is_customizable` stays as-is — it remains the explicit admin-facing gate
("check this box to reveal personalization config"), it does not get
inferred from the presence of the other fields.

**Cross-field validation** (application-level, in
`createCatalogItemAction`/`updateCatalogItemAction`): if `is_customizable` is
true, require at least one of: `system_prompt` non-empty, `skill_id`
non-empty, ≥1 attached boilerplate. Reject the save with an inline form error
otherwise. `tags` has no such requirement — a customizable item may have zero
tags (boilerplate-only styling, no color/text/photo input).

### `personalization_boilerplates` — redesigned as a shared library

```
id uuid primary key
name text not null
image_path text not null
openai_file_id text not null
generation_instruction text not null default ''
manufacturing_process text not null default ''
generate_hidden_svg boolean not null default false
is_active boolean not null default true
sort_order integer not null default 0
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Drops `model_id` (no more FK to a model), collapses the three localized
`name_en/name_hy/name_ru` + `admin_name` columns into one `name` — localized
per-boilerplate names existed to serve the model-scoped night-lights UI, which
no longer applies once boilerplates are a shared library referenced generically
by name only.

### New table: `catalog_item_boilerplates`

```
catalog_item_id uuid not null references catalog_items(id) on delete cascade
boilerplate_id uuid not null references personalization_boilerplates(id) on delete cascade
sort_order integer not null default 0
primary key (catalog_item_id, boilerplate_id)
```

### `generated_items` — new column

```
catalog_item_id uuid references catalog_items(id) on delete set null
```

Replaces the model-based linkage. `product_type` is populated by copying the
item's `item_type` at generation time — no new enum value needed since
`item_type_check` already includes `personalized_night_light`, which
night-light items keep after migration (their manufacturing-specific
behavior on the results page stays keyed on this same value).

### Dropped entirely

- `personalization_models` table (and its FKs from
  `personalization_boilerplates.model_id`).
- Seed/reference data tied to the old model-per-category shape.

## Components

### Admin: item form (`app/admin/items/item-form/`)

The existing `FlagsFields` "Customizable" checkbox is unchanged in position;
checking it reveals a new `PersonalizationFields` block:

- **System Prompt** — textarea, optional.
- **Skill ID** — text input, optional.
- **Boilerplates** — multi-select checkbox grid with thumbnails, sourced from
  the shared library (`personalization_boilerplates` where `is_active`);
  selections write `catalog_item_boilerplates` join rows on save (diffed:
  insert new selections, delete removed ones).
- **Tags** — checkbox group over the 3 predefined tags
  (`personal_color`, `personal_text`, `personal_photo`).

`ItemFormValue` (`app/admin/items/item-form/types.ts`) gains `systemPrompt`,
`skillId`, `tags`, `boilerplateIds`. `createCatalogItemAction`/
`updateCatalogItemAction` (`app/admin/items/actions.ts`) map these to the new
columns/join rows and run the cross-field validation described above.

### Admin: boilerplate library (`/admin/personalization/boilerplates`)

Replaces `/admin/personalization/night-lights`. Flat CRUD list, same
upload-order guarantee as today (OpenAI file upload first — fail-fast, no
partial saves; see [[openai-boilerplate-golive-pending]]):

- **Create:** upload image to OpenAI (`uploadReferenceImage`) → upload to
  Supabase Storage (`catalog-assets` bucket) → insert row with both
  `openai_file_id` and `image_path`. OpenAI upload failure aborts the save,
  nothing persisted.
- **Edit with new image:** upload new file to OpenAI → update row → best-effort
  delete the old OpenAI file (`deleteReferenceFile`).
- **Edit without image change:** no OpenAI calls.
- **Delete:** remove row → best-effort delete the OpenAI file.

Fields: `name`, image, `generation_instruction`, `manufacturing_process`,
`generate_hidden_svg`, `is_active`, `sort_order`. No UI here manages
`catalog_item_boilerplates` join rows directly — attachment is driven
entirely from each item's form.

### Storefront: item detail page (`app/items/[slug]/page.tsx`)

Where `is_customizable` currently renders only a cosmetic badge, add a
"Personalize with AI" button (visible whenever `is_customizable` is true,
regardless of which config fields are populated — per decision #1, skill-only
items still show the button) linking to `/personalize/[itemSlug]`.

### Storefront: personalize page (`app/personalize/[itemSlug]/page.tsx`)

Replaces the model-slug-keyed `app/personalize/[slug]/page.tsx`. Server
component loads the `catalog_items` row (must be `is_customizable` and
published) plus its joined boilerplates (via `catalog_item_boilerplates`,
`is_active` only), and renders `<PersonalizeItemForm item boilerplates />`
(client component, replacing `PersonalizedNightLightForm`) if the customer is
logged in, else a sign-in CTA (unchanged pattern).

Layout: left = item preview (reuse existing catalog item image display),
right = form:

1. **Boilerplate grid** (checkbox tiles) — shown whenever the item has ≥1
   boilerplate; submit disabled until ≥1 selected. Hidden entirely if the
   item has zero boilerplates.
2. **`personal_photo` tag** → photo uploader, max 1 image (matches
   night-lights' `maxImages: 1`).
3. **`personal_color` tag** → the existing fixed 5-swatch palette
   (`comfortableLedColors` from `lib/marketplace-constants.ts`, relocated to
   a product-agnostic constants file, e.g. `lib/personalization-constants.ts`).
4. **`personal_text` tag** → rich text editor (bold/italic/underline), 80-char
   cap, same as today's limit.
5. Sticky footer credit counter: `N credits` where `N = max(selectedBoilerplateCount, 1)`
   if the item has any boilerplates, else a flat `1 credit`. Same
   insufficient-credits modal linking to `/credits`.

### Generation action (`app/personalize/actions.ts`)

`generatePersonalizedItemAction` replaces
`generatePersonalizedNightLightAction`:

1. Load the `catalog_items` row (`is_customizable`, published) and the
   selected boilerplates (must be in `catalog_item_boilerplates` for this
   item, `is_active`).
2. Validate: if item has ≥1 configured boilerplate, require ≥1 selected. If
   the item has neither `system_prompt` nor any boilerplates (i.e. relies
   solely on `skill_id`), return the friendly "not available yet" error
   immediately — no credit debit.
3. `creditCost = max(selectedBoilerplates.length, 1)`; debit before
   generating, refund on any failure (unchanged pattern from
   `lib/credits.ts`).
4. If `personal_photo` tag present and a file was submitted, upload it to the
   `user-uploads` Supabase Storage bucket (unchanged pattern).
5. **Generic prompt composition** (`lib/personalization-ai.ts`, replacing
   `lib/personalized-night-light-ai.ts`'s hardcoded
   `buildPersonalizedNightLightPrompt`):
   ```
   [
     item.system_prompt,
     boilerplate.generation_instruction,      // per call, for the current boilerplate
     personal_text ? `Personalized text: ${text} (styling: ${formattingDescription})` : null,
     personal_color ? `Use color: ${label} ${hex}` : null,
     personal_photo ? `User photo attached as subject reference.` : null,
   ].filter(Boolean).join('\n\n')
   ```
   No product-specific domain language (acrylic/LED/wood-engraving rules) is
   hardcoded in TypeScript anymore — that content becomes the admin-authored
   `system_prompt` value for whichever item needs it. Night-lights' current
   prompt text becomes the seed value pasted into the night-light item's
   System Prompt field during post-deploy reconfiguration.
6. Loop per selected boilerplate (or once, with no `referenceFileId`, if the
   item has none): call `generateOpenAiImage` with the composed prompt +
   `referenceFileId: boilerplate.openai_file_id` + the uploaded photo as an
   input image (unchanged `lib/openai-image.ts` signature).
7. Insert one `generated_items` row (`catalog_item_id` FK, `product_type`
   copied from `catalog_items.item_type`) + one `personalized_preview_options`
   row per generated preview (unchanged pattern).
8. Redirect to `/generated/[id]`.

### Results page (`app/generated/[id]/page.tsx`)

Joins through `catalog_item_id` (instead of the old model linkage) for title,
thumbnail, and price. `salePriceCents` is read directly from the joined
`catalog_items.price_cents` — the `generation_options.salePriceCents` jsonb
duplication is removed. Existing `product_type === 'personalized_night_light'`
branches (SVG/wood-engraving-specific rendering) are unchanged, since
night-light items retain that `item_type` after migration.

## Rollout note

After this migration deploys, the night-light catalog item(s) will have
`is_customizable = true` but empty `system_prompt`/boilerplates/tags until an
admin manually reconfigures them through the new admin UI — personalization
for night-lights is **broken** between deploy and that reconfiguration. This
follows the same shape as the existing [[openai-boilerplate-golive-pending]]
and [[ameriabank-golive-pending]] gates: flag to the user before merging that
the admin recreation step (system prompt + boilerplates + tags on the
night-light item) must happen immediately after deploy, not sit
deployed-but-broken.

## Error handling

- **Admin item save:** cross-field validation (System Prompt/Skill ID/≥1
  boilerplate requirement when `is_customizable`) surfaces as an inline form
  error, save is rejected — not silently accepted.
- **Admin boilerplate save:** unchanged fail-fast-before-persist pattern
  (OpenAI upload errors abort the save).
- **File deletes:** best-effort, logged, never thrown (unchanged).
- **Generation:** credit debit-then-refund-on-failure (unchanged); skill-only
  items short-circuit before debiting credits with a friendly "personalization
  isn't available for this item yet" message; other failures map through a
  generalized `friendlyGenerationError` (night-light-specific wording removed).

## Testing

- Extend `scripts/smoke/*.mjs` (`ui-workflows.mjs`, `generation.mjs`,
  `catalog-media.mjs` — already touched per current working tree) to cover:
  - Admin boilerplate library CRUD (create/edit/delete, OpenAI upload
    ordering).
  - Admin item-form validation: reject save when `is_customizable` is checked
    with no System Prompt / Skill ID / boilerplate.
  - Full personalize → generate → results smoke path against a mocked OpenAI
    client, covering both the with-boilerplates loop and the
    zero-boilerplates single-call path.
- Manual QA after deploy: reconfigure the night-light item via admin
  (exercises the new form + boilerplate library), run one real generation
  end-to-end (exercises the generic prompt composition + file-id path).

## Out of scope (explicitly deferred)

- Actually calling out to an OpenAI Assistant/Skill resource via `skill_id`
  at generation time. This round only stores/selects it.
- Any tag beyond the 3 predefined ones (`personal_color`, `personal_text`,
  `personal_photo`) — adding a new tag requires both a migration (CHECK
  constraint update) and new UI/prompt-composition code, so this is not
  designed as an admin-extensible list.
