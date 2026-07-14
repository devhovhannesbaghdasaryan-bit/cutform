# Admin Item Form AI Autogenerate — Design

**Date:** 2026-07-14
**Status:** Approved for planning

## Problem

Admins creating or editing a catalog item (`app/admin/items/item-form/`) fill
in many text fields by hand: title, manufacturing notes, admin-only
characteristics, the personalization system prompt, the laser-solid
engraving prompt, and a full SEO block (title/description/keywords/OG
title/OG description) repeated for three storefront locales (`en`, `ru`,
`am`) — 20 free-text fields in total. Writing all of this by hand, especially
the localized SEO copy, is slow and repetitive when the admin already has a
plain-English description of the product in mind.

Separately, `app/admin/seo-metadata-manager.tsx` already offers AI-assisted
SEO metadata generation, but as a disconnected two-step "generate a draft →
review it → save it" flow that lives below the item form, writes straight to
`catalog_item_seo_metadata` on its own submit (bypassing the main item
save), and uses the Vercel AI SDK (`ai` + `@ai-sdk/openai`) rather than the
raw `openai` package already used elsewhere in this codebase for
OpenAI-specific work (`lib/openai-client.ts`, `lib/openai-image.ts`).

## Goal

Add an **Autogenerate** button next to every target field in the item
create/edit form. Clicking it reads the current value of the existing
**Description** field as the English source, sends it (plus light context)
to OpenAI, and writes the result straight into that one field. A **Fill
all** button near the Description field does the same for every target
field currently present in the form, in one combined request.

This fully replaces the existing SEO AI draft flow — `lib/seo-ai.ts`,
`app/admin/items/seo-actions.ts`, and `app/admin/seo-metadata-manager.tsx`
are deleted, along with their render site in
`app/admin/items/[id]/page.tsx`. The new per-field/localized buttons inside
the item form's own `SeoSection` are a strict superset of what the old
"fields to regenerate" checkbox flow did, and consolidate SEO metadata onto
the same save path as the rest of the item (nothing hits the database until
the admin clicks the form's own Save/Create button).

## Key decisions (settled with the user)

1. **Source text is the existing Description field.** No new "AI notes"
   field. The Description field itself gets no Autogenerate button — it's
   the source, not a target.
2. **Target fields:** `title`, `manufacturingNotes`, `characteristics`,
   `systemPrompt`, `laserSolidPrompt`, plus `seoTitle`, `seoDescription`,
   `seoKeywords`, `ogTitle`, `ogDescription` × locales `en`/`ru`/`am` (15
   fields). `socialImagePath`, `slug`, `sizesJson`, `priceCents`, `status`,
   `skillId`, and all checkbox/select fields are out of scope — not
   prose-generatable.
3. **Write immediately, no preview step.** Generated text replaces the
   field's current value right away. Nothing is persisted until the admin
   submits the form normally; a page reload discards ungenerated changes
   exactly like any other unsaved edit.
4. **Raw `openai` npm package**, not the Vercel AI SDK — consistent with
   `lib/openai-client.ts` / `lib/openai-image.ts`, and the explicit
   preference over the `ai`-package pattern used in the (now removed)
   `lib/seo-ai.ts`.
5. **SEO fields are localized.** `ru`/`am` SEO fields are generated *in
   Russian / Armenian*, adapting the English description — not left in
   English and not transliterated.
6. **Old SEO AI draft flow is deleted**, not kept alongside the new one.

## Architecture

### Server: `lib/item-ai.ts` (new)

- `ITEM_AI_FIELDS`: a const map from field key (e.g. `title`,
  `seoTitle_ru`) to `{ label, instruction, locale? }`. Core fields have a
  hand-written instruction tailored to what that field is for (see below).
  SEO fields share one instruction template parameterized by locale name.
- `buildItemFieldsPrompt(input: { sourceDescription, fields, context })` —
  composes a single prompt: the source description, known context (current
  title if not itself being regenerated, category name, item type), and the
  per-field instructions for exactly the requested keys.
- `generateItemFields(input): Promise<Record<string, string>>` — builds a
  Structured Outputs JSON schema dynamically from the requested field keys
  (every value a required string) and calls:

  ```ts
  client.responses.create({
    model: getServerEnv().OPENAI_RESPONSES_MODEL ?? 'gpt-5-mini',
    store: false,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    text: { format: { type: 'json_schema', name: 'item_fields', schema, strict: true } },
  })
  ```

  using the singleton client from `lib/openai-client.ts`. Parses and
  returns the JSON object keyed by the same field names that were
  requested. Throws a plain `Error` with a user-presentable message on any
  OpenAI failure (rate limit, malformed output, missing API key surfaced
  earlier by `getOpenAiClient()`).

Per-field instruction examples (final wording decided during
implementation, not user-facing copy that needs sign-off):

- `title` — short marketing product title.
- `manufacturingNotes` — production-facing notes: materials, assembly,
  finish.
- `characteristics` — admin-only technical specs: materials, dimensions,
  construction details, open unknowns.
- `systemPrompt` — directives for an AI image-personalization step, written
  as instructions, not marketing copy.
- `laserSolidPrompt` — directives for generating the solid-scratched glass
  engraving variant.
- `seoTitle` / `seoDescription` / `seoKeywords` / `ogTitle` /
  `ogDescription` — one shared SEO instruction block, parameterized with the
  target locale's language and existing length limits already enforced by
  `seoLocaleSchema` in `item-form-parsing.ts` (70/170/–/90/220 chars).

### Server: `app/admin/items/ai-fill-actions.ts` (new)

```ts
'use server';
export async function generateItemFieldValuesAction(input: {
  sourceDescription: string;
  fields: string[]; // validated against the ITEM_AI_FIELDS key enum
  context: { title?: string; categoryName?: string; itemType?: string };
}): Promise<{ values: Record<string, string> } | { error: string }>
```

- Called imperatively from a client component (not bound to a `<form
  action>`), inside a `useTransition`.
- Validates input with a Zod schema; `fields` restricted to
  `z.enum(Object.keys(ITEM_AI_FIELDS))`, `sourceDescription` required
  non-empty (trimmed).
- Gated by `requireAdminPermission('catalog_manage')` — same permission the
  rest of item create/edit already requires.
- Calls `generateItemFields` from `lib/item-ai.ts`; catches and returns
  `{ error: message }` rather than throwing, since this is called directly
  (no `useActionState` error boundary wrapping it).

### Client: `app/admin/items/item-form/ai-context.tsx` (new)

- `ItemFormAiProvider({ formRef, categories })` — context provider wrapping
  the `<form>` contents in `ItemForm`. Holds `pendingFields: Set<string>`
  and an error message per attempted request.
- `generate(fields: string[])`:
  1. Filters `fields` down to whichever have a matching
     `form.current.elements.namedItem(name)` — silently drops fields not
     currently rendered (e.g. `systemPrompt` when Customizable is
     unchecked, `laserSolidPrompt` when Solid is unchecked).
  2. Reads `sourceDescription` from `elements.namedItem('description')`.
  3. Resolves `context` from currently-live form values (title, selected
     category's name via the `categories` prop, item type).
  4. Calls `generateItemFieldValuesAction`; on success, writes each
     returned value directly onto `elements.namedItem(key).value`.
- `useItemFormAi()` hook for consumers.
- `AutogenerateButton({ field })` — `Button variant="ghost" size="sm"` with
  a sparkle icon, calls `generate([field])`, disabled while any field is
  pending or Description is empty.
- `FillAllButton` — calls `generate(Object.keys(ITEM_AI_FIELDS))` (the
  DOM-presence filter above narrows it to what's actually visible),
  rendered directly under the Description field.

### Field component changes

`ItemForm` (`item-form/index.tsx`) adds a `formRef` (`useRef<HTMLFormElement>`)
on its `<form>` and wraps its body in `<ItemFormAiProvider formRef={formRef}
categories={categories}>`. Each field component that owns a target field
imports `AutogenerateButton` and places it next to that field's `<Label>`:

- `basics-fields.tsx` → `TitleSlugFields` (title only)
- `pricing-size-fields.tsx` → `ManufacturingNotesField`,
  `SizesCharacteristicsFields` (characteristics only)
- `personalization-fields.tsx` → system prompt
- `engraving-fields.tsx` → laser-solid prompt (already `'use client'`)
- `seo-section.tsx` → all five SEO fields, once per locale iteration

None of these fields change from uncontrolled (`defaultValue`) to
controlled — `AutogenerateButton` writes to the DOM node directly, exactly
mirroring how `FormData(form)` already reads these fields on submit. No
change to `createCatalogItemAction` / `updateCatalogItemAction` /
`item-form-parsing.ts`.

## Data flow

1. Admin types a description, clicks Autogenerate on `characteristics` (or
   Fill All).
2. Client reads `description` field + light context off the live form,
   calls `generateItemFieldValuesAction` with the (DOM-presence-filtered)
   field list.
3. Server validates permission + input, calls `generateItemFields`, which
   prompts OpenAI once for exactly the requested keys via Structured
   Outputs, and returns a flat `{ fieldKey: text }` object.
4. Client writes each value onto its input/textarea. Nothing is saved.
5. Admin reviews/edits inline, then submits the form as normal — same
   `createCatalogItemAction` / `updateCatalogItemAction` path, unchanged.

## Error handling

- Buttons are disabled with a tooltip when Description is empty — no
  request is made.
- Only one generation request may be in flight at a time; all
  Autogenerate/Fill All buttons disable while `pendingFields` is non-empty,
  to avoid overlapping writes to adjacent fields.
- On failure (missing `OPENAI_API_KEY`, OpenAI error, network failure), the
  action returns `{ error }`; the provider surfaces it as a small inline
  message near the button that was clicked, cleared on the next attempt.
  No silent fallback template (unlike the removed `lib/seo-ai.ts`, which
  had one) — this is an explicit, user-initiated action, so a clear error
  is preferable to quietly substituting low-quality boilerplate.

## Removal scope (old SEO AI draft flow)

- Delete `lib/seo-ai.ts`.
- Delete `app/admin/items/seo-actions.ts`.
- Delete `app/admin/seo-metadata-manager.tsx`.
- In `app/admin/items/[id]/page.tsx`: remove the `SeoMetadataManager` import
  and its `<SeoMetadataManager catalogItemId={item.id} />` render call.
- No database migration needed — `catalog_item_seo_metadata` is unchanged;
  only the write path into it changes (now solely through the item form's
  existing save actions).
- Confirmed via repo-wide search: these three files have no other
  importers, so removal is self-contained.

## Testing

- `lib/item-ai.ts`: unit tests for `buildItemFieldsPrompt` /
  `generateItemFields`'s schema builder — correct keys for a given field
  list, correct locale-language instruction for `ru`/`am` SEO fields, no
  leakage of unrequested keys into the schema. OpenAI call itself mocked,
  following `tests/lib/openai-client.test.ts`'s pattern.
- `ai-fill-actions.ts`: unit tests for Zod validation (rejects unknown
  field keys, empty `sourceDescription`) and the permission gate.
- No new browser/e2e test; verified manually in the admin UI per this
  repo's existing manual-verification norm for admin form changes.
