# Admin Item Form AI Autogenerate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-field "Autogenerate" buttons and a "Fill all" button to the admin item create/edit form, so an admin can write one English Description and have OpenAI draft the title, manufacturing notes, characteristics, personalization/engraving prompts, and localized SEO metadata — replacing the old two-step SEO AI draft flow entirely.

**Architecture:** Two new server-side files (`lib/item-ai.ts` for prompt/schema building and the raw OpenAI call, `app/admin/items/ai-fill-actions.ts` for the validated, permission-gated server action) plus one new client file (`app/admin/items/item-form/ai-context.tsx`) providing a context + `AutogenerateButton`/`FillAllButton` that write generated text directly onto the form's existing uncontrolled DOM inputs via `form.elements.namedItem(name)`. Five existing field components get one-line button insertions. The old SEO AI draft flow (`lib/seo-ai.ts`, `app/admin/items/seo-actions.ts`, `app/admin/seo-metadata-manager.tsx`) is deleted.

**Tech Stack:** Next.js 16 App Router, React 19, raw `openai` npm package (Responses API, Structured Outputs), Zod, Vitest, lucide-react, existing Tailwind/shadcn UI primitives.

## Global Constraints

- Use the raw `openai` npm package (`lib/openai-client.ts`'s `getOpenAiClient()`), not the Vercel AI SDK — per the approved design spec.
- Reuse `getServerEnv().OPENAI_RESPONSES_MODEL ?? 'gpt-5-mini'` and the Responses API (`client.responses.create`), matching `lib/openai-image.ts`.
- No new npm dependencies — `openai`, `zod`, `lucide-react`, `vitest` are already installed.
- Generated text writes immediately into the form's DOM inputs; nothing is persisted to the database until the admin submits the item form's existing Save/Create action.
- `ru`/`am` SEO fields must be generated in Russian/Armenian respectively, not left in English.
- All generation requests are gated by `requireAdminPermission('catalog_manage')`.
- The old SEO AI draft flow (`lib/seo-ai.ts`, `app/admin/items/seo-actions.ts`, `app/admin/seo-metadata-manager.tsx`) must be fully deleted, not kept alongside the new flow.
- Spec: `docs/superpowers/specs/2026-07-14-admin-item-ai-autogenerate-design.md`.

---

### Task 1: `lib/item-ai.ts` — field registry, prompt builder, OpenAI call

**Files:**
- Create: `lib/item-ai.ts`
- Test: `tests/lib/item-ai.test.ts`

**Interfaces:**
- Consumes: `getServerEnv()` from `lib/env.ts` (existing, returns `OPENAI_RESPONSES_MODEL?: string`), `APP_LOCALES`/`AppLocale` from `lib/i18n-config.ts` (existing, `['en', 'ru', 'am']`), `OpenAI` type from the `openai` package.
- Produces (used by Task 2):
  - `ITEM_AI_FIELD_KEYS: [string, ...string[]]` — all 20 valid field keys (`title`, `manufacturingNotes`, `characteristics`, `systemPrompt`, `laserSolidPrompt`, and `seoTitle_en`/`seoTitle_ru`/`seoTitle_am`/`seoDescription_en`/.../`ogDescription_am`).
  - `interface ItemAiContext { title?: string; categoryName?: string; itemType?: string }`
  - `interface GenerateItemFieldsInput { sourceDescription: string; fields: string[]; context: ItemAiContext }`
  - `function buildItemFieldsPrompt(input: GenerateItemFieldsInput): string`
  - `function extractResponseText(response: { output: Array<{ type: string; content?: Array<{ type: string; text?: string | null }> }> }): string`
  - `async function generateItemFields(client: OpenAI, input: GenerateItemFieldsInput): Promise<Record<string, string>>`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/item-ai.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  buildItemFieldsPrompt,
  extractResponseText,
  generateItemFields,
  ITEM_AI_FIELD_KEYS,
} from '@/lib/item-ai';

describe('ITEM_AI_FIELD_KEYS', () => {
  it('contains the 5 core fields and 15 localized SEO fields', () => {
    expect(ITEM_AI_FIELD_KEYS).toHaveLength(20);
    expect(ITEM_AI_FIELD_KEYS).toEqual(
      expect.arrayContaining([
        'title',
        'manufacturingNotes',
        'characteristics',
        'systemPrompt',
        'laserSolidPrompt',
        'seoTitle_en',
        'seoTitle_ru',
        'seoTitle_am',
        'ogDescription_am',
      ]),
    );
  });
});

describe('buildItemFieldsPrompt', () => {
  it('includes the source description and instructions only for requested fields', () => {
    const prompt = buildItemFieldsPrompt({
      sourceDescription: 'A laser-cut oak jewelry box with a hinged lid.',
      fields: ['title', 'characteristics'],
      context: {},
    });
    expect(prompt).toContain('A laser-cut oak jewelry box with a hinged lid.');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"characteristics"');
    expect(prompt).not.toContain('"manufacturingNotes"');
  });

  it('includes context lines when provided', () => {
    const prompt = buildItemFieldsPrompt({
      sourceDescription: 'desc',
      fields: ['title'],
      context: { title: 'Old Title', categoryName: 'Decorations', itemType: 'decoration' },
    });
    expect(prompt).toContain('Current title: Old Title');
    expect(prompt).toContain('Category: Decorations');
    expect(prompt).toContain('Item type: decoration');
  });

  it('instructs Russian output for ru SEO fields and Armenian for am SEO fields', () => {
    const prompt = buildItemFieldsPrompt({
      sourceDescription: 'desc',
      fields: ['seoTitle_ru', 'seoTitle_am', 'seoTitle_en'],
      context: {},
    });
    expect(prompt).toContain('An SEO title in Russian');
    expect(prompt).toContain('An SEO title in Armenian');
    expect(prompt).toContain('An SEO title in English');
  });

  it('throws for an unknown field key', () => {
    expect(() =>
      buildItemFieldsPrompt({ sourceDescription: 'desc', fields: ['notARealField'], context: {} }),
    ).toThrow('Unknown item AI field: notARealField');
  });
});

describe('extractResponseText', () => {
  it('extracts text from a message output_text content part', () => {
    const text = extractResponseText({
      output: [
        { type: 'reasoning' },
        { type: 'message', content: [{ type: 'output_text', text: '{"title":"Oak Box"}' }] },
      ],
    });
    expect(text).toBe('{"title":"Oak Box"}');
  });

  it('throws when no message output_text part is present', () => {
    expect(() => extractResponseText({ output: [{ type: 'reasoning' }] })).toThrow(
      'OpenAI response did not include any output text.',
    );
  });
});

describe('generateItemFields', () => {
  it('sends a strict json_schema request scoped to exactly the requested fields and returns the parsed values', async () => {
    const create = vi.fn(async () => ({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                title: 'Oak Jewelry Box',
                characteristics: 'Solid oak, brass hinges.',
              }),
            },
          ],
        },
      ],
    }));
    const client = { responses: { create } } as unknown as Parameters<typeof generateItemFields>[0];

    const values = await generateItemFields(client, {
      sourceDescription: 'A laser-cut oak jewelry box.',
      fields: ['title', 'characteristics'],
      context: {},
    });

    expect(values).toEqual({ title: 'Oak Jewelry Box', characteristics: 'Solid oak, brass hinges.' });
    // biome-ignore lint/suspicious/noExplicitAny: test double for the Responses API request body
    const requestBody = (create.mock.calls[0] as any[])[0];
    expect(requestBody.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(requestBody.text.format.schema).toEqual({
      type: 'object',
      properties: { title: { type: 'string' }, characteristics: { type: 'string' } },
      required: ['title', 'characteristics'],
      additionalProperties: false,
    });
  });

  it('throws when the model omits a requested field', async () => {
    const create = vi.fn(async () => ({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify({ title: 'Only title' }) }],
        },
      ],
    }));
    const client = { responses: { create } } as unknown as Parameters<typeof generateItemFields>[0];

    await expect(
      generateItemFields(client, {
        sourceDescription: 'desc',
        fields: ['title', 'characteristics'],
        context: {},
      }),
    ).rejects.toThrow('OpenAI response missing field: characteristics');
  });

  it('returns an empty object without calling OpenAI when no fields are requested', async () => {
    const create = vi.fn();
    const client = { responses: { create } } as unknown as Parameters<typeof generateItemFields>[0];

    const values = await generateItemFields(client, {
      sourceDescription: 'desc',
      fields: [],
      context: {},
    });

    expect(values).toEqual({});
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/item-ai.test.ts`
Expected: FAIL with "Cannot find module '@/lib/item-ai'" (or similar resolution error).

- [ ] **Step 3: Write the implementation**

Create `lib/item-ai.ts`:

```ts
import 'server-only';

import type OpenAI from 'openai';
import { getServerEnv } from '@/lib/env';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n-config';

const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  ru: 'Russian',
  am: 'Armenian',
};

const CORE_FIELD_INSTRUCTIONS: Record<string, string> = {
  title: 'A short, compelling marketing product title, under 80 characters. No surrounding quotes.',
  manufacturingNotes:
    'Production-facing manufacturing notes: materials, assembly steps, finish. Plain sentences, no markdown.',
  characteristics:
    'Admin-only technical characteristics: materials, dimensions, construction details, and open unknowns that need review before publishing. Plain sentences, no markdown.',
  systemPrompt:
    'Directive instructions (not marketing copy) for an AI image-personalization step that will use this product as context.',
  laserSolidPrompt:
    'Directive instructions for generating the solid-scratched glass engraving variant of this product.',
};

const SEO_SUB_FIELDS = ['seoTitle', 'seoDescription', 'seoKeywords', 'ogTitle', 'ogDescription'] as const;

const SEO_FIELD_INSTRUCTIONS: Record<(typeof SEO_SUB_FIELDS)[number], (language: string) => string> = {
  seoTitle: (language) => `An SEO title in ${language}, 70 characters or fewer.`,
  seoDescription: (language) => `A meta description in ${language}, 170 characters or fewer.`,
  seoKeywords: (language) => `A comma-separated list of up to 10 SEO keywords in ${language}.`,
  ogTitle: (language) => `An Open Graph title in ${language}, 90 characters or fewer.`,
  ogDescription: (language) => `An Open Graph description in ${language}, 220 characters or fewer.`,
};

function buildFieldInstructions(): Record<string, string> {
  const instructions: Record<string, string> = { ...CORE_FIELD_INSTRUCTIONS };
  for (const locale of APP_LOCALES) {
    for (const sub of SEO_SUB_FIELDS) {
      instructions[`${sub}_${locale}`] = SEO_FIELD_INSTRUCTIONS[sub](LOCALE_NAMES[locale]);
    }
  }
  return instructions;
}

export const ITEM_AI_FIELD_INSTRUCTIONS = buildFieldInstructions();

export const ITEM_AI_FIELD_KEYS = Object.keys(ITEM_AI_FIELD_INSTRUCTIONS) as [string, ...string[]];

export interface ItemAiContext {
  title?: string;
  categoryName?: string;
  itemType?: string;
}

export interface GenerateItemFieldsInput {
  sourceDescription: string;
  fields: string[];
  context: ItemAiContext;
}

export function buildItemFieldsPrompt(input: GenerateItemFieldsInput): string {
  const contextLines = [
    input.context.title ? `Current title: ${input.context.title}` : null,
    input.context.categoryName ? `Category: ${input.context.categoryName}` : null,
    input.context.itemType ? `Item type: ${input.context.itemType}` : null,
  ].filter((line): line is string => Boolean(line));

  const fieldLines = input.fields.map((field) => {
    const instruction = ITEM_AI_FIELD_INSTRUCTIONS[field];
    if (!instruction) throw new Error(`Unknown item AI field: ${field}`);
    return `- "${field}": ${instruction}`;
  });

  return [
    'You are drafting catalog fields for a laser-cut/CNC marketplace item, based on an English product description written by an admin.',
    `English description: ${input.sourceDescription}`,
    ...contextLines,
    'Generate exactly these fields, each as a single string value:',
    ...fieldLines,
    'Do not invent facts not implied by the description. Avoid unsafe, medical, or child-safety claims.',
  ].join('\n');
}

export function extractResponseText(response: {
  output: Array<{ type: string; content?: Array<{ type: string; text?: string | null }> }>;
}): string {
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  throw new Error('OpenAI response did not include any output text.');
}

function buildResponseSchema(fields: string[]) {
  const properties: Record<string, { type: 'string' }> = {};
  for (const field of fields) properties[field] = { type: 'string' };
  return {
    type: 'object' as const,
    properties,
    required: fields,
    additionalProperties: false,
  };
}

function getResponsesModel() {
  return getServerEnv().OPENAI_RESPONSES_MODEL ?? 'gpt-5-mini';
}

export async function generateItemFields(
  client: OpenAI,
  input: GenerateItemFieldsInput,
): Promise<Record<string, string>> {
  if (input.fields.length === 0) return {};

  const prompt = buildItemFieldsPrompt(input);

  const response = await client.responses.create({
    model: getResponsesModel(),
    store: false,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    text: {
      format: {
        type: 'json_schema',
        name: 'item_fields',
        strict: true,
        schema: buildResponseSchema(input.fields),
      },
    },
  });

  const parsed = JSON.parse(extractResponseText(response)) as Record<string, string>;
  const values: Record<string, string> = {};
  for (const field of input.fields) {
    const value = parsed[field];
    if (typeof value !== 'string') throw new Error(`OpenAI response missing field: ${field}`);
    values[field] = value;
  }
  return values;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/item-ai.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/item-ai.ts tests/lib/item-ai.test.ts
git commit -m "feat(admin): add item AI field prompt/schema builder and generator"
```

---

### Task 2: `app/admin/items/ai-fill-actions.ts` — validated, permission-gated server action

**Files:**
- Create: `app/admin/items/ai-fill-actions.ts`
- Test: `tests/app/admin/items/ai-fill-actions.test.ts`

**Interfaces:**
- Consumes: Task 1's `generateItemFields`, `ITEM_AI_FIELD_KEYS` from `@/lib/item-ai`; `requireAdminPermission` from `@/lib/admin` (existing, throws/redirects on failure); `getOpenAiClient` from `@/lib/openai-client` (existing).
- Produces (used by Task 3):
  - `type GenerateItemFieldValuesInput = { sourceDescription: string; fields: string[]; context: { title?: string; categoryName?: string; itemType?: string } }`
  - `type GenerateItemFieldValuesResult = { values: Record<string, string> } | { error: string }`
  - `async function generateItemFieldValuesAction(input: GenerateItemFieldValuesInput): Promise<GenerateItemFieldValuesResult>`

- [ ] **Step 1: Write the failing test**

Create `tests/app/admin/items/ai-fill-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({
  requireAdminPermission: vi.fn(),
}));

vi.mock('@/lib/openai-client', () => ({
  getOpenAiClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/item-ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/item-ai')>('@/lib/item-ai');
  return { ...actual, generateItemFields: vi.fn() };
});

import { requireAdminPermission } from '@/lib/admin';
import { generateItemFields } from '@/lib/item-ai';
import { generateItemFieldValuesAction } from '@/app/admin/items/ai-fill-actions';

describe('generateItemFieldValuesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown field key without checking permissions', async () => {
    const result = await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['notARealField'],
      context: {},
    });
    expect('error' in result).toBe(true);
    expect(requireAdminPermission).not.toHaveBeenCalled();
  });

  it('rejects an empty source description', async () => {
    const result = await generateItemFieldValuesAction({
      sourceDescription: '   ',
      fields: ['title'],
      context: {},
    });
    expect(result).toEqual({ error: 'Enter a description first.' });
  });

  it('requires catalog_manage permission before generating', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({} as never);
    vi.mocked(generateItemFields).mockResolvedValue({ title: 'Generated Title' });

    await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['title'],
      context: {},
    });

    expect(requireAdminPermission).toHaveBeenCalledWith('catalog_manage');
  });

  it('returns generated values on success', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({} as never);
    vi.mocked(generateItemFields).mockResolvedValue({ title: 'Generated Title' });

    const result = await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['title'],
      context: {},
    });

    expect(result).toEqual({ values: { title: 'Generated Title' } });
  });

  it('returns an error message when generation fails', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({} as never);
    vi.mocked(generateItemFields).mockRejectedValue(new Error('OpenAI is down'));

    const result = await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['title'],
      context: {},
    });

    expect(result).toEqual({ error: 'OpenAI is down' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/app/admin/items/ai-fill-actions.test.ts`
Expected: FAIL with "Cannot find module '@/app/admin/items/ai-fill-actions'".

- [ ] **Step 3: Write the implementation**

Create `app/admin/items/ai-fill-actions.ts`:

```ts
'use server';

import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { generateItemFields, ITEM_AI_FIELD_KEYS } from '@/lib/item-ai';
import { getOpenAiClient } from '@/lib/openai-client';

const generateItemFieldValuesSchema = z.object({
  sourceDescription: z.string().trim().min(1, 'Enter a description first.'),
  fields: z.array(z.enum(ITEM_AI_FIELD_KEYS)).min(1, 'Select at least one field to generate.'),
  context: z.object({
    title: z.string().trim().optional(),
    categoryName: z.string().trim().optional(),
    itemType: z.string().trim().optional(),
  }),
});

export type GenerateItemFieldValuesInput = z.input<typeof generateItemFieldValuesSchema>;
export type GenerateItemFieldValuesResult = { values: Record<string, string> } | { error: string };

export async function generateItemFieldValuesAction(
  input: GenerateItemFieldValuesInput,
): Promise<GenerateItemFieldValuesResult> {
  const parsed = generateItemFieldValuesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid generation request.' };
  }

  // Left outside the try/catch: requireAdminPermission redirects (throws a
  // Next.js-special error) on failure, and that must propagate, not become
  // a generic { error } shown inline near a button.
  await requireAdminPermission('catalog_manage');

  try {
    const client = getOpenAiClient();
    const values = await generateItemFields(client, parsed.data);
    return { values };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'AI generation failed.' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/app/admin/items/ai-fill-actions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/admin/items/ai-fill-actions.ts tests/app/admin/items/ai-fill-actions.test.ts
git commit -m "feat(admin): add generateItemFieldValuesAction server action"
```

---

### Task 3: `app/admin/items/item-form/ai-context.tsx` — client provider and buttons

**Files:**
- Create: `app/admin/items/item-form/ai-context.tsx`

**Interfaces:**
- Consumes: Task 2's `generateItemFieldValuesAction`; Task 1's `ITEM_AI_FIELD_KEYS`; `CategoryOption` type from `./types` (existing); `Button` from `@/components/ui/button` (existing); `Loader2`/`Sparkles` from `lucide-react` (existing dependency, already used with this exact pairing in `app/admin/generated/[id]/manufacturing-file-form.tsx`).
- Produces (used by Task 4):
  - `ItemFormAiProvider({ formRef: RefObject<HTMLFormElement | null>; categories: CategoryOption[]; initialDescription: string; children }): JSX.Element`
  - `useItemFormAi(): { generateField(field: string): void; generateAll(): void; pendingFields: ReadonlySet<string>; isFillAllPending: boolean; fieldError: { field: string; message: string } | null; fillAllError: string | null; hasDescription: boolean; onDescriptionInput(value: string): void }`
  - `AutogenerateButton({ field: string }): JSX.Element`
  - `FillAllButton(): JSX.Element`

No automated test for this file — this repo has no component-testing infrastructure (no jsdom/`@testing-library` dependency; every existing `tests/**` file exercises pure `lib`/server logic only). It's verified in Task 4's manual QA pass, consistent with the design spec's testing section.

- [ ] **Step 1: Write the implementation**

Create `app/admin/items/item-form/ai-context.tsx`:

```tsx
'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { createContext, useCallback, useContext, useState, useTransition } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { generateItemFieldValuesAction } from '@/app/admin/items/ai-fill-actions';
import { ITEM_AI_FIELD_KEYS } from '@/lib/item-ai';
import type { CategoryOption } from './types';

interface FieldError {
  field: string;
  message: string;
}

interface ItemFormAiContextValue {
  generateField: (field: string) => void;
  generateAll: () => void;
  pendingFields: ReadonlySet<string>;
  isFillAllPending: boolean;
  fieldError: FieldError | null;
  fillAllError: string | null;
  hasDescription: boolean;
  onDescriptionInput: (value: string) => void;
}

const ItemFormAiContext = createContext<ItemFormAiContextValue | null>(null);

function readFieldValue(form: HTMLFormElement, name: string): string {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.value
    : '';
}

function writeFieldValue(form: HTMLFormElement, name: string, value: string) {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
  }
}

export function ItemFormAiProvider({
  formRef,
  categories,
  initialDescription,
  children,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  categories: CategoryOption[];
  initialDescription: string;
  children: React.ReactNode;
}) {
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const [isFillAllPending, setIsFillAllPending] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [fillAllError, setFillAllError] = useState<string | null>(null);
  const [hasDescription, setHasDescription] = useState(() => initialDescription.trim().length > 0);
  const [, startTransition] = useTransition();

  const onDescriptionInput = useCallback((value: string) => {
    setHasDescription(value.trim().length > 0);
  }, []);

  const run = useCallback(
    (fields: string[], isFillAll: boolean) => {
      const form = formRef.current;
      if (!form) return;

      const availableFields = fields.filter((field) => form.elements.namedItem(field) !== null);
      if (availableFields.length === 0) return;

      const sourceDescription = readFieldValue(form, 'description').trim();
      setFieldError(null);
      setFillAllError(null);

      if (!sourceDescription) {
        const message = 'Enter a description first.';
        if (isFillAll) setFillAllError(message);
        else setFieldError({ field: availableFields[0], message });
        return;
      }

      const categoryId = readFieldValue(form, 'categoryId');
      const categoryName = categories.find((category) => category.id === categoryId)?.name;

      setPendingFields(new Set(availableFields));
      setIsFillAllPending(isFillAll);

      startTransition(async () => {
        const result = await generateItemFieldValuesAction({
          sourceDescription,
          fields: availableFields,
          context: {
            title: readFieldValue(form, 'title').trim() || undefined,
            categoryName,
            itemType: readFieldValue(form, 'itemType').trim() || undefined,
          },
        });

        if ('error' in result) {
          if (isFillAll) setFillAllError(result.error);
          else setFieldError({ field: availableFields[0], message: result.error });
        } else {
          for (const [field, fieldValue] of Object.entries(result.values)) {
            writeFieldValue(form, field, fieldValue);
          }
        }
        setPendingFields(new Set());
        setIsFillAllPending(false);
      });
    },
    [formRef, categories],
  );

  const value: ItemFormAiContextValue = {
    generateField: (field) => run([field], false),
    generateAll: () => run([...ITEM_AI_FIELD_KEYS], true),
    pendingFields,
    isFillAllPending,
    fieldError,
    fillAllError,
    hasDescription,
    onDescriptionInput,
  };

  return <ItemFormAiContext.Provider value={value}>{children}</ItemFormAiContext.Provider>;
}

export function useItemFormAi() {
  const context = useContext(ItemFormAiContext);
  if (!context) {
    throw new Error('useItemFormAi must be used within an ItemFormAiProvider');
  }
  return context;
}

export function AutogenerateButton({ field }: { field: string }) {
  const { generateField, pendingFields, fieldError, hasDescription } = useItemFormAi();
  const isPending = pendingFields.has(field);
  const disabled = pendingFields.size > 0 || !hasDescription;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        title={hasDescription ? undefined : 'Enter a description first.'}
        onClick={() => generateField(field)}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-3.5" aria-hidden="true" />
        )}
        Autogenerate
      </Button>
      {fieldError?.field === field ? (
        <span role="alert" className="text-xs text-destructive">
          {fieldError.message}
        </span>
      ) : null}
    </span>
  );
}

export function FillAllButton() {
  const { generateAll, pendingFields, isFillAllPending, fillAllError, hasDescription } =
    useItemFormAi();
  const disabled = pendingFields.size > 0 || !hasDescription;

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        title={hasDescription ? undefined : 'Enter a description first.'}
        onClick={generateAll}
      >
        {isFillAllPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        Fill all fields from description
      </Button>
      {fillAllError ? (
        <span role="alert" className="text-xs text-destructive">
          {fillAllError}
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (this file isn't imported anywhere yet, but it must compile standalone).

- [ ] **Step 3: Commit**

```bash
git add app/admin/items/item-form/ai-context.tsx
git commit -m "feat(admin): add ItemFormAiProvider, AutogenerateButton, FillAllButton"
```

---

### Task 4: Wire Autogenerate/Fill-all buttons into the item form

**Files:**
- Modify: `app/admin/items/item-form/index.tsx`
- Modify: `app/admin/items/item-form/basics-fields.tsx`
- Modify: `app/admin/items/item-form/pricing-size-fields.tsx`
- Modify: `app/admin/items/item-form/personalization-fields.tsx`
- Modify: `app/admin/items/item-form/engraving-fields.tsx`
- Modify: `app/admin/items/item-form/seo-section.tsx`

**Interfaces:**
- Consumes: Task 3's `ItemFormAiProvider`, `AutogenerateButton`, `FillAllButton`, `useItemFormAi`.
- Produces: a working Autogenerate/Fill-all UI across the create/edit item form. No new exports.

- [ ] **Step 1: Wire the provider and Fill All button into `index.tsx`**

Replace the full contents of `app/admin/items/item-form/index.tsx`:

```tsx
'use client';

import { useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createCatalogItemAction, updateCatalogItemAction } from '@/app/admin/items/actions';
import { errorOf, idleState } from '@/lib/action-state';
import { FillAllButton, ItemFormAiProvider } from './ai-context';
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
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="space-y-6">
      {item?.id && <input type="hidden" name="id" value={item.id} />}

      <ItemFormAiProvider
        formRef={formRef}
        categories={categories}
        initialDescription={item?.description ?? ''}
      >
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
        <FillAllButton />

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
      </ItemFormAiProvider>
    </form>
  );
}
```

- [ ] **Step 2: Add the Title button and wire the Description field in `basics-fields.tsx`**

Replace the full contents of `app/admin/items/item-form/basics-fields.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutogenerateButton, useItemFormAi } from './ai-context';
import type { CategoryOption, ItemFormValue, SubcategoryOption } from './types';

export function TitleSlugFields({ item }: { item?: Pick<ItemFormValue, 'title' | 'slug'> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="title">Title</Label>
          <AutogenerateButton field="title" />
        </div>
        <Input id="title" name="title" defaultValue={item?.title ?? ''} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" defaultValue={item?.slug ?? ''} required />
      </div>
    </div>
  );
}

export function ClassificationFields({
  categories,
  subcategories,
  item,
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  item?: Pick<ItemFormValue, 'category_id' | 'subcategory_id' | 'item_type'>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={item?.category_id ?? categories[0]?.id ?? ''}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subcategoryId">Subcategory</Label>
        <select
          id="subcategoryId"
          name="subcategoryId"
          defaultValue={item?.subcategory_id ?? ''}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">None</option>
          {subcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>
              {subcategory.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="itemType">Item type</Label>
        <select
          id="itemType"
          name="itemType"
          defaultValue={item?.item_type ?? 'standard'}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="standard">Standard</option>
          <option value="toy">Toy</option>
          <option value="decoration">Decoration</option>
          <option value="night_light">Night light</option>
          <option value="personalized_night_light">Personalized night light</option>
          <option value="banner">Banner</option>
        </select>
      </div>
    </div>
  );
}

export function StatusField({ item }: { item?: Pick<ItemFormValue, 'status'> }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="status">Status</Label>
      <select
        id="status"
        name="status"
        defaultValue={item?.status ?? 'draft'}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
    </div>
  );
}

export function DescriptionField({ item }: { item?: Pick<ItemFormValue, 'description'> }) {
  const { onDescriptionInput } = useItemFormAi();
  return (
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        name="description"
        defaultValue={item?.description ?? ''}
        onInput={(event) => onDescriptionInput(event.currentTarget.value)}
      />
    </div>
  );
}

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

- [ ] **Step 3: Add Manufacturing notes and Characteristics buttons in `pricing-size-fields.tsx`**

Replace the full contents of `app/admin/items/item-form/pricing-size-fields.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutogenerateButton } from './ai-context';
import type { ItemFormValue } from './types';

export function PriceField({ item }: { item?: Pick<ItemFormValue, 'price_cents'> }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="priceCents">Price, cents</Label>
      <Input
        id="priceCents"
        name="priceCents"
        type="number"
        min="0"
        step="1"
        defaultValue={item?.price_cents ?? 0}
        required
      />
    </div>
  );
}

export function ManufacturingNotesField({
  item,
}: {
  item?: Pick<ItemFormValue, 'manufacturing_notes'>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="manufacturingNotes">Manufacturing notes</Label>
        <AutogenerateButton field="manufacturingNotes" />
      </div>
      <Textarea
        id="manufacturingNotes"
        name="manufacturingNotes"
        defaultValue={item?.manufacturing_notes ?? ''}
      />
    </div>
  );
}

export function SizesCharacteristicsFields({
  item,
}: {
  item?: Pick<ItemFormValue, 'sizes' | 'characteristics'>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="sizesJson">Sizes JSON</Label>
        <Textarea
          id="sizesJson"
          name="sizesJson"
          defaultValue={JSON.stringify(item?.sizes ?? [], null, 2)}
          placeholder='[{"label":"Medium","widthMm":300,"heightMm":200}]'
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="characteristics">Admin-only characteristics</Label>
          <AutogenerateButton field="characteristics" />
        </div>
        <Textarea
          id="characteristics"
          name="characteristics"
          defaultValue={item?.characteristics ?? ''}
          placeholder="Materials, specifications, finish, production assumptions."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the System prompt button in `personalization-fields.tsx`**

Replace the full contents of `app/admin/items/item-form/personalization-fields.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PERSONALIZATION_TAGS } from '@/lib/personalization-constants';
import { AutogenerateButton } from './ai-context';
import { EngravingFields } from './engraving-fields';
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
  item?: Pick<
    ItemFormValue,
    | 'system_prompt'
    | 'skill_id'
    | 'tags'
    | 'laser_contour_enabled'
    | 'laser_solid_enabled'
    | 'laser_solid_price_cents'
    | 'laser_solid_prompt'
  >;
  boilerplateOptions: BoilerplateOption[];
  selectedBoilerplateIds: string[];
}) {
  const selected = new Set(selectedBoilerplateIds);
  const tags = new Set(item?.tags ?? []);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="systemPrompt">System prompt</Label>
          <AutogenerateButton field="systemPrompt" />
        </div>
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
      <EngravingFields item={item} />

      <p className="text-xs text-muted-foreground">
        At least one of System prompt, Skill ID, or a selected boilerplate is required when
        Customizable is checked.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Add the Solid-prompt button in `engraving-fields.tsx`**

Replace the full contents of `app/admin/items/item-form/engraving-fields.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_SOLID_ENGRAVING_PROMPT } from '@/lib/personalization-constants';
import { AutogenerateButton } from './ai-context';
import type { ItemFormValue } from './types';

/**
 * Per-item laser-on-glass engraving styles. Contour (hairline) uses the item's
 * base price; Solid (scratched fill) is opt-in and reveals its own price + prompt.
 * The feature is off unless at least one box is checked. Solid always includes
 * the base Contour style, so enabling Solid forces Contour on too.
 */
export function EngravingFields({
  item,
}: {
  item?: Pick<
    ItemFormValue,
    'laser_contour_enabled' | 'laser_solid_enabled' | 'laser_solid_price_cents' | 'laser_solid_prompt'
  >;
}) {
  const [contourEnabled, setContourEnabled] = useState(item?.laser_contour_enabled ?? false);
  const [solidEnabled, setSolidEnabled] = useState(item?.laser_solid_enabled ?? false);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <Label>Laser engraving styles (glass)</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. Enable a style to offer laser-on-glass engraving. Contour (hairline) uses this
          item&apos;s base price; Solid (scratched fill) has its own price and prompt. When Solid is
          on, both styles are generated and the customer picks which to buy.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="laserContourEnabled"
            checked={contourEnabled}
            // Solid always ships alongside the base Contour style, so it stays on
            // (and locked) while Solid is enabled.
            disabled={solidEnabled}
            onChange={(event) => setContourEnabled(event.target.checked)}
          />
          Contour (hairline)
        </label>
        {/* A disabled checkbox is not submitted, so keep Contour's value posted
            while it is locked on by Solid. */}
        {solidEnabled ? <input type="hidden" name="laserContourEnabled" value="on" /> : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="laserSolidEnabled"
            checked={solidEnabled}
            onChange={(event) => {
              const next = event.target.checked;
              setSolidEnabled(next);
              if (next) setContourEnabled(true);
            }}
          />
          Solid (scratching)
        </label>
      </div>

      {solidEnabled ? (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <div className="space-y-2">
            <Label htmlFor="laserSolidPriceCents">Solid price, cents</Label>
            <Input
              id="laserSolidPriceCents"
              name="laserSolidPriceCents"
              type="number"
              min={0}
              step={1}
              defaultValue={item?.laser_solid_price_cents ?? ''}
              placeholder="Price for the solid-scratched option, in cents."
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="laserSolidPrompt">Solid generation prompt</Label>
              <AutogenerateButton field="laserSolidPrompt" />
            </div>
            <Textarea
              id="laserSolidPrompt"
              name="laserSolidPrompt"
              rows={4}
              defaultValue={item?.laser_solid_prompt ?? DEFAULT_SOLID_ENGRAVING_PROMPT}
              placeholder="Instructions for generating the solid-scratched glass image."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Add SEO field buttons for all 3 locales in `seo-section.tsx`**

Replace the full contents of `app/admin/items/item-form/seo-section.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n';
import { validateSeoMetadata } from '@/lib/seo-validation';
import { AutogenerateButton } from './ai-context';
import type { ItemFormValue, SeoFormValue } from './types';

export function SeoSection({
  item,
  seo,
  seoRecords,
}: {
  item?: Pick<ItemFormValue, 'title' | 'slug' | 'description' | 'thumbnail_path'>;
  seo?: SeoFormValue | null;
  seoRecords?: SeoFormValue[];
}) {
  const seoByLocale = new Map<AppLocale, SeoFormValue>();
  if (seo) seoByLocale.set('en', seo);
  seoRecords?.forEach((record) => {
    if (record.locale) seoByLocale.set(record.locale, record);
  });

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">SEO metadata</h2>
        <p className="text-sm text-muted-foreground">
          Manage indexed metadata for English, Russian, and Armenian storefront pages.
        </p>
      </div>
      {APP_LOCALES.map((locale) => {
        const currentSeo = seoByLocale.get(locale);
        const warnings = validateSeoMetadata(
          {
            seo_title: currentSeo?.seo_title ?? null,
            seo_description: currentSeo?.seo_description ?? null,
            seo_slug: currentSeo?.seo_slug ?? item?.slug ?? null,
            keywords: currentSeo?.keywords ?? [],
            og_title: currentSeo?.og_title ?? null,
            og_description: currentSeo?.og_description ?? null,
            social_image_path: currentSeo?.social_image_path ?? item?.thumbnail_path ?? null,
            noindex: currentSeo?.noindex ?? false,
          },
          { requireLocalized: locale !== 'en' },
        );
        const previewTitle = currentSeo?.seo_title || item?.title || 'SEO title preview';
        const previewDescription =
          currentSeo?.seo_description ||
          item?.description ||
          'Meta description preview appears here.';

        return (
          <div key={locale} className="space-y-4 rounded-md border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide">{locale}</h3>
                <p className="text-xs text-muted-foreground">
                  {currentSeo?.generated_by_ai ? 'Generated by AI' : 'Manual metadata'}
                  {currentSeo?.reviewed_by_admin ? ' - reviewed' : ' - needs review'}
                </p>
              </div>
              {warnings.length > 0 && (
                <div className="warning-panel rounded-md border px-3 py-2 text-xs">
                  {warnings.map((warning) => (
                    <div key={warning.code}>{warning.message}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="truncate text-sm font-medium text-blue-700">{previewTitle}</p>
              <p className="truncate text-xs text-success">
                /items/{currentSeo?.seo_slug || item?.slug || 'item-slug'}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {previewDescription}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`seoTitle_${locale}`}>SEO title</Label>
                  <AutogenerateButton field={`seoTitle_${locale}`} />
                </div>
                <Input
                  id={`seoTitle_${locale}`}
                  name={`seoTitle_${locale}`}
                  defaultValue={currentSeo?.seo_title ?? ''}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`seoKeywords_${locale}`}>Keywords</Label>
                  <AutogenerateButton field={`seoKeywords_${locale}`} />
                </div>
                <Input
                  id={`seoKeywords_${locale}`}
                  name={`seoKeywords_${locale}`}
                  defaultValue={currentSeo?.keywords?.join(', ') ?? ''}
                  placeholder="wooden gift, night light"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`seoDescription_${locale}`}>Meta description</Label>
                <AutogenerateButton field={`seoDescription_${locale}`} />
              </div>
              <Textarea
                id={`seoDescription_${locale}`}
                name={`seoDescription_${locale}`}
                defaultValue={currentSeo?.seo_description ?? ''}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`ogTitle_${locale}`}>Open Graph title</Label>
                  <AutogenerateButton field={`ogTitle_${locale}`} />
                </div>
                <Input
                  id={`ogTitle_${locale}`}
                  name={`ogTitle_${locale}`}
                  defaultValue={currentSeo?.og_title ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`socialImagePath_${locale}`}>Social image path</Label>
                <p className="text-xs text-muted-foreground">
                  Recommended 1200x630 px for Open Graph sharing.
                </p>
                <Input
                  id={`socialImagePath_${locale}`}
                  name={`socialImagePath_${locale}`}
                  defaultValue={currentSeo?.social_image_path ?? ''}
                />
                <Input
                  id={`socialImageFile_${locale}`}
                  name={`socialImageFile_${locale}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`ogDescription_${locale}`}>Open Graph description</Label>
                <AutogenerateButton field={`ogDescription_${locale}`} />
              </div>
              <Textarea
                id={`ogDescription_${locale}`}
                name={`ogDescription_${locale}`}
                defaultValue={currentSeo?.og_description ?? ''}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 8: Manual QA in the browser**

Run: `pnpm dev`, then in a browser signed in as an admin:

1. Go to `/admin/items/new`.
2. Type a description, e.g. "A laser-cut oak jewelry box with a hinged lid and felt lining, sized for rings and small trinkets."
3. Click **Autogenerate** next to Title. Confirm the Title field fills in within a few seconds and no page navigation happens.
4. Click **Fill all fields from description**. Confirm Manufacturing notes, Admin-only characteristics, and all 15 SEO fields (English/Russian/Armenian) fill in — the `ru` and `am` SEO title/description/keywords/OG fields should visibly contain Russian/Armenian text, not English.
5. Clear the Description field entirely, then click any Autogenerate button. Confirm an inline "Enter a description first." message appears next to that button and no network request fires (check the browser Network tab).
6. Restore the description, check **Customizable**, click **Autogenerate** next to System prompt — confirm it fills in.
7. Check **Solid (scratching)** under Laser engraving styles, click **Autogenerate** next to Solid generation prompt — confirm it fills in.
8. Click **Create item**. Confirm the item saves, then reload the edit page (`/admin/items/[id]`) and confirm every generated value persisted.

- [ ] **Step 9: Commit**

```bash
git add app/admin/items/item-form/index.tsx app/admin/items/item-form/basics-fields.tsx \
  app/admin/items/item-form/pricing-size-fields.tsx app/admin/items/item-form/personalization-fields.tsx \
  app/admin/items/item-form/engraving-fields.tsx app/admin/items/item-form/seo-section.tsx
git commit -m "feat(admin): wire Autogenerate/Fill-all buttons into the item form"
```

---

### Task 5: Remove the old SEO AI draft flow

**Files:**
- Delete: `lib/seo-ai.ts`
- Delete: `app/admin/items/seo-actions.ts`
- Delete: `app/admin/seo-metadata-manager.tsx`
- Modify: `app/admin/items/[id]/page.tsx`
- Modify: `scripts/smoke/admin.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — pure removal plus one smoke-test contract swap (old `generateCatalogItemSeoDraftAction` check → new `generateItemFieldValuesAction`/`generateItemFields` checks).

Confirmed via repo-wide search (`grep -rln "seo-ai\|SeoMetadataManager\|generateCatalogItemSeoDraftAction\|saveGeneratedCatalogItemSeoDraftAction\|SeoGenerationState"`) that only these three files plus `app/admin/items/[id]/page.tsx` (render site) and `scripts/smoke/admin.mjs` (a content-grep smoke check) reference this flow.

- [ ] **Step 1: Delete the three old-flow files**

```bash
git rm lib/seo-ai.ts app/admin/items/seo-actions.ts app/admin/seo-metadata-manager.tsx
```

- [ ] **Step 2: Remove the render site from `app/admin/items/[id]/page.tsx`**

In `app/admin/items/[id]/page.tsx`, remove the import on line 3:

```diff
 import { notFound } from 'next/navigation';
 import { ItemForm } from '@/app/admin/items/item-form';
-import { SeoMetadataManager } from '@/app/admin/seo-metadata-manager';
 import { Button } from '@/components/ui/button';
```

And remove the render call after `</ItemForm>`:

```diff
         selectedBoilerplateIds={(itemBoilerplates ?? []).map((row) => row.boilerplate_id)}
       />
-      <SeoMetadataManager catalogItemId={item.id} />
     </main>
   );
 }
```

- [ ] **Step 3: Update the smoke-test contract in `scripts/smoke/admin.mjs`**

Replace lines 26-29 (the `seo-actions.ts` check):

```diff
-const seoActions = readFileSync('app/admin/items/seo-actions.ts', 'utf8');
-if (!seoActions.includes('generateCatalogItemSeoDraftAction')) {
-  throw new Error('Missing admin action: generateCatalogItemSeoDraftAction');
-}
+const itemAiLib = readFileSync('lib/item-ai.ts', 'utf8');
+if (!itemAiLib.includes('generateItemFields')) {
+  throw new Error('Missing item AI helper: generateItemFields');
+}
+
+const aiFillActions = readFileSync('app/admin/items/ai-fill-actions.ts', 'utf8');
+if (!aiFillActions.includes('generateItemFieldValuesAction')) {
+  throw new Error('Missing admin action: generateItemFieldValuesAction');
+}
```

- [ ] **Step 4: Verify nothing else references the removed files**

Run: `grep -rln "seo-ai\|SeoMetadataManager\|generateCatalogItemSeoDraftAction\|saveGeneratedCatalogItemSeoDraftAction\|SeoGenerationState" --include="*.ts" --include="*.tsx" --include="*.mjs" . --exclude-dir=node_modules --exclude-dir=.next`
Expected: no output.

- [ ] **Step 5: Run the full verification battery**

Run: `pnpm typecheck && pnpm test && pnpm smoke:admin && pnpm smoke:seo`
Expected: all four pass — typecheck clean, all Vitest suites (including Tasks 1-2's new tests) pass, and both smoke scripts print their `... passed` line.

- [ ] **Step 6: Commit**

```bash
git add app/admin/items/[id]/page.tsx scripts/smoke/admin.mjs
git commit -m "refactor(admin): remove old SEO AI draft flow, superseded by inline Autogenerate"
```
