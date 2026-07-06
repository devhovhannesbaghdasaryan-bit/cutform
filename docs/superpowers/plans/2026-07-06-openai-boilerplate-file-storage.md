# OpenAI Boilerplate File Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload each personalization boilerplate reference image to OpenAI File Storage once (on admin create/edit), and reference it by `file_id` at generation time instead of re-sending its bytes on every customer generation.

**Architecture:** Add the official `openai` npm package alongside the existing AI SDK. A new `lib/openai-client.ts` + `lib/openai-files.ts` handle file upload/delete; `lib/openai-image.ts` migrates from the Images API (`ai` SDK) to the Responses API's `image_generation` tool, taking a `file_id` for the boilerplate and inline base64 for user photos. The admin boilerplate form (`app/personalization/night-lights/actions.ts`) uploads to OpenAI synchronously on save and fails the save if that upload fails. The customer generation flow (`app/personalize/actions.ts`) drops its per-request boilerplate download entirely.

**Tech Stack:** Next.js server actions, Supabase (Postgres + storage), official `openai` npm SDK (Responses API + Files API), Vitest.

**Source spec:** `docs/superpowers/specs/2026-07-06-openai-boilerplate-file-storage-design.md`

## Global Constraints

- Use the **official `openai` npm package** (not the `ai` SDK / `@ai-sdk/openai`) for all Files API and Responses API calls added by this feature. The `ai` SDK stays in place for `app/admin/generated/actions.ts`, which is out of scope.
- `personalization_boilerplates.openai_file_id` is `NOT NULL`. There is **no backfill**: the migration deletes all existing rows; the admin recreates them through the UI after deploy.
- Admin boilerplate save **must fail outright** if the OpenAI file upload fails — no partial saves, no null file ids, no inline-bytes fallback.
- OpenAI file **deletes** (on image replace or boilerplate removal) are **best-effort**: caught, logged with a `[personalization-boilerplates]` tag, never thrown.
- `openai@6.45.0`'s Responses API `image_generation` tool call output (`ImageGenerationCall`) has no `revised_prompt` field — only `id`, `result` (base64), `status`, `type`. The `revisedPrompt` metadata key stays in the schema for compatibility but is always `null` from this path.
- `ResponseInputImage.detail` is a required field in this SDK version — every `input_image` part must set `detail: 'auto'`.
- Package manager is `pnpm`. Run `pnpm typecheck` after every task that touches TypeScript.

---

### Task 1: OpenAI client factory (`lib/openai-client.ts`)

**Files:**
- Create: `lib/openai-client.ts`
- Test: `tests/lib/openai-client.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml` (dependency already added — see Step 0)

**Interfaces:**
- Produces: `getOpenAiClient(): OpenAI` — throws `Error('OPENAI_API_KEY is required for AI image generation.')` when `getServerEnv().OPENAI_API_KEY` is unset; otherwise returns a memoized `OpenAI` client instance.

- [ ] **Step 0: Confirm and commit the already-added `openai` dependency**

The `openai` package (v6.45.0) was already installed via `pnpm add openai -w` during planning. Confirm it's still present and commit it as its own step before writing any code that depends on it:

Run: `node -e "console.log(require('./node_modules/openai/package.json').version)"`
Expected: `6.45.0`

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: add openai SDK for boilerplate file storage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 1: Write the failing test**

Create `tests/lib/openai-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

async function importClient() {
  vi.resetModules();
  return import('@/lib/openai-client');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getOpenAiClient', () => {
  it('throws when OPENAI_API_KEY is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { getOpenAiClient } = await importClient();
    expect(() => getOpenAiClient()).toThrow('OPENAI_API_KEY is required for AI image generation.');
  });

  it('returns the same client instance on repeated calls', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const { getOpenAiClient } = await importClient();
    const first = getOpenAiClient();
    const second = getOpenAiClient();
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/openai-client.test.ts`
Expected: FAIL with "Cannot find module '@/lib/openai-client'" (or similar resolution error)

- [ ] **Step 3: Write the implementation**

Create `lib/openai-client.ts`:

```ts
import 'server-only';

import OpenAI from 'openai';
import { getServerEnv } from '@/lib/env';

let client: OpenAI | null = null;

/** Lazily constructs a singleton OpenAI client, throwing if no API key is configured. */
export function getOpenAiClient(): OpenAI {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for AI image generation.');
  client ??= new OpenAI({ apiKey });
  return client;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/openai-client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no errors

```bash
git add lib/openai-client.ts tests/lib/openai-client.test.ts
git commit -m "$(cat <<'EOF'
feat(personalization): add OpenAI client factory

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reference file upload/delete (`lib/openai-files.ts`)

**Files:**
- Create: `lib/openai-files.ts`
- Test: `tests/lib/openai-files.test.ts`

**Interfaces:**
- Consumes: none (takes an injected client shaped `Pick<OpenAI, 'files'>`, matching the `lib/storage.ts` pattern of accepting the client as the first argument).
- Produces:
  - `uploadReferenceImage(client: Pick<OpenAI, 'files'>, file: File): Promise<string>` — throws on failure, returns the OpenAI file id.
  - `deleteReferenceFile(client: Pick<OpenAI, 'files'>, fileId: string): Promise<void>` — never throws; logs with `[personalization-boilerplates]` prefix on failure.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/openai-files.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { deleteReferenceFile, uploadReferenceImage } from '@/lib/openai-files';

type FilesClient = Parameters<typeof uploadReferenceImage>[0];

function fakeOpenAiClient(overrides: {
  create?: (...args: unknown[]) => unknown;
  del?: (...args: unknown[]) => unknown;
} = {}) {
  return {
    files: {
      create: overrides.create ?? vi.fn(async () => ({ id: 'file-abc123' })),
      delete: overrides.del ?? vi.fn(async () => ({ id: 'file-abc123', deleted: true })),
    },
  } as unknown as FilesClient;
}

describe('uploadReferenceImage', () => {
  it('returns the uploaded file id', async () => {
    const client = fakeOpenAiClient();
    const file = new File([new Uint8Array([1, 2, 3])], 'boilerplate.jpg', { type: 'image/jpeg' });
    await expect(uploadReferenceImage(client, file)).resolves.toBe('file-abc123');
    expect(client.files.create).toHaveBeenCalledWith({ file, purpose: 'vision' });
  });

  it('throws when the upload fails', async () => {
    const client = fakeOpenAiClient({
      create: vi.fn(async () => {
        throw new Error('network error');
      }),
    });
    const file = new File([new Uint8Array([1])], 'boilerplate.jpg', { type: 'image/jpeg' });
    await expect(uploadReferenceImage(client, file)).rejects.toThrow('network error');
  });
});

describe('deleteReferenceFile', () => {
  it('deletes the file by id', async () => {
    const client = fakeOpenAiClient();
    await deleteReferenceFile(client, 'file-abc123');
    expect(client.files.delete).toHaveBeenCalledWith('file-abc123');
  });

  it('swallows errors and logs instead of throwing', async () => {
    const client = fakeOpenAiClient({
      del: vi.fn(async () => {
        throw new Error('not found');
      }),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(deleteReferenceFile(client, 'file-missing')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/openai-files.test.ts`
Expected: FAIL with "Cannot find module '@/lib/openai-files'"

- [ ] **Step 3: Write the implementation**

Create `lib/openai-files.ts`:

```ts
import 'server-only';

import type OpenAI from 'openai';

/** Uploads an image to OpenAI File Storage for reuse across generation requests. Throws on failure. */
export async function uploadReferenceImage(
  client: Pick<OpenAI, 'files'>,
  file: File,
): Promise<string> {
  const uploaded = await client.files.create({ file, purpose: 'vision' });
  return uploaded.id;
}

/** Best-effort delete of a previously uploaded reference file. Never throws. */
export async function deleteReferenceFile(
  client: Pick<OpenAI, 'files'>,
  fileId: string,
): Promise<void> {
  try {
    await client.files.delete(fileId);
  } catch (error) {
    console.error('[personalization-boilerplates] failed to delete OpenAI file', fileId, error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/openai-files.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no errors

```bash
git add lib/openai-files.ts tests/lib/openai-files.test.ts
git commit -m "$(cat <<'EOF'
feat(personalization): add OpenAI reference file upload/delete helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Schema migration and type updates

**Files:**
- Create: `supabase/migrations/20260706150000_openai_boilerplate_file_storage.sql`
- Modify: `lib/supabase/database.types.ts`
- Modify: `lib/personalization-boilerplates.ts`

**Interfaces:**
- Produces: `PersonalizationBoilerplate.openai_file_id: string` (new required field on the existing interface exported from `lib/personalization-boilerplates.ts`).
- Removes: `loadBoilerplate()` (dead code — every remaining caller after Task 8 already holds the raw `File` it needs; see Task 8 rationale below).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260706150000_openai_boilerplate_file_storage.sql`:

```sql
-- OpenAI file storage for personalization boilerplates: each boilerplate's
-- reference image is uploaded to OpenAI once (admin create/edit) and reused
-- by file_id at generation time instead of being re-sent on every request.
-- No backfill: existing rows are wiped and recreated through the admin UI,
-- which exercises the new upload path. personalized_preview_options.boilerplate_id
-- already has `on delete set null`, so historical previews are unaffected.

delete from public.personalization_boilerplates;

alter table public.personalization_boilerplates
  add column if not exists openai_file_id text not null;
```

- [ ] **Step 2: Apply the migration locally (if local Supabase is running)**

Run: `supabase db reset --local`
Expected: migration applies cleanly with no errors. If local Supabase isn't running, skip this step — the hand-edited types in Step 3 keep the app consistent, and the migration will apply on the next `supabase db reset` or deploy.

- [ ] **Step 3: Update the generated types by hand**

Edit `lib/supabase/database.types.ts`. In the `personalization_boilerplates` table type (originally at lines 1275-1333), add `openai_file_id` to `Row`, `Insert`, and `Update`, alphabetically between `name_ru` and `sort_order`:

In `Row` (add as required, matching the `NOT NULL` column):
```ts
          name_ru: string | null
          openai_file_id: string
          sort_order: number
```

In `Insert` (add as required — no default, so it's mandatory on insert):
```ts
          name_ru?: string | null
          openai_file_id: string
          sort_order?: number
```

In `Update` (add as optional, matching every other column):
```ts
          name_ru?: string | null
          openai_file_id?: string
          sort_order?: number
```

(If local Supabase is running, you can instead run `pnpm db:types` to regenerate the whole file and confirm it matches this shape.)

- [ ] **Step 4: Update the `PersonalizationBoilerplate` interface and remove dead code**

Read `lib/personalization-boilerplates.ts`. Replace the entire file with:

```ts
import type { AppLocale } from '@/lib/i18n';

export interface PersonalizationBoilerplate {
  id: string;
  model_id: string;
  admin_name: string;
  name_en: string | null;
  name_hy: string | null;
  name_ru: string | null;
  image_path: string;
  openai_file_id: string;
  manufacturing_process: string;
  generation_instruction: string;
  generate_hidden_svg: boolean;
  is_active: boolean;
  sort_order: number;
}

export function getBoilerplateName(
  boilerplate: Pick<PersonalizationBoilerplate, 'admin_name' | 'name_en' | 'name_hy' | 'name_ru'>,
  locale: AppLocale,
) {
  const localized = locale === 'am'
    ? boilerplate.name_hy
    : locale === 'ru'
      ? boilerplate.name_ru
      : boilerplate.name_en;
  return localized?.trim() || boilerplate.name_en?.trim() || boilerplate.admin_name;
}
```

This drops `loadBoilerplate`, `readFile`, `path`, and `downloadFromBucket` — `loadBoilerplate` read boilerplate bytes from Supabase storage for the old per-request-download flow. After Task 8, the only remaining caller (`app/personalize/actions.ts`) no longer needs it (it now sends `openai_file_id` instead of bytes), and the admin save flow (Task 6) already holds the raw uploaded `File` directly from `formData`, so it never needed `loadBoilerplate` either.

Expected compile errors until Task 6 and Task 8 land: `app/personalize/actions.ts` still imports `loadBoilerplate` at this point. This is expected — `pnpm typecheck` will show one error in that file until Task 8. Confirm it's *only* that one error before moving on.

Run: `pnpm typecheck`
Expected: exactly one error, in `app/personalize/actions.ts`, about `loadBoilerplate` no longer being exported from `@/lib/personalization-boilerplates`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260706150000_openai_boilerplate_file_storage.sql lib/supabase/database.types.ts lib/personalization-boilerplates.ts
git commit -m "$(cat <<'EOF'
feat(personalization): add openai_file_id column and drop dead boilerplate loader

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Migrate generation to the Responses API (`lib/openai-image.ts`)

**Files:**
- Modify: `lib/env.ts`
- Modify: `.env.local.example`
- Modify: `README.md`
- Modify: `lib/openai-image.ts` (full rewrite)
- Test: `tests/lib/openai-image.test.ts` (new)

**Interfaces:**
- Consumes: `OpenAI` type from the `openai` package (Task 1's dependency).
- Produces:
  - `extractGeneratedImage(response: { output: Array<{ type: string; result?: string | null }> }): { bytes: Uint8Array; revisedPrompt: string | null }` — throws `Error('OpenAI did not return a generated image.')` if no `image_generation_call` with a `result` is present.
  - `generateOpenAiImage(client: OpenAI, input: OpenAiImageInput): Promise<{ bytes: Uint8Array; revisedPrompt: string | null }>` where `OpenAiImageInput = { prompt: string; userImages: File[]; referenceFileId: string; size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto'; quality?: 'low' | 'medium' | 'high' | 'auto' }`.

- [ ] **Step 1: Add the `OPENAI_RESPONSES_MODEL` env var**

Edit `lib/env.ts`. In `serverShape`, add the new key right after `OPENAI_IMAGE_MODEL`:

```ts
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_IMAGE_MODEL: optionalNonEmpty,
  OPENAI_RESPONSES_MODEL: optionalNonEmpty,
```

Edit `.env.local.example`, in the `# OpenAI (server-only)` section:

```
# OpenAI (server-only)
OPENAI_API_KEY=sk-...
# Optional overrides — defaults are gpt-image-2 (image tool) and gpt-5-mini (orchestrator model).
# OPENAI_IMAGE_MODEL=gpt-image-2
# OPENAI_RESPONSES_MODEL=gpt-5-mini
```

Edit `README.md` at line 66 (`OPENAI_API_KEY=sk-...`, inside the `env` fenced code block starting at line 61). Insert immediately after it, still inside the fence:

```env
OPENAI_API_KEY=sk-...
# OPENAI_IMAGE_MODEL=gpt-image-2
# OPENAI_RESPONSES_MODEL=gpt-5-mini
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/openai-image.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { extractGeneratedImage, generateOpenAiImage } from '@/lib/openai-image';

describe('extractGeneratedImage', () => {
  it('decodes the base64 result from the image_generation_call output item', () => {
    const base64 = Buffer.from('fake-png-bytes').toString('base64');
    const result = extractGeneratedImage({
      output: [{ type: 'reasoning' }, { type: 'image_generation_call', result: base64 }],
    });
    expect(result.bytes).toEqual(new Uint8Array(Buffer.from('fake-png-bytes')));
    expect(result.revisedPrompt).toBeNull();
  });

  it('throws when no image_generation_call is present', () => {
    expect(() => extractGeneratedImage({ output: [{ type: 'reasoning' }] })).toThrow(
      'OpenAI did not return a generated image.',
    );
  });

  it('throws when the image_generation_call has no result', () => {
    expect(() =>
      extractGeneratedImage({ output: [{ type: 'image_generation_call', result: null }] }),
    ).toThrow('OpenAI did not return a generated image.');
  });
});

describe('generateOpenAiImage', () => {
  it('sends the prompt, user images, and reference file id to the Responses API', async () => {
    const base64 = Buffer.from('generated-bytes').toString('base64');
    const create = vi.fn(async () => ({
      output: [{ type: 'image_generation_call', result: base64 }],
    }));
    const client = { responses: { create } } as unknown as Parameters<typeof generateOpenAiImage>[0];
    const userImage = new File([new Uint8Array([9, 9])], 'user.jpg', { type: 'image/jpeg' });

    const result = await generateOpenAiImage(client, {
      prompt: 'Generate a night light',
      userImages: [userImage],
      referenceFileId: 'file-boilerplate-1',
      size: '1024x1024',
      quality: 'low',
    });

    expect(result.bytes).toEqual(new Uint8Array(Buffer.from('generated-bytes')));
    expect(create).toHaveBeenCalledTimes(1);
    const requestBody = create.mock.calls[0][0];
    expect(requestBody.model).toBe('gpt-5-mini');
    expect(requestBody.store).toBe(false);
    expect(requestBody.tools).toEqual([
      { type: 'image_generation', model: 'gpt-image-2', size: '1024x1024', quality: 'low' },
    ]);
    const [message] = requestBody.input;
    expect(message.role).toBe('user');
    expect(message.content[0]).toEqual({ type: 'input_text', text: 'Generate a night light' });
    expect(message.content[1]).toMatchObject({ type: 'input_image', detail: 'auto' });
    expect(message.content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(message.content[2]).toEqual({
      type: 'input_image',
      detail: 'auto',
      file_id: 'file-boilerplate-1',
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/openai-image.test.ts`
Expected: FAIL — `extractGeneratedImage` is not exported (current `lib/openai-image.ts` only exports `generateOpenAiImage` with the old Images-API signature)

- [ ] **Step 4: Rewrite the implementation**

Replace the full contents of `lib/openai-image.ts`:

```ts
import 'server-only';

import type OpenAI from 'openai';
import { getServerEnv } from '@/lib/env';

export interface OpenAiImageInput {
  prompt: string;
  userImages: File[];
  referenceFileId: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

export interface GeneratedImage {
  bytes: Uint8Array;
  revisedPrompt: string | null;
}

function getImageModel() {
  return getServerEnv().OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
}

function getResponsesModel() {
  return getServerEnv().OPENAI_RESPONSES_MODEL ?? 'gpt-5-mini';
}

async function toInputImagePart(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString('base64');
  return {
    type: 'input_image' as const,
    detail: 'auto' as const,
    image_url: `data:${file.type || 'image/jpeg'};base64,${base64}`,
  };
}

/**
 * Extracts the generated image from a Responses API result. The `image_generation`
 * tool call result is base64-encoded; this SDK version has no revised-prompt field
 * on the call, so `revisedPrompt` is always null.
 */
export function extractGeneratedImage(response: {
  output: Array<{ type: string; result?: string | null }>;
}): GeneratedImage {
  const call = response.output.find((item) => item.type === 'image_generation_call');
  if (!call || !call.result) {
    throw new Error('OpenAI did not return a generated image.');
  }
  return { bytes: Buffer.from(call.result, 'base64'), revisedPrompt: null };
}

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
          { type: 'input_image', detail: 'auto', file_id: input.referenceFileId },
        ],
      },
    ],
    tools: [{ type: 'image_generation', model: getImageModel(), size, quality }],
  });

  return extractGeneratedImage(response);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/openai-image.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: the same single pre-existing error in `app/personalize/actions.ts` from Task 3 (still unresolved until Task 8), plus a new error in the same file where it calls `generateOpenAiImage` with the old `{ prompt, images, size, quality }` shape. Confirm no errors anywhere else.

- [ ] **Step 7: Commit**

```bash
git add lib/env.ts .env.local.example README.md lib/openai-image.ts tests/lib/openai-image.test.ts
git commit -m "$(cat <<'EOF'
feat(personalization): migrate image generation to the Responses API

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Payload builder takes selected boilerplates (`lib/personalized-night-light-ai.ts`)

**Files:**
- Modify: `lib/personalized-night-light-ai.ts`
- Test: `tests/lib/personalized-night-light-ai.test.ts` (new)

**Interfaces:**
- Consumes: `PersonalizationBoilerplate` type from `lib/personalization-boilerplates.ts` (Task 3).
- Produces: `buildPersonalizedNightLightOpenAiPayload(input: PersonalizedNightLightRequest, selectedBoilerplates: Array<Pick<PersonalizationBoilerplate, 'image_path' | 'manufacturing_process'>>)` — new second parameter; `expectedOptions` and `outputContract.optionProcesses` now size to `selectedBoilerplates.length` instead of the deleted `NIGHT_LIGHT_BOILERPLATES` constant.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/personalized-night-light-ai.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPersonalizedNightLightOpenAiPayload } from '@/lib/personalized-night-light-ai';

const baseRequest = {
  modelId: '11111111-1111-1111-1111-111111111111',
  modelSlug: 'portrait-personalized-night-light',
  modelTitle: 'Portrait night light',
  boilerplateImagePath: null,
  userImagePaths: ['user/photo.jpg'],
  customText: 'Hello',
  customTextFormatting: undefined,
  ledColor: 'warm_white',
  multiColor: false,
  comfortableColors: [{ value: 'warm_white', label: 'Warm white', hex: '#FFDDAA' }],
};

const boilerplates = [
  { image_path: 'catalog/rectangular.jpg', manufacturing_process: 'rectangular UV-printed acrylic' },
  { image_path: 'catalog/round.jpg', manufacturing_process: 'round UV-printed acrylic' },
];

describe('buildPersonalizedNightLightOpenAiPayload', () => {
  it('includes one image entry per selected boilerplate', () => {
    const payload = buildPersonalizedNightLightOpenAiPayload(baseRequest, boilerplates);
    expect(payload.images).toEqual(['user/photo.jpg', 'catalog/rectangular.jpg', 'catalog/round.jpg']);
  });

  it('sizes expectedOptions and optionProcesses to the selection, not a fixed constant', () => {
    const payload = buildPersonalizedNightLightOpenAiPayload(baseRequest, boilerplates);
    expect(payload.expectedOptions).toBe(2);
    expect(payload.outputContract.optionProcesses).toEqual([
      { optionIndex: 1, process: 'rectangular UV-printed acrylic', publicPath: 'catalog/rectangular.jpg' },
      { optionIndex: 2, process: 'round UV-printed acrylic', publicPath: 'catalog/round.jpg' },
    ]);
  });

  it('works with a single selected boilerplate', () => {
    const payload = buildPersonalizedNightLightOpenAiPayload(baseRequest, [boilerplates[0]]);
    expect(payload.expectedOptions).toBe(1);
    expect(payload.outputContract.previews).toBe('1 generated preview image paths or files');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/personalized-night-light-ai.test.ts`
Expected: FAIL — `buildPersonalizedNightLightOpenAiPayload` currently takes one argument and ignores the second, so `expectedOptions` will be `3` (from the hardcoded `NIGHT_LIGHT_BOILERPLATES` constant) instead of `2`.

- [ ] **Step 3: Update the implementation**

Edit `lib/personalized-night-light-ai.ts`. Add this import at the top, after the `zod` import:

```ts
import type { PersonalizationBoilerplate } from "@/lib/personalization-boilerplates";
```

Delete the entire `NIGHT_LIGHT_BOILERPLATES` constant block (from `export const NIGHT_LIGHT_BOILERPLATES = [` through its closing `] as const;`).

Replace `buildPersonalizedNightLightOpenAiPayload` with:

```ts
export function buildPersonalizedNightLightOpenAiPayload(
  input: PersonalizedNightLightRequest,
  selectedBoilerplates: Array<
    Pick<PersonalizationBoilerplate, "image_path" | "manufacturing_process">
  >,
) {
  const parsed = personalizedNightLightRequestSchema.parse(input);
  return {
    prompt: buildPersonalizedNightLightPrompt(parsed),
    images: [
      ...parsed.userImagePaths,
      ...(parsed.boilerplateImagePath ? [parsed.boilerplateImagePath] : []),
      ...selectedBoilerplates.map((reference) => reference.image_path),
    ],
    expectedOptions: selectedBoilerplates.length,
    outputContract: {
      previews: `${selectedBoilerplates.length} generated preview image paths or files`,
      metadata: [
        "modelId",
        "customText",
        "ledColor",
        "multiColor",
        "templateVersion",
      ],
      optionProcesses: selectedBoilerplates.map((reference, index) => ({
        optionIndex: index + 1,
        process: reference.manufacturing_process,
        publicPath: reference.image_path,
      })),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/personalized-night-light-ai.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: same pre-existing errors in `app/personalize/actions.ts` as before (now also including a missing-second-argument error at its `buildPersonalizedNightLightOpenAiPayload(...)` call site). No new errors elsewhere.

- [ ] **Step 6: Commit**

```bash
git add lib/personalized-night-light-ai.ts tests/lib/personalized-night-light-ai.test.ts
git commit -m "$(cat <<'EOF'
feat(personalization): size the AI payload contract to selected boilerplates

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire OpenAI upload/delete into the admin boilerplate actions

**Files:**
- Modify: `app/personalization/night-lights/actions.ts`
- Modify: `scripts/smoke/admin.mjs`

**Interfaces:**
- Consumes: `getOpenAiClient()` (Task 1), `uploadReferenceImage`/`deleteReferenceFile` (Task 2), `openai_file_id` column (Task 3).
- Produces: no new exports — `savePersonalizationBoilerplateAction` and `removePersonalizationBoilerplateAction` keep their existing signatures (`(formData: FormData) => Promise<void>`), but now manage the OpenAI file lifecycle.

- [ ] **Step 1: Add imports**

Edit `app/personalization/night-lights/actions.ts`. Add after the existing `import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';` line:

```ts
import { getOpenAiClient } from '@/lib/openai-client';
import { deleteReferenceFile, uploadReferenceImage } from '@/lib/openai-files';
```

- [ ] **Step 2: Rewrite `savePersonalizationBoilerplateAction`**

Replace the whole function body:

```ts
export async function savePersonalizationBoilerplateAction(formData: FormData) {
  const parsed = boilerplateSchema.safeParse({
    id: formData.get('id') || undefined,
    modelId: formData.get('modelId'),
    adminName: formData.get('adminName'),
    nameEn: formData.get('nameEn') || undefined,
    nameHy: formData.get('nameHy') || undefined,
    nameRu: formData.get('nameRu') || undefined,
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
    if (newImageFile.size > 10 * 1024 * 1024) throw new Error('Template images must be 10 MB or smaller.');

    // OpenAI upload happens first: if it fails, nothing is persisted.
    openaiFileId = await uploadReferenceImage(getOpenAiClient(), newImageFile);
    imagePath = await uploadToBucket(supabase, {
      bucket: 'catalog-assets',
      path: `${user.id}/personalization-models/boilerplate-${crypto.randomUUID()}.${ext}`,
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
    model_id: values.modelId,
    admin_name: values.adminName,
    name_en: values.nameEn || null,
    name_hy: values.nameHy || null,
    name_ru: values.nameRu || null,
    image_path: imagePath,
    openai_file_id: openaiFileId,
    manufacturing_process: values.manufacturingProcess,
    generation_instruction: values.generationInstruction,
    sort_order: values.sortOrder,
    generate_hidden_svg: values.generateHiddenSvg,
    is_active: values.isActive,
  };

  const query = values.id
    ? supabase.from('personalization_boilerplates').update(payload).eq('id', values.id).eq('model_id', values.modelId)
    : supabase.from('personalization_boilerplates').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);

  if (previousOpenaiFileId) await deleteReferenceFile(getOpenAiClient(), previousOpenaiFileId);

  const { data: model } = await supabase
    .from('personalization_models')
    .select('slug')
    .eq('id', values.modelId)
    .maybeSingle<{ slug: string }>();
  revalidatePersonalization(model?.slug);
}
```

- [ ] **Step 3: Rewrite `removePersonalizationBoilerplateAction`**

Replace the whole function body:

```ts
export async function removePersonalizationBoilerplateAction(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), modelId: z.string().uuid() }).safeParse({
    id: formData.get('id'),
    modelId: formData.get('modelId'),
  });
  if (!parsed.success) throw new Error('Invalid boilerplate.');

  const { supabase } = await requireAdminPermission('catalog_manage');
  const { data: existing } = await supabase
    .from('personalization_boilerplates')
    .select('openai_file_id')
    .eq('id', parsed.data.id)
    .maybeSingle<{ openai_file_id: string }>();

  const { error } = await supabase.from('personalization_boilerplates').delete().eq('id', parsed.data.id);
  if (error) throw new Error(error.message);

  if (existing?.openai_file_id) await deleteReferenceFile(getOpenAiClient(), existing.openai_file_id);

  const { data: model } = await supabase
    .from('personalization_models')
    .select('slug')
    .eq('id', parsed.data.modelId)
    .maybeSingle<{ slug: string }>();
  revalidatePersonalization(model?.slug);
}
```

- [ ] **Step 4: Update the admin smoke script contract**

Edit `scripts/smoke/admin.mjs`. Extend the existing loop (currently checking `savePersonalizationBoilerplateAction`, `removePersonalizationBoilerplateAction`) to also require the new OpenAI wiring:

```js
const personalizationActions = readFileSync('app/personalization/night-lights/actions.ts', 'utf8');
for (const action of [
  'savePersonalizationBoilerplateAction',
  'removePersonalizationBoilerplateAction',
  'uploadReferenceImage',
  'deleteReferenceFile',
]) {
  if (!personalizationActions.includes(action)) throw new Error(`Missing personalization admin action: ${action}`);
}
```

- [ ] **Step 5: Run the smoke script and typecheck**

Run: `pnpm smoke:admin`
Expected: `Admin smoke passed` (or equivalent success output, no thrown error)

Run: `pnpm typecheck`
Expected: same pre-existing errors in `app/personalize/actions.ts` as before (unaffected by this task). No errors in `app/personalization/night-lights/actions.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/personalization/night-lights/actions.ts scripts/smoke/admin.mjs
git commit -m "$(cat <<'EOF'
feat(personalization): upload/delete OpenAI reference files on boilerplate save

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Show the OpenAI file id in the admin UI

**Files:**
- Modify: `app/personalization/night-lights/page.tsx`
- Modify: `messages/en.json`, `messages/am.json`, `messages/ru.json`

**Interfaces:**
- Consumes: `PersonalizationBoilerplate.openai_file_id` (Task 3).

- [ ] **Step 1: Add the translation key to all three locale files**

Edit `messages/en.json` at line 470 (`"requiresSvg": "Requires manufacturing file",`). Insert immediately after it:

```json
    "requiresSvg": "Requires manufacturing file",
    "openaiFileId": "OpenAI file ID",
```

Edit `messages/am.json` at line 470 (`"requiresSvg": "Պահանջվում է արտադրական ֆայլ",`). Insert immediately after it:

```json
    "requiresSvg": "Պահանջվում է արտադրական ֆայլ",
    "openaiFileId": "OpenAI ֆայլի ID",
```

Edit `messages/ru.json` at line 470 (`"requiresSvg": "Требуется производственный файл",`). Insert immediately after it:

```json
    "requiresSvg": "Требуется производственный файл",
    "openaiFileId": "ID файла OpenAI",
```

- [ ] **Step 2: Select the new column in the page query**

Edit `app/personalization/night-lights/page.tsx`. Update the boilerplates query select list:

```ts
    supabase
      .from('personalization_boilerplates')
      .select('id, model_id, admin_name, name_en, name_hy, name_ru, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order')
      .order('sort_order')
      .returns<PersonalizationBoilerplate[]>(),
```

- [ ] **Step 3: Display it read-only in `BoilerplateForm`**

In the same file, inside `BoilerplateForm`, add this block immediately before the final `<div className="flex items-center gap-2 md:col-span-3">` (the submit/remove button row) — only rendered for existing boilerplates:

```tsx
      {boilerplate ? (
        <p className="text-xs text-muted-foreground md:col-span-3">
          {t('personalization.openaiFileId')}: <code>{boilerplate.openai_file_id}</code>
        </p>
      ) : null}
```

- [ ] **Step 4: Update the admin smoke script and i18n smoke check**

Edit `scripts/smoke/admin.mjs`. Extend the existing personalization page contract check:

```js
const personalizationPage = readFileSync('app/personalization/night-lights/page.tsx', 'utf8');
for (const contract of ['ImageUploadField', 'mockImagePath', 'boilerplateImagePath', 'resolvePublicStorageUrl', 'openai_file_id']) {
  if (!personalizationPage.includes(contract)) throw new Error(`Missing personalization image contract: ${contract}`);
}
```

Run: `pnpm smoke:admin`
Expected: passes

Run: `pnpm smoke:i18n`
Expected: passes (confirms `openaiFileId` exists with matching keys across en/am/ru and no leaf/branch conflicts)

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: same pre-existing errors in `app/personalize/actions.ts` as before (unaffected by this task).

- [ ] **Step 6: Commit**

```bash
git add app/personalization/night-lights/page.tsx messages/en.json messages/am.json messages/ru.json scripts/smoke/admin.mjs
git commit -m "$(cat <<'EOF'
feat(personalization): show the OpenAI file id on each boilerplate row

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Switch customer generation to file-id references

**Files:**
- Modify: `app/personalize/actions.ts`
- Modify: `scripts/smoke/generation.mjs`

**Interfaces:**
- Consumes: `getOpenAiClient()` (Task 1), `generateOpenAiImage(client, input)` new signature (Task 4), `buildPersonalizedNightLightOpenAiPayload(input, selectedBoilerplates)` new signature (Task 5), `openai_file_id` column (Task 3).
- Produces: no new exports — this task closes out the last two `pnpm typecheck` errors left dangling since Task 3.

This is the task that finally resolves every compile error left open by Tasks 3–5. After this task, `pnpm typecheck` should be fully clean.

- [ ] **Step 1: Update imports**

Edit `app/personalize/actions.ts`. Replace:

```ts
import { generateOpenAiImage } from "@/lib/openai-image";
```

with:

```ts
import { getOpenAiClient } from "@/lib/openai-client";
import { generateOpenAiImage } from "@/lib/openai-image";
```

Replace:

```ts
import {
  loadBoilerplate,
  type PersonalizationBoilerplate,
} from "@/lib/personalization-boilerplates";
```

with:

```ts
import type { PersonalizationBoilerplate } from "@/lib/personalization-boilerplates";
```

- [ ] **Step 2: Select `openai_file_id` in the boilerplate query**

Update the `selectedBoilerplates` query's `.select(...)` call:

```ts
  const { data: selectedBoilerplates, error: boilerplateError } = await supabase
    .from("personalization_boilerplates")
    .select("id, model_id, admin_name, name_en, name_hy, name_ru, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order")
    .eq("model_id", model.id)
    .eq("is_active", true)
    .in("id", requestedBoilerplateIds)
    .order("sort_order")
    .returns<PersonalizationBoilerplate[]>();
```

- [ ] **Step 3: Pass `selectedBoilerplates` into the payload builder**

Update the `buildPersonalizedNightLightOpenAiPayload` call:

```ts
    const requestPayload = buildPersonalizedNightLightOpenAiPayload(
      {
        modelId: model.id,
        modelSlug: model.slug,
        modelTitle: model.title,
        boilerplateImagePath: model.boilerplate_image_path,
        userImagePaths: originalImagePaths,
        customText,
        customTextFormatting,
        ledColor,
        multiColor,
        comfortableColors: PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.map(
          (color) => ({ ...color }),
        ),
      },
      selectedBoilerplates,
    );
```

- [ ] **Step 4: Drop the per-option boilerplate download and use the file id**

Replace the per-option loop body. Find:

```ts
    const options = [];
    for (let offset = 0; offset < selectedBoilerplates.length; offset += 1) {
      const index = offset + 1;
      const reference = selectedBoilerplates[offset];
      const boilerplate = await loadBoilerplate(supabase, reference);
      const image = await generateOpenAiImage({
        prompt: `${requestPayload.prompt}\n\nCreate the selected ${reference.admin_name} preview using manufacturing process ${reference.manufacturing_process}. ${reference.generation_instruction} The final preview must show this boilerplate product customized with the user-submitted subject; do not return the blank boilerplate.`,
        images: [...files, boilerplate],
        size: "1024x1024",
        quality: "low",
      });
```

Replace with:

```ts
    const openAiClient = getOpenAiClient();
    const options = [];
    for (let offset = 0; offset < selectedBoilerplates.length; offset += 1) {
      const index = offset + 1;
      const reference = selectedBoilerplates[offset];
      const image = await generateOpenAiImage(openAiClient, {
        prompt: `${requestPayload.prompt}\n\nCreate the selected ${reference.admin_name} preview using manufacturing process ${reference.manufacturing_process}. ${reference.generation_instruction} The final preview must show this boilerplate product customized with the user-submitted subject; do not return the blank boilerplate.`,
        userImages: files,
        referenceFileId: reference.openai_file_id,
        size: "1024x1024",
        quality: "low",
      });
```

The rest of the loop body (building `previewPath` and pushing onto `options`) is unchanged.

- [ ] **Step 5: Update the generation smoke script**

Edit `scripts/smoke/generation.mjs`. Add a new required contract to the existing `for (const contract of [...])` loop over `personalizedAction`:

```js
for (const contract of [
  'formData.getAll("boilerplateIds")',
  'const creditCost = selectedBoilerplates.length',
  'reference.generate_hidden_svg',
  'manufacturingFilePath: null',
  'manufacturingSvgStatus: "pending_admin_generation"',
  'referenceFileId: reference.openai_file_id',
]) {
  if (!personalizedAction.includes(contract)) throw new Error(`Missing personalized generation contract: ${contract}`);
}
```

Add a new retired-contract check to the existing `for (const removedContract of [...])` loop:

```js
for (const removedContract of ['createPreviewSvg(', 'uploadGeneratedSvg(', 'hiddenSvgs:', 'loadBoilerplate(']) {
  if (personalizedAction.includes(removedContract)) throw new Error(`Customer generation still creates manufacturing SVGs: ${removedContract}`);
}
```

- [ ] **Step 6: Run the smoke script**

Run: `pnpm smoke:generation`
Expected: `Personalized generation smoke passed`

- [ ] **Step 7: Full typecheck — must be clean**

Run: `pnpm typecheck`
Expected: **no errors anywhere.** This is the task where every dangling error from Tasks 3–5 finally resolves. If anything still fails, re-check the exact function signatures against Tasks 1, 4, and 5 before proceeding.

- [ ] **Step 8: Run the full unit test suite**

Run: `pnpm test`
Expected: all tests pass, including the new files from Tasks 1, 2, 4, and 5.

- [ ] **Step 9: Commit**

```bash
git add app/personalize/actions.ts scripts/smoke/generation.mjs
git commit -m "$(cat <<'EOF'
feat(personalization): generate previews from stored OpenAI file ids

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: no errors

- [ ] **Step 2: Format check**

Run: `pnpm format:check`
Expected: no errors (if this fails on files touched by this plan, run `pnpm format` and re-commit)

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: all tests pass

- [ ] **Step 4: Full typecheck**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 5: Full smoke suite**

Run: `pnpm smoke`
Expected: all smoke checks pass, including `smoke:generation` and `smoke:admin`

- [ ] **Step 6: Manual QA (requires a real `OPENAI_API_KEY` and a deployed/local environment with Supabase running)**

This step cannot be scripted — perform it manually after deploy:

1. Open `/personalization/night-lights` as an admin.
2. Recreate the three original boilerplates (Rectangular UV print, Round UV print, Contour laser engraved) using the images previously at `public/product-references/night-lights/*.jpg`, filling in the same `manufacturing_process` and `generation_instruction` text that was in the deleted seed migration (`supabase/migrations/20260701104320_personalized_night_light_boilerplates.sql`, now historical).
3. Confirm each saved row shows a non-empty OpenAI file id in the admin UI.
4. Run one real customer generation end-to-end at `/personalize/<model-slug>` and confirm a preview image is produced.
5. In the OpenAI dashboard, confirm the uploaded files appear under Files with purpose `vision`.

- [ ] **Step 7: Update the go-live checklist if one exists**

Check whether `docs/investigations/` or a go-live checklist doc references personalization boilerplates needing recreation after this deploy. If a relevant checklist exists (e.g. similar to the Ameriabank go-live checklist), add a line noting that boilerplates must be recreated through the admin UI after this migration deploys, since the migration deletes all existing rows. If you edit such a file, commit it separately:

```bash
git add <checklist-file>
git commit -m "$(cat <<'EOF'
docs: note personalization boilerplate recreation in go-live checklist

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
