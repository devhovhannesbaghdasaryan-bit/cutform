# Move Laser Engraving Styles Into Boilerplates (with % Price Adjustment) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the bespoke per-item laser engraving feature and re-represent the two styles (Contour/Solid) as ordinary boilerplates, adding an optional percentage price adjustment to boilerplates.

**Architecture:** Revert the laser columns and all their code across the admin form, MCP tools, AI-field autogenerate, prompt builder, generation action, and results display. Keep the commit's now-generic per-option pricing plumbing and repoint the per-option price to a new `price_adjustment_percent` column on `personalization_boilerplates`, applied via a single pure helper.

**Tech Stack:** Next.js App Router (Server Actions), TypeScript, Supabase (Postgres + generated types), Zod, Vitest, next-intl.

## Global Constraints

- **Migrations are forward-only.** Never edit the shipped
  `20260714120000_laser_glass_engraving_styles.sql`. New migration filenames use
  the `YYYYMMDDHHMMSS_description.sql` convention; use timestamps after
  `20260715120000` (the latest). This plan uses `20260720120000_…` and
  `20260720120100_…`.
- **Price formula (single source of truth):**
  `final_cents = Math.max(0, Math.round(baseCents * (1 + pct / 100)))`, where
  `pct = price_adjustment_percent ?? 0`. Lives only in
  `adjustedPriceCents()` in `lib/personalization-boilerplates.ts`.
- **Percent is an integer, any sign** (surcharge or discount). Nullable
  (`null` = no adjustment). No DB sign constraint.
- **Keep the `generated.total` i18n key** and the commit's per-option pricing
  plumbing (`metadata.unitPriceCents`/`unitCurrency`, `previewOptionPriceCents`,
  per-option currency conversion in `app/generated/actions.ts`,
  `components/generated-preview-selector.tsx`). These are generic — do not revert
  them.
- **Verification commands:** `pnpm typecheck` (tsc --noEmit), `pnpm test`
  (vitest run), `pnpm lint` (biome). Each task ends green on typecheck + the
  named tests.
- **Commit after every task.** Work on branch
  `move-engraving-styles-to-boilerplates` (already created).

---

### Task 1: Migrations + additive types + boilerplate pricing helper

Establishes the DB schema and the pure pricing helper (the one piece of genuinely
new logic), unit-tested. All edits here are additive or SQL-only, so the tree
stays green.

**Files:**
- Create: `supabase/migrations/20260720120000_drop_laser_glass_engraving_styles.sql`
- Create: `supabase/migrations/20260720120100_boilerplate_price_adjustment_percent.sql`
- Modify: `lib/supabase/database.types.ts` (add `price_adjustment_percent` to `personalization_boilerplates` Row/Insert/Update — additive only in this task)
- Modify: `lib/personalization-boilerplates.ts`
- Test: `tests/lib/personalization-boilerplates.test.ts` (create)

**Interfaces:**
- Produces: `adjustedPriceCents(baseCents: number, pct: number | null): number`
  exported from `lib/personalization-boilerplates.ts`. Consumed by Task 6.
- Produces: `price_adjustment_percent: number | null` on the
  `PersonalizationBoilerplate` interface. Consumed by Tasks 2 and 6.

- [ ] **Step 1: Write the drop migration**

Create `supabase/migrations/20260720120000_drop_laser_glass_engraving_styles.sql`:

```sql
-- Reverts 20260714120000_laser_glass_engraving_styles.sql. The per-item laser
-- engraving feature is replaced by ordinary boilerplates (Solid/Contour) plus a
-- percentage price adjustment on personalization_boilerplates. No backfill: any
-- item currently relying on these flags loses that behavior on drop.
alter table "public"."catalog_items"
  drop constraint if exists "catalog_items_laser_solid_price_cents_check",
  drop column if exists "laser_contour_enabled",
  drop column if exists "laser_solid_enabled",
  drop column if exists "laser_solid_price_cents",
  drop column if exists "laser_solid_prompt";
```

- [ ] **Step 2: Write the add-column migration**

Create `supabase/migrations/20260720120100_boilerplate_price_adjustment_percent.sql`:

```sql
-- Optional percentage adjustment applied to an item's base price when this
-- boilerplate is selected during personalization. Any sign (surcharge or
-- discount); null means no adjustment. Final price is floored at 0 in app code.
alter table "public"."personalization_boilerplates"
  add column "price_adjustment_percent" integer;
```

- [ ] **Step 3: Add the new column to generated types (additive)**

In `lib/supabase/database.types.ts`, find the `personalization_boilerplates`
table block (the `Row`, `Insert`, and `Update` shapes). Add the line
`price_adjustment_percent: number | null` to `Row`, and
`price_adjustment_percent?: number | null` to both `Insert` and `Update`, placed
alphabetically/adjacent to the other columns (e.g. after `openai_file_id` or
`name` — position does not matter functionally). Do NOT touch the `catalog_items`
laser fields in this task.

- [ ] **Step 4: Write the failing test for the pricing helper**

Create `tests/lib/personalization-boilerplates.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { adjustedPriceCents } from '@/lib/personalization-boilerplates';

describe('adjustedPriceCents', () => {
  it('returns the base price unchanged for a null percent', () => {
    expect(adjustedPriceCents(5000, null)).toBe(5000);
  });

  it('returns the base price unchanged for a 0 percent', () => {
    expect(adjustedPriceCents(5000, 0)).toBe(5000);
  });

  it('adds a positive percent as a surcharge', () => {
    expect(adjustedPriceCents(5000, 20)).toBe(6000);
  });

  it('subtracts a negative percent as a discount', () => {
    expect(adjustedPriceCents(5000, -10)).toBe(4500);
  });

  it('rounds to the nearest cent', () => {
    // 4999 * 1.125 = 5623.875 -> 5624
    expect(adjustedPriceCents(4999, 12.5 as number)).toBe(5624);
  });

  it('floors at 0 for a percent below -100', () => {
    expect(adjustedPriceCents(5000, -150)).toBe(0);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test -- tests/lib/personalization-boilerplates.test.ts`
Expected: FAIL — `adjustedPriceCents` is not exported.

- [ ] **Step 6: Add the field and helper to the boilerplate lib**

In `lib/personalization-boilerplates.ts`, add `price_adjustment_percent` to the
interface (after `sort_order`):

```typescript
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
  price_adjustment_percent: number | null;
}
```

Add `price_adjustment_percent` to the select string inside
`listCatalogItemBoilerplates` (the nested `boilerplate:personalization_boilerplates(...)`
column list), so it reads:

```typescript
    .select(
      'sort_order, boilerplate:personalization_boilerplates(id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order, price_adjustment_percent)',
    )
```

Add the pure helper at the end of the file:

```typescript
/**
 * Applies a boilerplate's optional percentage price adjustment to an item's base
 * price. `pct` is an integer percent of any sign (surcharge or discount); null
 * means no adjustment. The result is rounded to the nearest cent and floored at 0.
 */
export function adjustedPriceCents(baseCents: number, pct: number | null): number {
  return Math.max(0, Math.round(baseCents * (1 + (pct ?? 0) / 100)));
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test -- tests/lib/personalization-boilerplates.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (all changes additive; laser fields still present everywhere else).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260720120000_drop_laser_glass_engraving_styles.sql supabase/migrations/20260720120100_boilerplate_price_adjustment_percent.sql lib/supabase/database.types.ts lib/personalization-boilerplates.ts tests/lib/personalization-boilerplates.test.ts
git commit -m "feat(boilerplates): add price_adjustment_percent column + helper; migrations to drop laser columns"
```

---

### Task 2: Expose price adjustment % in the admin boilerplate form

Adds the admin input and persistence for the new field. Independent of the laser
revert.

**Files:**
- Modify: `app/admin/personalization/boilerplates/actions.ts`
- Modify: `app/admin/personalization/boilerplates/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`, `messages/am.json`

**Interfaces:**
- Consumes: `price_adjustment_percent` column (Task 1).

- [ ] **Step 1: Add the schema field and payload write in the action**

In `app/admin/personalization/boilerplates/actions.ts`, add to `boilerplateSchema`
(after `isActive`):

```typescript
  priceAdjustmentPercent: z.coerce.number().int().optional(),
```

In `saveBoilerplateAction`, add to the `boilerplateSchema.safeParse({...})` object
(after `isActive: formData.get('isActive') === 'on',`):

```typescript
    priceAdjustmentPercent: formData.get('priceAdjustmentPercent') || undefined,
```

In the `payload` object (after `is_active: values.isActive,`):

```typescript
    price_adjustment_percent: values.priceAdjustmentPercent ?? null,
```

- [ ] **Step 2: Add the i18n keys**

In `messages/en.json`, inside the `personalization` object, add:

```json
    "priceAdjustmentPercent": "Price adjustment (%)",
    "priceAdjustmentHelp": "Optional. Adjusts this item's base price when this boilerplate is selected — e.g. 20 adds 20%, -10 takes off 10%.",
```

In `messages/ru.json`, `personalization` object:

```json
    "priceAdjustmentPercent": "Корректировка цены (%)",
    "priceAdjustmentHelp": "Необязательно. Изменяет базовую цену товара при выборе этого шаблона — например, 20 добавляет 20%, -10 снимает 10%.",
```

In `messages/am.json`, `personalization` object:

```json
    "priceAdjustmentPercent": "Գնի ճշգրտում (%)",
    "priceAdjustmentHelp": "Ընտրովի։ Ճշգրտում է ապրանքի բազային գինը, երբ ընտրված է այս ձևանմուշը — օրինակ՝ 20-ը ավելացնում է 20%, -10-ը հանում է 10%։",
```

(Place them next to the other `personalization.*` keys; exact position is
irrelevant to JSON.)

- [ ] **Step 3: Add the column to the page select and the input to the form**

In `app/admin/personalization/boilerplates/page.tsx`, add `price_adjustment_percent`
to the `.select(...)` string (after `sort_order`):

```typescript
    .select(
      'id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order, price_adjustment_percent',
    )
```

In the `BoilerplateForm` component, add a new field block after the "Display order"
block (the one containing `name="sortOrder"`, ending at its closing `</div>`):

```tsx
      <div className="space-y-1.5">
        <Label>{t('personalization.priceAdjustmentPercent')}</Label>
        <Input
          name="priceAdjustmentPercent"
          type="number"
          step={1}
          defaultValue={boilerplate?.price_adjustment_percent ?? ''}
        />
        <p className="text-xs text-muted-foreground">{t('personalization.priceAdjustmentHelp')}</p>
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (`boilerplate.price_adjustment_percent` resolves via the
`PersonalizationBoilerplate` type from Task 1.)

- [ ] **Step 5: Commit**

```bash
git add app/admin/personalization/boilerplates/actions.ts app/admin/personalization/boilerplates/page.tsx messages/en.json messages/ru.json messages/am.json
git commit -m "feat(admin): edit boilerplate price adjustment percent"
```

---

### Task 3: Remove the engraving prompt channel

Reverts `engravingInstruction` from the prompt builder and its tests. Grouped
with `app/personalize/actions.ts` in Task 6 would be cleaner, but the prompt
builder + its own test are self-contained here as long as Task 6 follows before a
full typecheck — so we defer the full-tree typecheck. To keep this task green on
its own, we ALSO stop passing `engravingInstruction` from the one caller
(`app/personalize/actions.ts`) is done in Task 6; therefore this task's green gate
is the prompt-builder test only, and a full `pnpm typecheck` is expected to fail
until Task 6. **Do the vitest gate here, not typecheck.**

**Files:**
- Modify: `lib/personalization-ai.ts`
- Test: `tests/lib/personalization-ai.test.ts`

**Interfaces:**
- Produces: `PersonalizationPromptInput` without the `engravingInstruction`
  field. Consumed by Task 6 (`app/personalize/actions.ts`).

- [ ] **Step 1: Update the tests to the reverted shape**

In `tests/lib/personalization-ai.test.ts`, remove every `engravingInstruction: …`
line from the four remaining test-input objects (currently at lines ~9, ~23, ~61,
~75), and **delete** the entire test block titled
`it('inserts the engraving instruction after the boilerplate instruction', …)`
(the one that passes `engravingInstruction: 'Solid scratched fill on glass.'`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/lib/personalization-ai.test.ts`
Expected: FAIL — TypeScript/vitest error: object literals are missing
`engravingInstruction` required by `PersonalizationPromptInput` (the field still
exists in the source).

- [ ] **Step 3: Remove the field from the prompt builder**

In `lib/personalization-ai.ts`, delete these two lines:

- In `PersonalizationPromptInput`:
  ```typescript
    /** Extra style instruction for the selected laser engraving style (e.g. solid scratching). */
    engravingInstruction: string | null;
  ```
- In `composePersonalizationPrompt`'s `parts` array:
  ```typescript
      input.engravingInstruction?.trim() || null,
  ```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- tests/lib/personalization-ai.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/personalization-ai.ts tests/lib/personalization-ai.test.ts
git commit -m "refactor(personalization): drop engravingInstruction prompt channel"
```

---

### Task 4: Rework the generation action (remove laser, apply % pricing)

Removes all laser logic from the generation action and repoints per-option pricing
to the boilerplate percentage via `adjustedPriceCents`. After this task the
generation flow no longer references any laser column, and the prompt-builder call
(Task 3) is satisfied.

**Files:**
- Modify: `app/personalize/actions.ts`

**Interfaces:**
- Consumes: `adjustedPriceCents` (Task 1), `PersonalizationBoilerplate.price_adjustment_percent`
  (Task 1), `PersonalizationPromptInput` without `engravingInstruction` (Task 3).

- [ ] **Step 1: Fix imports**

In `app/personalize/actions.ts`, replace the constants import block:

```typescript
import {
  COMFORTABLE_COLORS,
  DEFAULT_SOLID_ENGRAVING_PROMPT,
  type LaserEngravingStyle,
} from '@/lib/personalization-constants';
```

with:

```typescript
import { COMFORTABLE_COLORS } from '@/lib/personalization-constants';
```

Update the boilerplates import to also pull the helper:

```typescript
import {
  adjustedPriceCents,
  listCatalogItemBoilerplates,
  type PersonalizationBoilerplate,
} from '@/lib/personalization-boilerplates';
```

(Replace the two existing separate imports from `@/lib/personalization-boilerplates`
— the `import type { PersonalizationBoilerplate }` line and the
`import { listCatalogItemBoilerplates }` line — with this single combined import.)

- [ ] **Step 2: Delete the engraving-style scaffolding**

Delete the entire `interface ActiveEngravingStyle { … }` block and the entire
`function buildActiveEngravingStyles(item: { … }): ActiveEngravingStyle[] { … }`
function (currently lines ~40–93).

- [ ] **Step 3: Revert the item select**

Change the catalog item select string back to its pre-laser column list:

```typescript
    .select(
      'id, slug, title, price_cents, currency, item_type, status, is_customizable, system_prompt, skill_id, tags',
    )
```

- [ ] **Step 4: Revert the coming-soon guard**

Replace:

```typescript
  const configuredBoilerplates = await listCatalogItemBoilerplates(supabase, item.id);
  // The Solid engraving style carries its own prompt, so it counts as a usable
  // generation source even without a system prompt or boilerplate.
  if (!item.system_prompt && !configuredBoilerplates.length && !item.laser_solid_enabled) {
    return errorState(t('comingSoonBody'));
  }
```

with:

```typescript
  const configuredBoilerplates = await listCatalogItemBoilerplates(supabase, item.id);
  if (!item.system_prompt && !configuredBoilerplates.length) {
    return errorState(t('comingSoonBody'));
  }
```

- [ ] **Step 5: Revert credit cost and remove activeStyles**

Replace this block:

```typescript
  // Laser-on-glass engraving styles. When neither flag is set the item keeps its
  // single-style behaviour; otherwise one preview is generated per enabled style,
  // each priced independently (Contour = base price, Solid = its own price).
  const activeStyles = buildActiveEngravingStyles(item);
  const callTargets: Array<PersonalizationBoilerplate | null> = selectedBoilerplates.length
    ? selectedBoilerplates
    : [null];

  const creditCost = callTargets.length * activeStyles.length;
```

with:

```typescript
  const callTargets: Array<PersonalizationBoilerplate | null> = selectedBoilerplates.length
    ? selectedBoilerplates
    : [null];

  const creditCost = Math.max(callTargets.length, 1);
```

- [ ] **Step 6: Remove laserStyles from the generated item's generationOptions**

In the `createGeneratedItem({...})` call, delete these lines from
`generationOptions`:

```typescript
        laserStyles: activeStyles
          .map((style) => style.key)
          .filter((key): key is LaserEngravingStyle => key !== null),
```

- [ ] **Step 7: Collapse the nested loop and compute per-boilerplate pricing**

Replace the entire double-loop (currently
`let optionIndex = 0; for (const reference of callTargets) { for (const style of activeStyles) { … } }`)
with a single loop:

```typescript
    let optionIndex = 0;
    for (const reference of callTargets) {
      optionIndex += 1;
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
        optionIndex,
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
          unitPriceCents: adjustedPriceCents(
            item.price_cents,
            reference?.price_adjustment_percent ?? null,
          ),
          unitCurrency: item.currency,
        },
      });
    }
```

(The surrounding `const openAiClient = getOpenAiClient(); const options = [];` line
and the trailing `await createPersonalizedPreviewOptions(supabase, options);` stay
as they are.)

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: `app/personalize/actions.ts`, `lib/personalization-ai.ts`, and
`tests/lib/personalization-ai.test.ts` are all clean now. (Other laser references
in admin/MCP files still typecheck because their columns remain in
`database.types.ts`.)

- [ ] **Step 9: Run the affected tests**

Run: `pnpm test -- tests/lib/personalization-ai.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/personalize/actions.ts
git commit -m "refactor(personalize): drop laser styles, price options by boilerplate percent"
```

---

### Task 5: Revert the results display + remove laser constants + translations

Reverts the generated-results page label composition and cart title, removes the
laser constants module exports, and drops the `laserStyle` i18n keys. Keeps
per-option price display.

**Files:**
- Modify: `app/generated/[id]/page.tsx`
- Modify: `lib/generated-items.ts`
- Modify: `lib/personalization-constants.ts`
- Modify: `messages/en.json`, `messages/ru.json`, `messages/am.json`

**Interfaces:**
- Consumes: nothing new. Produces: no new symbols.

- [ ] **Step 1: Revert the option-label composition on the results page**

In `app/generated/[id]/page.tsx`, replace the `options={previewOptions.map((option) => { … })}`
block with the reverted version (drop `style`/`styleFallback`/`styleLabel`; keep
`priceCents`):

```tsx
              options={previewOptions.map((option) => {
                const boilerplateName =
                  option.boilerplate?.name ??
                  (typeof option.metadata.boilerplateName === 'string'
                    ? option.metadata.boilerplateName
                    : null);
                return {
                  id: option.id,
                  previewUrl: option.previewUrl,
                  label:
                    boilerplateName ??
                    t('generated.option', { number: String(option.option_index) }),
                  priceCents: previewOptionPriceCents(option, salePriceCents),
                };
              })}
```

Leave the `tDynamic` import and its other three usages (product type, review
status, color) untouched.

- [ ] **Step 2: Revert the cart title in generated-items**

In `lib/generated-items.ts`, inside `planGeneratedItemCartAdd`'s
`fetchedOptions.map((option) => { … })`, delete the `engravingLabel` computation:

```typescript
      const engravingLabel =
        typeof option.metadata.engravingStyleLabel === 'string'
          ? option.metadata.engravingStyleLabel
          : null;
```

and change the `title` from:

```typescript
        title:
          engravingLabel ??
          (typeof option.metadata.boilerplateName === 'string'
            ? option.metadata.boilerplateName
            : (item.title ?? 'Personalized night light')),
```

to:

```typescript
        title:
          typeof option.metadata.boilerplateName === 'string'
            ? option.metadata.boilerplateName
            : (item.title ?? 'Personalized night light'),
```

(Keep the `optionPricing` logic and everything else in the map body.)

- [ ] **Step 3: Remove laser exports from the constants module**

In `lib/personalization-constants.ts`, delete everything from the
`LASER_ENGRAVING_STYLES` comment block through the end of the
`DEFAULT_SOLID_ENGRAVING_PROMPT` array (lines ~16–34), leaving the file ending at
`export const MAX_PERSONALIZED_PHOTOS = 1;`.

- [ ] **Step 4: Remove the laserStyle i18n keys**

In each of `messages/en.json`, `messages/ru.json`, `messages/am.json`, inside the
`generated` object, delete the `laserStyle` key and its object:

```json
    "laserStyle": {
      "contour": "…",
      "solid": "…"
    },
```

**Keep** the `"total": "…"` key in all three.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: clean. (`app/generated/[id]/page.tsx` no longer references
`engravingStyle`; nothing imports the removed constants — Task 4 already dropped
the `app/personalize/actions.ts` import.)

- [ ] **Step 6: Run tests touching generated-items**

Run: `pnpm test -- tests/lib`
Expected: PASS (no test asserts the engraving label; the generated-items cart
tests, if any, assert `boilerplateName`/`title` which still resolve).

- [ ] **Step 7: Commit**

```bash
git add "app/generated/[id]/page.tsx" lib/generated-items.ts lib/personalization-constants.ts messages/en.json messages/ru.json messages/am.json
git commit -m "refactor(generated): revert laser style labels, keep per-option pricing"
```

---

### Task 6: Revert the admin item form + write path

Removes the engraving fields UI, the `itemSchema` laser fields, the validators,
and the `lib/catalog-items/core.ts` write path. Updates `core.test.ts`.

**Files:**
- Delete: `app/admin/items/item-form/engraving-fields.tsx`
- Modify: `app/admin/items/item-form/personalization-fields.tsx`
- Modify: `app/admin/items/item-form/types.ts`
- Modify: `app/admin/items/item-form-parsing.ts`
- Modify: `lib/catalog-items/core.ts`
- Modify: `app/admin/items/[id]/page.tsx`
- Test: `tests/lib/catalog-items/core.test.ts`

**Interfaces:**
- Produces: `itemSchema` without `laserContourEnabled`/`laserSolidEnabled`/
  `laserSolidPriceCents`/`laserSolidPrompt`. Consumed by Task 7 (MCP tools).
- Produces: `validatePersonalizationConfig` without the `laserSolidEnabled`
  branch; `validateEngravingConfig` deleted.

- [ ] **Step 1: Update the core.test.ts fixture (failing test first)**

In `tests/lib/catalog-items/core.test.ts`, delete these four lines from `baseItem`:

```typescript
    laserContourEnabled: false,
    laserSolidEnabled: false,
    laserSolidPriceCents: undefined,
    laserSolidPrompt: undefined,
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/lib/catalog-items/core.test.ts`
Expected: FAIL — `baseItem` return type no longer satisfies `z.infer<typeof itemSchema>`
(the schema still requires the laser fields).

- [ ] **Step 3: Delete the engraving fields component**

```bash
git rm app/admin/items/item-form/engraving-fields.tsx
```

- [ ] **Step 4: Remove EngravingFields from personalization-fields**

In `app/admin/items/item-form/personalization-fields.tsx`:
- Delete the import line `import { EngravingFields } from './engraving-fields';`
- Delete the usage line `<EngravingFields item={item} />` (and the blank line after it).
- Narrow the `item` Pick back to its pre-laser shape:
  ```typescript
    item?: Pick<ItemFormValue, 'system_prompt' | 'skill_id' | 'tags'>;
  ```

- [ ] **Step 5: Remove laser fields from the form value type**

In `app/admin/items/item-form/types.ts`, delete these four lines from the Pick:

```typescript
    | 'laser_contour_enabled'
    | 'laser_solid_enabled'
    | 'laser_solid_price_cents'
    | 'laser_solid_prompt'
```

- [ ] **Step 6: Remove laser from the item schema and parser**

In `app/admin/items/item-form-parsing.ts`:

- Delete from `itemSchema`:
  ```typescript
    laserContourEnabled: z.boolean(),
    laserSolidEnabled: z.boolean(),
    laserSolidPriceCents: z.coerce
      .number()
      .int()
      .min(0, 'Solid price cannot be negative.')
      .optional(),
    laserSolidPrompt: z.string().trim().optional(),
  ```
- Delete from `parseItemForm`'s object:
  ```typescript
    laserContourEnabled: formData.get('laserContourEnabled') === 'on',
    laserSolidEnabled: formData.get('laserSolidEnabled') === 'on',
    laserSolidPriceCents: formData.get('laserSolidPriceCents') || undefined,
    laserSolidPrompt: formData.get('laserSolidPrompt') || undefined,
  ```
- Revert `validatePersonalizationConfig` to:
  ```typescript
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
  ```
- **Delete** the entire `validateEngravingConfig` function (the block from its
  doc comment `/** Validates the laser engraving configuration. … */` through its
  closing `}`).

- [ ] **Step 7: Remove the laser writes and validator call from core.ts**

In `lib/catalog-items/core.ts`:
- Remove `validateEngravingConfig,` from the import block from
  `@/app/admin/items/item-form-parsing`.
- In `validateItemAndParseSizes`, delete:
  ```typescript
    const engravingError = validateEngravingConfig(item);
    if (engravingError) throw new Error(engravingError);
  ```
- In `toCatalogItemRow`, delete the four `laser_*` lines:
  ```typescript
    laser_contour_enabled: item.laserContourEnabled,
    laser_solid_enabled: item.laserSolidEnabled,
    laser_solid_price_cents: item.laserSolidEnabled ? (item.laserSolidPriceCents ?? null) : null,
    laser_solid_prompt: item.laserSolidEnabled ? (item.laserSolidPrompt ?? null) : null,
  ```

- [ ] **Step 8: Remove the laser columns from the edit page select**

In `app/admin/items/[id]/page.tsx`, change the select string (line ~38) to drop
`, laser_contour_enabled, laser_solid_enabled, laser_solid_price_cents, laser_solid_prompt`,
ending it at `…, skill_id, tags`.

- [ ] **Step 9: Run the test to verify it passes**

Run: `pnpm test -- tests/lib/catalog-items/core.test.ts`
Expected: PASS.

- [ ] **Step 10: Typecheck**

Run: `pnpm typecheck`
Expected: only errors remaining (if any) are in the three MCP tool files and
`lib/item-ai-fields.ts` / their tests — handled in Task 7. If `pnpm typecheck`
reports errors ONLY in `lib/mcp/tools/*` and `tests/lib/mcp/tools/*` and
`tests/lib/item-ai.test.ts`, that is expected; proceed. (The MCP tools set
`itemSchema` laser fields that no longer exist → excess-property errors.)

- [ ] **Step 11: Commit**

```bash
git add app/admin/items/item-form/personalization-fields.tsx app/admin/items/item-form/types.ts app/admin/items/item-form-parsing.ts lib/catalog-items/core.ts "app/admin/items/[id]/page.tsx" tests/lib/catalog-items/core.test.ts
git commit -m "refactor(admin): remove per-item laser engraving fields and validation"
```

---

### Task 7: Revert the MCP tools + AI field, then drop laser types

Removes the laser fields from the three MCP tools and the AI-field list, updates
their tests, then removes the now-unused `catalog_items` laser fields from
`database.types.ts`. This is the final cleanup — the whole tree must be green.

**Files:**
- Modify: `lib/mcp/tools/create-catalog-item.ts`
- Modify: `lib/mcp/tools/get-catalog-item.ts`
- Modify: `lib/mcp/tools/update-catalog-item.ts`
- Modify: `lib/item-ai-fields.ts`
- Modify: `lib/marketplace.ts`
- Modify: `app/items/[slug]/page.tsx`
- Modify: `app/personalize/[itemSlug]/page.tsx`
- Modify: `lib/supabase/database.types.ts`
- Test: `tests/lib/mcp/tools/update-catalog-item.test.ts`
- Test: `tests/lib/item-ai.test.ts`

**Interfaces:**
- Consumes: `itemSchema` without laser fields (Task 6).

- [ ] **Step 1: Update the item-ai count test (failing first)**

In `tests/lib/item-ai.test.ts`, change the `ITEM_AI_FIELD_KEYS` test:
- Rename the `it(...)` title to `'contains the 4 core fields and 15 localized SEO fields'`.
- Change `expect(ITEM_AI_FIELD_KEYS).toHaveLength(20);` to `toHaveLength(19);`.
- Remove the `'laserSolidPrompt',` line from the `arrayContaining([...])` list.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/lib/item-ai.test.ts`
Expected: FAIL — length is still 20 and `laserSolidPrompt` still present (source
not yet changed).

- [ ] **Step 3: Remove laserSolidPrompt from the AI field instructions**

In `lib/item-ai-fields.ts`, delete from `CORE_FIELD_INSTRUCTIONS`:

```typescript
  laserSolidPrompt:
    'Directive instructions for generating the solid-scratched glass engraving variant of this product.',
```

- [ ] **Step 4: Run the item-ai test to verify it passes**

Run: `pnpm test -- tests/lib/item-ai.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the update-catalog-item test fixture and assertions**

In `tests/lib/mcp/tools/update-catalog-item.test.ts`:
- In the `EXISTING` object, delete:
  ```typescript
    laser_contour_enabled: true,
    laser_solid_enabled: true,
    laser_solid_price_cents: 500,
    laser_solid_prompt: 'Existing solid prompt',
  ```
- In the `toMatchObject({...})` assertion (the "preserves fields…" test), delete:
  ```typescript
      laserContourEnabled: true,
      laserSolidEnabled: true,
      laserSolidPriceCents: 500,
      laserSolidPrompt: 'Existing solid prompt',
  ```
- In the `handleGetCatalogItem.mockResolvedValue({ ...EXISTING, system_prompt: null, skill_id: null, laser_solid_enabled: false })` call, delete the
  `laser_solid_enabled: false,` line (leaving the `system_prompt`/`skill_id` overrides).

- [ ] **Step 6: Remove laser fields from the three MCP tools**

- `lib/mcp/tools/create-catalog-item.ts` — delete from the `item` object:
  ```typescript
    laserContourEnabled: false,
    laserSolidEnabled: false,
    laserSolidPriceCents: undefined,
    laserSolidPrompt: undefined,
  ```
- `lib/mcp/tools/get-catalog-item.ts` — remove
  `, laser_contour_enabled, laser_solid_enabled, laser_solid_price_cents, laser_solid_prompt`
  from `CATALOG_ITEM_COLUMNS` (ending it at `…, skill_id, … sizes` — keep `sizes`),
  and delete the four laser fields from the `CatalogItemSummary` interface:
  ```typescript
    laser_contour_enabled: boolean;
    laser_solid_enabled: boolean;
    laser_solid_price_cents: number | null;
    laser_solid_prompt: string | null;
  ```
- `lib/mcp/tools/update-catalog-item.ts` — delete from the `item` object:
  ```typescript
    laserContourEnabled: existing.laser_contour_enabled,
    laserSolidEnabled: existing.laser_solid_enabled,
    laserSolidPriceCents: existing.laser_solid_price_cents ?? undefined,
    laserSolidPrompt: existing.laser_solid_prompt ?? undefined,
  ```

- [ ] **Step 7: Remove laser from marketplace and the two catalog pages**

- `lib/marketplace.ts` — delete the four laser fields from the `CatalogItem`
  interface (lines ~41–44) and the four laser lines from `CATALOG_SELECT`
  (lines ~83–86).
- `app/items/[slug]/page.tsx` — delete the line `      item.laser_solid_enabled ||`
  from the customizable check.
- `app/personalize/[itemSlug]/page.tsx` — change:
  ```typescript
    // Solid engraving carries its own prompt, so it makes an item personalizable
    // even without a system prompt or boilerplate.
    const hasUsablePersonalization =
      Boolean(item.system_prompt) || boilerplateRows.length > 0 || item.laser_solid_enabled;
  ```
  to:
  ```typescript
    const hasUsablePersonalization = Boolean(item.system_prompt) || boilerplateRows.length > 0;
  ```

- [ ] **Step 8: Remove the catalog_items laser fields from generated types**

In `lib/supabase/database.types.ts`, delete all twelve laser lines from the
`catalog_items` table block — four in `Row`, four in `Insert`, four in `Update`:

```typescript
          laser_contour_enabled: boolean        // Row
          laser_solid_enabled: boolean
          laser_solid_price_cents: number | null
          laser_solid_prompt: string | null
```
```typescript
          laser_contour_enabled?: boolean        // Insert
          laser_solid_enabled?: boolean
          laser_solid_price_cents?: number | null
          laser_solid_prompt?: string | null
```
```typescript
          laser_contour_enabled?: boolean        // Update
          laser_solid_enabled?: boolean
          laser_solid_price_cents?: number | null
          laser_solid_prompt?: string | null
```

Leave the `personalization_boilerplates.price_adjustment_percent` additions from
Task 1 in place.

- [ ] **Step 9: Full typecheck (whole tree must be green)**

Run: `pnpm typecheck`
Expected: no errors anywhere.

- [ ] **Step 10: Full test suite**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 11: Lint + build**

Run: `pnpm lint` then `pnpm build`
Expected: lint clean; build succeeds.

- [ ] **Step 12: Verify no laser references remain in source**

Run: `git grep -nI "laser_contour\|laser_solid\|engravingStyle\|EngravingFields\|buildActiveEngravingStyles\|validateEngravingConfig\|DEFAULT_SOLID_ENGRAVING_PROMPT\|LASER_ENGRAVING_STYLES" -- ':!supabase/migrations' ':!docs'`
Expected: no output (all removed; the two migration files legitimately still name
the columns in their drop statement).

- [ ] **Step 13: Commit**

```bash
git add lib/mcp/tools/create-catalog-item.ts lib/mcp/tools/get-catalog-item.ts lib/mcp/tools/update-catalog-item.ts lib/item-ai-fields.ts lib/marketplace.ts "app/items/[slug]/page.tsx" "app/personalize/[itemSlug]/page.tsx" lib/supabase/database.types.ts tests/lib/mcp/tools/update-catalog-item.test.ts tests/lib/item-ai.test.ts
git commit -m "refactor(mcp): remove laser fields from tools, AI fields, and generated types"
```

---

## Post-Implementation: Manual Rollout (not code — surface to the user)

These are operational steps the plan cannot execute; call them out when handing off:

1. **Deploy both migrations to prod Supabase and verify.** Per the recurring
   "migrations merge but don't reach prod" gap, diff `list_migrations` against the
   repo after merge.
2. **Pre-deploy check:** confirm whether any live `catalog_items` row has a laser
   flag set (no backfill — that behavior is lost on drop).
3. **Create the Solid and Contour boilerplates** in the admin UI after deploy:
   upload each reference image (populates the `NOT NULL` `openai_file_id`), write
   the `generation_instruction` (the old `DEFAULT_SOLID_ENGRAVING_PROMPT` text is a
   good starting point for Solid), set `price_adjustment_percent`, and attach them
   to the relevant items. A migration cannot do this (requires a real OpenAI file
   upload).

---

## Self-Review

**Spec coverage:**
- Schema revert (`catalog_items`) → Task 1 migration + Task 7 types.
- New `price_adjustment_percent` column + helper → Task 1.
- Admin boilerplate form field → Task 2.
- Prompt-channel revert → Task 3.
- Generation action rework + % pricing → Task 4.
- Results display / constants / translations revert → Task 5.
- Admin item form + write path revert → Task 6.
- MCP tools + AI field + catalog reads + type drop → Task 7.
- All spec touch points (including the expanded MCP/AI scope) are covered.

**Placeholder scan:** none — every code step shows exact content; migration
timestamps are concrete.

**Type consistency:** `adjustedPriceCents(baseCents, pct)` defined in Task 1 and
consumed with that exact signature in Task 4; `PersonalizationBoilerplate.price_adjustment_percent`
defined in Task 1, read in Tasks 2 and 4; `itemSchema` laser fields removed in
Task 6 before their MCP consumers in Task 7.

**Ordering / green-at-each-commit:** Tasks 1–2 additive (green). Task 3 gates on
its vitest (typecheck intentionally deferred; documented). Task 4 restores full
typecheck for the personalize/prompt slice. Tasks 5–6 stay green except for the
MCP/AI files, whose errors are explicitly expected and closed out in Task 7,
which ends with a full green tree, build, and a grep guard.
