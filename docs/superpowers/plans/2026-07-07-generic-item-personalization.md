# Generic Item Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the night-lights-specific personalization system (`personalization_models` + `/personalize/[slug]`) with a generic, per-catalog-item personalization engine driven by admin-configured System Prompt/Skill ID/boilerplates and a predefined tag system (`personal_color`, `personal_text`, `personal_photo`).

**Architecture:** `catalog_items` gains `system_prompt`, `skill_id`, and a `tags text[]` column; boilerplates become a shared library (`personalization_boilerplates`, no longer owned by a model) attached to items via a new `catalog_item_boilerplates` join table. The customer-facing `/personalize/[itemSlug]` flow and its generation action reuse the night-lights credit-per-boilerplate mechanic generically, composing the AI prompt from the item's System Prompt + boilerplate instruction + tag-driven inputs instead of a hardcoded night-light prompt.

**Tech Stack:** Next.js App Router (server actions), Supabase (Postgres + RLS + Storage), `openai` npm SDK (Responses API, File Storage), Zod, next-intl, Vitest.

## Global Constraints

- No backfill: this is dev-stage data: "Do not worry about current data. We can recreate DB from scratch." Existing `personalization_boilerplates` rows and the seeded `personalization_models` row are dropped, not migrated.
- Full replace, not additive: `personalization_models`, `/admin/personalization/night-lights`, `/personalize/[slug]`, `/catalog/night-lights/personalized`, and `lib/personalized-night-light-ai.ts` are deleted, not kept alongside the new system.
- `skill_id` is stored/selected only in this round; actually calling out to an OpenAI Assistant/Skill resource is explicitly out of scope (deferred follow-up).
- Credit cost = number of selected boilerplates, minimum 1 if the item has none configured. Color and text selections never add cost.
- Personal Color uses the existing fixed 5-swatch palette; no per-item configurability.
- Migrations for this repo are added as new timestamped files under `supabase/migrations/`, never by hand-editing `supabase/migrations/0001_init.sql` (see `docs/superpowers/specs/2026-07-07-generic-item-personalization-design.md`).
- Follow existing action-state conventions (`lib/action-state.ts`) for form-rendering admin actions; imperative flows that redirect (checkout-style) keep throwing.

---

### Task 1: Database migration — schema, RLS, and type regeneration

**Files:**
- Create: `supabase/migrations/20260707140000_generic_item_personalization.sql`
- Modify: `supabase/seed.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated, not hand-edited)

**Interfaces:**
- Produces: `catalog_items.system_prompt text`, `catalog_items.skill_id text`, `catalog_items.tags text[]`; `catalog_item_boilerplates(catalog_item_id, boilerplate_id, sort_order)`; `personalization_boilerplates` with columns `id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order, created_at, updated_at` (no `model_id`); `generated_items.catalog_item_id uuid`; `generated_items.product_type` CHECK now also allows `'standard'`; `personalization_models` table dropped.

- [ ] **Step 1: Write the migration file**

```sql
-- Generic per-catalog-item personalization: replaces the night-lights-specific
-- personalization_models system. No backfill (dev-stage data; admin
-- reconfigures affected items after deploy per
-- docs/superpowers/specs/2026-07-07-generic-item-personalization-design.md).

alter table "public"."catalog_items"
  add column "system_prompt" text,
  add column "skill_id" text,
  add column "tags" text[] not null default '{}'::text[];

alter table "public"."catalog_items"
  add constraint "catalog_items_tags_check"
  check (tags <@ ARRAY['personal_color', 'personal_text', 'personal_photo']::text[]);

alter table "public"."generated_items"
  add column "catalog_item_id" uuid references public.catalog_items(id) on delete set null;

alter table "public"."generated_items" drop constraint "generated_items_product_type_check";
alter table "public"."generated_items" add constraint "generated_items_product_type_check"
  check ((product_type = ANY (ARRAY['night_light'::text, 'personalized_night_light'::text, 'laser_cut_2d_toy'::text, 'laser_cut_2d_decoration'::text, 'laser_cut_2d_constructor'::text, 'banner'::text, 'standard'::text])));

-- Boilerplates become a shared library: drop per-model ownership and the
-- localized-name columns that only made sense scoped to one model's UI.
-- No backfill — existing rows (night-lights seed data) are discarded.
delete from public.personalization_boilerplates;

-- Must drop this policy before dropping model_id: its USING clause
-- references personalization_boilerplates.model_id, which blocks the
-- column drop below otherwise. The replacement policy (readable whenever
-- active, no model gating) is created further down, once
-- personalization_models is gone.
drop policy "customers read active personalization boilerplates" on "public"."personalization_boilerplates";

alter table "public"."personalization_boilerplates"
  drop constraint "personalization_boilerplates_model_id_fkey",
  drop constraint "personalization_boilerplates_model_id_admin_name_key";

alter table "public"."personalization_boilerplates"
  drop column "model_id",
  drop column "name_en",
  drop column "name_hy",
  drop column "name_ru";

alter table "public"."personalization_boilerplates"
  rename column "admin_name" to "name";

alter table "public"."personalization_boilerplates"
  add constraint "personalization_boilerplates_name_key" unique ("name");

create table "public"."catalog_item_boilerplates" (
  "catalog_item_id" uuid not null references public.catalog_items(id) on delete cascade,
  "boilerplate_id" uuid not null references public.personalization_boilerplates(id) on delete cascade,
  "sort_order" integer not null default 0,
  primary key ("catalog_item_id", "boilerplate_id")
);

alter table "public"."catalog_item_boilerplates" enable row level security;

drop table "public"."personalization_models" cascade;

-- Boilerplates are no longer gated by a model's published status; the shared
-- library is readable whenever active, same as any other catalog asset.
create policy "customers read active personalization boilerplates"
  on "public"."personalization_boilerplates"
  as permissive
  for select
  to anon, authenticated
  using (is_active);

create policy "admins manage catalog item boilerplates"
  on "public"."catalog_item_boilerplates"
  as permissive
  for all
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

create policy "public reads catalog item boilerplates for published items"
  on "public"."catalog_item_boilerplates"
  as permissive
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.catalog_items
      where catalog_items.id = catalog_item_boilerplates.catalog_item_id
        and (catalog_items.status = 'published' or private.is_admin((select auth.uid())))
    )
  );

grant delete, insert, references, select, trigger, truncate, update
  on table "public"."catalog_item_boilerplates" to "anon";
grant delete, insert, references, select, trigger, truncate, update
  on table "public"."catalog_item_boilerplates" to "authenticated";
grant delete, insert, references, select, trigger, truncate, update
  on table "public"."catalog_item_boilerplates" to "service_role";
```

- [ ] **Step 2: Update `supabase/seed.sql` to match the new boilerplate shape**

`supabase/seed.sql` runs automatically after migrations on every `supabase db reset` (per `supabase/config.toml`'s `[db.seed] sql_paths`). It currently inserts a `personalization_models` row and three model-scoped `personalization_boilerplates` rows (with `model_id`, `admin_name`, `name_en`/`name_hy`/`name_ru`) — all incompatible with this migration's schema, so `supabase db reset` fails at the seed step otherwise. Rewrite it to seed the same three real, already-uploaded OpenAI file ids directly into the new shared-library shape (no `model_id`, `name` instead of `admin_name`, upsert on the new `personalization_boilerplates_name_key` unique constraint):

Replace the entire contents of `supabase/seed.sql` with:

```sql
-- Local dev seed: personalization boilerplates wired to already-uploaded
-- OpenAI file ids, so a fresh `supabase db reset` produces attachable
-- boilerplates without a live OPENAI_API_KEY. Runs automatically per
-- supabase/config.toml's [db.seed] sql_paths = ["./seed.sql"].
-- Safe to re-run: upserts by name.
--
-- Boilerplates are a shared library (see catalog_item_boilerplates) —
-- attach any of these to a customizable catalog item from the item form
-- (/admin/items) once it has boilerplates selected there.

insert into public.personalization_boilerplates (
  name, image_path, openai_file_id, manufacturing_process, generation_instruction,
  generate_hidden_svg, is_active, sort_order
) values
  (
    'Rectangular UV print',
    '/product-references/night-lights/rectangular-uv-print.jpg', 'file-SvvFVqDiSzBCNZVy8M96Dg',
    'rectangular UV-printed acrylic',
    'Preserve the rectangular panel and base and create an elegant full-color keepsake.',
    false, true, 10
  ),
  (
    'Round UV print',
    '/product-references/night-lights/round-uv-print.jpg', 'file-HzYrHR6cyMgU1BukvkmMkw',
    'round UV-printed acrylic',
    'Preserve the circular panel and round base and balance the artwork inside the circle.',
    false, true, 20
  ),
  (
    'Contour laser engraved',
    '/product-references/night-lights/contour-laser-engraved.jpg', 'file-H18ukJkpJx9SC5zLzFdXhL',
    'contour-cut CO2-laser-engraved acrylic',
    'Derive a simple outer silhouette and render the subject as monochrome engraved vector line art.',
    true, true, 30
  )
on conflict (name) do update set
  image_path = excluded.image_path,
  openai_file_id = excluded.openai_file_id,
  manufacturing_process = excluded.manufacturing_process,
  generation_instruction = excluded.generation_instruction,
  generate_hidden_svg = excluded.generate_hidden_svg,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
```

- [ ] **Step 3: Apply the migration locally**

Run: `supabase start` (if not already running), then `supabase db reset`
Expected: output ends with `Finished supabase db reset` and no SQL errors. This re-applies `0001_init.sql` (whose `personalization_models` seed insert is harmless — the row is immediately dropped by this migration's `drop table ... cascade`), then the new migration, then the updated `supabase/seed.sql`.

- [ ] **Step 4: Verify the schema changes**

Run: `docker exec supabase_db_uniqraft psql -U postgres -d postgres -c "\d catalog_items"`
Expected: output includes `system_prompt`, `skill_id`, and `tags` rows.

Run: `docker exec supabase_db_uniqraft psql -U postgres -d postgres -c "\d catalog_item_boilerplates"`
Expected: table exists with `catalog_item_id`, `boilerplate_id`, `sort_order` columns.

Run: `docker exec supabase_db_uniqraft psql -U postgres -d postgres -c "\d personalization_models"`
Expected: `Did not find any relation named "personalization_models".`

Run: `docker exec supabase_db_uniqraft psql -U postgres -d postgres -c "\d personalization_boilerplates"`
Expected: output includes `name` (not `admin_name`/`name_en`/`name_hy`/`name_ru`/`model_id`).

- [ ] **Step 5: Regenerate TypeScript types**

Run: `pnpm db:types`
Expected: `lib/supabase/database.types.ts` is rewritten. Confirm with a search: it should contain `system_prompt` and `catalog_item_boilerplates` and should NOT contain `personalization_models`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260707140000_generic_item_personalization.sql supabase/seed.sql lib/supabase/database.types.ts
git commit -m "feat(db): add generic per-item personalization schema"
```

---

### Task 2: Backend swap — lib rewrites, generation engine, results page, delete legacy routes

**Files:**
- Create: `lib/personalization-constants.ts`
- Create: `lib/personalization-ai.ts`
- Create: `tests/lib/personalization-ai.test.ts`
- Create: `tests/lib/marketplace-constants.test.ts`
- Modify: `lib/personalization-boilerplates.ts` (rewrite)
- Modify: `lib/marketplace-constants.ts`
- Modify: `lib/marketplace.ts`
- Modify: `lib/generated-items.ts`
- Modify: `lib/openai-image.ts`
- Modify: `tests/lib/openai-image.test.ts`
- Modify: `app/personalize/form-parsing.ts` (rewrite)
- Modify: `app/personalize/actions.ts` (rewrite)
- Modify: `app/generated/[id]/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`, `messages/am.json`
- Delete: `lib/personalized-night-light-ai.ts`
- Delete: `tests/lib/personalized-night-light-ai.test.ts`
- Delete: `app/personalize/[slug]/page.tsx`
- Delete: `components/personalized-night-light-form.tsx`
- Delete: `app/catalog/night-lights/personalized/page.tsx`

**Interfaces:**
- Consumes: `Tables<'catalog_items'>`, `Tables<'personalization_boilerplates'>`, `Tables<'catalog_item_boilerplates'>` from `lib/supabase/types` (Task 1's regenerated types); `getOpenAiClient` (`lib/openai-client.ts`), `debitCredits`/`refundCredits`/`getCreditBalance` (`lib/credits.ts`), `createGeneratedItem`/`createPersonalizedPreviewOptions` (`lib/generated-items.ts`), `uploadToBucket` (`lib/storage.ts`).
- Produces: `PersonalizationBoilerplate` type and `listCatalogItemBoilerplates(supabase, catalogItemId)` (`lib/personalization-boilerplates.ts`); `PERSONALIZATION_TAGS`, `PersonalizationTag`, `COMFORTABLE_COLORS`, `DEFAULT_COLOR_VALUE`, `MAX_PERSONALIZED_TEXT_LENGTH`, `MAX_PERSONALIZED_PHOTOS` (`lib/personalization-constants.ts`); `composePersonalizationPrompt(input)`, `friendlyGenerationError(error)` (`lib/personalization-ai.ts`); `mapCatalogItemTypeToProductType(itemType)` (`lib/marketplace-constants.ts`); `generatePersonalizedItemAction(prevState, formData)` returning `PersonalizedGenerationState` (`app/personalize/actions.ts`) — consumed by Task 5's `PersonalizeItemForm`; `CatalogItem` gains `system_prompt`, `skill_id`, `tags` (`lib/marketplace.ts`) — consumed by Tasks 4 and 5.

- [ ] **Step 1: Delete the legacy night-lights-specific files**

```bash
git rm app/personalize/\[slug\]/page.tsx components/personalized-night-light-form.tsx app/catalog/night-lights/personalized/page.tsx lib/personalized-night-light-ai.ts tests/lib/personalized-night-light-ai.test.ts
```

- [ ] **Step 2: Create `lib/personalization-constants.ts`**

```ts
export const PERSONALIZATION_TAGS = ['personal_color', 'personal_text', 'personal_photo'] as const;
export type PersonalizationTag = (typeof PERSONALIZATION_TAGS)[number];

export const COMFORTABLE_COLORS = [
  { value: 'warm_white', label: 'Warm white', hex: '#f7d7a1' },
  { value: 'soft_amber', label: 'Soft amber', hex: '#f4bf73' },
  { value: 'soft_peach', label: 'Soft peach', hex: '#f5b49f' },
  { value: 'mint', label: 'Mint', hex: '#a8dbc2' },
  { value: 'sky_blue', label: 'Sky blue', hex: '#9fcaea' },
] as const;

export const DEFAULT_COLOR_VALUE = 'warm_white';
export const MAX_PERSONALIZED_TEXT_LENGTH = 80;
export const MAX_PERSONALIZED_PHOTOS = 1;
```

- [ ] **Step 3: Rewrite `lib/personalization-boilerplates.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersonalizationBoilerplate {
  id: string;
  name: string;
  image_path: string;
  openai_file_id: string;
  manufacturing_process: string;
  generation_instruction: string;
  generate_hidden_svg: boolean;
  is_active: boolean;
  sort_order: number;
}

interface CatalogItemBoilerplateRow {
  sort_order: number;
  boilerplate: PersonalizationBoilerplate | null;
}

/** Active boilerplates attached to a catalog item, in admin-configured order. */
export async function listCatalogItemBoilerplates(
  supabase: SupabaseClient,
  catalogItemId: string,
): Promise<PersonalizationBoilerplate[]> {
  const { data, error } = await supabase
    .from('catalog_item_boilerplates')
    .select(
      'sort_order, boilerplate:personalization_boilerplates(id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order)',
    )
    .eq('catalog_item_id', catalogItemId)
    .order('sort_order', { ascending: true })
    .returns<CatalogItemBoilerplateRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.boilerplate)
    .filter((boilerplate): boilerplate is PersonalizationBoilerplate =>
      Boolean(boilerplate?.is_active),
    );
}
```

- [ ] **Step 4: Write the failing test for the prompt composer**

Create `tests/lib/personalization-ai.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { composePersonalizationPrompt, friendlyGenerationError } from '@/lib/personalization-ai';

describe('composePersonalizationPrompt', () => {
  it('joins only the parts that are present', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: 'Base instructions.',
      boilerplateInstruction: null,
      personalizedText: null,
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe('Base instructions.');
  });

  it('includes boilerplate instruction, text with formatting, color, and photo note when all are present', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: 'Base instructions.',
      boilerplateInstruction: 'Rectangular UV-printed acrylic panel.',
      personalizedText: 'Happy Birthday',
      personalizedTextFormatting: 'bold emphasis, center aligned',
      colorLabel: 'Warm white',
      colorHex: '#f7d7a1',
      hasPhoto: true,
    });
    expect(prompt).toBe(
      [
        'Base instructions.',
        'Rectangular UV-printed acrylic panel.',
        'Personalized text: Happy Birthday (styling: bold emphasis, center aligned).',
        'Use color: Warm white (#f7d7a1).',
        'A user photo is attached as the subject reference; preserve its recognizable identity and defining features.',
      ].join('\n\n'),
    );
  });

  it('omits the formatting parenthetical when no formatting is given', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: null,
      boilerplateInstruction: null,
      personalizedText: 'Hello',
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe('Personalized text: Hello.');
  });

  it('returns an empty string when nothing is present', () => {
    const prompt = composePersonalizationPrompt({
      systemPrompt: null,
      boilerplateInstruction: null,
      personalizedText: null,
      personalizedTextFormatting: null,
      colorLabel: null,
      colorHex: null,
      hasPhoto: false,
    });
    expect(prompt).toBe('');
  });
});

describe('friendlyGenerationError', () => {
  it('maps billing errors to a friendly message', () => {
    expect(friendlyGenerationError(new Error('Billing hard limit reached'))).toContain(
      'billing limit',
    );
  });

  it('falls back to a generic message', () => {
    expect(friendlyGenerationError(new Error('boom'))).toContain(
      'We could not generate your previews.',
    );
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm vitest run tests/lib/personalization-ai.test.ts`
Expected: FAIL — `Cannot find module '@/lib/personalization-ai'`.

- [ ] **Step 6: Create `lib/personalization-ai.ts`**

```ts
/** Maps raw AI-provider errors to a customer-friendly generation message. */
export function friendlyGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('billing hard limit') || message.includes('billing limit')) {
    return 'Image generation is temporarily unavailable because the AI service billing limit was reached. Please try again later or contact support. Any generation credits were refunded.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'The image service is busy right now. Please wait a moment and try again. Any generation credits were refunded.';
  }
  return 'We could not generate your previews. Please try again. Any generation credits were refunded.';
}

export interface PersonalizationPromptInput {
  systemPrompt: string | null;
  boilerplateInstruction: string | null;
  personalizedText: string | null;
  personalizedTextFormatting: string | null;
  colorLabel: string | null;
  colorHex: string | null;
  hasPhoto: boolean;
}

/**
 * Composes the AI generation prompt from an item's admin-authored System
 * Prompt plus whichever tag-driven inputs the customer supplied. Replaces the
 * hardcoded night-light-specific prompt builder: product domain language now
 * lives entirely in the admin-authored System Prompt.
 */
export function composePersonalizationPrompt(input: PersonalizationPromptInput): string {
  const parts = [
    input.systemPrompt?.trim() || null,
    input.boilerplateInstruction?.trim() || null,
    input.personalizedText
      ? `Personalized text: ${input.personalizedText}${input.personalizedTextFormatting ? ` (styling: ${input.personalizedTextFormatting})` : ''}.`
      : null,
    input.colorLabel
      ? `Use color: ${input.colorLabel}${input.colorHex ? ` (${input.colorHex})` : ''}.`
      : null,
    input.hasPhoto
      ? 'A user photo is attached as the subject reference; preserve its recognizable identity and defining features.'
      : null,
  ];
  return parts.filter((part): part is string => Boolean(part)).join('\n\n');
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm vitest run tests/lib/personalization-ai.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Remove the night-light-specific constant from `lib/marketplace-constants.ts` and add the item-type-to-product-type mapper**

Modify `lib/marketplace-constants.ts` — delete the `PERSONALIZED_NIGHT_LIGHT` export block (the `export const PERSONALIZED_NIGHT_LIGHT = { ... } as const;` block, currently lines 21-35), and add after the `PRODUCT_TYPES`/`ProductType` export:

```ts
export const PRODUCT_TYPES = [
  'night_light',
  'personalized_night_light',
  'laser_cut_2d_toy',
  'laser_cut_2d_decoration',
  'laser_cut_2d_constructor',
  'banner',
  'standard',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

const ITEM_TYPE_TO_PRODUCT_TYPE: Record<string, ProductType> = {
  standard: 'standard',
  toy: 'laser_cut_2d_toy',
  decoration: 'laser_cut_2d_decoration',
  night_light: 'night_light',
  personalized_night_light: 'personalized_night_light',
  banner: 'banner',
};

/** Maps a `catalog_items.item_type` value to the `generated_items.product_type` it should carry. */
export function mapCatalogItemTypeToProductType(itemType: string): ProductType {
  return ITEM_TYPE_TO_PRODUCT_TYPE[itemType] ?? 'standard';
}
```

(`'standard'` was added to `PRODUCT_TYPES` and to the DB check constraint in Task 1 because `catalog_items.item_type` includes values — `standard`, `toy`, `decoration` — that had no matching `product_type` before; any customizable item using those types now maps to a valid, if generic, product type instead of crashing the insert.)

- [ ] **Step 9: Write the failing test for the mapper**

Create `tests/lib/marketplace-constants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapCatalogItemTypeToProductType } from '@/lib/marketplace-constants';

describe('mapCatalogItemTypeToProductType', () => {
  it('maps known item types to their product type', () => {
    expect(mapCatalogItemTypeToProductType('toy')).toBe('laser_cut_2d_toy');
    expect(mapCatalogItemTypeToProductType('decoration')).toBe('laser_cut_2d_decoration');
    expect(mapCatalogItemTypeToProductType('night_light')).toBe('night_light');
    expect(mapCatalogItemTypeToProductType('personalized_night_light')).toBe(
      'personalized_night_light',
    );
    expect(mapCatalogItemTypeToProductType('banner')).toBe('banner');
    expect(mapCatalogItemTypeToProductType('standard')).toBe('standard');
  });

  it('falls back to standard for an unknown item type', () => {
    expect(mapCatalogItemTypeToProductType('unknown_type')).toBe('standard');
  });
});
```

Run: `pnpm vitest run tests/lib/marketplace-constants.test.ts`
Expected: PASS (this file already exists after Step 8, so this is confirmatory, not a red/green cycle).

- [ ] **Step 10: Make `referenceFileId` optional in `lib/openai-image.ts`**

Modify `lib/openai-image.ts`:

```ts
export interface OpenAiImageInput {
  prompt: string;
  userImages: File[];
  referenceFileId?: string | null;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}
```

Replace the `content` array construction inside `generateOpenAiImage` (currently always appending the reference file part unconditionally):

```ts
export async function generateOpenAiImage(
  client: OpenAI,
  input: OpenAiImageInput,
): Promise<GeneratedImage> {
  const quality = input.quality ?? 'low';
  const size = input.size ?? '1024x1024';
  const userImageParts = await Promise.all(input.userImages.map(toInputImagePart));

  const response = await client.responses.create({
    model: getResponsesModel(),
    store: false,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: input.prompt },
          ...userImageParts,
          ...(input.referenceFileId
            ? [{ type: 'input_image' as const, detail: 'auto' as const, file_id: input.referenceFileId }]
            : []),
        ],
      },
    ],
    tools: [{ type: 'image_generation', model: getImageModel(), size, quality }],
  });

  return extractGeneratedImage(response);
}
```

- [ ] **Step 11: Add a test for the no-reference case**

Modify `tests/lib/openai-image.test.ts` — add inside the `describe('generateOpenAiImage', ...)` block, after the existing test:

```ts
  it('omits the reference file_id content part when none is given', async () => {
    const base64 = Buffer.from('generated-bytes').toString('base64');
    const create = vi.fn(async () => ({
      output: [{ type: 'image_generation_call', result: base64 }],
    }));
    const client = { responses: { create } } as unknown as Parameters<
      typeof generateOpenAiImage
    >[0];
    const userImage = new File([new Uint8Array([9, 9])], 'user.jpg', { type: 'image/jpeg' });

    await generateOpenAiImage(client, {
      prompt: 'Generate a preview',
      userImages: [userImage],
      referenceFileId: null,
      size: '1024x1024',
      quality: 'low',
    });

    // biome-ignore lint/suspicious/noExplicitAny: test double for the Responses API request body
    const requestBody = (create.mock.calls[0] as any[])[0];
    const [message] = requestBody.input;
    expect(message.content).toHaveLength(2);
    expect(message.content.some((part: { type: string }) => part.type === 'input_image' && 'file_id' in part)).toBe(false);
  });
```

Run: `pnpm vitest run tests/lib/openai-image.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 12: Add `catalogItemId` to `GeneratedItemInput`**

Modify `lib/generated-items.ts` — in `GeneratedItemInput`, add a field after `subcategoryId`:

```ts
export interface GeneratedItemInput {
  userId: string;
  generatedBy?: string | null;
  productType: ProductType;
  categoryId?: string | null;
  subcategoryId?: string | null;
  catalogItemId?: string | null;
  title?: string | null;
  sourceImagePath?: string | null;
  prompt?: string | null;
  customText?: string | null;
  svgContent?: string;
  previewPath?: string | null;
  selectedPreviewPath?: string | null;
  manufacturingFilePath?: string | null;
  originalImagePaths?: string[];
  color?: string | null;
  multiColor?: boolean;
  manufacturingMetadata?: Record<string, unknown>;
  generationOptions?: Record<string, unknown>;
  creditCost?: number;
  reviewStatus?: string;
}
```

In `createGeneratedItem`, add `catalog_item_id: input.catalogItemId ?? null,` to the `.insert({ ... })` object, immediately after `subcategory_id: input.subcategoryId ?? null,`.

- [ ] **Step 13: Rewrite `app/personalize/form-parsing.ts`**

```ts
// Plain module (no "use server"): server-action files may only export async
// functions, so the form schema and sync parsing helpers live here instead.
import { z } from 'zod';
import { COMFORTABLE_COLORS, DEFAULT_COLOR_VALUE, MAX_PERSONALIZED_PHOTOS, MAX_PERSONALIZED_TEXT_LENGTH } from '@/lib/personalization-constants';

/**
 * Structural parse of the generic personalize-item generation form. The
 * schema's job is shape/narrowing only — localized error-message selection
 * stays in the server action.
 */
export const generationFormSchema = z.object({
  catalogItemId: z.string().trim().min(1),
  customText: z.string().trim().max(MAX_PERSONALIZED_TEXT_LENGTH),
  color: z
    .string()
    .catch(DEFAULT_COLOR_VALUE)
    .transform((value) =>
      COMFORTABLE_COLORS.some((color) => color.value === value) ? value : DEFAULT_COLOR_VALUE,
    ),
  images: z.array(z.instanceof(File)).max(MAX_PERSONALIZED_PHOTOS),
  boilerplateIds: z
    .array(z.union([z.string(), z.instanceof(File)]))
    .transform((values) => [
      ...new Set(values.filter((value): value is string => typeof value === 'string')),
    ]),
});

export function getImageFiles(formData: FormData) {
  return formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function summarizeTextFormatting(value: FormDataEntryValue | null) {
  const html = typeof value === 'string' ? value.slice(0, 2_000) : '';
  const styles = [
    /<(b|strong)(\s|>)/i.test(html) ? 'bold emphasis' : null,
    /<(i|em)(\s|>)/i.test(html) ? 'italic emphasis' : null,
    /text-align\s*:\s*center|align=["']?center/i.test(html) ? 'center aligned' : 'left aligned',
  ].filter(Boolean);
  return styles.join(', ');
}
```

- [ ] **Step 14: Rewrite `app/personalize/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  generationFormSchema,
  getImageFiles,
  summarizeTextFormatting,
} from '@/app/personalize/form-parsing';
import { debitCredits, getCreditBalance, refundCredits } from '@/lib/credits';
import { createGeneratedItem, createPersonalizedPreviewOptions } from '@/lib/generated-items';
import { mapCatalogItemTypeToProductType } from '@/lib/marketplace-constants';
import { getOpenAiClient } from '@/lib/openai-client';
import { generateOpenAiImage } from '@/lib/openai-image';
import { composePersonalizationPrompt, friendlyGenerationError } from '@/lib/personalization-ai';
import { COMFORTABLE_COLORS } from '@/lib/personalization-constants';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import { listCatalogItemBoilerplates } from '@/lib/personalization-boilerplates';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

// Sanctioned exception to the ActionState convention (lib/action-state.ts):
// the credits dialog in components/personalize-item-form.tsx needs the
// richer `insufficient_credits` code plus required/available credit counts.
export type PersonalizedGenerationState = {
  code: 'idle' | 'error' | 'insufficient_credits';
  message: string | null;
  requiredCredits?: number;
  availableCredits?: number;
};

function errorState(message: string): PersonalizedGenerationState {
  return { code: 'error', message };
}

async function uploadUserImage(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  file: File,
) {
  const ext = IMAGE_EXTENSION_BY_MIME[file.type];
  if (!ext) throw new Error('Upload PNG, JPG, or WEBP images only.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller.');
  return uploadToBucket(supabase, {
    bucket: 'user-uploads',
    path: `${userId}/personalized-items/${crypto.randomUUID()}.${ext}`,
    body: await file.arrayBuffer(),
    contentType: file.type,
  });
}

async function uploadGeneratedPng(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  bytes: Uint8Array,
) {
  return uploadToBucket(supabase, {
    bucket: 'generated-assets',
    path: `${userId}/personalized-items/previews/${crypto.randomUUID()}.png`,
    body: bytes,
    contentType: 'image/png',
  });
}

export async function generatePersonalizedItemAction(
  _previousState: PersonalizedGenerationState,
  formData: FormData,
): Promise<PersonalizedGenerationState> {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  const rawItemId = String(formData.get('catalogItemId') ?? '');
  if (!user) redirect(`/login?next=/personalize/${encodeURIComponent(rawItemId)}`);
  const t = await getTranslations('personalize');

  const parsed = generationFormSchema.safeParse({
    catalogItemId: rawItemId,
    customText: String(formData.get('customText') ?? ''),
    color: formData.get('color'),
    images: getImageFiles(formData),
    boilerplateIds: formData.getAll('boilerplateIds'),
  });
  if (!parsed.success) {
    const invalidFields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    if (invalidFields.has('images')) return errorState(t('errorUpload'));
    if (invalidFields.has('customText')) return errorState(t('errorText'));
    return errorState(t('errorItem'));
  }
  const { catalogItemId, customText, color, images: rawFiles } = parsed.data;
  const customTextFormatting = summarizeTextFormatting(formData.get('customTextHtml'));

  const { data: item, error: itemError } = await supabase
    .from('catalog_items')
    .select('id, slug, title, price_cents, currency, item_type, status, is_customizable, system_prompt, skill_id, tags')
    .eq('id', catalogItemId)
    .eq('status', 'published')
    .maybeSingle();
  if (itemError || !item || !item.is_customizable) return errorState(t('errorItem'));

  const configuredBoilerplates = await listCatalogItemBoilerplates(supabase, item.id);
  if (!item.system_prompt && !configuredBoilerplates.length) {
    return errorState(t('comingSoonBody'));
  }

  const requestedBoilerplateIds = parsed.data.boilerplateIds;
  let selectedBoilerplates: PersonalizationBoilerplate[] = [];
  if (configuredBoilerplates.length) {
    if (!requestedBoilerplateIds.length) return errorState(t('selectAtLeastOne'));
    selectedBoilerplates = configuredBoilerplates.filter((boilerplate) =>
      requestedBoilerplateIds.includes(boilerplate.id),
    );
    if (selectedBoilerplates.length !== requestedBoilerplateIds.length) {
      return errorState(t('errorStyle'));
    }
  }

  const tags = new Set(item.tags ?? []);
  const files = tags.has('personal_photo') ? rawFiles : [];
  if (tags.has('personal_photo') && files.length !== 1) return errorState(t('errorUpload'));

  const creditCost = Math.max(selectedBoilerplates.length, 1);
  let debited = false;
  let generatedId: string | null = null;
  let creditSupabase: ReturnType<typeof getServiceSupabase> | null = null;
  try {
    creditSupabase = getServiceSupabase();
    const availableCredits = await getCreditBalance(creditSupabase, user.id);
    if (availableCredits < creditCost) {
      return {
        code: 'insufficient_credits',
        message: `You need ${creditCost} credits to generate these previews, but you have ${availableCredits}.`,
        requiredCredits: creditCost,
        availableCredits,
      };
    }
    await debitCredits(creditSupabase, {
      userId: user.id,
      amount: creditCost,
      referenceType: 'personalized_item',
      metadata: { catalogItemId: item.id, boilerplateIds: requestedBoilerplateIds },
    });
    debited = true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('insufficient credit')) {
      return {
        code: 'insufficient_credits',
        message: 'You do not have enough credits to generate these previews.',
        requiredCredits: creditCost,
      };
    }
    return errorState(t('errorBalance'));
  }

  try {
    const originalImagePaths: string[] = [];
    for (const file of files) originalImagePaths.push(await uploadUserImage(supabase, user.id, file));

    const selectedColor = tags.has('personal_color')
      ? (COMFORTABLE_COLORS.find((option) => option.value === color) ?? null)
      : null;
    const hasPhoto = originalImagePaths.length > 0;
    const personalizedText = tags.has('personal_text') && customText ? customText : null;

    const generated = await createGeneratedItem(supabase, {
      userId: user.id,
      generatedBy: user.id,
      productType: mapCatalogItemTypeToProductType(item.item_type),
      catalogItemId: item.id,
      title: `${item.title} preview`,
      customText: personalizedText,
      originalImagePaths,
      color: selectedColor?.value ?? null,
      multiColor: false,
      generationOptions: {
        catalogItemId: item.id,
        boilerplateIds: selectedBoilerplates.map((boilerplate) => boilerplate.id),
        customTextFormatting,
      },
      creditCost,
      reviewStatus: 'preview_ready',
    });
    generatedId = generated.id;

    const openAiClient = getOpenAiClient();
    const callTargets: Array<PersonalizationBoilerplate | null> = selectedBoilerplates.length
      ? selectedBoilerplates
      : [null];
    const options = [];
    for (let offset = 0; offset < callTargets.length; offset += 1) {
      const index = offset + 1;
      const reference = callTargets[offset];
      const prompt = composePersonalizationPrompt({
        systemPrompt: item.system_prompt,
        boilerplateInstruction: reference?.generation_instruction ?? null,
        personalizedText,
        personalizedTextFormatting: customTextFormatting || null,
        colorLabel: selectedColor?.label ?? null,
        colorHex: selectedColor?.hex ?? null,
        hasPhoto,
      });
      const image = await generateOpenAiImage(openAiClient, {
        prompt,
        userImages: files,
        referenceFileId: reference?.openai_file_id ?? null,
        size: '1024x1024',
        quality: 'low',
      });
      const previewPath = await uploadGeneratedPng(supabase, user.id, image.bytes);
      options.push({
        generatedItemId: generated.id,
        optionIndex: index,
        previewImagePath: previewPath,
        manufacturingFilePath: null,
        boilerplateId: reference?.id ?? null,
        metadata: {
          boilerplateId: reference?.id ?? null,
          boilerplateName: reference?.name ?? null,
          manufacturingProcess: reference?.manufacturing_process ?? null,
          requiresManufacturingSvg: reference?.generate_hidden_svg ?? false,
          manufacturingSvgStatus: 'pending_admin_generation',
          revisedPrompt: image.revisedPrompt,
          validationWarnings: [],
        },
      });
    }
    await createPersonalizedPreviewOptions(supabase, options);
  } catch (error) {
    if (debited && creditSupabase) {
      try {
        await refundCredits(creditSupabase, {
          userId: user.id,
          amount: creditCost,
          referenceType: 'personalized_item',
          referenceId: generatedId,
          metadata: {
            catalogItemId: item.id,
            reason: error instanceof Error ? error.message : 'personalized_generation_failed',
          },
        });
      } catch (refundError) {
        console.error('[personalized-item] credit refund failed', refundError);
      }
    }
    return errorState(error instanceof Error ? friendlyGenerationError(error) : t('errorGeneration'));
  }

  if (!generatedId) return errorState('We could not save the generated previews. Please try again.');
  redirect(`/generated/${generatedId}`);
}
```

- [ ] **Step 15: Rename the `nightLight` i18n namespace to `personalize` and drop `personalizedList`**

The action written in Step 14 calls `getTranslations('personalize')`, so the namespace must exist before that code can run correctly — do this rename now rather than later.

Modify `messages/en.json` — replace the entire `"nightLight": { ... }` block with:

```json
  "personalize": {
    "back": "Back to item",
    "signInTitle": "Sign in to generate",
    "signInBody": "You can browse items as a guest, but generation uses your uploads, credit balance, and saved preview history.",
    "comingSoonTitle": "Personalization coming soon",
    "comingSoonBody": "AI personalization isn't available for this item yet. Please check back later.",
    "chooseTemplates": "Choose your styles",
    "chooseTemplatesHelp": "Select one or more. Each style creates a separate design.",
    "image": "Your image",
    "upload": "Upload one PNG, JPG, or WEBP image",
    "color": "Color",
    "text": "Personalized text",
    "textOptional": "Optional",
    "textPlaceholder": "Name, date, or short message",
    "charactersRemaining": "{count} characters remaining",
    "creditPerStyle": "1 credit per style",
    "creditTotal": "{count} credits total",
    "generate": "Generate {count} designs",
    "generatingTitle": "Creating your designs",
    "generatingBody": "We are adapting your input to every selected style. This can take a little while.",
    "selectAtLeastOne": "Select at least one style.",
    "notEnoughCredits": "Not enough credits",
    "buyCredits": "Buy credits",
    "results": "Your generated options",
    "resultsHelp": "Select one or more designs to add to your cart.",
    "addSelected": "Add selected to cart",
    "requiredCredits": "Required",
    "availableCredits": "Available",
    "errorUpload": "Upload exactly one PNG, JPG, or WEBP image.",
    "errorText": "Personalized text must be 80 characters or fewer.",
    "errorItem": "This item is not available for personalization right now.",
    "errorStyle": "One or more selected styles are no longer available. Refresh and try again.",
    "errorBalance": "We could not verify your credit balance. Please try again.",
    "errorGeneration": "We could not generate your designs. Please try again. Your credits were refunded."
  },
```

Modify `messages/ru.json` — replace the entire `"nightLight": { ... }` block with:

```json
  "personalize": {
    "back": "Назад к товару",
    "signInTitle": "Войдите, чтобы создать дизайн",
    "signInBody": "Товары можно просматривать без входа, но для генерации нужны ваши загрузки, баланс кредитов и сохранённая история вариантов.",
    "comingSoonTitle": "Персонализация скоро появится",
    "comingSoonBody": "AI-персонализация пока недоступна для этого товара. Загляните позже.",
    "chooseTemplates": "Выберите стили",
    "chooseTemplatesHelp": "Выберите один или несколько. Для каждого стиля будет создан отдельный дизайн.",
    "image": "Ваше изображение",
    "upload": "Загрузите одно изображение PNG, JPG или WEBP",
    "color": "Цвет",
    "text": "Персональный текст",
    "textOptional": "Необязательно",
    "textPlaceholder": "Имя, дата или короткое сообщение",
    "charactersRemaining": "Осталось символов: {count}",
    "creditPerStyle": "1 кредит за стиль",
    "creditTotal": "Всего кредитов: {count}",
    "generate": "Создать дизайны: {count}",
    "generatingTitle": "Создаём ваши дизайны",
    "generatingBody": "Мы адаптируем ваши данные для каждого выбранного стиля. Это может занять некоторое время.",
    "selectAtLeastOne": "Выберите хотя бы один стиль.",
    "notEnoughCredits": "Недостаточно кредитов",
    "buyCredits": "Купить кредиты",
    "results": "Созданные варианты",
    "resultsHelp": "Выберите один или несколько дизайнов для добавления в корзину.",
    "addSelected": "Добавить выбранное в корзину",
    "requiredCredits": "Нужно",
    "availableCredits": "Доступно",
    "errorUpload": "Загрузите ровно одно изображение PNG, JPG или WEBP.",
    "errorText": "Персональный текст должен содержать не более 80 символов.",
    "errorItem": "Этот товар сейчас недоступен для персонализации.",
    "errorStyle": "Один или несколько выбранных стилей больше недоступны. Обновите страницу и повторите попытку.",
    "errorBalance": "Не удалось проверить баланс кредитов. Повторите попытку.",
    "errorGeneration": "Не удалось создать дизайны. Повторите попытку. Кредиты возвращены."
  },
```

Modify `messages/am.json` — replace the entire `"nightLight": { ... }` block with:

```json
  "personalize": {
    "back": "Վերադառնալ ապրանքին",
    "signInTitle": "Մուտք գործեք դիզայն ստեղծելու համար",
    "signInBody": "Ապրանքները կարող եք դիտել որպես հյուր, սակայն գեներացման համար օգտագործվում են ձեր վերբեռնումները, կրեդիտների մնացորդը և պահպանված տարբերակների պատմությունը։",
    "comingSoonTitle": "Անհատականացումը շուտով կհասանելի լինի",
    "comingSoonBody": "AI անհատականացումն այս ապրանքի համար դեռ հասանելի չէ։ Խնդրում ենք ստուգել ավելի ուշ։",
    "chooseTemplates": "Ընտրեք ոճերը",
    "chooseTemplatesHelp": "Ընտրեք մեկ կամ մի քանիսը։ Յուրաքանչյուր ոճի համար կստեղծվի առանձին դիզայն։",
    "image": "Ձեր պատկերը",
    "upload": "Վերբեռնեք մեկ PNG, JPG կամ WEBP պատկեր",
    "color": "Գույն",
    "text": "Անհատական տեքստ",
    "textOptional": "Ըստ ցանկության",
    "textPlaceholder": "Անուն, ամսաթիվ կամ կարճ հաղորդագրություն",
    "charactersRemaining": "Մնացել է {count} նիշ",
    "creditPerStyle": "1 կրեդիտ յուրաքանչյուր ոճի համար",
    "creditTotal": "Ընդամենը՝ {count} կրեդիտ",
    "generate": "Ստեղծել {count} դիզայն",
    "generatingTitle": "Ստեղծում ենք ձեր դիզայնները",
    "generatingBody": "Ձեր տվյալները հարմարեցնում ենք ընտրված յուրաքանչյուր ոճին։ Սա կարող է մի փոքր տևել։",
    "selectAtLeastOne": "Ընտրեք առնվազն մեկ ոճ։",
    "notEnoughCredits": "Կրեդիտները բավարար չեն",
    "buyCredits": "Գնել կրեդիտներ",
    "results": "Ձեր ստեղծված տարբերակները",
    "resultsHelp": "Ընտրեք մեկ կամ մի քանի դիզայն՝ զամբյուղ ավելացնելու համար։",
    "addSelected": "Ընտրվածները ավելացնել զամբյուղ",
    "requiredCredits": "Պահանջվում է",
    "availableCredits": "Հասանելի է",
    "errorUpload": "Վերբեռնեք ճիշտ մեկ PNG, JPG կամ WEBP պատկեր։",
    "errorText": "Անհատական տեքստը պետք է լինի առավելագույնը 80 նիշ։",
    "errorItem": "Այս ապրանքն այժմ հասանելի չէ անհատականացման համար։",
    "errorStyle": "Ընտրված ոճերից մեկը կամ մի քանիսն այլևս հասանելի չեն։ Թարմացրեք էջը և կրկին փորձեք։",
    "errorBalance": "Չհաջողվեց ստուգել կրեդիտների մնացորդը։ Կրկին փորձեք։",
    "errorGeneration": "Չհաջողվեց ստեղծել դիզայնները։ Կրկին փորձեք։ Կրեդիտները վերադարձվել են։"
  },
```

Modify `messages/en.json`, `messages/ru.json`, `messages/am.json` — delete the entire `"personalizedList": { ... }` block from each (its only consumer, `app/catalog/night-lights/personalized/page.tsx`, was deleted in Step 1 of this task).

- [ ] **Step 16: Generalize `app/generated/[id]/page.tsx`**

In addition to the changes below, update the three call sites inside the `<GeneratedPreviewSelector copy={{ ... }}>` block that currently read `t('nightLight.results')`, `t('nightLight.resultsHelp')`, `t('nightLight.addSelected')` — change them to `t('personalize.results')`, `t('personalize.resultsHelp')`, `t('personalize.addSelected')` (the namespace was renamed in Step 15).

Modify the imports (drop `getBoilerplateName`, add `Tables`):

```ts
import type { GeneratedItemRow, PersonalizedPreviewOptionRow } from '@/lib/generated-items';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import type { Tables } from '@/lib/supabase/types';
```

Modify the type definitions:

```ts
type GeneratedItemDetail = Pick<
  GeneratedItemRow,
  | 'id'
  | 'title'
  | 'product_type'
  | 'review_status'
  | 'credit_cost'
  | 'preview_path'
  | 'selected_preview_path'
  | 'custom_text'
  | 'color'
  | 'multi_color'
  | 'svg_content'
  | 'manufacturing_metadata'
  | 'generation_options'
  | 'created_at'
> & {
  catalog_item: Pick<Tables<'catalog_items'>, 'title' | 'slug' | 'price_cents' | 'currency'> | null;
};

type PreviewOption = Pick<
  PersonalizedPreviewOptionRow,
  'id' | 'option_index' | 'preview_image_path' | 'status' | 'metadata'
> & {
  boilerplate: Pick<PersonalizationBoilerplate, 'name'> | null;
};
```

Modify the `generated_items` query's `.select(...)` argument:

```ts
      .select(
        'id, title, product_type, review_status, credit_cost, preview_path, selected_preview_path, custom_text, color, multi_color, svg_content, manufacturing_metadata, generation_options, created_at, catalog_item:catalog_items(title, slug, price_cents, currency)',
      )
```

Modify the `personalized_preview_options` query's `.select(...)` argument:

```ts
      .select(
        'id, option_index, preview_image_path, status, metadata, boilerplate:personalization_boilerplates(name)',
      )
```

Modify the price line (currently `const salePriceCents = Number(item.generation_options.salePriceCents ?? 0);`):

```ts
  const salePriceCents = item.catalog_item?.price_cents ?? 0;
  const saleCurrency = item.catalog_item?.currency ?? 'AMD';
```

Modify both `formatLocalizedCurrency(locale, salePriceCents, 'AMD')` call sites (in `priceLabel` and the add-to-cart panel) to use `saleCurrency` instead of the hardcoded `'AMD'` literal:

```ts
formatLocalizedCurrency(locale, salePriceCents, saleCurrency)
```

Modify the option label mapping (currently `option.boilerplate ? getBoilerplateName(option.boilerplate, locale) : ...`):

```ts
                label: option.boilerplate
                  ? option.boilerplate.name
                  : typeof option.metadata.boilerplateName === 'string'
                    ? option.metadata.boilerplateName
                    : t('generated.option', { number: String(option.option_index) }),
```

- [ ] **Step 17: Generalize `CatalogItem` and drop the model-based query functions in `lib/marketplace.ts`**

Task 1 already dropped the `personalization_models` table, so `lib/marketplace.ts`'s `PersonalizationModel` type and its two query functions no longer typecheck against the regenerated types — fix that now rather than leaving it broken into later tasks.

Modify the `CatalogItem` interface — add three fields after `is_customizable`:

```ts
export interface CatalogItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  is_popular: boolean;
  is_customizable: boolean;
  system_prompt: string | null;
  skill_id: string | null;
  tags: string[];
  thumbnail_path: string | null;
  manufacturing_notes: string | null;
  created_at: string;
  subcategory_id?: string | null;
  item_type?: string;
  category: {
    slug: string;
    name: string;
  } | null;
  subcategory?: {
    slug: string;
    name: string;
  } | null;
  media?: CatalogItemMedia[];
}
```

Modify `CATALOG_SELECT` — add the three columns after `is_customizable,`:

```ts
const CATALOG_SELECT = `
  id,
  title,
  slug,
  description,
  price_cents,
  currency,
  is_popular,
  is_customizable,
  system_prompt,
  skill_id,
  tags,
  thumbnail_path,
  manufacturing_notes,
  created_at,
  subcategory_id,
  item_type,
  category:categories (
    slug,
    name
  ),
  subcategory:subcategories (
    slug,
    name
  ),
  media:catalog_item_media (
    id,
    media_type,
    storage_path,
    alt_text,
    poster_path,
    sort_order,
    is_primary
  )
`;
```

Delete the `PersonalizationModel` interface and the `listPublishedPersonalizationModels`/`getPublishedPersonalizationModel` functions (everything from `export interface PersonalizationModel {` through the end of `getPublishedPersonalizationModel`) — their only callers (`app/personalize/[slug]/page.tsx`, `app/catalog/night-lights/personalized/page.tsx`) were deleted in Step 1, and they queried the now-dropped `personalization_models` table.

- [ ] **Step 18: Run the full lib test suite and typecheck**

Run: `pnpm vitest run tests/lib`
Expected: PASS, no failures.

Run: `pnpm typecheck`
Expected: no errors. (`app/admin/personalization/night-lights/*` still references the pre-Task-1 `personalization_models`/`model_id` shape and will fail to typecheck until Task 3 deletes it — if `pnpm typecheck` surfaces errors only in that directory, they are expected here and resolved by Task 3, not a sign this task is broken. Errors anywhere else must be fixed before committing.)

- [ ] **Step 19: Remove dead links to the deleted `/personalize/[slug]` route**

`app/page.tsx` and `app/catalog/page.tsx` both hardcode a CTA button linking to `/personalize/portrait-personalized-night-light` — the old model-slug route deleted in Step 1. The new system has no single global personalize target to replace it with (personalization is now discovered per-item via each item's own "Personalize with AI" button, added in Task 5) — remove the buttons rather than pointing them at a broken or arbitrary link.

Modify `app/page.tsx` — remove the second `<Button>` (the "Generate custom" one) from this block, leaving only the "Browse catalog" button:

```tsx
              <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg">
                  <Link href="/catalog">
                    {t('landing.browse_catalog')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
```

Modify `app/catalog/page.tsx` — remove the `<Button>` wrapping the dead link entirely, leaving just the title/subtitle block:

```tsx
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{t('catalog.title')}</h1>
            <p className="max-w-2xl text-muted-foreground">{t('catalog.subtitle')}</p>
          </div>
        </div>
```

The now-unused `landing.generate_custom` and `catalog.generate_custom` i18n keys can stay in `messages/*.json` — removing them isn't required and this codebase doesn't lint for unused translation keys.

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "feat: replace night-light-specific personalization engine with a generic per-item one"
```

---

### Task 3: Admin boilerplate library (shared CRUD, replacing the night-lights admin page)

**Files:**
- Create: `app/admin/personalization/boilerplates/page.tsx`
- Create: `app/admin/personalization/boilerplates/actions.ts`
- Modify: `app/admin/personalization/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`, `messages/am.json`
- Delete: `app/admin/personalization/night-lights/page.tsx`
- Delete: `app/admin/personalization/night-lights/actions.ts`

**Interfaces:**
- Consumes: `PersonalizationBoilerplate` (`lib/personalization-boilerplates.ts`), `uploadReferenceImage`/`deleteReferenceFile` (`lib/openai-files.ts`), `getOpenAiClient` (`lib/openai-client.ts`), `requireAdminPermission` (`lib/admin.ts`), `uploadToBucket` (`lib/storage.ts`).
- Produces: `saveBoilerplateAction(formData)`, `removeBoilerplateAction(formData)` (`app/admin/personalization/boilerplates/actions.ts`) — used only by this page's own forms.

- [ ] **Step 1: Delete the old night-lights admin page and actions**

```bash
git rm app/admin/personalization/night-lights/page.tsx app/admin/personalization/night-lights/actions.ts
```

- [ ] **Step 2: Update i18n — replace `personalization.*` category-grid and model keys with boilerplate-library keys**

Modify `messages/en.json` — replace the entire `"personalization": { ... }` block (currently keys `title` through `uploadHelp`) with:

```json
  "personalization": {
    "title": "Personalization",
    "subtitle": "Manage the shared boilerplate library used for AI personalization.",
    "libraryCard": "Boilerplate library",
    "libraryCardHelp": "Manage the shared boilerplate images used for AI personalization.",
    "boilerplateLibraryTitle": "Boilerplate library",
    "boilerplateLibrarySubtitle": "These boilerplates are shared across any catalog item that attaches them from the item form.",
    "back": "Back to personalization",
    "boilerplateName": "Name",
    "templateImage": "Template image",
    "manufacturingProcess": "Manufacturing process",
    "generationInstruction": "AI generation instruction",
    "displayOrder": "Display order",
    "requiresSvg": "Requires manufacturing file",
    "openaiFileId": "OpenAI file ID",
    "updateBoilerplate": "Update boilerplate",
    "addBoilerplate": "Add boilerplate",
    "noImage": "No image uploaded",
    "currentImageAlt": "Current {label}",
    "replaceImageHelp": "Choose a file to replace the current image.",
    "uploadHelp": "Upload PNG, JPG, WEBP, or SVG up to 10 MB."
  },
```

Modify `messages/ru.json` — replace the same block with:

```json
  "personalization": {
    "title": "Персонализация",
    "subtitle": "Управляйте общей библиотекой шаблонов для AI-персонализации.",
    "libraryCard": "Библиотека шаблонов",
    "libraryCardHelp": "Управляйте общими изображениями шаблонов для AI-персонализации.",
    "boilerplateLibraryTitle": "Библиотека шаблонов",
    "boilerplateLibrarySubtitle": "Эти шаблоны доступны любому товару каталога, который подключит их из формы товара.",
    "back": "Назад к персонализации",
    "boilerplateName": "Название",
    "templateImage": "Изображение шаблона",
    "manufacturingProcess": "Производственный процесс",
    "generationInstruction": "Инструкция для AI-генерации",
    "displayOrder": "Порядок отображения",
    "requiresSvg": "Требуется производственный файл",
    "openaiFileId": "ID файла OpenAI",
    "updateBoilerplate": "Обновить шаблон",
    "addBoilerplate": "Добавить шаблон",
    "noImage": "Изображение не загружено",
    "currentImageAlt": "Текущее изображение: {label}",
    "replaceImageHelp": "Выберите файл, чтобы заменить текущее изображение.",
    "uploadHelp": "Загрузите PNG, JPG, WEBP или SVG до 10 МБ."
  },
```

Modify `messages/am.json` — replace the same block with:

```json
  "personalization": {
    "title": "Անհատականացում",
    "subtitle": "Կառավարեք AI անհատականացման ընդհանուր ձևանմուշների գրադարանը։",
    "libraryCard": "Ձևանմուշների գրադարան",
    "libraryCardHelp": "Կառավարեք AI անհատականացման ընդհանուր ձևանմուշների պատկերները։",
    "boilerplateLibraryTitle": "Ձևանմուշների գրադարան",
    "boilerplateLibrarySubtitle": "Այս ձևանմուշները հասանելի են ցանկացած ապրանքի, որը դրանք կցի ապրանքի ձևից։",
    "back": "Վերադառնալ անհատականացում",
    "boilerplateName": "Անվանում",
    "templateImage": "Ձևանմուշի պատկեր",
    "manufacturingProcess": "Արտադրական գործընթաց",
    "generationInstruction": "AI գեներացման հրահանգ",
    "displayOrder": "Ցուցադրման հերթականություն",
    "requiresSvg": "Պահանջվում է արտադրական ֆայլ",
    "openaiFileId": "OpenAI ֆայլի ID",
    "updateBoilerplate": "Թարմացնել ձևանմուշը",
    "addBoilerplate": "Ավելացնել ձևանմուշ",
    "noImage": "Պատկեր վերբեռնված չէ",
    "currentImageAlt": "Ընթացիկ պատկեր՝ {label}",
    "replaceImageHelp": "Ընտրեք ֆայլ՝ ընթացիկ պատկերը փոխարինելու համար։",
    "uploadHelp": "Վերբեռնեք PNG, JPG, WEBP կամ SVG՝ մինչև 10 ՄԲ։"
  },
```

- [ ] **Step 3: Create `app/admin/personalization/boilerplates/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { deleteReferenceFile, uploadReferenceImage } from '@/lib/openai-files';
import { getOpenAiClient } from '@/lib/openai-client';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';

const imageExtByMime: Record<string, string> = {
  ...IMAGE_EXTENSION_BY_MIME,
  'image/svg+xml': 'svg',
};

const boilerplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required.'),
  imagePath: z.string().trim().optional(),
  manufacturingProcess: z.string().trim().min(1, 'Manufacturing process is required.'),
  generationInstruction: z.string().trim().min(1, 'Generation instruction is required.'),
  sortOrder: z.coerce.number().int(),
  generateHiddenSvg: z.boolean(),
  isActive: z.boolean(),
});

function getFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveBoilerplateAction(formData: FormData) {
  const parsed = boilerplateSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    imagePath: formData.get('imagePath') || undefined,
    manufacturingProcess: formData.get('manufacturingProcess'),
    generationInstruction: formData.get('generationInstruction'),
    sortOrder: formData.get('sortOrder') || 0,
    generateHiddenSvg: formData.get('generateHiddenSvg') === 'on',
    isActive: formData.get('isActive') === 'on',
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid boilerplate.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const values = parsed.data;
  const newImageFile = getFile(formData, 'imageFile');

  let imagePath: string;
  let openaiFileId: string;
  let previousOpenaiFileId: string | null = null;

  if (newImageFile) {
    const ext = imageExtByMime[newImageFile.type];
    if (!ext) throw new Error('Upload PNG, JPG, WEBP, or SVG images only.');
    if (newImageFile.size > 10 * 1024 * 1024)
      throw new Error('Template images must be 10 MB or smaller.');

    // OpenAI upload happens first: if it fails, nothing is persisted.
    openaiFileId = await uploadReferenceImage(getOpenAiClient(), newImageFile);
    imagePath = await uploadToBucket(supabase, {
      bucket: 'catalog-assets',
      path: `${user.id}/personalization-boilerplates/${crypto.randomUUID()}.${ext}`,
      body: await newImageFile.arrayBuffer(),
      contentType: newImageFile.type,
    });

    if (values.id) {
      const { data: existing } = await supabase
        .from('personalization_boilerplates')
        .select('openai_file_id')
        .eq('id', values.id)
        .maybeSingle<{ openai_file_id: string }>();
      previousOpenaiFileId = existing?.openai_file_id ?? null;
    }
  } else if (!values.id) {
    throw new Error('Upload a boilerplate image.');
  } else {
    const { data: existing } = await supabase
      .from('personalization_boilerplates')
      .select('openai_file_id, image_path')
      .eq('id', values.id)
      .maybeSingle<{ openai_file_id: string; image_path: string }>();
    if (!existing) throw new Error('Boilerplate not found.');
    openaiFileId = existing.openai_file_id;
    imagePath = existing.image_path;
  }

  const payload = {
    name: values.name,
    image_path: imagePath,
    openai_file_id: openaiFileId,
    manufacturing_process: values.manufacturingProcess,
    generation_instruction: values.generationInstruction,
    sort_order: values.sortOrder,
    generate_hidden_svg: values.generateHiddenSvg,
    is_active: values.isActive,
  };

  const query = values.id
    ? supabase.from('personalization_boilerplates').update(payload).eq('id', values.id)
    : supabase.from('personalization_boilerplates').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);

  if (previousOpenaiFileId) await deleteReferenceFile(getOpenAiClient(), previousOpenaiFileId);

  revalidatePath('/admin/personalization/boilerplates');
  revalidatePath('/admin/items');
}

export async function removeBoilerplateAction(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get('id') });
  if (!parsed.success) throw new Error('Invalid boilerplate.');

  const { supabase } = await requireAdminPermission('catalog_manage');
  const { data: existing } = await supabase
    .from('personalization_boilerplates')
    .select('openai_file_id')
    .eq('id', parsed.data.id)
    .maybeSingle<{ openai_file_id: string }>();

  const { error } = await supabase
    .from('personalization_boilerplates')
    .delete()
    .eq('id', parsed.data.id);
  if (error) throw new Error(error.message);

  if (existing?.openai_file_id) await deleteReferenceFile(getOpenAiClient(), existing.openai_file_id);

  revalidatePath('/admin/personalization/boilerplates');
  revalidatePath('/admin/items');
}
```

- [ ] **Step 4: Create `app/admin/personalization/boilerplates/page.tsx`**

```tsx
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { removeBoilerplateAction, saveBoilerplateAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import { resolvePublicStorageUrl } from '@/lib/storage';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BoilerplateLibraryPage() {
  const t = await getTranslations();
  const supabase = await getServerSupabase();
  const { data: boilerplates } = await supabase
    .from('personalization_boilerplates')
    .select(
      'id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order',
    )
    .order('sort_order')
    .returns<PersonalizationBoilerplate[]>();

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <Button asChild variant="ghost" className="mb-3 px-0">
          <Link href="/admin/personalization">{t('personalization.back')}</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('personalization.boilerplateLibraryTitle')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('personalization.boilerplateLibrarySubtitle')}
        </p>
      </div>

      <section className="space-y-4">
        {(boilerplates ?? []).map((boilerplate) => (
          <BoilerplateForm key={boilerplate.id} boilerplate={boilerplate} />
        ))}
        <BoilerplateForm />
      </section>
    </main>
  );
}

async function BoilerplateForm({ boilerplate }: { boilerplate?: PersonalizationBoilerplate }) {
  const t = await getTranslations();
  const fieldId = `boilerplate-image-${boilerplate?.id ?? 'new'}`;
  const currentUrl = resolvePublicStorageUrl('catalog-assets', boilerplate?.image_path);

  return (
    <form
      action={saveBoilerplateAction}
      className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3"
    >
      {boilerplate ? <input type="hidden" name="id" value={boilerplate.id} /> : null}
      <div className="space-y-1.5">
        <Label>{t('personalization.boilerplateName')}</Label>
        <Input name="name" defaultValue={boilerplate?.name ?? ''} required />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={fieldId}>{t('personalization.templateImage')}</Label>
        <input type="hidden" name="imagePath" value={boilerplate?.image_path ?? ''} />
        <div className="flex aspect-[4/3] max-w-sm items-center justify-center overflow-hidden rounded-md border bg-muted/30">
          {currentUrl ? (
            // biome-ignore lint/performance/noImgElement: admin uploads can be SVG; next/image cannot render SVG markup
            <img
              src={currentUrl}
              alt={t('personalization.currentImageAlt', { label: t('personalization.templateImage').toLowerCase() })}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <ImageOff className="h-6 w-6" />
              <span>{t('personalization.noImage')}</span>
            </div>
          )}
        </div>
        <Input
          id={fieldId}
          name="imageFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required={!boilerplate?.image_path}
        />
        <p className="text-xs text-muted-foreground">
          {boilerplate ? t('personalization.replaceImageHelp') : t('personalization.uploadHelp')}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>{t('personalization.manufacturingProcess')}</Label>
        <Input
          name="manufacturingProcess"
          defaultValue={boilerplate?.manufacturing_process ?? ''}
          required
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>{t('personalization.generationInstruction')}</Label>
        <Textarea
          name="generationInstruction"
          defaultValue={boilerplate?.generation_instruction ?? ''}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('personalization.displayOrder')}</Label>
        <Input name="sortOrder" type="number" defaultValue={boilerplate?.sort_order ?? 0} />
      </div>
      <div className="flex flex-wrap items-center gap-5 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={boilerplate?.is_active ?? true} />{' '}
          {t('profile.status.active')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="generateHiddenSvg"
            defaultChecked={boilerplate?.generate_hidden_svg ?? false}
          />{' '}
          {t('personalization.requiresSvg')}
        </label>
      </div>
      {boilerplate ? (
        <p className="text-xs text-muted-foreground md:col-span-3">
          {t('personalization.openaiFileId')}: <code>{boilerplate.openai_file_id}</code>
        </p>
      ) : null}
      <div className="flex items-center gap-2 md:col-span-3">
        <Button type="submit" size="sm">
          {boilerplate
            ? t('personalization.updateBoilerplate')
            : t('personalization.addBoilerplate')}
        </Button>
        {boilerplate ? (
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            formAction={removeBoilerplateAction}
            formNoValidate
          >
            {t('cart.remove')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Simplify `app/admin/personalization/page.tsx` to link directly to the library**

Replace the whole file:

```tsx
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function PersonalizationPage() {
  const t = await getTranslations();
  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('personalization.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('personalization.subtitle')}</p>
      </div>

      <Link
        href="/admin/personalization/boilerplates"
        className="block max-w-sm rounded-lg border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <h2 className="text-lg font-semibold">{t('personalization.libraryCard')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('personalization.libraryCardHelp')}</p>
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `pnpm dev`, sign in as an admin, visit `/admin/personalization` → click through to `/admin/personalization/boilerplates`, add a boilerplate with a real image (requires `OPENAI_API_KEY` configured), confirm it saves and shows an OpenAI file ID, then edit and delete it.

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): add shared boilerplate library, replacing the night-lights admin page"
```

---

### Task 4: Admin item form — System Prompt / Skill ID / Tags / Boilerplate picker

**Files:**
- Modify: `app/admin/items/item-form/types.ts`
- Create: `app/admin/items/item-form/personalization-fields.tsx`
- Modify: `app/admin/items/item-form/basics-fields.tsx`
- Modify: `app/admin/items/item-form/index.tsx`
- Modify: `app/admin/items/item-form-parsing.ts`
- Modify: `app/admin/items/actions.ts`
- Modify: `app/admin/items/[id]/page.tsx`
- Modify: `app/admin/items/new/page.tsx`
- Create: `tests/lib/item-form-parsing.test.ts`

**Interfaces:**
- Consumes: `ItemFormValue` (extended in this task), `PersonalizationBoilerplate` (`lib/personalization-boilerplates.ts`), `PERSONALIZATION_TAGS`/`PersonalizationTag` (`lib/personalization-constants.ts`).
- Produces: `validatePersonalizationConfig(item)`, `syncCatalogItemBoilerplates(supabase, catalogItemId, boilerplateIds)` (`app/admin/items/item-form-parsing.ts`) — consumed only within this task's own `actions.ts`.

- [ ] **Step 1: Extend `ItemFormValue` and add a `BoilerplateOption` type**

Modify `app/admin/items/item-form/types.ts` — change the `ItemFormValue` export:

```ts
export type ItemFormValue = Partial<
  Pick<
    Tables<'catalog_items'>,
    | 'id'
    | 'title'
    | 'slug'
    | 'category_id'
    | 'subcategory_id'
    | 'item_type'
    | 'description'
    | 'price_cents'
    | 'status'
    | 'is_popular'
    | 'is_customizable'
    | 'thumbnail_path'
    | 'manufacturing_notes'
    | 'sizes'
    | 'characteristics'
    | 'system_prompt'
    | 'skill_id'
    | 'tags'
  >
>;

export type BoilerplateOption = Pick<Tables<'personalization_boilerplates'>, 'id' | 'name'>;
```

- [ ] **Step 2: Create `app/admin/items/item-form/personalization-fields.tsx`**

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PERSONALIZATION_TAGS } from '@/lib/personalization-constants';
import type { BoilerplateOption, ItemFormValue } from './types';

const TAG_LABELS: Record<(typeof PERSONALIZATION_TAGS)[number], string> = {
  personal_color: 'Personal Color',
  personal_text: 'Personal Text',
  personal_photo: 'Personal Photo',
};

export function PersonalizationFields({
  item,
  boilerplateOptions,
  selectedBoilerplateIds,
}: {
  item?: Pick<ItemFormValue, 'system_prompt' | 'skill_id' | 'tags'>;
  boilerplateOptions: BoilerplateOption[];
  selectedBoilerplateIds: string[];
}) {
  const selected = new Set(selectedBoilerplateIds);
  const tags = new Set(item?.tags ?? []);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-2">
        <Label htmlFor="systemPrompt">System prompt</Label>
        <Textarea
          id="systemPrompt"
          name="systemPrompt"
          defaultValue={item?.system_prompt ?? ''}
          placeholder="Base generation instructions for this item's AI personalization."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="skillId">Skill ID</Label>
        <Input
          id="skillId"
          name="skillId"
          defaultValue={item?.skill_id ?? ''}
          placeholder="Opaque reference to an OpenAI Assistant/Skill resource"
        />
      </div>
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-4">
          {PERSONALIZATION_TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="tags" value={tag} defaultChecked={tags.has(tag)} />
              {TAG_LABELS[tag]}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Boilerplates</Label>
        {boilerplateOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {boilerplateOptions.map((boilerplate) => (
              <label
                key={boilerplate.id}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="boilerplateIds"
                  value={boilerplate.id}
                  defaultChecked={selected.has(boilerplate.id)}
                />
                {boilerplate.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No boilerplates yet. Add some in the{' '}
            <a href="/admin/personalization/boilerplates" className="underline">
              boilerplate library
            </a>{' '}
            first.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        At least one of System prompt, Skill ID, or a selected boilerplate is required when
        Customizable is checked.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Wire the Customizable checkbox to reveal the new fields**

Modify `app/admin/items/item-form/basics-fields.tsx` — change the `FlagsFields` export:

```tsx
export function FlagsFields({
  item,
  onCustomizableChange,
}: {
  item?: Pick<ItemFormValue, 'is_popular' | 'is_customizable'>;
  onCustomizableChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-6">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPopular" defaultChecked={item?.is_popular ?? false} />
        Popular
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isCustomizable"
          defaultChecked={item?.is_customizable ?? false}
          onChange={(event) => onCustomizableChange?.(event.target.checked)}
        />
        Customizable
      </label>
    </div>
  );
}
```

Modify `app/admin/items/item-form/index.tsx` — add the `useState` import, `PersonalizationFields` import, extend the `ItemForm` props, and render the new section:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createCatalogItemAction, updateCatalogItemAction } from '@/app/admin/items/actions';
import { errorOf, idleState } from '@/lib/action-state';
import {
  ClassificationFields,
  DescriptionField,
  FlagsFields,
  StatusField,
  TitleSlugFields,
} from './basics-fields';
import { MarketRulesSection } from './market-rules-fields';
import { MediaSection, ThumbnailFields } from './media-fields';
import { PersonalizationFields } from './personalization-fields';
import {
  ManufacturingNotesField,
  PriceField,
  SizesCharacteristicsFields,
} from './pricing-size-fields';
import { SeoSection } from './seo-section';
import type {
  BoilerplateOption,
  CatalogMediaFormValue,
  CategoryOption,
  ItemFormValue,
  MarketCountryFormValue,
  MarketRegionFormValue,
  MarketRuleFormValue,
  SeoFormValue,
  SubcategoryOption,
} from './types';

export function ItemForm({
  categories,
  subcategories,
  item,
  media,
  seo,
  seoRecords,
  marketRegions = [],
  marketCountries = [],
  marketRules = [],
  boilerplateOptions = [],
  selectedBoilerplateIds = [],
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  item?: ItemFormValue;
  media?: CatalogMediaFormValue[];
  seo?: SeoFormValue | null;
  seoRecords?: SeoFormValue[];
  marketRegions?: MarketRegionFormValue[];
  marketCountries?: MarketCountryFormValue[];
  marketRules?: MarketRuleFormValue[];
  boilerplateOptions?: BoilerplateOption[];
  selectedBoilerplateIds?: string[];
}) {
  const actionFn = item?.id ? updateCatalogItemAction : createCatalogItemAction;
  const [state, action, pending] = useActionState(actionFn, idleState);
  const error = errorOf(state);
  const [isCustomizable, setIsCustomizable] = useState(item?.is_customizable ?? false);

  return (
    <form action={action} className="space-y-6">
      {item?.id && <input type="hidden" name="id" value={item.id} />}

      <TitleSlugFields item={item} />

      {marketRegions.length > 0 && (
        <MarketRulesSection
          marketRegions={marketRegions}
          marketCountries={marketCountries}
          marketRules={marketRules}
        />
      )}

      <ClassificationFields categories={categories} subcategories={subcategories} item={item} />

      <div className="grid gap-4 md:grid-cols-3">
        <PriceField item={item} />
        <StatusField item={item} />
      </div>

      <DescriptionField item={item} />

      <ThumbnailFields item={item} />

      <MediaSection media={media} />

      <ManufacturingNotesField item={item} />

      <SizesCharacteristicsFields item={item} />

      <SeoSection item={item} seo={seo} seoRecords={seoRecords} />

      <FlagsFields item={item} onCustomizableChange={setIsCustomizable} />

      {isCustomizable && (
        <PersonalizationFields
          item={item}
          boilerplateOptions={boilerplateOptions}
          selectedBoilerplateIds={selectedBoilerplateIds}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : item?.id ? 'Save item' : 'Create item'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Write the failing test for form validation**

Create `tests/lib/item-form-parsing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validatePersonalizationConfig } from '@/app/admin/items/item-form-parsing';

describe('validatePersonalizationConfig', () => {
  it('passes non-customizable items regardless of personalization fields', () => {
    expect(
      validatePersonalizationConfig({ isCustomizable: false, boilerplateIds: [] }),
    ).toBe(true);
  });

  it('fails a customizable item with no system prompt, skill id, or boilerplates', () => {
    expect(
      validatePersonalizationConfig({ isCustomizable: true, boilerplateIds: [] }),
    ).toBe(false);
  });

  it('passes when a system prompt is set', () => {
    expect(
      validatePersonalizationConfig({
        isCustomizable: true,
        systemPrompt: 'Base instructions.',
        boilerplateIds: [],
      }),
    ).toBe(true);
  });

  it('passes when a skill id is set', () => {
    expect(
      validatePersonalizationConfig({
        isCustomizable: true,
        skillId: 'skill-123',
        boilerplateIds: [],
      }),
    ).toBe(true);
  });

  it('passes when at least one boilerplate is selected', () => {
    expect(
      validatePersonalizationConfig({
        isCustomizable: true,
        boilerplateIds: ['00000000-0000-0000-0000-000000000001'],
      }),
    ).toBe(true);
  });
});
```

Run: `pnpm vitest run tests/lib/item-form-parsing.test.ts`
Expected: FAIL — `validatePersonalizationConfig` is not exported from `app/admin/items/item-form-parsing.ts` (it doesn't exist yet).

- [ ] **Step 5: Extend `app/admin/items/item-form-parsing.ts`**

Modify the `itemSchema` — add fields after `characteristics`:

```ts
export const itemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a URL-safe slug.'),
  categoryId: z.uuid('Choose a category.'),
  subcategoryId: z.union([z.uuid(), z.literal('')]),
  itemType: z.enum([
    'standard',
    'toy',
    'decoration',
    'night_light',
    'personalized_night_light',
    'banner',
  ]),
  description: z.string().trim().optional(),
  priceCents: z.coerce.number().int().min(0, 'Price cannot be negative.'),
  status: z.enum(['draft', 'published', 'archived']),
  isPopular: z.boolean(),
  isCustomizable: z.boolean(),
  thumbnailPath: z.string().trim().optional(),
  manufacturingNotes: z.string().trim().optional(),
  sizesJson: z.string().trim().optional(),
  characteristics: z.string().trim().optional(),
  systemPrompt: z.string().trim().optional(),
  skillId: z.string().trim().optional(),
  tags: z.array(z.enum(['personal_color', 'personal_text', 'personal_photo'])),
  boilerplateIds: z.array(z.uuid()),
  seo: z.object({
    en: seoLocaleSchema,
    ru: seoLocaleSchema,
    am: seoLocaleSchema,
  }),
});
```

Modify `parseItemForm` — add the new field reads:

```ts
export function parseItemForm(formData: FormData) {
  return itemSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    categoryId: formData.get('categoryId'),
    subcategoryId: formData.get('subcategoryId') || '',
    itemType: formData.get('itemType') || 'standard',
    description: formData.get('description') || undefined,
    priceCents: formData.get('priceCents'),
    status: formData.get('status'),
    isPopular: formData.get('isPopular') === 'on',
    isCustomizable: formData.get('isCustomizable') === 'on',
    thumbnailPath: formData.get('thumbnailPath') || undefined,
    manufacturingNotes: formData.get('manufacturingNotes') || undefined,
    sizesJson: formData.get('sizesJson') || undefined,
    characteristics: formData.get('characteristics') || undefined,
    systemPrompt: formData.get('systemPrompt') || undefined,
    skillId: formData.get('skillId') || undefined,
    tags: formData.getAll('tags').map(String),
    boilerplateIds: formData.getAll('boilerplateIds').map(String),
    seo: {
      en: readSeoLocale(formData, 'en'),
      ru: readSeoLocale(formData, 'ru'),
      am: readSeoLocale(formData, 'am'),
    },
  });
}
```

Add two new exported functions at the end of the file (after `syncCatalogItemMedia`):

```ts
/** True unless the item is customizable with no System Prompt, Skill ID, or boilerplate selected. */
export function validatePersonalizationConfig(item: {
  isCustomizable: boolean;
  systemPrompt?: string;
  skillId?: string;
  boilerplateIds: string[];
}) {
  if (!item.isCustomizable) return true;
  return Boolean(item.systemPrompt) || Boolean(item.skillId) || item.boilerplateIds.length > 0;
}

export async function syncCatalogItemBoilerplates(
  supabase: AdminSupabase,
  catalogItemId: string,
  boilerplateIds: string[],
) {
  const { error: deleteError } = await supabase
    .from('catalog_item_boilerplates')
    .delete()
    .eq('catalog_item_id', catalogItemId);
  if (deleteError) throw new Error(deleteError.message);
  if (!boilerplateIds.length) return;
  const { error } = await supabase.from('catalog_item_boilerplates').insert(
    boilerplateIds.map((boilerplateId, index) => ({
      catalog_item_id: catalogItemId,
      boilerplate_id: boilerplateId,
      sort_order: index,
    })),
  );
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run tests/lib/item-form-parsing.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Wire validation and boilerplate sync into `app/admin/items/actions.ts`**

Modify the import block at the top:

```ts
import {
  type AdminSupabase,
  getOptionalFile,
  type itemSchema,
  parseItemForm,
  parseKeywords,
  parseSizesJson,
  ensureCatalogSlugIsAvailable,
  syncCatalogItemBoilerplates,
  syncCatalogItemMedia,
  uploadAdminCatalogAsset,
  validatePersonalizationConfig,
} from './item-form-parsing';
```

In `createCatalogItemAction`, add the validation check right after the `validSubcategory` check and before `sizes` parsing:

```ts
  if (!validSubcategory) return actionError('Selected subcategory does not belong to category.');
  if (!validatePersonalizationConfig(item)) {
    return actionError(
      'Customizable items need a System Prompt, a Skill ID, or at least one boilerplate.',
    );
  }
  let sizes: Json[];
```

Add `system_prompt`, `skill_id`, `tags` to the `.insert({ ... })` payload, immediately after `characteristics: item.characteristics ?? null,`:

```ts
      characteristics: item.characteristics ?? null,
      system_prompt: item.systemPrompt ?? null,
      skill_id: item.skillId ?? null,
      tags: item.tags,
      created_by: user.id,
```

After the existing `await syncCatalogItemMedia(...)` call in `createCatalogItemAction`, add:

```ts
  await syncCatalogItemBoilerplates(supabase, data.id, item.boilerplateIds);
```

Apply the same three changes to `updateCatalogItemAction`: the validation check after its `validSubcategory` check, the same three fields in its `.update({ ... })` payload (no `created_by` there), and `await syncCatalogItemBoilerplates(supabase, id, item.boilerplateIds);` after its `syncCatalogItemMedia` call.

- [ ] **Step 8: Fetch boilerplate options and selections in the admin item pages**

Modify `app/admin/items/[id]/page.tsx` — extend the `catalog_items` select string (in the first `Promise.all` entry):

```ts
      .select(
        'id, title, slug, category_id, subcategory_id, item_type, description, price_cents, status, is_popular, is_customizable, thumbnail_path, manufacturing_notes, sizes, characteristics, system_prompt, skill_id, tags',
      )
```

Add two more queries to the `Promise.all` array (after `marketRules`), and destructure them:

```ts
  const [
    { data: item, error },
    { data: categories },
    { data: subcategories },
    { data: seoRecords },
    { data: media },
    geography,
    { data: marketRules },
    { data: boilerplateOptions },
    { data: itemBoilerplates },
  ] = await Promise.all([
    supabase
      .from('catalog_items')
      .select(
        'id, title, slug, category_id, subcategory_id, item_type, description, price_cents, status, is_popular, is_customizable, thumbnail_path, manufacturing_notes, sizes, characteristics, system_prompt, skill_id, tags',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('subcategories')
      .select('id, name, category_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('catalog_item_seo_metadata')
      .select(
        'locale, seo_slug, seo_title, seo_description, keywords, og_title, og_description, social_image_path, noindex, generated_by_ai, reviewed_by_admin',
      )
      .eq('catalog_item_id', id)
      .order('locale', { ascending: true })
      .returns<SeoMetadata[]>(),
    supabase
      .from('catalog_item_media')
      .select('id, media_type, storage_path, alt_text, sort_order, is_primary')
      .eq('catalog_item_id', id)
      .order('sort_order', { ascending: true })
      .returns<CatalogMedia[]>(),
    listMarketGeography(supabase),
    supabase
      .from('catalog_item_market_rules')
      .select('id, region_id, country_code, visibility_override, shipping_rate_cents')
      .eq('catalog_item_id', id),
    supabase
      .from('personalization_boilerplates')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<{ id: string; name: string }[]>(),
    supabase
      .from('catalog_item_boilerplates')
      .select('boilerplate_id')
      .eq('catalog_item_id', id)
      .returns<{ boilerplate_id: string }[]>(),
  ]);
```

Pass the new props to `<ItemForm ... />`:

```tsx
      <ItemForm
        categories={categories ?? []}
        subcategories={subcategories ?? []}
        item={item}
        media={media ?? []}
        seoRecords={seoRecords ?? []}
        marketRegions={geography.regions}
        marketCountries={geography.countries.map((country) => ({
          ...country,
          label: getCountryDisplayName(country.code),
        }))}
        marketRules={marketRules ?? []}
        boilerplateOptions={boilerplateOptions ?? []}
        selectedBoilerplateIds={(itemBoilerplates ?? []).map((row) => row.boilerplate_id)}
      />
```

Modify `app/admin/items/new/page.tsx` — add a boilerplate options query and pass it through:

```tsx
import { ItemForm } from '@/app/admin/items/item-form';
import { requireAdmin } from '@/lib/admin';
import { getCountryDisplayName, listMarketGeography } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function NewAdminItemPage() {
  const { supabase } = await requireAdmin();
  const [{ data: categories, error }, { data: subcategories }, geography, { data: boilerplateOptions }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .returns<{ id: string; name: string }[]>(),
      supabase
        .from('subcategories')
        .select('id, name, category_id')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .returns<{ id: string; name: string; category_id: string }[]>(),
      listMarketGeography(supabase),
      supabase
        .from('personalization_boilerplates')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .returns<{ id: string; name: string }[]>(),
    ]);

  return (
    <main className="container max-w-4xl space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New item</h1>
        <p className="text-muted-foreground">Create a marketplace catalog item.</p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : (
        <ItemForm
          categories={categories ?? []}
          subcategories={subcategories ?? []}
          marketRegions={geography.regions}
          marketCountries={geography.countries.map((country) => ({
            ...country,
            label: getCountryDisplayName(country.code),
          }))}
          boilerplateOptions={boilerplateOptions ?? []}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 9: Manual verification**

Run: `pnpm dev`, sign in as admin, go to `/admin/items/new`, check "Customizable" and confirm System Prompt/Skill ID/Tags/Boilerplates appear; try saving with the checkbox checked and nothing else filled in — confirm the inline error appears; fill in a System Prompt and save; edit the item again and confirm the fields and boilerplate selection persist.

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(admin): add personalization config (system prompt, skill id, tags, boilerplates) to the item form"
```

---

### Task 5: Storefront — generic personalize page, form, and item-detail entry point

**Files:**
- Modify: `app/items/[slug]/page.tsx`
- Create: `app/personalize/[itemSlug]/page.tsx`
- Create: `components/personalize-item-form.tsx`
- Modify: `messages/en.json`, `messages/ru.json`, `messages/am.json`

**Interfaces:**
- Consumes: `getCatalogItem(slug)` and `CatalogItem.system_prompt`/`skill_id`/`tags` (`lib/marketplace.ts`, generalized in Task 2 Step 17), `listCatalogItemBoilerplates` (`lib/personalization-boilerplates.ts`), `COMFORTABLE_COLORS`/`MAX_PERSONALIZED_TEXT_LENGTH`/`DEFAULT_COLOR_VALUE` (`lib/personalization-constants.ts`), `generatePersonalizedItemAction`/`PersonalizedGenerationState` (Task 2's `app/personalize/actions.ts`), the `personalize.*` i18n namespace (renamed from `nightLight` in Task 2 Step 15).
- Produces: `PersonalizeItemForm` component (`components/personalize-item-form.tsx`) — used only by `app/personalize/[itemSlug]/page.tsx`.

- [ ] **Step 1: Add the "Personalize with AI" button to the item detail page**

Modify `app/items/[slug]/page.tsx` — add imports:

```ts
import { listCatalogItemBoilerplates } from '@/lib/personalization-boilerplates';
import { getServerSupabase } from '@/lib/supabase/server';
```

In `CatalogItemDetailPage`, after `const item = await getCatalogItem(slug).catch(() => null); if (!item) notFound();`, add:

```ts
  const supabase = await getServerSupabase();
  const hasUsablePersonalization =
    item.is_customizable &&
    (Boolean(item.system_prompt) ||
      (await listCatalogItemBoilerplates(supabase, item.id).catch(() => [])).length > 0);
```

Replace the action buttons block (currently the "Add to cart" form + disabled "Buy" tooltip) — insert a "Personalize with AI" button before the existing `<div className="flex flex-wrap gap-3">`:

```tsx
            {hasUsablePersonalization && (
              <Button asChild size="lg" variant="secondary">
                <Link href={`/personalize/${item.slug}`}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('product.personalize')}
                </Link>
              </Button>
            )}

            <div className="flex flex-wrap gap-3">
```

(`Sparkles` and `Link` are already imported at the top of this file.)

- [ ] **Step 2: Add the `product.personalize` i18n key**

Modify `messages/en.json` — in the `"product"` block, add after `"customizable": "Customizable",`:

```json
    "personalize": "Personalize with AI",
```

Modify `messages/ru.json` — same location:

```json
    "personalize": "Персонализировать с помощью ИИ",
```

Modify `messages/am.json` — same location:

```json
    "personalize": "Անհատականացնել AI-ով",
```

(The `nightLight` i18n namespace was already renamed to `personalize`, and `personalizedList` deleted, in Task 2 Step 15 — both are needed by Task 2's `app/personalize/actions.ts` and `app/generated/[id]/page.tsx`, so that rename happened earlier in the plan than this task.)

- [ ] **Step 3: Create `components/personalize-item-form.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  Bold,
  Check,
  ImagePlus,
  Italic,
  LoaderCircle,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  generatePersonalizedItemAction,
  type PersonalizedGenerationState,
} from '@/app/personalize/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_COLOR_VALUE, MAX_PERSONALIZED_TEXT_LENGTH } from '@/lib/personalization-constants';

const initialState: PersonalizedGenerationState = { code: 'idle', message: null };

export interface PersonalizeBoilerplateOption {
  id: string;
  name: string;
  imageUrl: string;
}

export interface PersonalizeColorOption {
  value: string;
  label: string;
  hex: string;
}

export function PersonalizeItemForm({
  catalogItemId,
  boilerplates,
  colors,
  showColor,
  showText,
  showPhoto,
  copy,
}: {
  catalogItemId: string;
  boilerplates: PersonalizeBoilerplateOption[];
  colors: PersonalizeColorOption[];
  showColor: boolean;
  showText: boolean;
  showPhoto: boolean;
  copy: Record<string, string>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValidHtml = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [fileName, setFileName] = useState('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creditDialogDismissed, setCreditDialogDismissed] = useState(false);
  const [state, formAction, pending] = useActionState(generatePersonalizedItemAction, initialState);
  const remaining = MAX_PERSONALIZED_TEXT_LENGTH - text.length;
  const selectedCount = selected.length;
  const requiresBoilerplateSelection = boilerplates.length > 0;
  const canSubmit =
    (!requiresBoilerplateSelection || selectedCount > 0) && (!showPhoto || Boolean(fileName));

  useEffect(
    () => () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    },
    [filePreview],
  );

  function syncEditor() {
    const editor = editorRef.current;
    if (!editor) return;
    const nextText = (editor.innerText ?? '').replace(/\r/g, '');
    if (nextText.length > MAX_PERSONALIZED_TEXT_LENGTH) {
      editor.innerHTML = lastValidHtml.current;
      return;
    }
    lastValidHtml.current = editor.innerHTML;
    setText(nextText);
    setHtml(editor.innerHTML);
  }

  function format(command: 'bold' | 'italic' | 'justifyLeft' | 'justifyCenter') {
    editorRef.current?.focus();
    document.execCommand(command);
    syncEditor();
  }

  function toggleBoilerplate(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function updateFile(file?: File) {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFileName(file?.name ?? '');
    setFilePreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        setCreditDialogDismissed(false);
        if (!canSubmit) event.preventDefault();
      }}
      className="space-y-6 rounded-xl border bg-card p-5 shadow-sm"
    >
      <input type="hidden" name="catalogItemId" value={catalogItemId} />
      <input type="hidden" name="customText" value={showText ? text : ''} />
      <input type="hidden" name="customTextHtml" value={showText ? html : ''} />
      {!showColor ? <input type="hidden" name="color" value={DEFAULT_COLOR_VALUE} /> : null}

      {requiresBoilerplateSelection ? (
        <section className="space-y-3">
          <div>
            <Label>{copy.chooseTemplates}</Label>
            <p className="mt-1 text-sm text-muted-foreground">{copy.chooseTemplatesHelp}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boilerplates.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition focus-within:ring-2 focus-within:ring-ring ${checked ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'}`}
                >
                  <input
                    type="checkbox"
                    name="boilerplateIds"
                    value={option.id}
                    checked={checked}
                    onChange={() => toggleBoilerplate(option.id)}
                    className="sr-only"
                  />
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {/* biome-ignore lint/performance/noImgElement: dynamic signed storage URL; next/image cannot optimize expiring URLs */}
                    <img
                      src={option.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                    <span
                      className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border bg-background shadow ${checked ? 'border-primary bg-primary text-primary-foreground' : ''}`}
                    >
                      {checked ? <Check className="h-4 w-4" /> : null}
                    </span>
                  </div>
                  <span className="block p-3 text-sm font-medium">{option.name}</span>
                </label>
              );
            })}
          </div>
          {!selectedCount ? (
            <p className="text-sm text-muted-foreground">{copy.selectAtLeastOne}</p>
          ) : null}
        </section>
      ) : null}

      {showPhoto ? (
        <section className="space-y-2">
          <Label htmlFor="images">{copy.image}</Label>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: label wraps the file input control */}
          <label className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground transition hover:bg-muted/50">
            {filePreview ? (
              // biome-ignore lint/performance/noImgElement: local FileReader data-URL preview
              <img
                src={filePreview}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-25"
              />
            ) : null}
            <ImagePlus className="relative h-8 w-8" />
            <span className="relative font-medium text-foreground">{fileName || copy.upload}</span>
            <Input
              ref={fileInputRef}
              id="images"
              name="images"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              className="sr-only"
              onChange={(event) => updateFile(event.target.files?.[0])}
            />
            {fileName ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2 h-8 w-8"
                aria-label="Remove image"
                onClick={(event) => {
                  event.preventDefault();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  updateFile();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </label>
        </section>
      ) : null}

      {showColor ? (
        <section className="space-y-3">
          <Label htmlFor="color">{copy.color}</Label>
          <div className="grid grid-cols-3 gap-2">
            {colors.map((color) => (
              <label
                key={color.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="color"
                  value={color.value}
                  defaultChecked={color.value === DEFAULT_COLOR_VALUE}
                />
                <span
                  className="h-4 w-4 rounded-full border shadow-inner"
                  style={{ backgroundColor: color.hex }}
                />
                {color.label}
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {showText ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="customTextEditor">
              {copy.text}{' '}
              <span className="font-normal text-muted-foreground">({copy.textOptional})</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              {copy.charactersRemaining.replace('{count}', String(remaining))}
            </span>
          </div>
          <div className="overflow-hidden rounded-md border bg-background">
            <div
              className="flex gap-1 border-b bg-muted/40 p-1"
              role="toolbar"
              aria-label="Text formatting"
            >
              <EditorButton label="Bold" onClick={() => format('bold')}>
                <Bold className="h-4 w-4" />
              </EditorButton>
              <EditorButton label="Italic" onClick={() => format('italic')}>
                <Italic className="h-4 w-4" />
              </EditorButton>
              <EditorButton label="Align left" onClick={() => format('justifyLeft')}>
                <AlignLeft className="h-4 w-4" />
              </EditorButton>
              <EditorButton label="Align center" onClick={() => format('justifyCenter')}>
                <AlignCenter className="h-4 w-4" />
              </EditorButton>
            </div>
            <div className="relative">
              {!text ? (
                <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
                  {copy.textPlaceholder}
                </span>
              ) : null}
              {/* biome-ignore lint/a11y/useSemanticElements: rich contentEditable editor; textarea/input cannot hold formatted content */}
              <div
                ref={editorRef}
                id="customTextEditor"
                contentEditable
                tabIndex={0}
                role="textbox"
                aria-multiline="true"
                className="min-h-24 px-3 py-2 text-sm outline-none"
                onInput={syncEditor}
                onBlur={syncEditor}
                suppressContentEditableWarning
              />
            </div>
          </div>
        </section>
      ) : null}

      {state.code === 'error' && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      <div className="sticky bottom-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{copy.creditPerStyle}</span>
          <strong>{copy.creditTotal.replace('{count}', String(Math.max(selectedCount, 1)))}</strong>
        </div>
        <Button type="submit" className="w-full" disabled={pending || !canSubmit}>
          {pending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <WandSparkles className="mr-2 h-4 w-4" />
          )}
          {pending
            ? copy.generatingTitle
            : copy.generate.replace('{count}', String(Math.max(selectedCount, 1)))}
        </Button>
      </div>

      {pending ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-xl">
            <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 className="mt-5 text-xl font-semibold">{copy.generatingTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.generatingBody}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </div>
      ) : null}

      {state.code === 'insufficient_credits' && !creditDialogDismissed && !pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-dialog-title"
            className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl"
          >
            <h2 id="credits-dialog-title" className="text-xl font-semibold">
              {copy.notEnoughCredits}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-center text-sm">
              <div>
                <span className="block text-muted-foreground">{copy.requiredCredits}</span>
                <strong>{state.requiredCredits ?? selectedCount}</strong>
              </div>
              <div>
                <span className="block text-muted-foreground">{copy.availableCredits}</span>
                <strong>{state.availableCredits ?? '—'}</strong>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreditDialogDismissed(true)}
              >
                {copy.cancel}
              </Button>
              <Button asChild>
                <Link href="/credits">{copy.buyCredits}</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function EditorButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
```

- [ ] **Step 4: Create `app/personalize/[itemSlug]/page.tsx`**

```tsx
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { PersonalizeItemForm } from '@/components/personalize-item-form';
import { Button } from '@/components/ui/button';
import { getCatalogItem } from '@/lib/marketplace';
import { listCatalogItemBoilerplates } from '@/lib/personalization-boilerplates';
import { COMFORTABLE_COLORS } from '@/lib/personalization-constants';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { resolvePublicStorageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function PersonalizeItemPage({
  params,
}: {
  params: Promise<{ itemSlug: string }>;
}) {
  const { itemSlug } = await params;
  const [item, user, t, tRoot] = await Promise.all([
    getCatalogItem(itemSlug).catch(() => null),
    getCurrentUser(),
    getTranslations('personalize'),
    getTranslations(),
  ]);
  if (!item || !item.is_customizable) notFound();

  const supabase = await getServerSupabase();
  const boilerplateRows = await listCatalogItemBoilerplates(supabase, item.id);
  const hasUsablePersonalization = Boolean(item.system_prompt) || boilerplateRows.length > 0;
  if (!hasUsablePersonalization && !item.skill_id) notFound();

  const boilerplates = boilerplateRows.map((boilerplate) => ({
    id: boilerplate.id,
    name: boilerplate.name,
    imageUrl: resolvePublicStorageUrl('catalog-assets', boilerplate.image_path) ?? '',
  }));
  const thumbnailUrl = resolvePublicStorageUrl('catalog-assets', item.thumbnail_path);
  const tags = new Set(item.tags ?? []);

  return (
    <>
      <MarketplaceHeader />
      <main className="storefront-container space-y-8 py-10">
        <Button asChild variant="ghost" className="px-0">
          <Link href={`/items/${item.slug}`}>{t('back')}</Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section className="space-y-4">
            <div className="product-art-frame flex aspect-[4/3] items-center justify-center rounded-lg border p-4">
              {thumbnailUrl ? (
                <Image
                  src={thumbnailUrl}
                  alt={item.title}
                  width={480}
                  height={360}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-sm text-muted-foreground">{item.title}</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
              {item.description && (
                <p className="mt-1 text-muted-foreground">{item.description}</p>
              )}
            </div>
          </section>

          <aside>
            {!user ? (
              <div className="space-y-4 rounded-lg border p-5">
                <h2 className="text-xl font-semibold">{t('signInTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('signInBody')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild>
                    <Link href={`/login?next=/personalize/${item.slug}`}>{tRoot('auth.login')}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/register?next=/personalize/${item.slug}`}>
                      {tRoot('auth.signup')}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : !hasUsablePersonalization ? (
              <div className="space-y-3 rounded-lg border p-5">
                <h2 className="text-xl font-semibold">{t('comingSoonTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('comingSoonBody')}</p>
              </div>
            ) : (
              <PersonalizeItemForm
                catalogItemId={item.id}
                boilerplates={boilerplates}
                colors={[...COMFORTABLE_COLORS]}
                showColor={tags.has('personal_color')}
                showText={tags.has('personal_text')}
                showPhoto={tags.has('personal_photo')}
                copy={{
                  chooseTemplates: t('chooseTemplates'),
                  chooseTemplatesHelp: t('chooseTemplatesHelp'),
                  image: t('image'),
                  upload: t('upload'),
                  color: t('color'),
                  text: t('text'),
                  textOptional: t('textOptional'),
                  textPlaceholder: t('textPlaceholder'),
                  charactersRemaining: t.raw('charactersRemaining'),
                  creditPerStyle: t('creditPerStyle'),
                  creditTotal: t.raw('creditTotal'),
                  generate: t.raw('generate'),
                  generatingTitle: t('generatingTitle'),
                  generatingBody: t('generatingBody'),
                  selectAtLeastOne: t('selectAtLeastOne'),
                  notEnoughCredits: t('notEnoughCredits'),
                  buyCredits: t('buyCredits'),
                  requiredCredits: t('requiredCredits'),
                  availableCredits: t('availableCredits'),
                  cancel: tRoot('common.cancel'),
                }}
              />
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `pnpm dev`. As admin, make an existing catalog item customizable with a System Prompt and the `personal_text` + `personal_color` tags, attach a boilerplate from the library. As a signed-in customer, visit that item's detail page, confirm the "Personalize with AI" button appears, click through, select a boilerplate, add text and a color, submit, and confirm a `/generated/[id]` page renders with the item's real price. Then unset the item's `is_customizable` and confirm the button disappears and `/personalize/<slug>` 404s.

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: generic personalize page, form, and item-detail entry point"
```

---

### Task 6: Smoke test and full suite verification

**Files:**
- Modify: `scripts/smoke/generation.mjs`
- Modify: `scripts/smoke/ui-workflows.mjs`
- Modify: `scripts/smoke/catalog-media.mjs` (only if it references removed files — see Step 3)

**Interfaces:**
- Consumes: nothing new — this task only updates the "contract" string checks smoke scripts already use.

- [ ] **Step 1: Update `scripts/smoke/generation.mjs` contracts**

Modify the `requiredFiles` array (currently listing `components/personalized-night-light-form.tsx`) to reference the new files:

```js
const requiredFiles = [
  'lib/sanitize.ts',
  'components/personalize-item-form.tsx',
  'lib/personalization-boilerplates.ts',
  'lib/personalization-ai.ts',
  'supabase/migrations/0001_init.sql',
];
```

Replace the baseline-migration contract check (currently asserting `personalization_boilerplates` + `openai_file_id` in `0001_init.sql`, which no longer describes the current shape since the columns moved to the new migration) with a check against the new migration file:

```js
const personalizationMigration = readFileSync(
  'supabase/migrations/20260707140000_generic_item_personalization.sql',
  'utf8',
);
for (const contract of [
  'create table "public"."catalog_item_boilerplates"',
  'add column "system_prompt" text',
  'add column "skill_id" text',
  "add column \"tags\" text[]",
]) {
  if (!personalizationMigration.includes(contract)) {
    throw new Error(`Personalization migration is missing contract: ${contract}`);
  }
}
```

Replace the `personalizedAction` contract list (currently referencing `formData.getAll('boilerplateIds')`, `selectedBoilerplates.length`, etc. against `app/personalize/actions.ts`, which are still valid strings in the rewritten file) — no change needed there since the new `generatePersonalizedItemAction` still contains `formData.getAll('boilerplateIds')`, `reference.generate_hidden_svg`, `manufacturingFilePath: null`, `manufacturingSvgStatus: 'pending_admin_generation'`, and `reference?.openai_file_id`. Update only the one line that no longer matches literally:

```js
const personalizedAction = readFileSync('app/personalize/actions.ts', 'utf8');
for (const contract of [
  "formData.getAll('boilerplateIds')",
  'const creditCost = Math.max(selectedBoilerplates.length, 1)',
  'reference.generate_hidden_svg',
  'manufacturingFilePath: null',
  "manufacturingSvgStatus: 'pending_admin_generation'",
  'reference?.openai_file_id',
]) {
  if (!personalizedAction.includes(contract)) throw new Error(`Missing personalized generation contract: ${contract}`);
}
```

- [ ] **Step 2: Check `scripts/smoke/ui-workflows.mjs` and `scripts/smoke/catalog-media.mjs` for stale references**

Run: `grep -n "personalized-night-light-form\|personalize/\[slug\]\|night-lights/personalized\|personalization_models\|admin_name" scripts/smoke/ui-workflows.mjs scripts/smoke/catalog-media.mjs`
Expected: no matches. If any are found, update them to reference the equivalent new file/contract (e.g. `components/personalize-item-form.tsx`, `app/personalize/[itemSlug]/page.tsx`) the same way Step 1 did, following that script's existing contract-check pattern.

- [ ] **Step 3: Run the full automated test suite**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm vitest run`
Expected: all tests pass, including the new `tests/lib/personalization-ai.test.ts`, `tests/lib/marketplace-constants.test.ts`, `tests/lib/item-form-parsing.test.ts`, and the updated `tests/lib/openai-image.test.ts`.

Run: `pnpm lint`
Expected: no errors.

Run: `node scripts/smoke/generation.mjs`
Expected: `Personalized generation smoke passed`.

Run: `pnpm smoke:ui-workflows`
Expected: exits 0.

Run: `pnpm smoke:catalog-media`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: update smoke contracts for the generic personalization engine"
```
