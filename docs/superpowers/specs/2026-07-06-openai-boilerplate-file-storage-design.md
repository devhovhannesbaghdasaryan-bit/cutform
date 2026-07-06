# OpenAI Boilerplate File Storage — Design

**Date:** 2026-07-06
**Status:** Approved for planning

## Problem

Every personalized night-light generation downloads the selected boilerplate
reference image from Supabase (`catalog-assets` bucket or `public/`) and
re-sends its raw bytes to OpenAI as part of the request
(`app/personalize/actions.ts` → `loadBoilerplate` → `generateOpenAiImage`).
The same few boilerplate images are re-uploaded on every customer generation.

## Goal

Upload each boilerplate image to OpenAI File Storage **once**, when an admin
creates or edits the boilerplate, and reference it at generation time by
`file_id`. The whole lifecycle is managed from the existing admin surface at
`/personalization/night-lights` — no manual file-id entry.

## Key decisions (settled with the user)

1. **API migration required.** The current Images API path (`images/edits`
   via AI SDK `generateImage`) cannot consume file ids. The generation call
   moves to the **Responses API** with the `image_generation` tool.
2. **Official `openai` npm package** is added and used for this flow (Files
   API + Responses API). The AI SDK stays for everything else, including the
   admin manufacturing-file generation in `app/admin/generated/actions.ts`.
3. **Strict admin save.** If the OpenAI file upload fails, the boilerplate
   save fails. No partial saves, no null file ids.
4. **No backfill.** All existing `personalization_boilerplates` rows are
   erased by the migration; the admin recreates them through the UI, which
   exercises the new upload path. Consequently `openai_file_id` is
   `NOT NULL` and generation trusts it unconditionally.

## Data model

New migration:

- `delete from public.personalization_boilerplates;` — clean slate.
  `personalized_preview_options.boilerplate_id` has `on delete set null`, so
  historical previews are unaffected. The old seed block is not re-added.
- `alter table public.personalization_boilerplates add column openai_file_id text not null;`
  (safe: table is empty at this point).
- Regenerate `lib/supabase/database.types.ts`.

`PersonalizationBoilerplate` (lib/personalization-boilerplates.ts) gains
`openai_file_id: string`.

## Components

### `lib/openai-client.ts` (new)

Singleton factory for the official `openai` SDK client using
`getServerEnv().OPENAI_API_KEY`. Server-only.

### `lib/openai-files.ts` (new)

- `uploadReferenceImage(file: File): Promise<string>` —
  `client.files.create({ file, purpose: 'vision' })`, returns the file id.
  Throws on failure.
- `deleteReferenceFile(fileId: string): Promise<void>` — best-effort
  `client.files.delete`. Logs errors with a `[personalization-boilerplates]`
  tag; never throws.

### Admin actions (`app/personalization/night-lights/actions.ts`)

`savePersonalizationBoilerplateAction`:

- **Create:** resolve image bytes (uploaded file, or download from
  bucket/`public/` when only a path is provided — reuse the `loadBoilerplate`
  logic), upload to OpenAI **first**, then insert the row with
  `openai_file_id`. Upload failure → throw (`OpenAI file upload failed: …`)
  → nothing saved.
- **Edit with new image:** upload the new file to OpenAI → update the row
  (new `image_path` + new `openai_file_id`) → best-effort delete the old
  OpenAI file.
- **Edit without image change:** keep the existing `openai_file_id`; no
  OpenAI calls.

`removePersonalizationBoilerplateAction`: delete the row → best-effort
delete the OpenAI file.

Admin UI: display the `openai_file_id` read-only on each boilerplate row.
No extra controls — the id can never be null.

### Generation (`lib/openai-image.ts`)

`generateOpenAiImage` is only consumed by `app/personalize/actions.ts`, so it
is migrated in place:

- New input: `{ prompt, userImages: File[], referenceFileId: string, size?, quality? }`.
- Implementation: `client.responses.create` with
  - `model`: new env `OPENAI_RESPONSES_MODEL` (orchestrator; default
    `gpt-5-mini`),
  - `input`: one user message — `input_text` (prompt) + user photos as base64
    data-URL `input_image` parts + `{ type: 'input_image', file_id: referenceFileId }`,
  - `tools`: `[{ type: 'image_generation', size, quality }]`, with model
    passthrough from `OPENAI_IMAGE_MODEL`.
- Result parsing lives in a pure exported helper: find the
  `image_generation_call` output item, decode base64 → bytes, read
  `revised_prompt`. No `image_generation_call` present (refusal/safety) →
  throw a generation error.

### Personalize action (`app/personalize/actions.ts`)

- Boilerplate query selects `openai_file_id`.
- The per-option loop drops `loadBoilerplate` (no Supabase download per
  generation) and passes `reference.openai_file_id`.
- `loadBoilerplate` survives only for the admin save path.

### Cleanup (targeted)

`buildPersonalizedNightLightOpenAiPayload` still appends the hardcoded
`NIGHT_LIGHT_BOILERPLATES` constant's public paths to its audit `images`
array — stale pre-DB leftovers that misrepresent the actual request. The
payload builder takes the selected boilerplates as input instead, and the
constant is deleted if nothing else uses it.

## Environment

- `OPENAI_RESPONSES_MODEL` (optional, defaulted) added to `lib/env.ts`,
  `.env.local.example`, and README env docs.
- `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` unchanged.

## Error handling

- **Admin save:** OpenAI upload errors throw with a clear message; the save
  is rejected (existing throw-based surfacing).
- **File deletes:** best-effort, logged, never thrown.
- **Generation:** all failures land in the existing catch in
  `app/personalize/actions.ts`, which refunds credits and maps messages via
  `friendlyGenerationError` — unchanged. Stale file id (file deleted in the
  OpenAI dashboard) fails the same way; recovery is re-saving the boilerplate
  with its image, which re-uploads. Documented, no special code.

## Cost note (accepted trade-off)

`file_id` removes the repeated boilerplate upload (bandwidth/latency) and
adds admin manageability. The Responses API bills orchestrator vision tokens
for input images either way, so per-call price may be slightly higher than
raw `images/edits`. The win is architectural, not per-call price.

## Testing

- Unit tests under `tests/lib/`: reworked payload builder;
  `lib/openai-files.ts` with a mocked client; the pure Responses-output
  parsing helper (image bytes + `revised_prompt`, and the no-image case).
- Smoke scripts `scripts/smoke/generation.mjs` and `scripts/smoke/admin.mjs`
  updated for the new column and flow.
- Manual QA after deploy: recreate the three boilerplates via admin
  (exercises upload) and run one real generation end-to-end (exercises the
  file-id path).
