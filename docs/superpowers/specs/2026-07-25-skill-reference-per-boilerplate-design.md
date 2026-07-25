# Skill Reference per Item & Boilerplate — Design

**Date:** 2026-07-25
**Status:** Approved design, pending implementation plan

## Problem

Generation skills (instruction documents such as `skills/generate-night-light-preview/SKILL.md`) live in OpenAI File Storage and are referenced by file id. Today:

- `catalog_items.skill_id` exists as a free-text admin field but is **never included in the OpenAI generation call** — it only gates whether `/personalize/[itemSlug]` renders.
- `personalization_boilerplates` has no skill field at all.

Admins need to attach an optional skill file to a catalog item and/or to each boilerplate, and `generatePersonalizedItemAction` must include the skill guidance in the generation call when present — from both the product and the selected boilerplate.

## Decisions (agreed in brainstorming)

1. **Both skills attach** when item and boilerplate each have one: product skill first, boilerplate skill second.
2. **Upload through the admin forms** (item form and boilerplate form); the server uploads to OpenAI storage and stores the returned file id. No paste-an-id UX.
3. **Supabase copy kept** for every uploaded skill file, in the private `uploads` bucket (recovery after OpenAI file loss / environment resets; `catalog-assets` is public and MIME-restricted to images/video, so it cannot hold text/markdown skill files).
4. **Inline columns**, no shared skills table (YAGNI at current scale; duplicate uploads of the same skill across items are acceptable).
5. **Content injection, not `input_file`:** the Responses API `input_file` part is PDF-oriented and does not reliably accept markdown/plain text. At generation time the server fetches the skill file's content by id (`client.files.content`) and injects it as an `input_text` part. Skills remain managed purely as OpenAI storage file ids.

## Schema

One migration:

```sql
alter table personalization_boilerplates
  add column skill_openai_file_id text,
  add column skill_path text;

alter table catalog_items
  add column skill_path text;
```

- `catalog_items.skill_id` (existing, text) now holds the OpenAI file id when set through the new upload flow. Column is **not renamed** — MCP tools and seeds keep working.
- Legacy `skill_id` values (e.g. `skill-1` from seeds) are inert: generation only uses ids starting with `file-`.
- All new columns nullable; the feature is optional end to end.

## Admin UX

### Boilerplate form (`app/admin/personalization/boilerplates/`)

- New optional field: **Skill file** — accepts `.md`/`.txt`, max 1 MB.
- On save with a new skill file, ordered like the existing image flow (OpenAI first so nothing persists if it fails):
  1. Upload to OpenAI storage with `purpose: 'user_data'` → `skill_openai_file_id`.
  2. Copy to the private Supabase `uploads` bucket (not `catalog-assets`, which is public and MIME-restricted to images/video) at `{userId}/personalization-skills/{uuid}.{ext}` → `skill_path`.
  3. On replace, best-effort delete the previous OpenAI skill file after the DB write (mirrors `previousOpenaiFileId` handling for images).
- **Remove skill** checkbox clears both columns and best-effort deletes the OpenAI file.
- `removeBoilerplateAction` also best-effort deletes `skill_openai_file_id` alongside the image file.

### Item form (`app/admin/items/item-form/personalization-fields.tsx`)

- The free-text **Skill ID** input is replaced by the same optional upload field, with the same upload/replace/remove semantics writing to `catalog_items.skill_id` (OpenAI file id) and `catalog_items.skill_path`.
- The form shows whether a skill is currently attached (filename or truncated file id).
- MCP tools (`create-catalog-item`, `update-catalog-item`) are **unchanged**: they continue to accept `skillId` as a plain string. Callers that pass a real OpenAI file id get generation attachment; anything else stays inert.

### Shared helper

`lib/openai-files.ts` gains `uploadSkillFile(client, file)` (purpose `user_data`) beside `uploadReferenceImage`. `deleteReferenceFile` is reused for cleanup.

## Generation flow

In `generatePersonalizedItemAction` (`app/personalize/actions.ts`):

1. Select `skill_id` on the item (already selected) and `skill_openai_file_id` via `listCatalogItemBoilerplates` (add the column to its select in `lib/personalization-boilerplates.ts`).
2. Per call target, build the skill id list: `[item.skill_id if it starts with 'file-', boilerplate?.skill_openai_file_id]`, dropping nulls. Order fixed: product first, boilerplate second.
3. Fetch each **unique** file id's content once per action invocation (`client.files.content(fileId)` → text), memoized in a local `Map` — one fetch even when several selected boilerplates share the product skill.
4. Pass the fetched texts to `generateOpenAiImage` via a new optional input:

```ts
export interface OpenAiImageInput {
  prompt: string;
  skillTexts?: string[]; // injected before prompt, in given order
  userImages: File[];
  referenceFileId?: string | null;
  size?: ...;
  quality?: ...;
}
```

5. In `generateOpenAiImage`, each skill text becomes an `input_text` content part placed **before** the composed prompt part, so skill guidance frames the item system prompt, boilerplate instruction, and user inputs. Image parts follow as today.

Items and boilerplates without skills produce byte-identical calls to today's behavior.

## Error handling

- **Skill content fetch fails** → the whole generation attempt fails inside the existing `try/catch`: credits refunded, `friendlyGenerationError` shown. No partial "generate without the skill" fallback — a missing skill silently changing output quality is worse than a retryable error.
- **OpenAI skill upload fails on admin save** → save aborts before any DB write (same as image upload today).
- **Supabase copy fails after OpenAI upload** → save aborts; the just-uploaded OpenAI file is best-effort deleted so no orphan id persists.
- **Legacy non-`file-` skill_id** → skipped silently at generation; visible in the item form as the current value until replaced.

## Testing

- `tests/lib/openai-image.test.ts` (extend/create): `skillTexts` render as `input_text` parts before the prompt; omitted `skillTexts` produce today's exact input shape.
- Generation action-level test: skill id list assembly — legacy id skipped, `file-` id included, boilerplate skill appended, dedupe of repeated ids.
- Boilerplate action schema test: save accepted with and without skill file; remove-skill clears columns.
- Item form parsing test: upload writes file id into `skillId`; absent upload leaves existing value.
- No live OpenAI calls in tests; client mocked as in existing suites.

## Out of scope

- Shared skills library table / reuse across items (revisit if skill count grows).
- Skill versioning or content preview in admin.
- Any change to the manufacturing-SVG admin pipeline.
