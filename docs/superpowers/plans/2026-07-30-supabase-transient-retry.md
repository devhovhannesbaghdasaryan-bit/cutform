# Supabase Transient Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop intermittent Supabase `JWT issued at future` bursts from 503ing catalog pages by retrying transient errors on the three cached catalog reads.

**Architecture:** A small `retryTransient` helper (allowlist-matched errors only, 3 attempts total, jittered backoff) wraps the query bodies of the three `unstable_cache` callbacks in `lib/marketplace.ts`. After exhausted retries the error still throws — never return a fallback, because `unstable_cache` would store it as a successful result for the whole revalidate window.

**Tech Stack:** TypeScript (strict), Next.js App Router, supabase-js, Vitest (`pnpm test`), Biome (`pnpm lint`, `pnpm format:check`), `tsc --noEmit` (`pnpm typecheck`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-supabase-transient-retry-design.md`
- No new dependencies.
- Transient allowlist (exact, from spec): `JWT issued at future`, `fetch failed`, `ECONNRESET`, `socket hang up`, `ETIMEDOUT` — all case-insensitive substring/regex matches.
- Retry policy (from spec): 2 extra attempts (3 total), backoff ~250ms then ~500ms with ±50% jitter.
- Only the three catalog reads in `lib/marketplace.ts` get wrapped. Do not wrap other `getServiceSupabase` call sites.
- Imports use the `@/` path alias. Tests live under `tests/` and run in plain node (see `vitest.config.ts`).
- Work on branch `harden-catalog-transient-retry`.

---

### Task 1: `retryTransient` helper

**Files:**
- Create: `lib/supabase/retry.ts`
- Test: `tests/lib/supabase-retry.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `retryTransient<T>(fn: () => Promise<T>): Promise<T>` and `isTransientSupabaseError(error: unknown): boolean`, both exported from `@/lib/supabase/retry`. Task 2 imports `retryTransient`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/supabase-retry.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTransientSupabaseError, retryTransient } from '@/lib/supabase/retry';

describe('isTransientSupabaseError', () => {
  it('matches the transient allowlist case-insensitively', () => {
    expect(isTransientSupabaseError(new Error('JWT issued at future'))).toBe(true);
    expect(isTransientSupabaseError(new Error('jwt issued at future'))).toBe(true);
    expect(isTransientSupabaseError(new Error('TypeError: fetch failed'))).toBe(true);
    expect(isTransientSupabaseError(new Error('read ECONNRESET'))).toBe(true);
    expect(isTransientSupabaseError(new Error('socket hang up'))).toBe(true);
    expect(isTransientSupabaseError(new Error('connect ETIMEDOUT 1.2.3.4:443'))).toBe(true);
  });

  it('rejects non-transient errors and non-Error values', () => {
    expect(isTransientSupabaseError(new Error('permission denied for table carts'))).toBe(false);
    expect(isTransientSupabaseError(new Error('JWT expired'))).toBe(false);
    expect(isTransientSupabaseError(null)).toBe(false);
    expect(isTransientSupabaseError(undefined)).toBe(false);
  });
});

describe('retryTransient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin jitter to 0 (jitter = base * (random - 0.5)) so delays are exactly 250ms/500ms.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns immediately when fn succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retryTransient(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient error and succeeds on a later attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('JWT issued at future'))
      .mockResolvedValue('ok');
    const result = retryTransient(fn);
    await vi.advanceTimersByTimeAsync(250);
    await expect(result).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-transient error without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permission denied for table carts'));
    await expect(retryTransient(fn)).rejects.toThrow('permission denied');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 attempts and rethrows the last error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('JWT issued at future'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValue(new Error('socket hang up'));
    const result = retryTransient(fn);
    // Attach the rejection expectation before advancing timers to avoid
    // an unhandled rejection between ticks.
    const assertion = expect(result).rejects.toThrow('socket hang up');
    await vi.advanceTimersByTimeAsync(250 + 500);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('waits ~250ms then ~500ms between attempts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok');
    const result = retryTransient(fn);
    const assertion = expect(result).resolves.toBe('ok');

    // Before first backoff elapses: only the initial attempt has run.
    await vi.advanceTimersByTimeAsync(249);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // t=250 → attempt 2
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // t=750 → attempt 3
    expect(fn).toHaveBeenCalledTimes(3);
    await assertion;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/lib/supabase-retry.test.ts`
Expected: FAIL — cannot resolve `@/lib/supabase/retry` (file does not exist).

- [ ] **Step 3: Write the implementation**

Create `lib/supabase/retry.ts`:

```ts
// Retry helper for Supabase calls that fail for reasons outside our control
// (e.g. Supabase's gateway intermittently minting sb_secret JWTs with a
// future iat, which PostgREST rejects as "JWT issued at future"). Only
// errors on this allowlist are retried; anything else is a real bug and
// must fail loudly on the first attempt.
const TRANSIENT_ERROR_PATTERNS: readonly RegExp[] = [
  /JWT issued at future/i,
  /fetch failed/i,
  /ECONNRESET/i,
  /socket hang up/i,
  /ETIMEDOUT/i,
];

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 250;

export function isTransientSupabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function retryTransient<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS || !isTransientSupabaseError(error)) throw error;
      const base = BASE_DELAY_MS * attempt; // 250ms, then 500ms
      const jitter = base * (Math.random() - 0.5); // ±50%
      await sleep(base + jitter);
    }
  }
  throw lastError; // Unreachable; satisfies the compiler.
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/supabase-retry.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck, lint, format**

Run: `pnpm typecheck`, then `pnpm lint`, then `pnpm format:check` (if format fails, run `pnpm format` and re-check).
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/retry.ts tests/lib/supabase-retry.test.ts
git commit -m "feat: add retryTransient helper for transient Supabase errors

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Wrap the three cached catalog reads

**Files:**
- Modify: `lib/marketplace.ts` (three `unstable_cache` callbacks: `getCachedCategories` ~L108, `getCachedSubcategories` ~L129, `getCachedPublishedCatalogItemsPage` ~L178)

**Interfaces:**
- Consumes: `retryTransient<T>(fn: () => Promise<T>): Promise<T>` from `@/lib/supabase/retry` (Task 1).
- Produces: no new exports; the existing `listCategories`, `listSubcategories`, `listPublishedCatalogItems` signatures are unchanged.

- [ ] **Step 1: Add the import**

In `lib/marketplace.ts`, after the existing `getServerSupabase, getServiceSupabase` import, add:

```ts
import { retryTransient } from '@/lib/supabase/retry';
```

- [ ] **Step 2: Wrap `getCachedCategories`**

Replace the callback body so the whole query runs inside `retryTransient`. The existing code:

```ts
const getCachedCategories = unstable_cache(
  async () => {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('categories')
      .select('id, slug, name, description, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<MarketplaceCategory[]>();

    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['catalog-categories'],
  { revalidate: 3600, tags: ['categories'] },
);
```

becomes:

```ts
const getCachedCategories = unstable_cache(
  async () =>
    retryTransient(async () => {
      const supabase = getServiceSupabase();
      const { data, error } = await supabase
        .from('categories')
        .select('id, slug, name, description, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .returns<MarketplaceCategory[]>();

      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  ['catalog-categories'],
  { revalidate: 3600, tags: ['categories'] },
);
```

- [ ] **Step 3: Wrap `getCachedSubcategories`**

Same transformation — the callback `async (categorySlug: string | undefined) => { ... }` becomes `async (categorySlug: string | undefined) => retryTransient(async () => { ... })` with the entire existing body (from `const supabase = getServiceSupabase();` through `return (data ?? []).filter(...)`) moved inside unchanged. Keys/options (`['catalog-subcategories']`, `{ revalidate: 3600, tags: ['subcategories'] }`) stay as they are.

```ts
const getCachedSubcategories = unstable_cache(
  async (categorySlug: string | undefined) =>
    retryTransient(async () => {
      const supabase = getServiceSupabase();
      let query = supabase
        .from('subcategories')
        .select(
          `
          id,
          category_id,
          slug,
          name,
          description,
          sort_order,
          category:categories (
            slug,
            name
          )
        `,
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (categorySlug) {
        query = query.eq('categories.slug', categorySlug);
      }

      const { data, error } = await query.returns<MarketplaceSubcategory[]>();
      if (error) throw new Error(error.message);

      return (data ?? []).filter((item) => !categorySlug || item.category?.slug === categorySlug);
    }),
  ['catalog-subcategories'],
  { revalidate: 3600, tags: ['subcategories'] },
);
```

Note: the select string above is indented two spaces deeper than the original because it now sits inside the `retryTransient` callback — `pnpm format` will settle the final indentation; the string content itself is whitespace-insensitive to PostgREST.

- [ ] **Step 4: Wrap `getCachedPublishedCatalogItemsPage`**

```ts
const getCachedPublishedCatalogItemsPage = unstable_cache(
  async (categoryId: string | undefined, subcategoryId: string | undefined, offset: number) =>
    retryTransient(async () => {
      const supabase = getServiceSupabase();
      let query = supabase
        .from('catalog_items')
        .select(CATALOG_SELECT)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        // Fetch one extra row so the caller can tell whether another page
        // exists without a separate COUNT(*) query.
        .range(offset, offset + CATALOG_PAGE_SIZE);

      if (categoryId) query = query.eq('category_id', categoryId);
      if (subcategoryId) query = query.eq('subcategory_id', subcategoryId);

      const { data, error } = await query.returns<CatalogItem[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  ['catalog-items-page'],
  { revalidate: 300, tags: ['catalog-items'] },
);
```

- [ ] **Step 5: Full verification**

Run: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (run `pnpm format` first if needed), then the full suite `pnpm test`.
Expected: all clean; no existing tests break (nothing imports these cached internals directly).

- [ ] **Step 6: Update the knowledge graph**

Run: `graphify update .`
Expected: completes without error (AST-only refresh per project CLAUDE.md).

- [ ] **Step 7: Commit**

```bash
git add lib/marketplace.ts graphify-out
git commit -m "fix: retry transient Supabase failures in cached catalog reads

Intermittent 'JWT issued at future' bursts from Supabase's per-request
JWT minting for sb_secret keys were 503ing /, /catalog, and product
pages whenever an unstable_cache window expired mid-burst.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual follow-ups (not engineer tasks)

- **File the Supabase support ticket** from the production project's dashboard — ready-to-paste draft in the spec (`docs/superpowers/specs/2026-07-30-supabase-transient-retry-design.md`, section 5).
- **Escalation lever** if bursts worsen before Supabase responds: flip prod `SUPABASE_SECRET_KEY` to the legacy `service_role` JWT (env-only, temporary; revert after Supabase confirms a fix).
- After merge/deploy, watch Vercel runtime error groups for `JWT issued at future` recurrence; if new error groups appear on other `getServiceSupabase` paths, widening coverage is one `retryTransient` wrap per site.
