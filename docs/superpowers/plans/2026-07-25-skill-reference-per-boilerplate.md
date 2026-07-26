# Skill Reference per Item & Boilerplate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins attach an optional `.md`/`.txt` skill file to a catalog item and/or to each personalization boilerplate, and inject the skill file's text content into the OpenAI generation call (product skill first, boilerplate skill second).

**Architecture:** Skill files are uploaded through the admin forms: OpenAI File Storage first (`purpose: 'user_data'`, the source of truth referenced by file id), then a recovery copy in the Supabase `catalog-assets` bucket. At generation time the server fetches each unique skill file's text once (`client.files.content`, memoized per action invocation) and injects it as `input_text` parts placed before the composed prompt. `catalog_items.skill_id` (existing column, not renamed) holds the OpenAI file id; only ids starting with `file-` are used, so legacy seed values stay inert.

**Tech Stack:** Next.js App Router server actions, Supabase (Postgres + Storage), OpenAI Node SDK (Responses API + Files API), Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-25-skill-reference-per-boilerplate-design.md`

## Global Constraints

- Skill files: accept `.md`/`.txt` only, max **1 MB**. Error copy: `'Upload .md or .txt skill files only.'` and `'Skill files must be 1 MB or smaller.'`
- OpenAI upload purpose for skills: `user_data`.
- Supabase copy path: `{userId}/personalization-skills/{uuid}.{ext}` in bucket `catalog-assets`.
- Skill order in the generation call: **product skill first, boilerplate skill second**, both before the composed prompt.
- Generation only treats a skill id as real when it starts with `file-`; anything else is silently skipped.
- Items/boilerplates without skills must produce **byte-identical** OpenAI calls to today's behavior.
- `catalog_items.skill_id` is **not renamed**; MCP tools keep accepting `skillId` as a plain string, unchanged.
- No live OpenAI or Supabase calls in tests; clients are mocked as in existing suites.
- All new DB columns nullable; the feature is optional end to end.
- Work on the existing branch `boilerplate-skill-reference`. Run commands from the repo root `C:\apps\snip`. Tests: `npx vitest run <path>`. Typecheck: `npm run typecheck`.

---

### Task 1: Schema migration + generated types

**Files:**
- Create: `supabase/migrations/20260725120000_skill_reference_columns.sql`
- Modify: `lib/supabase/database.types.ts` (hand-edit; `npm run db:types` needs a running local Supabase, which the executor may not have)

**Interfaces:**
- Consumes: nothing.
- Produces: columns `personalization_boilerplates.skill_openai_file_id text`, `personalization_boilerplates.skill_path text`, `catalog_items.skill_path text`, and matching `Tables<...>` types. All later tasks rely on these generated types.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260725120000_skill_reference_columns.sql`:

```sql
-- Optional generation-skill attachments. skill_openai_file_id / catalog_items.skill_id
-- hold the OpenAI File Storage id injected into generation calls; skill_path is a
-- recovery copy of the same document in the catalog-assets bucket. All nullable —
-- the feature is optional end to end. catalog_items.skill_id (existing text column)
-- is reused for the item-level file id and intentionally not renamed.
alter table "public"."personalization_boilerplates"
  add column "skill_openai_file_id" text,
  add column "skill_path" text;

alter table "public"."catalog_items"
  add column "skill_path" text;
```

- [ ] **Step 2: Update generated types by hand**

In `lib/supabase/database.types.ts`:

In `catalog_items` (around line 602): keys are alphabetical. In `Row`, after `skill_id: string | null` add:

```ts
          skill_path: string | null
```

In `Insert` and `Update`, after their `skill_id?: string | null` lines add:

```ts
          skill_path?: string | null
```

In `personalization_boilerplates` (around line 1330): in `Row`, after `price_adjustment_percent: number | null` add:

```ts
          skill_openai_file_id: string | null
          skill_path: string | null
```

In `Insert` and `Update`, after their `price_adjustment_percent?: number | null` lines add:

```ts
          skill_openai_file_id?: string | null
          skill_path?: string | null
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725120000_skill_reference_columns.sql lib/supabase/database.types.ts
git commit -m "feat(db): skill reference columns on boilerplates and catalog items"
```

---

### Task 2: `uploadSkillFile` helper in `lib/openai-files.ts`

**Files:**
- Modify: `lib/openai-files.ts`
- Test: `tests/lib/openai-files.test.ts`

**Interfaces:**
- Consumes: existing `deleteReferenceFile(client, fileId)` (unchanged, reused later for skill cleanup).
- Produces: `uploadSkillFile(client: Pick<OpenAI, 'files'>, file: File): Promise<string>` — uploads with `purpose: 'user_data'`, returns the OpenAI file id, throws on failure. Tasks 6+ call this.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/openai-files.test.ts` (add `uploadSkillFile` to the existing import from `@/lib/openai-files`):

```ts
describe('uploadSkillFile', () => {
  it('uploads with the user_data purpose and returns the file id', async () => {
    const client = fakeOpenAiClient();
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    await expect(uploadSkillFile(client, file)).resolves.toBe('file-abc123');
    expect(client.files.create).toHaveBeenCalledWith({ file, purpose: 'user_data' });
  });

  it('throws when the upload fails', async () => {
    const client = fakeOpenAiClient({
      create: vi.fn(async () => {
        throw new Error('network error');
      }),
    });
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    await expect(uploadSkillFile(client, file)).rejects.toThrow('network error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/openai-files.test.ts`
Expected: FAIL — `uploadSkillFile` is not exported.

- [ ] **Step 3: Implement**

In `lib/openai-files.ts`, add after `uploadReferenceImage`:

```ts
/** Uploads a skill document (.md/.txt) to OpenAI File Storage. Throws on failure. */
export async function uploadSkillFile(
  client: Pick<OpenAI, 'files'>,
  file: File,
): Promise<string> {
  const uploaded = await client.files.create({ file, purpose: 'user_data' });
  return uploaded.id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/openai-files.test.ts`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add lib/openai-files.ts tests/lib/openai-files.test.ts
git commit -m "feat(openai): uploadSkillFile helper with user_data purpose"
```

---

### Task 3: Skill id collection + memoized content loader (`lib/personalization-skills.ts`)

**Files:**
- Create: `lib/personalization-skills.ts`
- Test: `tests/lib/personalization-skills.test.ts`

**Interfaces:**
- Consumes: OpenAI SDK type only (`client.files.content(fileId)` resolves to a `Response`-like object with `.text()`).
- Produces (used by Tasks 5 and 8):
  - `isOpenAiSkillFileId(value: string | null | undefined): value is string` — true only for strings starting with `file-`.
  - `collectSkillFileIds(itemSkillId: string | null, boilerplateSkillFileId: string | null | undefined): string[]` — ordered (item first, boilerplate second), legacy ids dropped, duplicates removed.
  - `createSkillTextLoader(client: Pick<OpenAI, 'files'>): (fileId: string) => Promise<string>` — fetches each unique file id's text at most once per loader instance.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/personalization-skills.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  collectSkillFileIds,
  createSkillTextLoader,
  isOpenAiSkillFileId,
} from '@/lib/personalization-skills';

describe('isOpenAiSkillFileId', () => {
  it('accepts ids starting with file-', () => {
    expect(isOpenAiSkillFileId('file-abc123')).toBe(true);
  });

  it('rejects legacy seed ids, null, undefined, and empty strings', () => {
    expect(isOpenAiSkillFileId('skill-1')).toBe(false);
    expect(isOpenAiSkillFileId(null)).toBe(false);
    expect(isOpenAiSkillFileId(undefined)).toBe(false);
    expect(isOpenAiSkillFileId('')).toBe(false);
  });
});

describe('collectSkillFileIds', () => {
  it('returns the product skill before the boilerplate skill', () => {
    expect(collectSkillFileIds('file-item', 'file-boiler')).toEqual(['file-item', 'file-boiler']);
  });

  it('skips a legacy non file- item skill id', () => {
    expect(collectSkillFileIds('skill-1', 'file-boiler')).toEqual(['file-boiler']);
  });

  it('includes only the item skill when the boilerplate has none', () => {
    expect(collectSkillFileIds('file-item', null)).toEqual(['file-item']);
    expect(collectSkillFileIds('file-item', undefined)).toEqual(['file-item']);
  });

  it('dedupes when item and boilerplate share the same file id', () => {
    expect(collectSkillFileIds('file-same', 'file-same')).toEqual(['file-same']);
  });

  it('returns an empty list when nothing is attached', () => {
    expect(collectSkillFileIds(null, null)).toEqual([]);
  });
});

describe('createSkillTextLoader', () => {
  function fakeClient(content: ReturnType<typeof vi.fn>) {
    return { files: { content } } as unknown as Parameters<typeof createSkillTextLoader>[0];
  }

  it('returns the fetched text', async () => {
    const content = vi.fn(async () => ({ text: async () => 'skill guidance' }));
    const load = createSkillTextLoader(fakeClient(content));
    await expect(load('file-a')).resolves.toBe('skill guidance');
    expect(content).toHaveBeenCalledWith('file-a');
  });

  it('fetches each unique file id only once', async () => {
    const content = vi.fn(async (fileId: string) => ({ text: async () => `text of ${fileId}` }));
    const load = createSkillTextLoader(fakeClient(content));
    await expect(load('file-a')).resolves.toBe('text of file-a');
    await expect(load('file-a')).resolves.toBe('text of file-a');
    await expect(load('file-b')).resolves.toBe('text of file-b');
    expect(content).toHaveBeenCalledTimes(2);
  });

  it('propagates fetch failures', async () => {
    const content = vi.fn(async () => {
      throw new Error('file not found');
    });
    const load = createSkillTextLoader(fakeClient(content));
    await expect(load('file-missing')).rejects.toThrow('file not found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/personalization-skills.test.ts`
Expected: FAIL — module `@/lib/personalization-skills` does not exist.

- [ ] **Step 3: Implement**

Create `lib/personalization-skills.ts` (no `'server-only'` — pure logic plus an injected client, mirroring `lib/personalization-boilerplates.ts`):

```ts
import type OpenAI from 'openai';

/**
 * Only ids minted by OpenAI File Storage participate in generation. Legacy
 * free-text values in catalog_items.skill_id (e.g. `skill-1` from seeds) are
 * inert by design — see the 2026-07-25 skill-reference spec.
 */
export function isOpenAiSkillFileId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('file-');
}

/**
 * Skill file ids for one generation call: product skill first, boilerplate
 * skill second. Legacy ids are dropped; a shared id appears once.
 */
export function collectSkillFileIds(
  itemSkillId: string | null,
  boilerplateSkillFileId: string | null | undefined,
): string[] {
  const ids: string[] = [];
  if (isOpenAiSkillFileId(itemSkillId)) ids.push(itemSkillId);
  if (isOpenAiSkillFileId(boilerplateSkillFileId) && !ids.includes(boilerplateSkillFileId)) {
    ids.push(boilerplateSkillFileId);
  }
  return ids;
}

/**
 * Memoized skill-content fetcher scoped to one action invocation: each unique
 * file id is downloaded once even when several selected boilerplates share
 * the product skill.
 */
export function createSkillTextLoader(
  client: Pick<OpenAI, 'files'>,
): (fileId: string) => Promise<string> {
  const cache = new Map<string, Promise<string>>();
  return (fileId) => {
    let pending = cache.get(fileId);
    if (!pending) {
      pending = Promise.resolve(client.files.content(fileId)).then((response) => response.text());
      cache.set(fileId, pending);
    }
    return pending;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/personalization-skills.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/personalization-skills.ts tests/lib/personalization-skills.test.ts
git commit -m "feat(personalization): skill id collection and memoized content loader"
```

---

### Task 4: `skillTexts` injection in `generateOpenAiImage`

**Files:**
- Modify: `lib/openai-image.ts`
- Test: `tests/lib/openai-image.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `OpenAiImageInput` gains `skillTexts?: string[]`. Each entry becomes an `{ type: 'input_text', text }` part placed **before** the prompt part, in the given order. Omitted or empty `skillTexts` yields today's exact request shape. Task 5 passes this field.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('generateOpenAiImage', ...)` block in `tests/lib/openai-image.test.ts`:

```ts
  it('injects skill texts as input_text parts before the prompt', async () => {
    const base64 = Buffer.from('generated-bytes').toString('base64');
    const create = vi.fn(async () => ({
      output: [{ type: 'image_generation_call', result: base64 }],
    }));
    const client = { responses: { create } } as unknown as Parameters<
      typeof generateOpenAiImage
    >[0];

    await generateOpenAiImage(client, {
      prompt: 'Generate a night light',
      skillTexts: ['product skill guidance', 'boilerplate skill guidance'],
      userImages: [],
      referenceFileId: 'file-boilerplate-1',
      size: '1024x1024',
      quality: 'low',
    });

    // biome-ignore lint/suspicious/noExplicitAny: test double for the Responses API request body
    const requestBody = (create.mock.calls[0] as any[])[0];
    const [message] = requestBody.input;
    expect(message.content[0]).toEqual({ type: 'input_text', text: 'product skill guidance' });
    expect(message.content[1]).toEqual({ type: 'input_text', text: 'boilerplate skill guidance' });
    expect(message.content[2]).toEqual({ type: 'input_text', text: 'Generate a night light' });
    expect(message.content[3]).toEqual({
      type: 'input_image',
      detail: 'auto',
      file_id: 'file-boilerplate-1',
    });
  });

  it('produces the exact legacy content shape for an empty skillTexts array', async () => {
    const base64 = Buffer.from('generated-bytes').toString('base64');
    const create = vi.fn(async () => ({
      output: [{ type: 'image_generation_call', result: base64 }],
    }));
    const client = { responses: { create } } as unknown as Parameters<
      typeof generateOpenAiImage
    >[0];

    await generateOpenAiImage(client, {
      prompt: 'Generate a preview',
      skillTexts: [],
      userImages: [],
      referenceFileId: null,
      size: '1024x1024',
      quality: 'low',
    });

    // biome-ignore lint/suspicious/noExplicitAny: test double for the Responses API request body
    const requestBody = (create.mock.calls[0] as any[])[0];
    const [message] = requestBody.input;
    expect(message.content).toEqual([{ type: 'input_text', text: 'Generate a preview' }]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/openai-image.test.ts`
Expected: FAIL — the first new test finds the prompt at `content[0]` instead of the skill text (`skillTexts` is not yet consumed).

- [ ] **Step 3: Implement**

In `lib/openai-image.ts`, extend the interface:

```ts
export interface OpenAiImageInput {
  prompt: string;
  /** Skill document texts injected as input_text parts before the prompt, in given order. */
  skillTexts?: string[];
  userImages: File[];
  referenceFileId?: string | null;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}
```

And change the `content` array inside `generateOpenAiImage`:

```ts
        content: [
          ...(input.skillTexts ?? []).map((text) => ({ type: 'input_text' as const, text })),
          { type: 'input_text', text: input.prompt },
          ...userImageParts,
          ...(input.referenceFileId
            ? [{ type: 'input_image' as const, detail: 'auto' as const, file_id: input.referenceFileId }]
            : []),
        ],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/openai-image.test.ts`
Expected: PASS — all tests including the two pre-existing ones (which prove the omitted-`skillTexts` shape is unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/openai-image.ts tests/lib/openai-image.test.ts
git commit -m "feat(openai): optional skillTexts injected before the generation prompt"
```

---

### Task 5: Generation flow wiring (`app/personalize/actions.ts`)

**Files:**
- Modify: `lib/personalization-boilerplates.ts` (interface + select)
- Modify: `app/personalize/actions.ts`

**Interfaces:**
- Consumes: `collectSkillFileIds`, `createSkillTextLoader` (Task 3); `skillTexts` on `OpenAiImageInput` (Task 4); `Tables<'personalization_boilerplates'>` columns (Task 1).
- Produces: `PersonalizationBoilerplate` gains `skill_openai_file_id: string | null` and `skill_path: string | null`. `listCatalogItemBoilerplates` selects them. Task 7's admin page relies on these interface fields.

- [ ] **Step 1: Expose skill columns on boilerplate reads**

In `lib/personalization-boilerplates.ts`:

Add to the `PersonalizationBoilerplate` interface after `price_adjustment_percent: number | null;`:

```ts
  skill_openai_file_id: string | null;
  skill_path: string | null;
```

Update the select string in `listCatalogItemBoilerplates` to:

```ts
      'sort_order, boilerplate:personalization_boilerplates(id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order, price_adjustment_percent, skill_openai_file_id, skill_path)',
```

Also update the admin page select in `app/admin/personalization/boilerplates/page.tsx` (it casts to the same interface) to:

```ts
      'id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order, price_adjustment_percent, skill_openai_file_id, skill_path',
```

- [ ] **Step 2: Wire skill texts into the generation loop**

In `app/personalize/actions.ts`:

Add the import:

```ts
import { collectSkillFileIds, createSkillTextLoader } from '@/lib/personalization-skills';
```

After `const openAiClient = getOpenAiClient();` (inside the main `try`), add:

```ts
    const loadSkillText = createSkillTextLoader(openAiClient);
```

Inside the `for (const reference of callTargets)` loop, between the `composePersonalizationPrompt` call and the `generateOpenAiImage` call, add:

```ts
      const skillTexts = await Promise.all(
        collectSkillFileIds(item.skill_id, reference?.skill_openai_file_id).map(loadSkillText),
      );
```

And pass it in the `generateOpenAiImage` call:

```ts
      const image = await generateOpenAiImage(openAiClient, {
        prompt,
        skillTexts,
        userImages: files,
        referenceFileId: reference?.openai_file_id ?? null,
        size: '1024x1024',
        quality: 'low',
      });
```

Error handling needs **no new code**: a failed `client.files.content` fetch rejects inside the existing `try/catch`, which already refunds credits and returns `friendlyGenerationError` — exactly the spec's required behavior (no "generate without the skill" fallback).

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npx vitest run tests/lib/personalization-boilerplates.test.ts tests/lib/personalization-ai.test.ts`
Expected: PASS (no behavior change for skill-less items).

- [ ] **Step 4: Commit**

```bash
git add lib/personalization-boilerplates.ts app/admin/personalization/boilerplates/page.tsx app/personalize/actions.ts
git commit -m "feat(personalize): inject item and boilerplate skill texts into generation calls"
```

---

### Task 6: Shared skill-file admin helpers (`lib/skill-files.ts`)

**Files:**
- Create: `lib/skill-files.ts`
- Test: `tests/lib/skill-files.test.ts`

**Interfaces:**
- Consumes: `uploadSkillFile`, `deleteReferenceFile` (Task 2 / existing); `uploadToBucket` (existing `lib/storage.ts`); `isOpenAiSkillFileId` (Task 3).
- Produces (used by Tasks 7 and 8):
  - `SKILL_FILE_MAX_BYTES = 1024 * 1024`
  - `skillFileExtension(fileName: string): 'md' | 'txt' | null`
  - `getSkillFile(formData: FormData): File | null` — reads the `skillFile` field.
  - `uploadSkillAssets(openai, supabase, userId, file): Promise<{ openaiFileId: string; skillPath: string }>` — validates, uploads to OpenAI first, then Supabase; on Supabase failure best-effort deletes the OpenAI file and rethrows.
  - `resolveSkillColumns({ uploaded, removeSkill, existing }): { skillOpenaiFileId: string | null; skillPath: string | null; previousOpenaiFileId: string | null }`
  - `applyItemSkillFields(openai, supabase, userId, formData, item): Promise<string | null>` — mutates `item.skillId`/`item.skillPath` per upload/remove semantics; returns the previous OpenAI file id to delete after the DB write (only ids passing `isOpenAiSkillFileId`), else null.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/skill-files.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/storage', () => ({ uploadToBucket: vi.fn() }));

import { uploadToBucket } from '@/lib/storage';
import {
  applyItemSkillFields,
  getSkillFile,
  resolveSkillColumns,
  skillFileExtension,
  uploadSkillAssets,
} from '@/lib/skill-files';

type OpenAiFilesClient = Parameters<typeof uploadSkillAssets>[0];
type StorageClient = Parameters<typeof uploadSkillAssets>[1];

function fakeOpenAi(
  overrides: { create?: (...args: unknown[]) => unknown; del?: (...args: unknown[]) => unknown } = {},
) {
  return {
    files: {
      create: overrides.create ?? vi.fn(async () => ({ id: 'file-new-skill' })),
      delete: overrides.del ?? vi.fn(async () => ({ id: 'file-new-skill', deleted: true })),
    },
  } as unknown as OpenAiFilesClient;
}

const storageClient = {} as StorageClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(uploadToBucket).mockImplementation(async (_client, { path }) => path);
});

describe('skillFileExtension', () => {
  it('maps .md and .txt (case-insensitive) to their extensions', () => {
    expect(skillFileExtension('guide.md')).toBe('md');
    expect(skillFileExtension('GUIDE.TXT')).toBe('txt');
  });

  it('returns null for anything else', () => {
    expect(skillFileExtension('image.png')).toBeNull();
    expect(skillFileExtension('archive.md.zip')).toBeNull();
    expect(skillFileExtension('noextension')).toBeNull();
  });
});

describe('getSkillFile', () => {
  it('returns the non-empty skillFile entry', () => {
    const formData = new FormData();
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    formData.set('skillFile', file);
    expect(getSkillFile(formData)).toBe(file);
  });

  it('returns null for a missing or empty file input', () => {
    expect(getSkillFile(new FormData())).toBeNull();
    const formData = new FormData();
    formData.set('skillFile', new File([], 'empty.md', { type: 'text/markdown' }));
    expect(getSkillFile(formData)).toBeNull();
  });
});

describe('uploadSkillAssets', () => {
  it('uploads to OpenAI then copies to Supabase under personalization-skills', async () => {
    const openai = fakeOpenAi();
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    const result = await uploadSkillAssets(openai, storageClient, 'user-1', file);
    expect(result.openaiFileId).toBe('file-new-skill');
    expect(result.skillPath).toMatch(/^user-1\/personalization-skills\/[0-9a-f-]+\.md$/);
    expect(uploadToBucket).toHaveBeenCalledWith(
      storageClient,
      expect.objectContaining({ bucket: 'catalog-assets', contentType: 'text/markdown' }),
    );
  });

  it('rejects unsupported extensions before uploading anything', async () => {
    const openai = fakeOpenAi();
    const file = new File(['x'], 'skill.pdf', { type: 'application/pdf' });
    await expect(uploadSkillAssets(openai, storageClient, 'user-1', file)).rejects.toThrow(
      'Upload .md or .txt skill files only.',
    );
    expect(openai.files.create).not.toHaveBeenCalled();
  });

  it('rejects files over 1 MB before uploading anything', async () => {
    const openai = fakeOpenAi();
    const file = new File([new Uint8Array(1024 * 1024 + 1)], 'big.md', { type: 'text/markdown' });
    await expect(uploadSkillAssets(openai, storageClient, 'user-1', file)).rejects.toThrow(
      'Skill files must be 1 MB or smaller.',
    );
    expect(openai.files.create).not.toHaveBeenCalled();
  });

  it('deletes the OpenAI file and rethrows when the Supabase copy fails', async () => {
    vi.mocked(uploadToBucket).mockRejectedValueOnce(new Error('bucket unavailable'));
    const openai = fakeOpenAi();
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    await expect(uploadSkillAssets(openai, storageClient, 'user-1', file)).rejects.toThrow(
      'bucket unavailable',
    );
    expect(openai.files.delete).toHaveBeenCalledWith('file-new-skill');
  });
});

describe('resolveSkillColumns', () => {
  const existing = { skillOpenaiFileId: 'file-old', skillPath: 'user-1/personalization-skills/old.md' };

  it('uses the uploaded skill and marks the previous one for deletion', () => {
    expect(
      resolveSkillColumns({
        uploaded: { openaiFileId: 'file-new-skill', skillPath: 'user-1/personalization-skills/new.md' },
        removeSkill: false,
        existing,
      }),
    ).toEqual({
      skillOpenaiFileId: 'file-new-skill',
      skillPath: 'user-1/personalization-skills/new.md',
      previousOpenaiFileId: 'file-old',
    });
  });

  it('clears both columns on removeSkill and marks the previous file for deletion', () => {
    expect(resolveSkillColumns({ uploaded: null, removeSkill: true, existing })).toEqual({
      skillOpenaiFileId: null,
      skillPath: null,
      previousOpenaiFileId: 'file-old',
    });
  });

  it('carries the existing skill through an unrelated save', () => {
    expect(resolveSkillColumns({ uploaded: null, removeSkill: false, existing })).toEqual({
      skillOpenaiFileId: 'file-old',
      skillPath: existing.skillPath,
      previousOpenaiFileId: null,
    });
  });

  it('handles a brand-new record with no skill', () => {
    expect(resolveSkillColumns({ uploaded: null, removeSkill: false, existing: null })).toEqual({
      skillOpenaiFileId: null,
      skillPath: null,
      previousOpenaiFileId: null,
    });
  });
});

describe('applyItemSkillFields', () => {
  it('writes the uploaded file id into skillId and returns the previous id', async () => {
    const openai = fakeOpenAi();
    const formData = new FormData();
    formData.set('skillFile', new File(['# Skill'], 'skill.md', { type: 'text/markdown' }));
    const item: { skillId?: string; skillPath?: string } = {
      skillId: 'file-old',
      skillPath: 'user-1/personalization-skills/old.md',
    };
    await expect(applyItemSkillFields(openai, storageClient, 'user-1', formData, item)).resolves.toBe(
      'file-old',
    );
    expect(item.skillId).toBe('file-new-skill');
    expect(item.skillPath).toMatch(/^user-1\/personalization-skills\//);
  });

  it('leaves the item untouched without an upload or removal', async () => {
    const openai = fakeOpenAi();
    const item: { skillId?: string; skillPath?: string } = { skillId: 'file-old' };
    await expect(
      applyItemSkillFields(openai, storageClient, 'user-1', new FormData(), item),
    ).resolves.toBeNull();
    expect(item.skillId).toBe('file-old');
  });

  it('clears the skill fields on removeSkill and returns the previous id', async () => {
    const openai = fakeOpenAi();
    const formData = new FormData();
    formData.set('removeSkill', 'on');
    const item: { skillId?: string; skillPath?: string } = {
      skillId: 'file-old',
      skillPath: 'user-1/personalization-skills/old.md',
    };
    await expect(applyItemSkillFields(openai, storageClient, 'user-1', formData, item)).resolves.toBe(
      'file-old',
    );
    expect(item.skillId).toBeUndefined();
    expect(item.skillPath).toBeUndefined();
  });

  it('never reports a legacy non file- id for deletion', async () => {
    const openai = fakeOpenAi();
    const formData = new FormData();
    formData.set('removeSkill', 'on');
    const item: { skillId?: string; skillPath?: string } = { skillId: 'skill-1' };
    await expect(
      applyItemSkillFields(openai, storageClient, 'user-1', formData, item),
    ).resolves.toBeNull();
    expect(item.skillId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/skill-files.test.ts`
Expected: FAIL — module `@/lib/skill-files` does not exist.

- [ ] **Step 3: Implement**

Create `lib/skill-files.ts`:

```ts
import 'server-only';

import type OpenAI from 'openai';
import { deleteReferenceFile, uploadSkillFile } from '@/lib/openai-files';
import { isOpenAiSkillFileId } from '@/lib/personalization-skills';
import { uploadToBucket } from '@/lib/storage';

export const SKILL_FILE_MAX_BYTES = 1024 * 1024;

const SKILL_CONTENT_TYPE_BY_EXT = { md: 'text/markdown', txt: 'text/plain' } as const;

type StorageClient = Parameters<typeof uploadToBucket>[0];

/** md/txt extension of a skill file name, or null when unsupported. */
export function skillFileExtension(fileName: string): 'md' | 'txt' | null {
  const match = /\.(md|txt)$/i.exec(fileName);
  return match ? (match[1].toLowerCase() as 'md' | 'txt') : null;
}

/** The non-empty `skillFile` form field, if any. */
export function getSkillFile(formData: FormData): File | null {
  const value = formData.get('skillFile');
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * Uploads a skill document: OpenAI File Storage first (source of truth), then
 * a recovery copy in the catalog-assets bucket. If the Supabase copy fails,
 * the just-uploaded OpenAI file is best-effort deleted so no orphan id persists.
 */
export async function uploadSkillAssets(
  openai: Pick<OpenAI, 'files'>,
  supabase: StorageClient,
  userId: string,
  file: File,
): Promise<{ openaiFileId: string; skillPath: string }> {
  const ext = skillFileExtension(file.name);
  if (!ext) throw new Error('Upload .md or .txt skill files only.');
  if (file.size > SKILL_FILE_MAX_BYTES) throw new Error('Skill files must be 1 MB or smaller.');

  const openaiFileId = await uploadSkillFile(openai, file);
  try {
    const skillPath = await uploadToBucket(supabase, {
      bucket: 'catalog-assets',
      path: `${userId}/personalization-skills/${crypto.randomUUID()}.${ext}`,
      body: await file.arrayBuffer(),
      contentType: file.type || SKILL_CONTENT_TYPE_BY_EXT[ext],
    });
    return { openaiFileId, skillPath };
  } catch (error) {
    await deleteReferenceFile(openai, openaiFileId);
    throw error;
  }
}

export interface SkillColumnState {
  skillOpenaiFileId: string | null;
  skillPath: string | null;
}

/**
 * Final skill columns for a save, plus which previous OpenAI file to
 * best-effort delete after the DB write. Upload wins over removeSkill;
 * with neither, the existing attachment is carried through unchanged.
 */
export function resolveSkillColumns(options: {
  uploaded: { openaiFileId: string; skillPath: string } | null;
  removeSkill: boolean;
  existing: SkillColumnState | null;
}): SkillColumnState & { previousOpenaiFileId: string | null } {
  const { uploaded, removeSkill, existing } = options;
  if (uploaded) {
    return {
      skillOpenaiFileId: uploaded.openaiFileId,
      skillPath: uploaded.skillPath,
      previousOpenaiFileId: existing?.skillOpenaiFileId ?? null,
    };
  }
  if (removeSkill) {
    return {
      skillOpenaiFileId: null,
      skillPath: null,
      previousOpenaiFileId: existing?.skillOpenaiFileId ?? null,
    };
  }
  return {
    skillOpenaiFileId: existing?.skillOpenaiFileId ?? null,
    skillPath: existing?.skillPath ?? null,
    previousOpenaiFileId: null,
  };
}

/**
 * Item-form skill semantics: a new upload replaces the attachment, the
 * removeSkill checkbox clears it, otherwise the hidden-input values already
 * on `item` are kept. Mutates `item` and returns the previous OpenAI file id
 * to delete after the catalog row is written (legacy non `file-` ids are
 * never deleted — they were not uploaded through this flow).
 */
export async function applyItemSkillFields(
  openai: Pick<OpenAI, 'files'>,
  supabase: StorageClient,
  userId: string,
  formData: FormData,
  item: { skillId?: string; skillPath?: string },
): Promise<string | null> {
  const skillFile = getSkillFile(formData);
  const removeSkill = formData.get('removeSkill') === 'on';
  const previous = isOpenAiSkillFileId(item.skillId) ? item.skillId : null;

  if (skillFile) {
    const uploaded = await uploadSkillAssets(openai, supabase, userId, skillFile);
    item.skillId = uploaded.openaiFileId;
    item.skillPath = uploaded.skillPath;
    return previous;
  }
  if (removeSkill) {
    item.skillId = undefined;
    item.skillPath = undefined;
    return previous;
  }
  return null;
}
```

Note: `applyItemSkillFields` references `item.skillPath`, which Task 8 adds to `itemSchema`. The `{ skillId?: string; skillPath?: string }` structural type keeps this file compiling on its own — no dependency on Task 8's schema change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/skill-files.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/skill-files.ts tests/lib/skill-files.test.ts
git commit -m "feat(admin): shared skill-file upload, resolution, and item-form helpers"
```

---

### Task 7: Boilerplate admin — action, form UI, i18n

**Files:**
- Modify: `app/admin/personalization/boilerplates/actions.ts`
- Modify: `app/admin/personalization/boilerplates/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`, `messages/am.json`

**Interfaces:**
- Consumes: `getSkillFile`, `uploadSkillAssets`, `resolveSkillColumns` (Task 6); `skill_openai_file_id`/`skill_path` on `PersonalizationBoilerplate` (Task 5).
- Produces: `saveBoilerplateAction` persists/clears `skill_openai_file_id` + `skill_path`; `removeBoilerplateAction` also deletes the skill's OpenAI file. Form fields: `skillFile` (file), `removeSkill` (checkbox).

- [ ] **Step 1: Rework `saveBoilerplateAction`**

Replace the body of `saveBoilerplateAction` in `app/admin/personalization/boilerplates/actions.ts`. Add `removeSkill: z.boolean()` to `boilerplateSchema` (after `priceAdjustmentPercent`), add to the imports:

```ts
import { getSkillFile, resolveSkillColumns, uploadSkillAssets } from '@/lib/skill-files';
```

New action body (the existing per-branch `existing` fetches are consolidated into one upfront fetch that now also reads the skill columns):

```ts
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
    priceAdjustmentPercent: formData.get('priceAdjustmentPercent') || undefined,
    removeSkill: formData.get('removeSkill') === 'on',
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid boilerplate.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const values = parsed.data;
  const newImageFile = getFile(formData, 'imageFile');
  const newSkillFile = getSkillFile(formData);

  interface ExistingBoilerplateFiles {
    openai_file_id: string;
    image_path: string;
    skill_openai_file_id: string | null;
    skill_path: string | null;
  }
  let existing: ExistingBoilerplateFiles | null = null;
  if (values.id) {
    const { data } = await supabase
      .from('personalization_boilerplates')
      .select('openai_file_id, image_path, skill_openai_file_id, skill_path')
      .eq('id', values.id)
      .maybeSingle<ExistingBoilerplateFiles>();
    if (!data) throw new Error('Boilerplate not found.');
    existing = data;
  }

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
    previousOpenaiFileId = existing?.openai_file_id ?? null;
  } else if (!existing) {
    throw new Error('Upload a boilerplate image.');
  } else {
    openaiFileId = existing.openai_file_id;
    imagePath = existing.image_path;
  }

  const uploadedSkill = newSkillFile
    ? await uploadSkillAssets(getOpenAiClient(), supabase, user.id, newSkillFile)
    : null;
  const skill = resolveSkillColumns({
    uploaded: uploadedSkill,
    removeSkill: values.removeSkill,
    existing: existing
      ? { skillOpenaiFileId: existing.skill_openai_file_id, skillPath: existing.skill_path }
      : null,
  });

  const payload = {
    name: values.name,
    image_path: imagePath,
    openai_file_id: openaiFileId,
    manufacturing_process: values.manufacturingProcess,
    generation_instruction: values.generationInstruction,
    sort_order: values.sortOrder,
    generate_hidden_svg: values.generateHiddenSvg,
    is_active: values.isActive,
    price_adjustment_percent: values.priceAdjustmentPercent ?? null,
    skill_openai_file_id: skill.skillOpenaiFileId,
    skill_path: skill.skillPath,
  };

  const query = values.id
    ? supabase.from('personalization_boilerplates').update(payload).eq('id', values.id)
    : supabase.from('personalization_boilerplates').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);

  if (previousOpenaiFileId) await deleteReferenceFile(getOpenAiClient(), previousOpenaiFileId);
  if (skill.previousOpenaiFileId)
    await deleteReferenceFile(getOpenAiClient(), skill.previousOpenaiFileId);

  revalidatePath('/admin/personalization/boilerplates');
  revalidatePath('/admin/items');
}
```

Behavior note (intentional): a save that references a missing boilerplate id now fails fast with `'Boilerplate not found.'` even when a new image is attached — previously that path silently updated zero rows.

- [ ] **Step 2: Extend `removeBoilerplateAction`**

In the same file, widen the existing-row select and delete the skill file too:

```ts
  const { data: existing } = await supabase
    .from('personalization_boilerplates')
    .select('openai_file_id, skill_openai_file_id')
    .eq('id', parsed.data.id)
    .maybeSingle<{ openai_file_id: string; skill_openai_file_id: string | null }>();
```

and after the existing image-file deletion line:

```ts
  if (existing?.skill_openai_file_id)
    await deleteReferenceFile(getOpenAiClient(), existing.skill_openai_file_id);
```

- [ ] **Step 3: Add the skill field to the boilerplate form**

In `app/admin/personalization/boilerplates/page.tsx`, inside `BoilerplateForm`, after the price-adjustment `<div>` (before the `isActive`/`generateHiddenSvg` checkbox row), add:

```tsx
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`boilerplate-skill-${boilerplate?.id ?? 'new'}`}>
          {t('personalization.skillFile')}
        </Label>
        <Input
          id={`boilerplate-skill-${boilerplate?.id ?? 'new'}`}
          name="skillFile"
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
        />
        <p className="text-xs text-muted-foreground">{t('personalization.skillFileHelp')}</p>
        {boilerplate?.skill_openai_file_id ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('personalization.skillAttached')}: <code>{boilerplate.skill_openai_file_id}</code>
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeSkill" /> {t('personalization.removeSkill')}
            </label>
          </div>
        ) : null}
      </div>
```

- [ ] **Step 4: Add i18n keys**

In each of `messages/en.json`, `messages/ru.json`, `messages/am.json`, add to the `"personalization"` section after `"priceAdjustmentHelp"`:

`messages/en.json`:

```json
    "skillFile": "Skill file (optional)",
    "skillFileHelp": "Upload a .md or .txt document up to 1 MB. Its content is injected into AI generation instructions.",
    "skillAttached": "Attached skill",
    "removeSkill": "Remove skill"
```

`messages/ru.json`:

```json
    "skillFile": "Файл навыка (необязательно)",
    "skillFileHelp": "Загрузите файл .md или .txt до 1 МБ. Его содержимое добавляется к инструкциям ИИ-генерации.",
    "skillAttached": "Прикреплённый навык",
    "removeSkill": "Удалить навык"
```

`messages/am.json`:

```json
    "skillFile": "Հմտության ֆայլ (ոչ պարտադիր)",
    "skillFileHelp": "Վերբեռնեք .md կամ .txt ֆայլ՝ մինչև 1 ՄԲ։ Դրա բովանդակությունը ավելացվում է ԱԲ գեներացիայի հրահանգներին։",
    "skillAttached": "Կցված հմտություն",
    "removeSkill": "Հեռացնել հմտությունը"
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run smoke:i18n`
Expected: PASS (key parity across locales).

- [ ] **Step 6: Commit**

```bash
git add app/admin/personalization/boilerplates/actions.ts app/admin/personalization/boilerplates/page.tsx messages/en.json messages/ru.json messages/am.json
git commit -m "feat(admin): skill file upload on personalization boilerplates"
```

---

### Task 8: Item admin — parsing, catalog row, actions, form UI

**Files:**
- Modify: `app/admin/items/item-form-parsing.ts`
- Modify: `lib/catalog-items/core.ts`
- Modify: `app/admin/items/actions.ts`
- Modify: `app/admin/items/item-form/personalization-fields.tsx`
- Modify: `app/admin/items/item-form/types.ts`
- Modify: `app/admin/items/[id]/page.tsx`
- Test: `tests/lib/item-form-parsing.test.ts`

**Interfaces:**
- Consumes: `applyItemSkillFields` (Task 6), `deleteReferenceFile` (existing), `getOpenAiClient` (existing), `catalog_items.skill_path` type (Task 1).
- Produces: `itemSchema` gains `skillPath: z.string().trim().optional()`; `parseItemForm` reads the `skillPath` hidden field; `toCatalogItemRow` writes `skill_path`. Task 9 relies on `skillPath` existing on `itemSchema`.

- [ ] **Step 1: Write the failing parsing test**

Append to `tests/lib/item-form-parsing.test.ts` (reuse the file's existing helper for building a valid item FormData if one exists; otherwise build on a copy of the FormData used by its existing `parseItemForm` tests):

```ts
describe('parseItemForm skill fields', () => {
  it('reads the skillPath hidden field alongside skillId', () => {
    const formData = buildValidItemFormData(); // the file's existing valid-form helper
    formData.set('skillId', 'file-abc123');
    formData.set('skillPath', 'user-1/personalization-skills/abc.md');
    const parsed = parseItemForm(formData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.skillId).toBe('file-abc123');
      expect(parsed.data.skillPath).toBe('user-1/personalization-skills/abc.md');
    }
  });

  it('leaves skillPath undefined when the field is absent or empty', () => {
    const formData = buildValidItemFormData();
    formData.set('skillPath', '');
    const parsed = parseItemForm(formData);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.skillPath).toBeUndefined();
  });
});
```

If `tests/lib/item-form-parsing.test.ts` has no valid-form helper, add one local to the new describe block that sets the minimum fields `itemSchema` requires: `title`, `slug` (e.g. `night-light`), `categoryId` (any UUID), `subcategoryId: ''`, `itemType: 'standard'`, `priceCents: '1000'`, `status: 'draft'`, and no tags/boilerplates.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/item-form-parsing.test.ts`
Expected: FAIL — `skillPath` is not in the schema, so `parsed.data.skillPath` is undefined in the first test (or a type error at build).

- [ ] **Step 3: Extend schema, parsing, and the catalog row**

In `app/admin/items/item-form-parsing.ts`:

- In `itemSchema`, after `skillId: z.string().trim().optional(),` add:

```ts
  skillPath: z.string().trim().optional(),
```

- In `parseItemForm`, after `skillId: formData.get('skillId') || undefined,` add:

```ts
    skillPath: formData.get('skillPath') || undefined,
```

In `lib/catalog-items/core.ts`, in `toCatalogItemRow`, after `skill_id: item.skillId ?? null,` add:

```ts
    skill_path: item.skillPath ?? null,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/item-form-parsing.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire skill upload into the item actions**

In `app/admin/items/actions.ts`, add imports:

```ts
import { deleteReferenceFile } from '@/lib/openai-files';
import { getOpenAiClient } from '@/lib/openai-client';
import { applyItemSkillFields } from '@/lib/skill-files';
```

In `createCatalogItemAction`, after the `uploadCatalogFormAssets` try/catch and before `createCatalogItemCore`, add:

```ts
  let previousSkillFileId: string | null = null;
  try {
    previousSkillFileId = await applyItemSkillFields(
      getOpenAiClient(),
      supabase,
      user.id,
      formData,
      item,
    );
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload skill file.');
  }
```

and after the successful `createCatalogItemCore` call (before `revalidatePath('/')`):

```ts
  if (previousSkillFileId) await deleteReferenceFile(getOpenAiClient(), previousSkillFileId);
```

Apply the identical two blocks to `updateCatalogItemAction`: the `applyItemSkillFields` block after its `uploadCatalogFormAssets` try/catch, and the `deleteReferenceFile` line after the successful `updateCatalogItemCore` call (before `revalidatePath('/')`).

- [ ] **Step 6: Replace the Skill ID text input with the upload field**

In `app/admin/items/item-form/types.ts`, add `'skill_path'` to the `ItemFormValue` pick list after `'skill_id'`.

In `app/admin/items/[id]/page.tsx`, add `skill_path` to the catalog item select string right after `skill_id`.

In `app/admin/items/item-form/personalization-fields.tsx`:

- Change the prop type to `item?: Pick<ItemFormValue, 'system_prompt' | 'skill_id' | 'skill_path' | 'tags'>;`
- Replace the entire Skill ID `<div className="space-y-2">` block (the `Label htmlFor="skillId"` + `Input id="skillId"` block) with:

```tsx
      <div className="space-y-2">
        <Label htmlFor="skillFile">Skill file</Label>
        <input type="hidden" name="skillId" defaultValue={item?.skill_id ?? ''} />
        <input type="hidden" name="skillPath" defaultValue={item?.skill_path ?? ''} />
        <Input
          id="skillFile"
          name="skillFile"
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
        />
        <p className="text-xs text-muted-foreground">
          Optional .md or .txt document (max 1 MB) injected into AI generation instructions.
        </p>
        {item?.skill_id ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Attached skill: <code>{item.skill_id.slice(0, 24)}…</code>
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeSkill" /> Remove skill
            </label>
          </div>
        ) : null}
      </div>
```

(Plain English literals match the rest of this admin-only form; the hint text below the boilerplate list still says "Skill ID" — update that sentence to:)

```tsx
      <p className="text-xs text-muted-foreground">
        At least one of System prompt, a skill file, or a selected boilerplate is required when
        Customizable is checked.
      </p>
```

Also update the matching server-side error string in `lib/catalog-items/core.ts` (`validateItemAndParseSizes`) to:

```ts
      'Customizable items need a System Prompt, a skill file, or at least one boilerplate.',
```

Check whether any test asserts the old error string (`npx vitest run tests/lib/item-form-parsing.test.ts tests/lib/catalog-items/core.test.ts` and grep for `Skill ID`) and update expectations to the new copy.

- [ ] **Step 7: Verify**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npx vitest run tests/lib/item-form-parsing.test.ts tests/lib/catalog-items/core.test.ts tests/lib/skill-files.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/admin/items/item-form-parsing.ts lib/catalog-items/core.ts app/admin/items/actions.ts app/admin/items/item-form/personalization-fields.tsx app/admin/items/item-form/types.ts "app/admin/items/[id]/page.tsx" tests/lib/item-form-parsing.test.ts tests/lib/catalog-items/core.test.ts
git commit -m "feat(admin): skill file upload on catalog items"
```

---

### Task 9: MCP tools — preserve `skill_path` through updates

**Files:**
- Modify: `lib/mcp/tools/get-catalog-item.ts`
- Modify: `lib/mcp/tools/update-catalog-item.ts`
- Test: `tests/lib/mcp/tools/update-catalog-item.test.ts`, `tests/lib/mcp/tools/get-catalog-item.test.ts` (adjust expectations only if they assert exact column lists/row shapes)

**Why:** `toCatalogItemRow` now writes `skill_path` from `item.skillPath` (Task 8). The MCP update tool rebuilds a full `itemSchema` object from the existing row; without carrying `skill_path` through, every MCP update would null out an admin-uploaded item skill copy. The tools' external contract (plain-string `skillId` in, per spec) is unchanged.

- [ ] **Step 1: Expose `skill_path` on the MCP item summary**

In `lib/mcp/tools/get-catalog-item.ts`:

- Append `, skill_path` to `CATALOG_ITEM_COLUMNS`.
- Add to `CatalogItemSummary` after `skill_id: string | null;`:

```ts
  skill_path: string | null;
```

- [ ] **Step 2: Preserve it in the update tool**

In `lib/mcp/tools/update-catalog-item.ts`, in the `item: z.infer<typeof itemSchema>` literal, after `skillId: existing.skill_id ?? undefined,` add:

```ts
    // Not settable via MCP — preserved so toCatalogItemRow doesn't null out
    // an admin-uploaded skill copy on unrelated updates.
    skillPath: existing.skill_path ?? undefined,
```

- [ ] **Step 3: Run the MCP tool tests and fix expectations**

Run: `npx vitest run tests/lib/mcp/tools/update-catalog-item.test.ts tests/lib/mcp/tools/get-catalog-item.test.ts tests/lib/mcp/tools/create-catalog-item.test.ts`
Expected: PASS. If a test stubs the existing-item fetch or asserts the updated row / selected columns, extend the stub with `skill_path: null` and the expectation with `skill_path` accordingly — assert that an existing `skill_path` value survives an update that doesn't touch skills, if the test structure makes that natural.

- [ ] **Step 4: Commit**

```bash
git add lib/mcp/tools/get-catalog-item.ts lib/mcp/tools/update-catalog-item.ts tests/lib/mcp/tools
git commit -m "fix(mcp): preserve catalog item skill_path through MCP updates"
```

---

### Task 10: Full verification + knowledge graph refresh

**Files:**
- Modify: `graphify-out/` (regenerated)

- [ ] **Step 1: Run the full suite**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run lint`
Expected: exit 0 (fix any new lint findings in files this plan touched).

Run: `npm test`
Expected: all tests PASS.

Run: `npm run smoke:i18n`
Expected: PASS.

- [ ] **Step 2: Refresh the knowledge graph**

Run: `graphify update .`
Expected: graph regenerated without errors (AST-only, no API cost).

- [ ] **Step 3: Commit**

```bash
git add graphify-out
git commit -m "chore(graph): refresh knowledge graph after skill reference feature"
```

- [ ] **Step 4: Deployment note (not part of this branch's code)**

The migration `20260725120000_skill_reference_columns.sql` must reach prod Supabase when this merges — the repo has a recurring gap where merged migrations don't get deployed (see `prod-migration-deploy-gap` memory). Surface this at merge time.
