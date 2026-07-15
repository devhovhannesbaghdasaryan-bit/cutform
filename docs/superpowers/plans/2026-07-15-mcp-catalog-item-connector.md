# ChatGPT/Claude Catalog Item Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins connect ChatGPT and Claude to Uniqraft as a remote MCP server, secured with OAuth 2.1 tied to their own Supabase login, so they can create hidden-draft catalog items by chatting.

**Architecture:** A resource server (`app/api/mcp/route.ts`, built on Vercel's `mcp-handler`) exposes 5 MCP tools backed by shared core catalog-item logic extracted from the existing admin form's Server Actions. A hand-rolled OAuth 2.1 authorization server (`app/api/mcp/{register,authorize,token}/route.ts`) issues tokens by reusing the existing Supabase Auth session and `catalog_manage` admin permission — "logging in" to the connector is just the admin's normal Uniqraft login. Three new Postgres tables back client registration, authorization codes, and tokens.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod v4, Supabase (Postgres + Auth + Storage), `mcp-handler` 1.1.0, `@modelcontextprotocol/sdk` 1.29.0, Vitest.

## Global Constraints

- Admin-only: every write path re-checks `hasAdminPermission(userId, 'catalog_manage')` live, not just at token issuance (`lib/admin.ts`).
- MCP-created items are always `status: 'draft'` — `status` is never an exposed tool parameter.
- Out of scope for all tools: `tags`, personalization config, engraving config, market rules, `isPopular`, gallery images beyond one thumbnail, item deletion, search/list-items.
- `imageUrl` inputs are fetched server-side with SSRF guards: `https` only, private/loopback/link-local IP ranges rejected (including after redirects), `image/*` content-type only, size-capped, timeout-bound.
- All new Postgres tables (`mcp_oauth_clients`, `mcp_oauth_authorization_codes`, `mcp_oauth_tokens`) have RLS enabled; no `anon` grants; `mcp_oauth_authorization_codes` has no `authenticated` grants at all (service-role only).
- Route handlers touching Node-only APIs (`node:crypto`, `node:dns`) declare `export const runtime = 'nodejs'`, matching `app/api/payments/ameria/callback/route.ts`.
- Follow existing repo conventions throughout: `'server-only'` imports on server-only modules, Zod `.trim()` on free-text inputs, `getServiceSupabase()` for privileged/session-less writes vs. the cookie-bound client from `requireAdmin()`/`requireAdminPermission()` for user-session reads.

---

## Task 1: Database migration and generated types

**Files:**
- Create: `supabase/migrations/20260715120000_mcp_oauth.sql`
- Modify: `lib/supabase/database.types.ts:1659-1660` (insert new table types before the `Tables` object's closing brace)

**Interfaces:**
- Produces: tables `mcp_oauth_clients` (`client_id uuid pk`, `client_name text`, `redirect_uris text[]`, `created_at`), `mcp_oauth_authorization_codes` (`id uuid pk`, `code_hash text unique`, `client_id`, `user_id`, `redirect_uri`, `code_challenge`, `scope`, `expires_at`, `used`, `created_at`), `mcp_oauth_tokens` (`id uuid pk`, `access_token_hash text unique`, `refresh_token_hash text unique`, `client_id`, `user_id`, `scope`, `expires_at`, `refresh_expires_at`, `revoked_at`, `created_at`). All later tasks depend on these existing in `Database['public']['Tables']` to typecheck.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260715120000_mcp_oauth.sql`:

```sql
-- OAuth 2.1 authorization/resource server tables backing the ChatGPT/Claude
-- MCP catalog-item connector. Public clients only (PKCE, no client secret) —
-- Claude and ChatGPT register themselves via Dynamic Client Registration.
-- See docs/superpowers/specs/2026-07-15-mcp-catalog-item-connector-design.md.

create table "public"."mcp_oauth_clients" (
  "client_id" uuid not null default gen_random_uuid() primary key,
  "client_name" text not null,
  "redirect_uris" text[] not null,
  "created_at" timestamptz not null default now()
);

alter table "public"."mcp_oauth_clients" enable row level security;

create policy "admins manage mcp oauth clients"
  on "public"."mcp_oauth_clients"
  as permissive
  for all
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

grant select, insert, update, delete on table "public"."mcp_oauth_clients" to "authenticated";
grant select, insert, update, delete on table "public"."mcp_oauth_clients" to "service_role";

-- Single-use, ~60s-lived authorization codes. Service-role only: neither the
-- issuing step (/api/mcp/authorize) nor the consuming step (/api/mcp/token)
-- runs with a PostgREST-visible user session worth writing an RLS policy for.
create table "public"."mcp_oauth_authorization_codes" (
  "id" uuid not null default gen_random_uuid() primary key,
  "code_hash" text not null unique,
  "client_id" uuid not null references public.mcp_oauth_clients(client_id) on delete cascade,
  "user_id" uuid not null references auth.users(id) on delete cascade,
  "redirect_uri" text not null,
  "code_challenge" text not null,
  "scope" text not null,
  "expires_at" timestamptz not null,
  "used" boolean not null default false,
  "created_at" timestamptz not null default now()
);

alter table "public"."mcp_oauth_authorization_codes" enable row level security;

grant select, insert, update, delete on table "public"."mcp_oauth_authorization_codes" to "service_role";

-- Access + refresh token pairs. Issuance/rotation is service-role only (the
-- /api/mcp/token exchange has no user cookie session), but an admin's own
-- rows are readable/revocable through their normal session for the
-- /admin/connectors page.
create table "public"."mcp_oauth_tokens" (
  "id" uuid not null default gen_random_uuid() primary key,
  "access_token_hash" text not null unique,
  "refresh_token_hash" text not null unique,
  "client_id" uuid not null references public.mcp_oauth_clients(client_id) on delete cascade,
  "user_id" uuid not null references auth.users(id) on delete cascade,
  "scope" text not null,
  "expires_at" timestamptz not null,
  "refresh_expires_at" timestamptz not null,
  "revoked_at" timestamptz,
  "created_at" timestamptz not null default now()
);

alter table "public"."mcp_oauth_tokens" enable row level security;

create policy "admins read own mcp oauth tokens"
  on "public"."mcp_oauth_tokens"
  as permissive
  for select
  to authenticated
  using (private.is_admin((select auth.uid())) and user_id = (select auth.uid()));

create policy "admins revoke own mcp oauth tokens"
  on "public"."mcp_oauth_tokens"
  as permissive
  for update
  to authenticated
  using (private.is_admin((select auth.uid())) and user_id = (select auth.uid()))
  with check (private.is_admin((select auth.uid())) and user_id = (select auth.uid()));

grant select, update on table "public"."mcp_oauth_tokens" to "authenticated";
grant select, insert, update, delete on table "public"."mcp_oauth_tokens" to "service_role";
```

- [ ] **Step 2: Add the generated types**

In `lib/supabase/database.types.ts`, the `Tables` object closes at line 1660 (right after the `transactions` table block ends at line 1659, right before `Views: {` at line 1661). Insert these three new blocks immediately before that closing `}` (i.e. between the current lines 1659 and 1660):

```ts
      mcp_oauth_authorization_codes: {
        Row: {
          client_id: string
          code_challenge: string
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          redirect_uri: string
          scope: string
          used: boolean
          user_id: string
        }
        Insert: {
          client_id: string
          code_challenge: string
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          redirect_uri: string
          scope: string
          used?: boolean
          user_id: string
        }
        Update: {
          client_id?: string
          code_challenge?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          scope?: string
          used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_oauth_authorization_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mcp_oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mcp_oauth_clients: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          redirect_uris: string[]
        }
        Insert: {
          client_id?: string
          client_name: string
          created_at?: string
          redirect_uris: string[]
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          redirect_uris?: string[]
        }
        Relationships: []
      }
      mcp_oauth_tokens: {
        Row: {
          access_token_hash: string
          client_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_expires_at: string
          refresh_token_hash: string
          revoked_at: string | null
          scope: string
          user_id: string
        }
        Insert: {
          access_token_hash: string
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_expires_at: string
          refresh_token_hash: string
          revoked_at?: string | null
          scope: string
          user_id: string
        }
        Update: {
          access_token_hash?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_expires_at?: string
          refresh_token_hash?: string
          revoked_at?: string | null
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_oauth_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mcp_oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
```

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm typecheck`
Expected: no new errors (nothing references these tables yet, so this just confirms the JSON/type literal is well-formed).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715120000_mcp_oauth.sql lib/supabase/database.types.ts
git commit -m "feat(mcp): add oauth client/code/token tables for the catalog item connector"
```

---

## Task 2: OAuth crypto helpers

**Files:**
- Create: `lib/mcp/oauth-crypto.ts`
- Test: `tests/lib/mcp/oauth-crypto.test.ts`

**Interfaces:**
- Produces: `generateOpaqueToken(): string`, `hashToken(token: string): string`, `verifyPkceChallenge(codeVerifier: string, codeChallenge: string): boolean` — used by Task 3 (`oauth-store.ts`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/mcp/oauth-crypto.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashToken, verifyPkceChallenge } from '@/lib/mcp/oauth-crypto';

describe('generateOpaqueToken', () => {
  it('returns a url-safe, sufficiently long random string', () => {
    const token = generateOpaqueToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('never repeats across calls', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateOpaqueToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('same-input')).toBe(hashToken('same-input'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });

  it('never returns the raw input', () => {
    expect(hashToken('my-secret-token')).not.toBe('my-secret-token');
  });
});

describe('verifyPkceChallenge', () => {
  // RFC 7636 Appendix B test vector.
  it('accepts the RFC 7636 S256 example pair', () => {
    expect(
      verifyPkceChallenge(
        'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      ),
    ).toBe(true);
  });

  it('rejects a mismatched verifier', () => {
    expect(verifyPkceChallenge('wrong-verifier', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lib/mcp/oauth-crypto.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/oauth-crypto'"

- [ ] **Step 3: Implement**

Create `lib/mcp/oauth-crypto.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

const OPAQUE_TOKEN_BYTES = 32;

/** A random, URL-safe opaque secret — used for authorization codes, access tokens, and refresh tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
}

/** SHA-256 hash for at-rest storage of opaque secrets; never store the raw value. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** RFC 7636 S256 PKCE verification: challenge must equal base64url(sha256(verifier)). */
export function verifyPkceChallenge(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return computed === codeChallenge;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lib/mcp/oauth-crypto.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/oauth-crypto.ts tests/lib/mcp/oauth-crypto.test.ts
git commit -m "feat(mcp): add opaque token and PKCE crypto helpers"
```

---

## Task 3: OAuth data-access layer

**Files:**
- Create: `lib/mcp/oauth-store.ts`
- Test: `tests/lib/mcp/oauth-store.test.ts`

**Interfaces:**
- Consumes: `generateOpaqueToken`, `hashToken` from `lib/mcp/oauth-crypto.ts` (Task 2); `getServiceSupabase` from `lib/supabase/server.ts`; `TypedSupabaseClient` from `lib/supabase/types.ts`.
- Produces: `MCP_OAUTH_SCOPE` constant, `registerOauthClient`, `getOauthClient`, `createAuthorizationCode`, `consumeAuthorizationCode`, `issueTokenPair`, `rotateRefreshToken`, `findAccessTokenContext`, `listConnectedApps`, `revokeConnectedApp` — used by Tasks 7, 9, 11, 12, 13, 14.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/mcp/oauth-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tables: Record<string, unknown[]> = {};

function resetTables() {
  tables.mcp_oauth_clients = [];
  tables.mcp_oauth_authorization_codes = [];
  tables.mcp_oauth_tokens = [];
}

function makeQuery(tableName: string) {
  const rows = () => tables[tableName] as Record<string, unknown>[];
  const state: { filters: Array<(row: Record<string, unknown>) => boolean> } = { filters: [] };
  const query = {
    insert(values: Record<string, unknown>) {
      const row = { id: crypto.randomUUID(), client_id: crypto.randomUUID(), ...values };
      rows().push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    },
    select() {
      return query;
    },
    eq(column: string, value: unknown) {
      state.filters.push((row) => row[column] === value);
      return query;
    },
    update(values: Record<string, unknown>) {
      return {
        eq: async (column: string, value: unknown) => {
          const match = rows().find((row) => row[column] === value);
          if (match) Object.assign(match, values);
          return { error: null };
        },
      };
    },
    async maybeSingle() {
      const match = rows().find((row) => state.filters.every((f) => f(row)));
      return { data: match ?? null, error: null };
    },
  };
  return query;
}

vi.mock('@/lib/supabase/server', () => ({
  getServiceSupabase: () => ({
    from: (tableName: string) => makeQuery(tableName),
  }),
}));

import {
  MCP_OAUTH_SCOPE,
  consumeAuthorizationCode,
  createAuthorizationCode,
  findAccessTokenContext,
  issueTokenPair,
  registerOauthClient,
  rotateRefreshToken,
} from '@/lib/mcp/oauth-store';

describe('oauth-store', () => {
  beforeEach(() => {
    resetTables();
  });

  it('registers a client and returns its id', async () => {
    const client = await registerOauthClient({
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    });
    expect(client.clientName).toBe('Claude');
    expect(client.clientId).toBeTruthy();
  });

  it('round-trips an authorization code: create then consume', async () => {
    const code = await createAuthorizationCode({
      clientId: 'client-1',
      userId: 'user-1',
      redirectUri: 'https://claude.ai/callback',
      codeChallenge: 'challenge-abc',
      scope: MCP_OAUTH_SCOPE,
    });

    const consumed = await consumeAuthorizationCode({
      code,
      clientId: 'client-1',
      redirectUri: 'https://claude.ai/callback',
    });

    expect(consumed).toEqual({ userId: 'user-1', scope: MCP_OAUTH_SCOPE, codeChallenge: 'challenge-abc' });
  });

  it('refuses to consume the same code twice', async () => {
    const code = await createAuthorizationCode({
      clientId: 'client-1',
      userId: 'user-1',
      redirectUri: 'https://claude.ai/callback',
      codeChallenge: 'challenge-abc',
      scope: MCP_OAUTH_SCOPE,
    });

    await consumeAuthorizationCode({ code, clientId: 'client-1', redirectUri: 'https://claude.ai/callback' });
    const second = await consumeAuthorizationCode({
      code,
      clientId: 'client-1',
      redirectUri: 'https://claude.ai/callback',
    });

    expect(second).toBeNull();
  });

  it('refuses to consume a code for the wrong client', async () => {
    const code = await createAuthorizationCode({
      clientId: 'client-1',
      userId: 'user-1',
      redirectUri: 'https://claude.ai/callback',
      codeChallenge: 'challenge-abc',
      scope: MCP_OAUTH_SCOPE,
    });

    const consumed = await consumeAuthorizationCode({
      code,
      clientId: 'client-attacker',
      redirectUri: 'https://claude.ai/callback',
    });

    expect(consumed).toBeNull();
  });

  it('issues a token pair and finds the access token context', async () => {
    const pair = await issueTokenPair({ clientId: 'client-1', userId: 'user-1', scope: MCP_OAUTH_SCOPE });
    expect(pair.expiresIn).toBeGreaterThan(0);

    const context = await findAccessTokenContext(pair.accessToken);
    expect(context).toEqual({ userId: 'user-1', clientId: 'client-1', scope: MCP_OAUTH_SCOPE });
  });

  it('returns null for an unknown access token', async () => {
    expect(await findAccessTokenContext('not-a-real-token')).toBeNull();
  });

  it('rotates a refresh token into a new pair and revokes the old one', async () => {
    const pair = await issueTokenPair({ clientId: 'client-1', userId: 'user-1', scope: MCP_OAUTH_SCOPE });
    const rotated = await rotateRefreshToken(pair.refreshToken);

    expect(rotated?.userId).toBe('user-1');
    expect(rotated?.accessToken).not.toBe(pair.accessToken);
    expect(await findAccessTokenContext(pair.accessToken)).not.toBeNull();
    // Old access token still resolves (only the refresh token was consumed);
    // the old row's revoked_at is set, so a *second* rotation of the same
    // refresh token must fail.
    expect(await rotateRefreshToken(pair.refreshToken)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lib/mcp/oauth-store.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/oauth-store'"

- [ ] **Step 3: Implement**

Create `lib/mcp/oauth-store.ts`:

```ts
import 'server-only';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { getServiceSupabase } from '@/lib/supabase/server';
import { generateOpaqueToken, hashToken } from '@/lib/mcp/oauth-crypto';

export const MCP_OAUTH_SCOPE = 'catalog:write';

const AUTHORIZATION_CODE_TTL_MS = 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface McpOauthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
}

export async function registerOauthClient(input: {
  clientName: string;
  redirectUris: string[];
}): Promise<McpOauthClient> {
  const { data, error } = await getServiceSupabase()
    .from('mcp_oauth_clients')
    .insert({ client_name: input.clientName, redirect_uris: input.redirectUris })
    .select('client_id, client_name, redirect_uris')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to register client.');
  return { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris };
}

export async function getOauthClient(clientId: string): Promise<McpOauthClient | null> {
  const { data, error } = await getServiceSupabase()
    .from('mcp_oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris };
}

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}): Promise<string> {
  const code = generateOpaqueToken();
  const { error } = await getServiceSupabase()
    .from('mcp_oauth_authorization_codes')
    .insert({
      code_hash: hashToken(code),
      client_id: input.clientId,
      user_id: input.userId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      scope: input.scope,
      expires_at: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS).toISOString(),
    });
  if (error) throw new Error(error.message);
  return code;
}

export interface ConsumedAuthorizationCode {
  userId: string;
  scope: string;
  codeChallenge: string;
}

export async function consumeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
}): Promise<ConsumedAuthorizationCode | null> {
  const supabase = getServiceSupabase();
  const codeHash = hashToken(input.code);
  const { data, error } = await supabase
    .from('mcp_oauth_authorization_codes')
    .select('id, user_id, scope, code_challenge, client_id, redirect_uri, expires_at, used')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.used) return null;
  if (data.client_id !== input.clientId) return null;
  if (data.redirect_uri !== input.redirectUri) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  const { error: updateError } = await supabase
    .from('mcp_oauth_authorization_codes')
    .update({ used: true })
    .eq('id', data.id);
  if (updateError) throw new Error(updateError.message);

  return { userId: data.user_id, scope: data.scope, codeChallenge: data.code_challenge };
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueTokenPair(input: {
  clientId: string;
  userId: string;
  scope: string;
}): Promise<IssuedTokenPair> {
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();
  const now = Date.now();
  const { error } = await getServiceSupabase()
    .from('mcp_oauth_tokens')
    .insert({
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      client_id: input.clientId,
      user_id: input.userId,
      scope: input.scope,
      expires_at: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
      refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
    });
  if (error) throw new Error(error.message);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
}

export interface RotatedTokenPair extends IssuedTokenPair {
  userId: string;
  scope: string;
  clientId: string;
}

export async function rotateRefreshToken(refreshToken: string): Promise<RotatedTokenPair | null> {
  const supabase = getServiceSupabase();
  const refreshTokenHash = hashToken(refreshToken);
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('id, user_id, client_id, scope, refresh_expires_at, revoked_at')
    .eq('refresh_token_hash', refreshTokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) return null;
  if (new Date(data.refresh_expires_at).getTime() < Date.now()) return null;

  const { error: revokeError } = await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', data.id);
  if (revokeError) throw new Error(revokeError.message);

  const pair = await issueTokenPair({ clientId: data.client_id, userId: data.user_id, scope: data.scope });
  return { ...pair, userId: data.user_id, scope: data.scope, clientId: data.client_id };
}

export interface AccessTokenContext {
  userId: string;
  clientId: string;
  scope: string;
}

export async function findAccessTokenContext(accessToken: string): Promise<AccessTokenContext | null> {
  const supabase = getServiceSupabase();
  const accessTokenHash = hashToken(accessToken);
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('user_id, client_id, scope, expires_at, revoked_at')
    .eq('access_token_hash', accessTokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return { userId: data.user_id, clientId: data.client_id, scope: data.scope };
}

export interface ConnectedApp {
  tokenId: string;
  clientId: string;
  clientName: string;
  expiresAt: string;
  refreshExpiresAt: string;
}

/** Reads through the caller's own session (RLS-scoped to their own rows) — pass the cookie-bound client from requireAdmin(), not the service client. */
export async function listConnectedApps(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<ConnectedApp[]> {
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('id, client_id, expires_at, refresh_expires_at, mcp_oauth_clients(client_name)')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    tokenId: row.id,
    clientId: row.client_id,
    clientName: (row.mcp_oauth_clients as { client_name: string } | null)?.client_name ?? 'Unknown app',
    expiresAt: row.expires_at,
    refreshExpiresAt: row.refresh_expires_at,
  }));
}

/** Soft-revokes one of the caller's own token rows through their own session — see listConnectedApps. */
export async function revokeConnectedApp(
  supabase: TypedSupabaseClient,
  userId: string,
  tokenId: string,
): Promise<void> {
  const { error } = await supabase
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lib/mcp/oauth-store.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add lib/mcp/oauth-store.ts tests/lib/mcp/oauth-store.test.ts
git commit -m "feat(mcp): add oauth client/code/token data-access layer"
```

---

## Task 4: SSRF-guarded image fetch

**Files:**
- Create: `lib/catalog-items/upload-from-url.ts`
- Test: `tests/lib/catalog-items/upload-from-url.test.ts`

**Interfaces:**
- Consumes: `uploadToBucket` from `lib/storage.ts:27`; `IMAGE_EXTENSION_BY_MIME` from `lib/storage.ts:12`.
- Produces: `fetchAndStoreCatalogImage(supabase, userId, imageUrl): Promise<string>` (returns the storage path) — used by Task 9 (`create_catalog_item` tool) and Task 10 (`update_catalog_item` tool).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/catalog-items/upload-from-url.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';

function fakeSupabase() {
  const uploaded: { path?: string; contentType?: string } = {};
  return {
    client: {
      storage: {
        from: () => ({
          upload: async (path: string, _body: unknown, options: { contentType: string }) => {
            uploaded.path = path;
            uploaded.contentType = options.contentType;
            return { error: null };
          },
        }),
      },
    } as unknown as Parameters<typeof fetchAndStoreCatalogImage>[0],
    uploaded,
  };
}

function jpegResponse(body = new Uint8Array([1, 2, 3])) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
}

describe('fetchAndStoreCatalogImage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-https URLs before ever calling fetch', async () => {
    const { client } = fakeSupabase();
    await expect(fetchAndStoreCatalogImage(client, 'user-1', 'http://example.com/a.jpg')).rejects.toThrow(
      /https/i,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a URL resolving to a private IP', async () => {
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://127.0.0.1/a.jpg'),
    ).rejects.toThrow(/private|loopback/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a URL resolving to a link-local/metadata address', async () => {
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://169.254.169.254/a.jpg'),
    ).rejects.toThrow(/private|loopback/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-image content type', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/a.jpg'),
    ).rejects.toThrow(/image/i);
  });

  it('rejects a response over the size cap', async () => {
    const oversized = new Uint8Array(51 * 1024 * 1024);
    vi.mocked(fetch).mockResolvedValue(jpegResponse(oversized));
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/a.jpg'),
    ).rejects.toThrow(/50 ?MB|size/i);
  });

  it('uploads a valid https image and returns the storage path', async () => {
    vi.mocked(fetch).mockResolvedValue(jpegResponse());
    const { client, uploaded } = fakeSupabase();
    const path = await fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/a.jpg');
    expect(path).toMatch(/^user-1\/mcp-images\/.+\.jpg$/);
    expect(uploaded.path).toBe(path);
    expect(uploaded.contentType).toBe('image/jpeg');
  });

  it('propagates a fetch failure as an error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
    const { client } = fakeSupabase();
    await expect(
      fetchAndStoreCatalogImage(client, 'user-1', 'https://93.184.216.34/missing.jpg'),
    ).rejects.toThrow(/404|fetch/i);
  });
});
```

Note: these tests pass literal public IP addresses (`93.184.216.34`) as the URL host rather than a hostname, so the SSRF guard's IP-range check runs without needing a mocked DNS lookup for the "allowed" cases; the private/loopback/link-local cases use IP literals directly for the same reason.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lib/catalog-items/upload-from-url.test.ts`
Expected: FAIL with "Cannot find module '@/lib/catalog-items/upload-from-url'"

- [ ] **Step 3: Implement**

Create `lib/catalog-items/upload-from-url.ts`:

```ts
import 'server-only';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

// IPv4 ranges that must never be fetched server-side: loopback, private,
// link-local (includes the 169.254.169.254 cloud metadata endpoint), and
// this-network/broadcast.
const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([base, prefix]) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:169.254.')
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  const directIpVersion = isIP(hostname);
  const addresses =
    directIpVersion > 0 ? [{ address: hostname, family: directIpVersion }] : await lookup(hostname, { all: true });

  for (const { address, family } of addresses) {
    const blocked = family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
    if (blocked) {
      throw new Error(`Refusing to fetch ${hostname}: resolves to a private/loopback address.`);
    }
  }
}

async function fetchImageWithGuards(imageUrl: string): Promise<Response> {
  let currentUrl = imageUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error('imageUrl must use https.');
    }
    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(currentUrl, { redirect: 'manual', signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect from ${currentUrl} had no Location header.`);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch image (HTTP ${response.status}).`);
    }
    return response;
  }
  throw new Error('Too many redirects while fetching imageUrl.');
}

/** Fetches an https image URL with SSRF guards and stores it in the catalog-assets bucket. Returns the storage path. */
export async function fetchAndStoreCatalogImage(
  supabase: TypedSupabaseClient,
  userId: string,
  imageUrl: string,
): Promise<string> {
  const response = await fetchImageWithGuards(imageUrl);

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const extension = IMAGE_EXTENSION_BY_MIME[contentType];
  if (!extension) {
    throw new Error(`imageUrl must point to a PNG, JPEG, or WEBP image (got "${contentType}").`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error('Catalog media must be 50 MB or smaller.');
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Catalog media must be 50 MB or smaller.');
  }

  return uploadToBucket(supabase, {
    bucket: 'catalog-assets',
    path: `${userId}/mcp-images/${crypto.randomUUID()}.${extension}`,
    body,
    contentType,
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lib/catalog-items/upload-from-url.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/catalog-items/upload-from-url.ts tests/lib/catalog-items/upload-from-url.test.ts
git commit -m "feat(catalog-items): fetch and store a catalog image from a URL with SSRF guards"
```

---

## Task 5: Extract shared catalog-item core logic

**Files:**
- Modify: `app/admin/items/actions.ts` (export 4 currently-private helpers, then replace the inlined insert/update+validation blocks in `createCatalogItemAction` and `updateCatalogItemAction`)
- Modify: `app/admin/items/item-form-parsing.ts` (receives the 4 exported helpers)
- Create: `lib/catalog-items/core.ts`
- Test: `tests/lib/catalog-items/core.test.ts`

**Interfaces:**
- Consumes: `itemSchema`, `AdminSupabase`, `ensureCatalogSlugIsAvailable`, `parseSizesJson`, `syncCatalogItemBoilerplates`, `syncCatalogItemMedia`, `validatePersonalizationConfig`, `validateEngravingConfig` (already exported from `app/admin/items/item-form-parsing.ts`), plus the 4 newly-exported helpers below.
- Produces: `createCatalogItemCore(supabase, user, item, thumbnailPath, formData?): Promise<{ id: string; slug: string }>`, `updateCatalogItemCore(supabase, id, user, item, thumbnailPath, formData?): Promise<void>` — used by Task 9 and Task 10 (MCP tools) and by `actions.ts` itself.

- [ ] **Step 1: Move 4 helpers from `actions.ts` to `item-form-parsing.ts`, exported**

In `app/admin/items/actions.ts`, these 4 functions currently have no `export` keyword: `upsertSeoMetadata` (line 51), `validateSubcategoryBelongsToCategory` (line 95), `validateCategoryExists` (line 112), `syncCatalogItemMarketRules` (line 123). Cut all 4 function bodies out of `actions.ts` and paste them into `app/admin/items/item-form-parsing.ts`, each with `export` added, placed after the existing `syncCatalogItemBoilerplates` function (end of file). They use `AdminSupabase`, `Json`, `APP_LOCALES`, `parseKeywords` — all already imported or defined in `item-form-parsing.ts` except `Json`, which is already imported there, and `APP_LOCALES`, already imported there too. No new imports needed in `item-form-parsing.ts`.

In `app/admin/items/actions.ts`, replace the import block (lines 10-23):

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
  validateEngravingConfig,
  validatePersonalizationConfig,
} from './item-form-parsing';
```

with:

```ts
import {
  type AdminSupabase,
  getOptionalFile,
  type itemSchema,
  parseItemForm,
  ensureCatalogSlugIsAvailable,
  syncCatalogItemBoilerplates,
  syncCatalogItemMarketRules,
  syncCatalogItemMedia,
  uploadAdminCatalogAsset,
  upsertSeoMetadata,
  validateCategoryExists,
  validateEngravingConfig,
  validatePersonalizationConfig,
  validateSubcategoryBelongsToCategory,
} from './item-form-parsing';
```

(`parseKeywords` and `parseSizesJson` are no longer referenced directly in `actions.ts` after Step 7 below removes the inlined blocks that used them; `z` and `Json` imports in `actions.ts` also become unused after Step 7 — leave the cleanup of those two to Step 7, once the blocks that use them are gone.)

- [ ] **Step 2: Run typecheck to confirm the move alone doesn't break anything**

Run: `pnpm typecheck`
Expected: no errors (the 4 functions now live in `item-form-parsing.ts` and are re-imported into `actions.ts` under the same names, so every call site in `actions.ts` still resolves).

- [ ] **Step 3: Write the failing tests for the new core module**

Create `tests/lib/catalog-items/core.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createCatalogItemCore, updateCatalogItemCore } from '@/lib/catalog-items/core';
import type { itemSchema } from '@/app/admin/items/item-form-parsing';
import type { z } from 'zod';

function baseItem(overrides: Partial<z.infer<typeof itemSchema>> = {}): z.infer<typeof itemSchema> {
  return {
    title: 'Test Item',
    slug: 'test-item',
    categoryId: '00000000-0000-0000-0000-000000000001',
    subcategoryId: '',
    itemType: 'standard',
    description: 'A description.',
    priceCents: 1000,
    status: 'draft',
    isPopular: false,
    isCustomizable: false,
    thumbnailPath: undefined,
    manufacturingNotes: undefined,
    sizesJson: undefined,
    characteristics: undefined,
    systemPrompt: undefined,
    skillId: undefined,
    tags: [],
    boilerplateIds: [],
    laserContourEnabled: false,
    laserSolidEnabled: false,
    laserSolidPriceCents: undefined,
    laserSolidPrompt: undefined,
    seo: { en: {}, ru: {}, am: {} },
    ...overrides,
  };
}

function fakeSupabase(options: { categoryExists?: boolean; slugTaken?: boolean } = {}) {
  const { categoryExists = true, slugTaken = false } = options;
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      if (table === 'categories') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: categoryExists ? { id: 'cat-1' } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'catalog_items') {
        return {
          select: (columns: string) => {
            if (columns === 'id') {
              return {
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: slugTaken ? { id: 'other-id' } : null, error: null }),
                  }),
                }),
              };
            }
            return { single: async () => ({ data: { id: 'new-id' }, error: null }) };
          },
          insert: (values: Record<string, unknown>) => {
            inserted.push(values);
            return {
              select: () => ({ single: async () => ({ data: { id: 'new-id' }, error: null }) }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'catalog_item_boilerplates') {
        return { delete: () => ({ eq: async () => ({ error: null }) }), insert: async () => ({ error: null }) };
      }
      if (table === 'catalog_item_seo_metadata') {
        return { upsert: async () => ({ error: null }) };
      }
      if (table === 'catalog_item_media') {
        return {
          select: () => ({ eq: () => ({ returns: async () => ({ data: [], error: null }) }) }),
          delete: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
          insert: async () => ({ error: null }),
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        };
      }
      if (table === 'catalog_item_market_rules') {
        return { delete: () => ({ eq: async () => ({ error: null }) }), insert: async () => ({ error: null }) };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  };
  return { client: client as never, inserted };
}

describe('createCatalogItemCore', () => {
  it('inserts the item and returns its id and slug', async () => {
    const { client, inserted } = fakeSupabase();
    const result = await createCatalogItemCore(client, { id: 'user-1' }, baseItem(), 'user-1/thumb.jpg');
    expect(result).toEqual({ id: 'new-id', slug: 'test-item' });
    expect(inserted[0]).toMatchObject({
      title: 'Test Item',
      slug: 'test-item',
      thumbnail_path: 'user-1/thumb.jpg',
      status: 'draft',
      created_by: 'user-1',
    });
  });

  it('rejects an unknown category', async () => {
    const { client } = fakeSupabase({ categoryExists: false });
    await expect(
      createCatalogItemCore(client, { id: 'user-1' }, baseItem(), null),
    ).rejects.toThrow('Selected category does not exist.');
  });

  it('rejects a slug already used by another item', async () => {
    const { client } = fakeSupabase({ slugTaken: true });
    await expect(createCatalogItemCore(client, { id: 'user-1' }, baseItem(), null)).rejects.toThrow(
      'Slug is already used by another item.',
    );
  });

  it('rejects a customizable item with no generation source', async () => {
    const { client } = fakeSupabase();
    await expect(
      createCatalogItemCore(client, { id: 'user-1' }, baseItem({ isCustomizable: true }), null),
    ).rejects.toThrow(/System Prompt|Skill ID|boilerplate/);
  });

  it('falls back to null thumbnail when none is given or on the item', async () => {
    const { client, inserted } = fakeSupabase();
    await createCatalogItemCore(client, { id: 'user-1' }, baseItem(), null);
    expect(inserted[0]).toMatchObject({ thumbnail_path: null });
  });
});

describe('updateCatalogItemCore', () => {
  it('updates without throwing for a valid item', async () => {
    const { client } = fakeSupabase();
    await expect(
      updateCatalogItemCore(client, 'existing-id', { id: 'user-1' }, baseItem(), 'user-1/thumb.jpg'),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lib/catalog-items/core.test.ts`
Expected: FAIL with "Cannot find module '@/lib/catalog-items/core'"

- [ ] **Step 5: Implement `lib/catalog-items/core.ts`**

```ts
import 'server-only';
import type { z } from 'zod';
import type { Json } from '@/lib/supabase/types';
import {
  type AdminSupabase,
  type itemSchema,
  ensureCatalogSlugIsAvailable,
  parseSizesJson,
  syncCatalogItemBoilerplates,
  syncCatalogItemMarketRules,
  syncCatalogItemMedia,
  upsertSeoMetadata,
  validateCategoryExists,
  validateEngravingConfig,
  validatePersonalizationConfig,
  validateSubcategoryBelongsToCategory,
} from '@/app/admin/items/item-form-parsing';

async function validateItemAndParseSizes(
  supabase: AdminSupabase,
  item: z.infer<typeof itemSchema>,
): Promise<Json[]> {
  const validCategory = await validateCategoryExists(supabase, item.categoryId);
  if (!validCategory) throw new Error('Selected category does not exist.');

  const validSubcategory = await validateSubcategoryBelongsToCategory(
    supabase,
    item.subcategoryId,
    item.categoryId,
  );
  if (!validSubcategory) throw new Error('Selected subcategory does not belong to category.');

  if (!validatePersonalizationConfig(item)) {
    throw new Error('Customizable items need a System Prompt, a Skill ID, or at least one boilerplate.');
  }

  const engravingError = validateEngravingConfig(item);
  if (engravingError) throw new Error(engravingError);

  try {
    return parseSizesJson(item.sizesJson);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid sizes.');
  }
}

function toCatalogItemRow(item: z.infer<typeof itemSchema>, sizes: Json[], thumbnailPath: string | null) {
  return {
    title: item.title,
    slug: item.slug,
    category_id: item.categoryId,
    subcategory_id: item.subcategoryId || null,
    item_type: item.itemType,
    description: item.description ?? null,
    price_cents: item.priceCents,
    status: item.status,
    is_popular: item.isPopular,
    is_customizable: item.isCustomizable,
    thumbnail_path: thumbnailPath ?? item.thumbnailPath ?? null,
    manufacturing_notes: item.manufacturingNotes ?? null,
    sizes,
    characteristics: item.characteristics ?? null,
    system_prompt: item.systemPrompt ?? null,
    skill_id: item.skillId ?? null,
    tags: item.tags,
    laser_contour_enabled: item.laserContourEnabled,
    laser_solid_enabled: item.laserSolidEnabled,
    laser_solid_price_cents: item.laserSolidEnabled ? (item.laserSolidPriceCents ?? null) : null,
    laser_solid_prompt: item.laserSolidEnabled ? (item.laserSolidPrompt ?? null) : null,
  };
}

export interface CreateCatalogItemCoreResult {
  id: string;
  slug: string;
}

/**
 * Shared insert path for a catalog item, used by both the admin form's
 * Server Action (real FormData for media/market-rules) and the MCP create
 * tool (omitted formData — an empty FormData means "no media edits beyond
 * the thumbnail, no market rules").
 */
export async function createCatalogItemCore(
  supabase: AdminSupabase,
  user: { id: string },
  item: z.infer<typeof itemSchema>,
  thumbnailPath: string | null,
  formData: FormData = new FormData(),
): Promise<CreateCatalogItemCoreResult> {
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug);
  if (!slugAvailable) throw new Error('Slug is already used by another item.');
  const sizes = await validateItemAndParseSizes(supabase, item);

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({ ...toCatalogItemRow(item, sizes, thumbnailPath), created_by: user.id })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create item.');

  await syncCatalogItemMedia(supabase, user.id, data.id, formData, thumbnailPath ?? item.thumbnailPath ?? null);
  await syncCatalogItemBoilerplates(supabase, data.id, item.boilerplateIds);
  await upsertSeoMetadata(supabase, data.id, item, user.id);
  await syncCatalogItemMarketRules(supabase, data.id, formData);

  return { id: data.id, slug: item.slug };
}

/** Shared update path for a catalog item — see createCatalogItemCore for the formData default. */
export async function updateCatalogItemCore(
  supabase: AdminSupabase,
  id: string,
  user: { id: string },
  item: z.infer<typeof itemSchema>,
  thumbnailPath: string | null,
  formData: FormData = new FormData(),
): Promise<void> {
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, item.slug, id);
  if (!slugAvailable) throw new Error('Slug is already used by another item.');
  const sizes = await validateItemAndParseSizes(supabase, item);

  const { error } = await supabase
    .from('catalog_items')
    .update(toCatalogItemRow(item, sizes, thumbnailPath))
    .eq('id', id);
  if (error) throw new Error(error.message);

  await syncCatalogItemMedia(supabase, user.id, id, formData, thumbnailPath ?? item.thumbnailPath ?? null);
  await syncCatalogItemBoilerplates(supabase, id, item.boilerplateIds);
  await upsertSeoMetadata(supabase, id, item, user.id);
  await syncCatalogItemMarketRules(supabase, id, formData);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lib/catalog-items/core.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Refactor `actions.ts` to call the new core functions**

In `app/admin/items/actions.ts`, in `createCatalogItemAction`, replace everything from `const validCategory = await validateCategoryExists(supabase, item.categoryId);` through the end of `await syncCatalogItemMarketRules(supabase, data.id, formData);` (originally lines 179–248) with:

```ts
  let uploadedAssets: { thumbnailPath: string | null };
  try {
    uploadedAssets = await uploadCatalogFormAssets(supabase, user.id, formData, item);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to upload catalog assets.');
  }

  let created: { id: string; slug: string };
  try {
    created = await createCatalogItemCore(
      supabase,
      user,
      item,
      uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
      formData,
    );
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to create item.');
  }

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  redirect(`/admin/items/${created.id}`);
```

(This removes the now-duplicated `uploadCatalogFormAssets` call that originally preceded this block — check the surrounding lines and delete the old `uploadCatalogFormAssets`/`uploadedAssets` block that came right before the old `const validCategory = ...` line so it isn't declared twice.)

Apply the equivalent replacement in `updateCatalogItemAction` (originally lines 269–336): keep the `uploadCatalogFormAssets` call, then replace the validation-through-`syncCatalogItemMarketRules` block with:

```ts
  try {
    await updateCatalogItemCore(
      supabase,
      id,
      user,
      item,
      uploadedAssets.thumbnailPath ?? item.thumbnailPath ?? null,
      formData,
    );
  } catch (error) {
    return actionError(error instanceof Error ? error.message : 'Failed to update item.');
  }

  revalidatePath('/');
  revalidatePath('/catalog');
  revalidatePath('/admin/items');
  revalidatePath(`/admin/items/${id}`);
  return actionSuccess(null);
```

Add the import at the top of `actions.ts`:

```ts
import { createCatalogItemCore, updateCatalogItemCore } from '@/lib/catalog-items/core';
```

Then remove now-unused imports from `actions.ts`: `parseKeywords`, `parseSizesJson`, `z` (if no longer referenced — check remaining uses; `z.infer<typeof itemSchema>` is still used in the function signatures of `uploadCatalogFormAssets`, so keep `z`), `Json` (still used in `uploadCatalogFormAssets`'s callers? check — if unused, remove). Run `pnpm lint` to catch any remaining unused imports.

- [ ] **Step 8: Run the full test suite and typecheck**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS, no errors (this repo has no prior tests for `actions.ts` itself, so nothing else to reconcile).

- [ ] **Step 9: Run lint**

Run: `pnpm lint`
Expected: no errors (fix any unused-import warnings surfaced from Step 7's cleanup)

- [ ] **Step 10: Commit**

```bash
git add app/admin/items/actions.ts app/admin/items/item-form-parsing.ts lib/catalog-items/core.ts tests/lib/catalog-items/core.test.ts
git commit -m "refactor(catalog-items): extract shared create/update core logic for reuse by the MCP tools"
```

---

## Task 6: Access-token verification

**Files:**
- Create: `lib/mcp/verify-token.ts`
- Test: `tests/lib/mcp/verify-token.test.ts`

**Interfaces:**
- Consumes: `findAccessTokenContext` from `lib/mcp/oauth-store.ts` (Task 3), `hasAdminPermission` from `lib/admin.ts:33`, `MCP_OAUTH_SCOPE` from `lib/mcp/oauth-store.ts`.
- Produces: `verifyAccessToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined>` — used by Task 13 (`app/api/mcp/route.ts`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/mcp/verify-token.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/oauth-store', () => ({
  findAccessTokenContext: vi.fn(),
  MCP_OAUTH_SCOPE: 'catalog:write',
}));
vi.mock('@/lib/admin', () => ({
  hasAdminPermission: vi.fn(),
}));

import { hasAdminPermission } from '@/lib/admin';
import { findAccessTokenContext } from '@/lib/mcp/oauth-store';
import { verifyAccessToken } from '@/lib/mcp/verify-token';

const fakeRequest = new Request('https://example.test/api/mcp');

describe('verifyAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when no bearer token is given', async () => {
    expect(await verifyAccessToken(fakeRequest, undefined)).toBeUndefined();
    expect(findAccessTokenContext).not.toHaveBeenCalled();
  });

  it('returns undefined for an unknown/expired token', async () => {
    vi.mocked(findAccessTokenContext).mockResolvedValue(null);
    expect(await verifyAccessToken(fakeRequest, 'bad-token')).toBeUndefined();
  });

  it('returns undefined when the resolved user is no longer an admin with catalog_manage', async () => {
    vi.mocked(findAccessTokenContext).mockResolvedValue({
      userId: 'user-1',
      clientId: 'client-1',
      scope: 'catalog:write',
    });
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    expect(await verifyAccessToken(fakeRequest, 'good-token')).toBeUndefined();
    expect(hasAdminPermission).toHaveBeenCalledWith('user-1', 'catalog_manage');
  });

  it('returns AuthInfo with the userId for a valid, authorized token', async () => {
    vi.mocked(findAccessTokenContext).mockResolvedValue({
      userId: 'user-1',
      clientId: 'client-1',
      scope: 'catalog:write',
    });
    vi.mocked(hasAdminPermission).mockResolvedValue(true);

    const result = await verifyAccessToken(fakeRequest, 'good-token');

    expect(result).toEqual({
      token: 'good-token',
      clientId: 'client-1',
      scopes: ['catalog:write'],
      extra: { userId: 'user-1' },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lib/mcp/verify-token.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/verify-token'"

- [ ] **Step 3: Implement**

Create `lib/mcp/verify-token.ts`:

```ts
import 'server-only';
import { hasAdminPermission } from '@/lib/admin';
import { findAccessTokenContext } from '@/lib/mcp/oauth-store';

export interface AuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  extra: { userId: string };
}

/**
 * Verifier passed to mcp-handler's withMcpAuth. Re-checks catalog_manage
 * live (not just at token-issuance time) so demoting an admin's role cuts
 * off their connector on the very next call.
 */
export async function verifyAccessToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const context = await findAccessTokenContext(bearerToken);
  if (!context) return undefined;

  const allowed = await hasAdminPermission(context.userId, 'catalog_manage');
  if (!allowed) return undefined;

  return {
    token: bearerToken,
    clientId: context.clientId,
    scopes: context.scope.split(' '),
    extra: { userId: context.userId },
  };
}
```

Note: this defines its own local `AuthInfo` type rather than importing `@modelcontextprotocol/sdk/server/auth/types.js` directly, to keep this module's tests dependency-free. Task 12 (which wires this into `withMcpAuth`) will confirm this shape is structurally compatible with the SDK's own `AuthInfo` type at the point it's actually passed to `withMcpAuth`, adjusting field names there if `pnpm typecheck` reports a mismatch against the installed SDK version.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lib/mcp/verify-token.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/verify-token.ts tests/lib/mcp/verify-token.test.ts
git commit -m "feat(mcp): verify bearer tokens against oauth-store with a live admin-permission check"
```

---

## Task 7: Read-only MCP tool handlers

**Files:**
- Create: `lib/mcp/tools/context.ts`
- Create: `lib/mcp/tools/list-categories.ts`
- Create: `lib/mcp/tools/list-subcategories.ts`
- Create: `lib/mcp/tools/get-catalog-item.ts`
- Test: `tests/lib/mcp/tools/list-categories.test.ts`
- Test: `tests/lib/mcp/tools/list-subcategories.test.ts`
- Test: `tests/lib/mcp/tools/get-catalog-item.test.ts`

**Interfaces:**
- Consumes: `hasAdminPermission` from `lib/admin.ts`, `getServiceSupabase` from `lib/supabase/server.ts`.
- Produces: `requireAuthedUserId(extra)`, `listCategoriesInputShape`/`handleListCategories(userId)`, `listSubcategoriesInputShape`/`handleListSubcategories(input, userId)`, `getCatalogItemInputShape`/`handleGetCatalogItem(input, userId)` — used by Task 12.

- [ ] **Step 1: Implement the shared auth-context helper (no test — trivial structural unwrap covered indirectly by every tool test below)**

Create `lib/mcp/tools/context.ts`:

```ts
export interface McpToolExtra {
  authInfo?: {
    extra?: Record<string, unknown>;
  };
}

/** Reads the admin's user id off the verified token's AuthInfo, threaded in by verifyAccessToken (lib/mcp/verify-token.ts). */
export function requireAuthedUserId(extra: McpToolExtra): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string' || !userId) {
    throw new Error('Missing authenticated user context.');
  }
  return userId;
}
```

- [ ] **Step 2: Write the failing test for `list-categories`**

Create `tests/lib/mcp/tools/list-categories.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import { handleListCategories } from '@/lib/mcp/tools/list-categories';

describe('handleListCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the user is not an admin with catalog_manage', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleListCategories('user-1')).rejects.toThrow(/not authorized/i);
  });

  it('returns active categories ordered by sort_order', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              returns: async () => ({
                data: [{ id: 'cat-1', name: 'Toys', slug: 'toys' }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await handleListCategories('user-1');

    expect(result).toEqual([{ id: 'cat-1', name: 'Toys', slug: 'toys' }]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run tests/lib/mcp/tools/list-categories.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/tools/list-categories'"

- [ ] **Step 4: Implement `list-categories.ts`**

```ts
import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';

export const listCategoriesInputShape = {};

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export async function handleListCategories(userId: string): Promise<CategorySummary[]> {
  const allowed = await hasAdminPermission(userId, 'catalog_manage');
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const { data, error } = await getServiceSupabase()
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<CategorySummary[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run tests/lib/mcp/tools/list-categories.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for `list-subcategories`**

Create `tests/lib/mcp/tools/list-subcategories.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import { handleListSubcategories } from '@/lib/mcp/tools/list-subcategories';

describe('handleListSubcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(
      handleListSubcategories({ categoryId: '00000000-0000-0000-0000-000000000001' }, 'user-1'),
    ).rejects.toThrow(/not authorized/i);
  });

  it('returns active subcategories for the given category', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                returns: async () => ({
                  data: [{ id: 'sub-1', name: 'Puzzles', slug: 'puzzles' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await handleListSubcategories(
      { categoryId: '00000000-0000-0000-0000-000000000001' },
      'user-1',
    );

    expect(result).toEqual([{ id: 'sub-1', name: 'Puzzles', slug: 'puzzles' }]);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `pnpm vitest run tests/lib/mcp/tools/list-subcategories.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/tools/list-subcategories'"

- [ ] **Step 8: Implement `list-subcategories.ts`**

```ts
import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import type { CategorySummary } from '@/lib/mcp/tools/list-categories';

export const listSubcategoriesInputShape = {
  categoryId: z.string().uuid().describe('A category id from list_categories.'),
};

const listSubcategoriesInputSchema = z.object(listSubcategoriesInputShape);

export async function handleListSubcategories(
  rawInput: unknown,
  userId: string,
): Promise<CategorySummary[]> {
  const input = listSubcategoriesInputSchema.parse(rawInput);

  const allowed = await hasAdminPermission(userId, 'catalog_manage');
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const { data, error } = await getServiceSupabase()
    .from('subcategories')
    .select('id, name, slug')
    .eq('category_id', input.categoryId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<CategorySummary[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `pnpm vitest run tests/lib/mcp/tools/list-subcategories.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 10: Write the failing test for `get-catalog-item`**

Create `tests/lib/mcp/tools/get-catalog-item.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import { handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';

const ITEM_ID = '00000000-0000-0000-0000-0000000000aa';

describe('handleGetCatalogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleGetCatalogItem({ id: ITEM_ID }, 'user-1')).rejects.toThrow(/not authorized/i);
  });

  it('throws a not-found error when the item does not exist', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    } as never);

    await expect(handleGetCatalogItem({ id: ITEM_ID }, 'user-1')).rejects.toThrow(/not found/i);
  });

  it('returns the item when found', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    const row = {
      id: ITEM_ID,
      title: 'Test',
      slug: 'test',
      status: 'draft',
      price_cents: 1000,
      description: 'desc',
      category_id: 'cat-1',
      subcategory_id: null,
      thumbnail_path: 'a/b.jpg',
      manufacturing_notes: null,
      characteristics: null,
    };
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      }),
    } as never);

    const result = await handleGetCatalogItem({ id: ITEM_ID }, 'user-1');

    expect(result).toEqual(row);
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `pnpm vitest run tests/lib/mcp/tools/get-catalog-item.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/tools/get-catalog-item'"

- [ ] **Step 12: Implement `get-catalog-item.ts`**

```ts
import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';

export const getCatalogItemInputShape = {
  id: z.string().uuid().describe('The catalog item id returned by create_catalog_item.'),
};

const getCatalogItemInputSchema = z.object(getCatalogItemInputShape);

const CATALOG_ITEM_COLUMNS =
  'id, title, slug, status, price_cents, description, category_id, subcategory_id, thumbnail_path, manufacturing_notes, characteristics';

export interface CatalogItemSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  price_cents: number;
  description: string | null;
  category_id: string;
  subcategory_id: string | null;
  thumbnail_path: string | null;
  manufacturing_notes: string | null;
  characteristics: string | null;
}

export async function handleGetCatalogItem(rawInput: unknown, userId: string): Promise<CatalogItemSummary> {
  const input = getCatalogItemInputSchema.parse(rawInput);

  const allowed = await hasAdminPermission(userId, 'catalog_manage');
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const { data, error } = await getServiceSupabase()
    .from('catalog_items')
    .select(CATALOG_ITEM_COLUMNS)
    .eq('id', input.id)
    .maybeSingle<CatalogItemSummary>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Catalog item ${input.id} not found.`);
  return data;
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `pnpm vitest run tests/lib/mcp/tools/get-catalog-item.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 14: Commit**

```bash
git add lib/mcp/tools/context.ts lib/mcp/tools/list-categories.ts lib/mcp/tools/list-subcategories.ts lib/mcp/tools/get-catalog-item.ts tests/lib/mcp/tools/
git commit -m "feat(mcp): add read-only category and catalog-item lookup tools"
```

---

## Task 8: `create_catalog_item` tool handler

**Files:**
- Create: `lib/mcp/tools/create-catalog-item.ts`
- Test: `tests/lib/mcp/tools/create-catalog-item.test.ts`

**Interfaces:**
- Consumes: `hasAdminPermission` (`lib/admin.ts`), `fetchAndStoreCatalogImage` (Task 4), `createCatalogItemCore` (Task 5), `ensureCatalogSlugIsAvailable` / `itemSchema` (`app/admin/items/item-form-parsing.ts`), `slugify` (`lib/utils.ts:22`), `getServiceSupabase` (`lib/supabase/server.ts`), `getServerEnv` (`lib/env.ts`).
- Produces: `createCatalogItemInputShape`, `handleCreateCatalogItem(rawInput, userId): Promise<{ id: string; slug: string; adminUrl: string }>` — used by Task 12.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/mcp/tools/create-catalog-item.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn(() => ({})) }));
vi.mock('@/lib/catalog-items/upload-from-url', () => ({ fetchAndStoreCatalogImage: vi.fn() }));
vi.mock('@/lib/catalog-items/core', () => ({ createCatalogItemCore: vi.fn() }));
vi.mock('@/app/admin/items/item-form-parsing', () => ({ ensureCatalogSlugIsAvailable: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { ensureCatalogSlugIsAvailable } from '@/app/admin/items/item-form-parsing';
import { createCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { handleCreateCatalogItem } from '@/lib/mcp/tools/create-catalog-item';

const VALID_INPUT = {
  title: 'Wooden Puzzle',
  description: 'A laser-cut wooden puzzle for kids.',
  imageUrl: 'https://example.test/puzzle.jpg',
  priceCents: 5000,
  categoryId: '00000000-0000-0000-0000-000000000001',
  seo: { en: { seoTitle: 'Wooden Puzzle' }, ru: {}, am: {} },
};

describe('handleCreateCatalogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed input before checking permission', async () => {
    await expect(handleCreateCatalogItem({ title: '' }, 'user-1')).rejects.toThrow();
    expect(hasAdminPermission).not.toHaveBeenCalled();
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleCreateCatalogItem(VALID_INPUT, 'user-1')).rejects.toThrow(/not authorized/i);
    expect(fetchAndStoreCatalogImage).not.toHaveBeenCalled();
  });

  it('fetches the image, resolves a unique slug, creates the item as a draft, and returns its id/slug/adminUrl', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(fetchAndStoreCatalogImage).mockResolvedValue('user-1/mcp-images/abc.jpg');
    vi.mocked(ensureCatalogSlugIsAvailable).mockResolvedValue(true);
    vi.mocked(createCatalogItemCore).mockResolvedValue({ id: 'item-1', slug: 'wooden-puzzle' });

    const result = await handleCreateCatalogItem(VALID_INPUT, 'user-1');

    expect(fetchAndStoreCatalogImage).toHaveBeenCalledWith(expect.anything(), 'user-1', VALID_INPUT.imageUrl);
    expect(createCatalogItemCore).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'user-1' },
      expect.objectContaining({
        title: 'Wooden Puzzle',
        slug: 'wooden-puzzle',
        status: 'draft',
        priceCents: 5000,
        categoryId: VALID_INPUT.categoryId,
        seo: expect.objectContaining({ en: expect.objectContaining({ seoTitle: 'Wooden Puzzle' }) }),
      }),
      'user-1/mcp-images/abc.jpg',
    );
    expect(result).toEqual({
      id: 'item-1',
      slug: 'wooden-puzzle',
      adminUrl: expect.stringContaining('/admin/items/item-1'),
    });
  });

  it('appends a random suffix to the slug when the slugified title is taken', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(fetchAndStoreCatalogImage).mockResolvedValue('user-1/mcp-images/abc.jpg');
    vi.mocked(ensureCatalogSlugIsAvailable).mockResolvedValue(false);
    vi.mocked(createCatalogItemCore).mockResolvedValue({ id: 'item-1', slug: 'wooden-puzzle-abcd1234' });

    await handleCreateCatalogItem(VALID_INPUT, 'user-1');

    const [, , itemArg] = vi.mocked(createCatalogItemCore).mock.calls[0];
    expect(itemArg.slug).toMatch(/^wooden-puzzle-[a-f0-9]{8}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lib/mcp/tools/create-catalog-item.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/tools/create-catalog-item'"

- [ ] **Step 3: Implement**

Create `lib/mcp/tools/create-catalog-item.ts`:

```ts
import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import { ensureCatalogSlugIsAvailable, type itemSchema } from '@/app/admin/items/item-form-parsing';
import { createCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { getServerEnv } from '@/lib/env';
import { getServiceSupabase } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

const seoLocaleInputShape = {
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
  seoKeywords: z.string().trim().optional(),
  ogTitle: z.string().trim().max(90).optional(),
  ogDescription: z.string().trim().max(220).optional(),
};

export const createCatalogItemInputShape = {
  title: z.string().trim().min(1).describe('Short marketing product title. Write this yourself.'),
  description: z.string().trim().min(1).describe("The admin's source brief for the item."),
  imageUrl: z
    .string()
    .url()
    .describe('URL of a product photo. The server downloads and stores it as the thumbnail.'),
  priceCents: z.number().int().min(0).describe('Price in the smallest currency unit.'),
  categoryId: z.string().uuid().describe('A category id from list_categories.'),
  subcategoryId: z.string().uuid().optional().describe('A subcategory id from list_subcategories, if applicable.'),
  manufacturingNotes: z
    .string()
    .trim()
    .optional()
    .describe('Production-facing notes: materials, assembly, finish. Write this yourself.'),
  characteristics: z
    .string()
    .trim()
    .optional()
    .describe('Admin-only technical specs. Write this yourself.'),
  seo: z.object({
    en: z.object(seoLocaleInputShape).describe('English SEO metadata. Write this yourself.'),
    ru: z.object(seoLocaleInputShape).describe('Russian SEO metadata, adapted (not transliterated). Write this yourself.'),
    am: z.object(seoLocaleInputShape).describe('Armenian SEO metadata, adapted (not transliterated). Write this yourself.'),
  }),
};

const createCatalogItemInputSchema = z.object(createCatalogItemInputShape);

export interface CreateCatalogItemToolResult {
  id: string;
  slug: string;
  adminUrl: string;
}

export async function handleCreateCatalogItem(
  rawInput: unknown,
  userId: string,
): Promise<CreateCatalogItemToolResult> {
  const input = createCatalogItemInputSchema.parse(rawInput);

  const allowed = await hasAdminPermission(userId, 'catalog_manage');
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const supabase = getServiceSupabase();
  const thumbnailPath = await fetchAndStoreCatalogImage(supabase, userId, input.imageUrl);

  let slug = slugify(input.title);
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, slug);
  if (!slugAvailable) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

  const item: z.infer<typeof itemSchema> = {
    title: input.title,
    slug,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId ?? '',
    itemType: 'standard',
    description: input.description,
    priceCents: input.priceCents,
    status: 'draft',
    isPopular: false,
    isCustomizable: false,
    thumbnailPath: undefined,
    manufacturingNotes: input.manufacturingNotes,
    sizesJson: undefined,
    characteristics: input.characteristics,
    systemPrompt: undefined,
    skillId: undefined,
    tags: [],
    boilerplateIds: [],
    laserContourEnabled: false,
    laserSolidEnabled: false,
    laserSolidPriceCents: undefined,
    laserSolidPrompt: undefined,
    seo: {
      en: { ...input.seo.en, socialImagePath: undefined },
      ru: { ...input.seo.ru, socialImagePath: undefined },
      am: { ...input.seo.am, socialImagePath: undefined },
    },
  };

  const created = await createCatalogItemCore(supabase, { id: userId }, item, thumbnailPath);

  return {
    id: created.id,
    slug: created.slug,
    adminUrl: `${getServerEnv().NEXT_PUBLIC_SITE_URL}/admin/items/${created.id}`,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lib/mcp/tools/create-catalog-item.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/tools/create-catalog-item.ts tests/lib/mcp/tools/create-catalog-item.test.ts
git commit -m "feat(mcp): add the create_catalog_item tool handler"
```

---

## Task 9: `update_catalog_item` tool handler

**Files:**
- Create: `lib/mcp/tools/update-catalog-item.ts`
- Test: `tests/lib/mcp/tools/update-catalog-item.test.ts`

**Interfaces:**
- Consumes: `handleGetCatalogItem`/`CatalogItemSummary` (Task 7), `hasAdminPermission`, `fetchAndStoreCatalogImage` (Task 4), `updateCatalogItemCore` (Task 5), `itemSchema` shape, `getServiceSupabase`.
- Produces: `updateCatalogItemInputShape`, `handleUpdateCatalogItem(rawInput, userId): Promise<{ id: string }>` — used by Task 12.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/mcp/tools/update-catalog-item.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn(() => ({})) }));
vi.mock('@/lib/catalog-items/upload-from-url', () => ({ fetchAndStoreCatalogImage: vi.fn() }));
vi.mock('@/lib/catalog-items/core', () => ({ updateCatalogItemCore: vi.fn() }));
vi.mock('@/lib/mcp/tools/get-catalog-item', () => ({ handleGetCatalogItem: vi.fn() }));

import { hasAdminPermission } from '@/lib/admin';
import { updateCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';
import { handleUpdateCatalogItem } from '@/lib/mcp/tools/update-catalog-item';

const ITEM_ID = '00000000-0000-0000-0000-0000000000aa';
const EXISTING = {
  id: ITEM_ID,
  title: 'Old Title',
  slug: 'old-title',
  status: 'draft',
  price_cents: 1000,
  description: 'old desc',
  category_id: 'cat-1',
  subcategory_id: null,
  thumbnail_path: 'old/path.jpg',
  manufacturing_notes: null,
  characteristics: null,
};

describe('handleUpdateCatalogItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleGetCatalogItem).mockResolvedValue(EXISTING);
  });

  it('throws when the user is not authorized', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    await expect(handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1')).rejects.toThrow(
      /not authorized/i,
    );
  });

  it('merges a partial patch onto the existing item and keeps the existing thumbnail when imageUrl is omitted', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);

    await handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 2000 }, 'user-1');

    expect(fetchAndStoreCatalogImage).not.toHaveBeenCalled();
    expect(updateCatalogItemCore).toHaveBeenCalledWith(
      expect.anything(),
      ITEM_ID,
      { id: 'user-1' },
      expect.objectContaining({ title: 'Old Title', priceCents: 2000, description: 'old desc' }),
      'old/path.jpg',
    );
  });

  it('re-fetches the thumbnail when imageUrl is given', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(fetchAndStoreCatalogImage).mockResolvedValue('user-1/mcp-images/new.jpg');
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);

    await handleUpdateCatalogItem({ id: ITEM_ID, imageUrl: 'https://example.test/new.jpg' }, 'user-1');

    expect(fetchAndStoreCatalogImage).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'https://example.test/new.jpg',
    );
    const [, , , , thumbnailArg] = vi.mocked(updateCatalogItemCore).mock.calls[0];
    expect(thumbnailArg).toBe('user-1/mcp-images/new.jpg');
  });

  it('returns the item id', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    vi.mocked(updateCatalogItemCore).mockResolvedValue(undefined);
    const result = await handleUpdateCatalogItem({ id: ITEM_ID, priceCents: 3000 }, 'user-1');
    expect(result).toEqual({ id: ITEM_ID });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/lib/mcp/tools/update-catalog-item.test.ts`
Expected: FAIL with "Cannot find module '@/lib/mcp/tools/update-catalog-item'"

- [ ] **Step 3: Implement**

Create `lib/mcp/tools/update-catalog-item.ts`:

```ts
import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import type { itemSchema } from '@/app/admin/items/item-form-parsing';
import { updateCatalogItemCore } from '@/lib/catalog-items/core';
import { fetchAndStoreCatalogImage } from '@/lib/catalog-items/upload-from-url';
import { handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';
import { getServiceSupabase } from '@/lib/supabase/server';

const seoLocaleInputShape = {
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
  seoKeywords: z.string().trim().optional(),
  ogTitle: z.string().trim().max(90).optional(),
  ogDescription: z.string().trim().max(220).optional(),
};

export const updateCatalogItemInputShape = {
  id: z.string().uuid().describe('The catalog item id returned by create_catalog_item.'),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  imageUrl: z.string().url().optional().describe('If given, replaces the thumbnail.'),
  priceCents: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  manufacturingNotes: z.string().trim().optional(),
  characteristics: z.string().trim().optional(),
  seo: z
    .object({
      en: z.object(seoLocaleInputShape),
      ru: z.object(seoLocaleInputShape),
      am: z.object(seoLocaleInputShape),
    })
    .optional(),
};

const updateCatalogItemInputSchema = z.object(updateCatalogItemInputShape);

export async function handleUpdateCatalogItem(
  rawInput: unknown,
  userId: string,
): Promise<{ id: string }> {
  const input = updateCatalogItemInputSchema.parse(rawInput);

  const allowed = await hasAdminPermission(userId, 'catalog_manage');
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const existing = await handleGetCatalogItem({ id: input.id }, userId);
  const supabase = getServiceSupabase();

  const thumbnailPath = input.imageUrl
    ? await fetchAndStoreCatalogImage(supabase, userId, input.imageUrl)
    : existing.thumbnail_path;

  const item: z.infer<typeof itemSchema> = {
    title: input.title ?? existing.title,
    slug: existing.slug,
    categoryId: input.categoryId ?? existing.category_id,
    subcategoryId: input.subcategoryId ?? existing.subcategory_id ?? '',
    itemType: 'standard',
    description: input.description ?? existing.description ?? undefined,
    priceCents: input.priceCents ?? existing.price_cents,
    status: existing.status as z.infer<typeof itemSchema>['status'],
    isPopular: false,
    isCustomizable: false,
    thumbnailPath: thumbnailPath ?? undefined,
    manufacturingNotes: input.manufacturingNotes ?? existing.manufacturing_notes ?? undefined,
    sizesJson: undefined,
    characteristics: input.characteristics ?? existing.characteristics ?? undefined,
    systemPrompt: undefined,
    skillId: undefined,
    tags: [],
    boilerplateIds: [],
    laserContourEnabled: false,
    laserSolidEnabled: false,
    laserSolidPriceCents: undefined,
    laserSolidPrompt: undefined,
    seo: {
      en: { ...(input.seo?.en ?? {}), socialImagePath: undefined },
      ru: { ...(input.seo?.ru ?? {}), socialImagePath: undefined },
      am: { ...(input.seo?.am ?? {}), socialImagePath: undefined },
    },
  };

  await updateCatalogItemCore(supabase, input.id, { id: userId }, item, thumbnailPath);

  return { id: input.id };
}
```

Note: this only carries forward SEO fields the caller sends in this call (an omitted `seo` patch clears previously-set SEO fields back to unset, since `updateCatalogItemCore` → `upsertSeoMetadata` fully replaces each locale's row). This matches the "conversational correction" scope from the design spec (fix one field, like price) — for now, an update call that also wants to preserve existing SEO copy must resend it. Acceptable for v1; call out as a known limitation, not a bug, if raised in review.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/lib/mcp/tools/update-catalog-item.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/tools/update-catalog-item.ts tests/lib/mcp/tools/update-catalog-item.test.ts
git commit -m "feat(mcp): add the update_catalog_item tool handler"
```

---

## Task 10: Dynamic Client Registration and token endpoints

**Files:**
- Modify: `package.json` (add `mcp-handler` and `@modelcontextprotocol/sdk`)
- Create: `app/api/mcp/register/route.ts`
- Create: `app/api/mcp/token/route.ts`
- Test: `tests/app/api/mcp/register.test.ts`
- Test: `tests/app/api/mcp/token.test.ts`

**Interfaces:**
- Consumes: `registerOauthClient`, `getOauthClient`, `consumeAuthorizationCode`, `issueTokenPair`, `rotateRefreshToken`, `MCP_OAUTH_SCOPE` (Task 3); `verifyPkceChallenge` (Task 2).
- Produces: `POST /api/mcp/register`, `POST /api/mcp/token` route handlers.

- [ ] **Step 1: Add dependencies**

Run: `pnpm add mcp-handler@1.1.0 @modelcontextprotocol/sdk@1.29.0`
Expected: `package.json` gains both under `"dependencies"`, lockfile updates.

- [ ] **Step 2: Write the failing test for `/register`**

Create `tests/app/api/mcp/register.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/oauth-store', () => ({ registerOauthClient: vi.fn() }));

import { registerOauthClient } from '@/lib/mcp/oauth-store';
import { POST } from '@/app/api/mcp/register/route';

describe('POST /api/mcp/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request with no redirect_uris', async () => {
    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({ client_name: 'Claude' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects an insecure redirect_uri', async () => {
    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({ client_name: 'Claude', redirect_uris: ['http://claude.ai/callback'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('registers a public client and returns the DCR response shape', async () => {
    vi.mocked(registerOauthClient).mockResolvedValue({
      clientId: 'client-1',
      clientName: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    });

    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Claude',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({
      client_id: 'client-1',
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  });

  it('allows an http loopback redirect_uri for native clients', async () => {
    vi.mocked(registerOauthClient).mockResolvedValue({
      clientId: 'client-2',
      clientName: 'Claude Code',
      redirectUris: ['http://127.0.0.1:9876/callback'],
    });
    const req = new Request('https://example.test/api/mcp/register', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Claude Code',
        redirect_uris: ['http://127.0.0.1:9876/callback'],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run tests/app/api/mcp/register.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/mcp/register/route'"

- [ ] **Step 4: Implement `/api/mcp/register`**

Create `app/api/mcp/register/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerOauthClient } from '@/lib/mcp/oauth-store';

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'https:') return true;
    // Native/loopback clients (e.g. Claude Code) redirect to localhost over http.
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

const registerRequestSchema = z.object({
  client_name: z.string().trim().min(1),
  redirect_uris: z.array(z.string()).min(1).refine((uris) => uris.every(isAllowedRedirectUri), {
    message: 'redirect_uris must be https, or http on localhost/127.0.0.1.',
  }),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const client = await registerOauthClient({
    clientName: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
  });

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    { status: 201 },
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run tests/app/api/mcp/register.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write the failing test for `/token`**

Create `tests/app/api/mcp/token.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/oauth-store', () => ({
  consumeAuthorizationCode: vi.fn(),
  issueTokenPair: vi.fn(),
  rotateRefreshToken: vi.fn(),
  MCP_OAUTH_SCOPE: 'catalog:write',
}));
vi.mock('@/lib/mcp/oauth-crypto', () => ({ verifyPkceChallenge: vi.fn() }));

import { verifyPkceChallenge } from '@/lib/mcp/oauth-crypto';
import { consumeAuthorizationCode, issueTokenPair, rotateRefreshToken } from '@/lib/mcp/oauth-store';
import { POST } from '@/app/api/mcp/token/route';

function formRequest(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new Request('https://example.test/api/mcp/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

describe('POST /api/mcp/token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown grant_type', async () => {
    const res = await POST(formRequest({ grant_type: 'password' }));
    expect(res.status).toBe(400);
  });

  it('exchanges a valid authorization_code + PKCE verifier for a token pair', async () => {
    vi.mocked(consumeAuthorizationCode).mockResolvedValue({
      userId: 'user-1',
      scope: 'catalog:write',
      codeChallenge: 'challenge-abc',
    });
    vi.mocked(verifyPkceChallenge).mockReturnValue(true);
    vi.mocked(issueTokenPair).mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresIn: 3600,
    });

    const res = await POST(
      formRequest({
        grant_type: 'authorization_code',
        code: 'code-1',
        redirect_uri: 'https://claude.ai/callback',
        client_id: 'client-1',
        code_verifier: 'verifier-1',
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      access_token: 'access-1',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-1',
      scope: 'catalog:write',
    });
  });

  it('rejects an authorization_code exchange with a bad PKCE verifier', async () => {
    vi.mocked(consumeAuthorizationCode).mockResolvedValue({
      userId: 'user-1',
      scope: 'catalog:write',
      codeChallenge: 'challenge-abc',
    });
    vi.mocked(verifyPkceChallenge).mockReturnValue(false);

    const res = await POST(
      formRequest({
        grant_type: 'authorization_code',
        code: 'code-1',
        redirect_uri: 'https://claude.ai/callback',
        client_id: 'client-1',
        code_verifier: 'wrong-verifier',
      }),
    );

    expect(res.status).toBe(400);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects an authorization_code exchange for an unknown/expired code', async () => {
    vi.mocked(consumeAuthorizationCode).mockResolvedValue(null);

    const res = await POST(
      formRequest({
        grant_type: 'authorization_code',
        code: 'bad-code',
        redirect_uri: 'https://claude.ai/callback',
        client_id: 'client-1',
        code_verifier: 'verifier-1',
      }),
    );

    expect(res.status).toBe(400);
  });

  it('exchanges a valid refresh_token for a new pair', async () => {
    vi.mocked(rotateRefreshToken).mockResolvedValue({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresIn: 3600,
      userId: 'user-1',
      scope: 'catalog:write',
      clientId: 'client-1',
    });

    const res = await POST(formRequest({ grant_type: 'refresh_token', refresh_token: 'refresh-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.access_token).toBe('access-2');
    expect(body.refresh_token).toBe('refresh-2');
  });

  it('rejects an unknown/expired refresh_token', async () => {
    vi.mocked(rotateRefreshToken).mockResolvedValue(null);
    const res = await POST(formRequest({ grant_type: 'refresh_token', refresh_token: 'bad' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `pnpm vitest run tests/app/api/mcp/token.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/mcp/token/route'"

- [ ] **Step 8: Implement `/api/mcp/token`**

Create `app/api/mcp/token/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { verifyPkceChallenge } from '@/lib/mcp/oauth-crypto';
import { consumeAuthorizationCode, issueTokenPair, rotateRefreshToken } from '@/lib/mcp/oauth-store';

function tokenResponse(pair: { accessToken: string; refreshToken: string; expiresIn: number }, scope: string) {
  return NextResponse.json({
    access_token: pair.accessToken,
    token_type: 'Bearer',
    expires_in: pair.expiresIn,
    refresh_token: pair.refreshToken,
    scope,
  });
}

function errorResponse(error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const grantType = String(form.get('grant_type') ?? '');

  if (grantType === 'authorization_code') {
    const code = String(form.get('code') ?? '');
    const redirectUri = String(form.get('redirect_uri') ?? '');
    const clientId = String(form.get('client_id') ?? '');
    const codeVerifier = String(form.get('code_verifier') ?? '');

    const consumed = await consumeAuthorizationCode({ code, clientId, redirectUri });
    if (!consumed) return errorResponse('invalid_grant', 'Unknown, expired, or already-used code.');
    if (!verifyPkceChallenge(codeVerifier, consumed.codeChallenge)) {
      return errorResponse('invalid_grant', 'PKCE verification failed.');
    }

    const pair = await issueTokenPair({ clientId, userId: consumed.userId, scope: consumed.scope });
    return tokenResponse(pair, consumed.scope);
  }

  if (grantType === 'refresh_token') {
    const refreshToken = String(form.get('refresh_token') ?? '');
    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) return errorResponse('invalid_grant', 'Unknown, expired, or revoked refresh token.');
    return tokenResponse(rotated, rotated.scope);
  }

  return errorResponse('unsupported_grant_type', `Unsupported grant_type: ${grantType}`);
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm vitest run tests/app/api/mcp/token.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-lock.yaml app/api/mcp/register app/api/mcp/token tests/app/api/mcp/register.test.ts tests/app/api/mcp/token.test.ts
git commit -m "feat(mcp): add dynamic client registration and token endpoints"
```

---

## Task 11: Authorize endpoint (login + consent)

**Files:**
- Create: `app/api/mcp/authorize/route.ts`
- Test: `tests/app/api/mcp/authorize.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (`lib/supabase/server.ts`), `hasAdminPermission` (`lib/admin.ts`), `getOauthClient`, `createAuthorizationCode` (Task 3), `getServerEnv` (`lib/env.ts`).
- Produces: `GET /api/mcp/authorize`, `POST /api/mcp/authorize`.

- [ ] **Step 1: Write the failing tests**

Create `tests/app/api/mcp/authorize.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/admin', () => ({ hasAdminPermission: vi.fn() }));
vi.mock('@/lib/mcp/oauth-store', () => ({
  getOauthClient: vi.fn(),
  createAuthorizationCode: vi.fn(),
  MCP_OAUTH_SCOPE: 'catalog:write',
}));

import { hasAdminPermission } from '@/lib/admin';
import { createAuthorizationCode, getOauthClient } from '@/lib/mcp/oauth-store';
import { getCurrentUser } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/mcp/authorize/route';

const CLIENT = {
  clientId: 'client-1',
  clientName: 'Claude',
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
};

function authorizeUrl(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'client-1',
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: 'challenge-abc',
    code_challenge_method: 'S256',
    state: 'state-abc',
    scope: 'catalog:write',
    ...overrides,
  });
  return `https://uniqraft.test/api/mcp/authorize?${params.toString()}`;
}

describe('GET /api/mcp/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOauthClient).mockResolvedValue(CLIENT);
  });

  it('rejects an unknown client_id', async () => {
    vi.mocked(getOauthClient).mockResolvedValue(null);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(400);
  });

  it('rejects a redirect_uri not registered for the client', async () => {
    const res = await GET(new Request(authorizeUrl({ redirect_uri: 'https://evil.test/callback' })));
    expect(res.status).toBe(400);
  });

  it('redirects to login when no user is signed in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?next=');
  });

  it('returns a plain not-authorized response for a non-admin user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(403);
  });

  it('shows a consent screen (200 html) for an authorized admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
    const res = await GET(new Request(authorizeUrl()));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Claude');
  });
});

describe('POST /api/mcp/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOauthClient).mockResolvedValue(CLIENT);
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(hasAdminPermission).mockResolvedValue(true);
  });

  function approvalForm(decision: 'approve' | 'deny') {
    const body = new URLSearchParams({
      decision,
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: 'challenge-abc',
      code_challenge_method: 'S256',
      state: 'state-abc',
      scope: 'catalog:write',
    });
    return new Request('https://uniqraft.test/api/mcp/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  it('mints a code and redirects back with it on approval', async () => {
    vi.mocked(createAuthorizationCode).mockResolvedValue('code-xyz');

    const res = await POST(approvalForm('approve'));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.origin + location.pathname).toBe('https://claude.ai/api/mcp/auth_callback');
    expect(location.searchParams.get('code')).toBe('code-xyz');
    expect(location.searchParams.get('state')).toBe('state-abc');
  });

  it('redirects back with access_denied on denial, without minting a code', async () => {
    const res = await POST(approvalForm('deny'));

    expect(createAuthorizationCode).not.toHaveBeenCalled();
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('state')).toBe('state-abc');
  });

  it('returns 403 instead of redirecting if the user is no longer an admin', async () => {
    vi.mocked(hasAdminPermission).mockResolvedValue(false);
    const res = await POST(approvalForm('approve'));
    expect(res.status).toBe(403);
    expect(createAuthorizationCode).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/app/api/mcp/authorize.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/mcp/authorize/route'"

- [ ] **Step 3: Implement**

Create `app/api/mcp/authorize/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { hasAdminPermission } from '@/lib/admin';
import { createAuthorizationCode, getOauthClient } from '@/lib/mcp/oauth-store';
import { getCurrentUser } from '@/lib/supabase/server';

interface AuthorizeParams {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
}

function readParams(source: URLSearchParams): AuthorizeParams {
  return {
    responseType: source.get('response_type') ?? '',
    clientId: source.get('client_id') ?? '',
    redirectUri: source.get('redirect_uri') ?? '',
    codeChallenge: source.get('code_challenge') ?? '',
    codeChallengeMethod: source.get('code_challenge_method') ?? '',
    state: source.get('state') ?? '',
    scope: source.get('scope') ?? '',
  };
}

function badRequest(message: string) {
  return NextResponse.json({ error: 'invalid_request', error_description: message }, { status: 400 });
}

function notAuthorizedResponse() {
  return new Response(
    '<!doctype html><html><body><h1>Not authorized</h1><p>Your Uniqraft account does not have catalog management access.</p></body></html>',
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function consentHtml(clientName: string, params: AuthorizeParams) {
  const hiddenFields = Object.entries({
    response_type: params.responseType,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    state: params.state,
    scope: params.scope,
  })
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join('\n');

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Connect ${escapeHtml(clientName)} to Uniqraft</title></head>
<body style="font-family: sans-serif; max-width: 32rem; margin: 4rem auto;">
  <h1>Connect ${escapeHtml(clientName)}</h1>
  <p><strong>${escapeHtml(clientName)}</strong> wants to create and edit catalog items as you.</p>
  <form method="POST">
    ${hiddenFields}
    <button type="submit" name="decision" value="approve">Allow</button>
    <button type="submit" name="decision" value="deny">Deny</button>
  </form>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

async function resolveAuthorizedUser(request: Request): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(request.url);
    return { ok: false, response: NextResponse.redirect(new URL(`/login?next=${next}`, request.url)) };
  }
  const allowed = await hasAdminPermission(user.id, 'catalog_manage');
  if (!allowed) return { ok: false, response: notAuthorizedResponse() };
  return { ok: true, userId: user.id };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = readParams(url.searchParams);

  if (params.responseType !== 'code') return badRequest('response_type must be "code".');
  if (params.codeChallengeMethod !== 'S256') return badRequest('code_challenge_method must be "S256".');

  const client = await getOauthClient(params.clientId);
  if (!client) return badRequest('Unknown client_id.');
  if (!client.redirectUris.includes(params.redirectUri)) {
    return badRequest('redirect_uri is not registered for this client.');
  }

  const resolved = await resolveAuthorizedUser(request);
  if (!resolved.ok) return resolved.response;

  return new Response(consentHtml(client.clientName, params), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = readParams(new URLSearchParams(form as unknown as Record<string, string>));
  const decision = String(form.get('decision') ?? '');

  const client = await getOauthClient(params.clientId);
  if (!client || !client.redirectUris.includes(params.redirectUri)) {
    return badRequest('Unknown client or redirect_uri.');
  }

  const resolved = await resolveAuthorizedUser(request);
  if (!resolved.ok) return resolved.response;

  const redirectUrl = new URL(params.redirectUri);
  if (decision !== 'approve') {
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('state', params.state);
    return NextResponse.redirect(redirectUrl);
  }

  const code = await createAuthorizationCode({
    clientId: params.clientId,
    userId: resolved.userId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scope: params.scope,
  });

  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', params.state);
  return NextResponse.redirect(redirectUrl);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/app/api/mcp/authorize.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors (if `new URLSearchParams(form as unknown as Record<string, string>)` reports a type error, replace it with an explicit loop building a `URLSearchParams` from `form.entries()` instead — the test suite already exercises this path so a fix here is verified by rerunning Step 4).

- [ ] **Step 6: Commit**

```bash
git add app/api/mcp/authorize tests/app/api/mcp/authorize.test.ts
git commit -m "feat(mcp): add the authorize endpoint (login redirect, consent screen, code minting)"
```

---

## Task 12: Resource server route and metadata endpoints

**Files:**
- Create: `app/api/mcp/route.ts`
- Create: `app/.well-known/oauth-protected-resource/route.ts`
- Create: `app/.well-known/oauth-authorization-server/route.ts`
- Test: `tests/app/api/mcp/well-known.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` (Task 6), `MCP_OAUTH_SCOPE` (Task 3), all 5 tool handlers + input shapes (Tasks 7–9), `getServerEnv` (`lib/env.ts`).
- Produces: `GET/POST /api/mcp`, `GET /.well-known/oauth-protected-resource`, `GET /.well-known/oauth-authorization-server`.

- [ ] **Step 1: Implement the resource server route**

Create `app/api/mcp/route.ts`:

```ts
export const runtime = 'nodejs';

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { createCatalogItemInputShape, handleCreateCatalogItem } from '@/lib/mcp/tools/create-catalog-item';
import { getCatalogItemInputShape, handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';
import { handleListCategories, listCategoriesInputShape } from '@/lib/mcp/tools/list-categories';
import {
  handleListSubcategories,
  listSubcategoriesInputShape,
} from '@/lib/mcp/tools/list-subcategories';
import { handleUpdateCatalogItem, updateCatalogItemInputShape } from '@/lib/mcp/tools/update-catalog-item';
import { requireAuthedUserId } from '@/lib/mcp/tools/context';
import { MCP_OAUTH_SCOPE } from '@/lib/mcp/oauth-store';
import { verifyAccessToken } from '@/lib/mcp/verify-token';

function toolError(error: unknown) {
  return {
    content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Tool call failed.' }],
    isError: true as const,
  };
}

function toolResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

const handler = createMcpHandler((server) => {
  server.tool(
    'create_catalog_item',
    'Create a new hidden-draft (unpublished) catalog item from a short admin brief. You (the assistant) write the title and localized SEO copy yourself and include them in this call — the admin only supplies description, image URL, price, and category.',
    createCatalogItemInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleCreateCatalogItem(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'update_catalog_item',
    'Patch an existing catalog item created by create_catalog_item. Only send the fields that should change; omitted fields keep their current value, except seo, which fully replaces the previous SEO copy when sent.',
    updateCatalogItemInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleUpdateCatalogItem(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'get_catalog_item',
    'Read the current values of a catalog item by id.',
    getCatalogItemInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleGetCatalogItem(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'list_categories',
    'List active catalog categories, for resolving a categoryId before calling create_catalog_item.',
    listCategoriesInputShape,
    async (_args, extra) => {
      try {
        return toolResult(await handleListCategories(requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'list_subcategories',
    'List active subcategories for a given category id.',
    listSubcategoriesInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleListSubcategories(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );
});

const authHandler = withMcpAuth(handler, verifyAccessToken, {
  required: true,
  requiredScopes: [MCP_OAUTH_SCOPE],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authHandler as GET, authHandler as POST };
```

**Verification note (do this before moving on, since third-party API shapes can drift between the docs above and the exact installed version):** run `pnpm typecheck`. If it reports a mismatch on `server.tool`'s parameter types, or on the `extra` parameter's shape inside a tool callback, inspect `node_modules/mcp-handler/dist/**/*.d.ts` and `node_modules/@modelcontextprotocol/sdk/dist/**/server/mcp.d.ts` for the actual installed signatures, and adjust `lib/mcp/tools/context.ts`'s `McpToolExtra` type (Task 7) and/or this file's `server.tool(...)` calls to match — the tool handler functions themselves (`handleCreateCatalogItem` etc.) do not need to change, only how their result is wrapped and how `extra` is read.

- [ ] **Step 2: Implement the protected-resource metadata route**

Create `app/.well-known/oauth-protected-resource/route.ts`:

```ts
export const runtime = 'nodejs';

import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';
import { getServerEnv } from '@/lib/env';

const handler = protectedResourceHandler({
  authServerUrls: [getServerEnv().NEXT_PUBLIC_SITE_URL],
});

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
```

- [ ] **Step 3: Write the failing test for the authorization-server metadata route**

Create `tests/app/api/mcp/well-known.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/.well-known/oauth-authorization-server/route';

describe('GET /.well-known/oauth-authorization-server', () => {
  it('advertises the three OAuth endpoints and PKCE-only, public-client support', async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.authorization_endpoint).toContain('/api/mcp/authorize');
    expect(body.token_endpoint).toContain('/api/mcp/token');
    expect(body.registration_endpoint).toContain('/api/mcp/register');
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(body.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(body.scopes_supported).toEqual(['catalog:write']);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm vitest run tests/app/api/mcp/well-known.test.ts`
Expected: FAIL with "Cannot find module '@/app/.well-known/oauth-authorization-server/route'"

- [ ] **Step 5: Implement the authorization-server metadata route**

Create `app/.well-known/oauth-authorization-server/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { MCP_OAUTH_SCOPE } from '@/lib/mcp/oauth-store';

export async function GET() {
  const baseUrl = getServerEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return NextResponse.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
    token_endpoint: `${baseUrl}/api/mcp/token`,
    registration_endpoint: `${baseUrl}/api/mcp/register`,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    scopes_supported: [MCP_OAUTH_SCOPE],
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run tests/app/api/mcp/well-known.test.ts`
Expected: PASS (1 test)

- [ ] **Step 7: Run full typecheck and test suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS. Resolve any `server.tool`/`extra` shape mismatches per the verification note in Step 1 before proceeding.

- [ ] **Step 8: Commit**

```bash
git add app/api/mcp/route.ts "app/.well-known" tests/app/api/mcp/well-known.test.ts
git commit -m "feat(mcp): wire up the resource server route and oauth metadata endpoints"
```

---

## Task 13: Connected Apps admin page

**Files:**
- Create: `app/admin/connectors/page.tsx`
- Create: `app/admin/connectors/actions.ts`
- Test: `tests/app/admin/connectors/actions.test.ts`
- Modify: `app/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `requireAdmin`/`requireAdminPermission` (`lib/admin.ts`), `listConnectedApps`/`revokeConnectedApp` (Task 3), `writeAdminAuditLog` (`lib/transactions.ts:102`), `formatDate` (`lib/utils.ts:18`).

- [ ] **Step 1: Write the failing test for the revoke action**

Create `tests/app/admin/connectors/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ requireAdminPermission: vi.fn() }));
vi.mock('@/lib/mcp/oauth-store', () => ({ revokeConnectedApp: vi.fn() }));
vi.mock('@/lib/transactions', () => ({ writeAdminAuditLog: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { requireAdminPermission } from '@/lib/admin';
import { revokeConnectedApp } from '@/lib/mcp/oauth-store';
import { writeAdminAuditLog } from '@/lib/transactions';
import { revokeConnectorAction } from '@/app/admin/connectors/actions';

describe('revokeConnectorAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires catalog_manage before revoking', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' } as never,
    });

    const formData = new FormData();
    formData.set('tokenId', 'token-1');
    await revokeConnectorAction(formData);

    expect(requireAdminPermission).toHaveBeenCalledWith('catalog_manage');
    expect(revokeConnectedApp).toHaveBeenCalledWith(expect.anything(), 'user-1', 'token-1');
  });

  it('writes an audit log entry after revoking', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' } as never,
    });

    const formData = new FormData();
    formData.set('tokenId', 'token-1');
    await revokeConnectorAction(formData);

    expect(writeAdminAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: 'user-1',
        action: 'admin_mcp_connector_revoked',
        entityType: 'mcp_oauth_token',
        entityId: 'token-1',
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/app/admin/connectors/actions.test.ts`
Expected: FAIL with "Cannot find module '@/app/admin/connectors/actions'"

- [ ] **Step 3: Implement the revoke action**

Create `app/admin/connectors/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { revokeConnectedApp } from '@/lib/mcp/oauth-store';
import { writeAdminAuditLog } from '@/lib/transactions';

const revokeSchema = z.object({ tokenId: z.string().uuid() });

export async function revokeConnectorAction(formData: FormData) {
  const parsed = revokeSchema.safeParse({ tokenId: formData.get('tokenId') });
  if (!parsed.success) throw new Error('Invalid connector.');

  const { supabase, user } = await requireAdminPermission('catalog_manage');

  await revokeConnectedApp(supabase, user.id, parsed.data.tokenId);

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: 'admin_mcp_connector_revoked',
    entityType: 'mcp_oauth_token',
    entityId: parsed.data.tokenId,
    reason: 'Admin revoked a connected MCP app from /admin/connectors.',
  });

  revalidatePath('/admin/connectors');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/app/admin/connectors/actions.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement the page**

Create `app/admin/connectors/page.tsx`:

```tsx
import { revokeConnectorAction } from '@/app/admin/connectors/actions';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { listConnectedApps } from '@/lib/mcp/oauth-store';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminConnectorsPage() {
  const { supabase, user } = await requireAdmin();
  const connectedApps = await listConnectedApps(supabase, user.id);

  return (
    <main className="container max-w-3xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connected apps</h1>
        <p className="text-muted-foreground">
          Apps you've authorized to create and edit catalog items on your behalf via ChatGPT or Claude. To
          connect a new one, add {`{your Uniqraft URL}/api/mcp`} as a custom connector in Claude or ChatGPT
          and sign in when prompted.
        </p>
      </div>

      {connectedApps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps connected yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">App</th>
                <th className="px-4 py-3 font-medium">Access expires</th>
                <th className="px-4 py-3 font-medium">Connection expires</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {connectedApps.map((app) => (
                <tr key={app.tokenId} className="border-t">
                  <td className="px-4 py-3 font-medium">{app.clientName}</td>
                  <td className="px-4 py-3">{formatDate(app.expiresAt)}</td>
                  <td className="px-4 py-3">{formatDate(app.refreshExpiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={revokeConnectorAction}>
                      <input type="hidden" name="tokenId" value={app.tokenId} />
                      <Button type="submit" variant="destructive" size="sm">
                        Revoke
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Add the nav entry**

In `app/admin/admin-nav.tsx`, add `Plug` to the `lucide-react` import (line 2) and a new entry to the `links` array (after `'/admin/markets'`, before `'/catalog'`):

```ts
import {
  Banknote,
  Boxes,
  ClipboardList,
  CreditCard,
  Globe2,
  LayoutDashboard,
  Plug,
  SlidersHorizontal,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
```

```ts
  { href: '/admin/markets', label: 'Markets', icon: Globe2 },
  { href: '/admin/connectors', label: 'Connected apps', icon: Plug },
  { href: '/catalog', label: 'Storefront', icon: Store },
```

- [ ] **Step 7: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add app/admin/connectors app/admin/admin-nav.tsx tests/app/admin/connectors/actions.test.ts
git commit -m "feat(admin): add a Connected Apps page to view and revoke MCP connectors"
```

---

## Task 14: Manual end-to-end verification

**Files:** none (manual verification only — no automated browser/e2e test for a real Claude/ChatGPT conversation, per the design spec's Testing section)

- [ ] **Step 1: Deploy to a preview environment**

Run: `vercel deploy` (or push the branch and let the existing CI/CD produce a preview URL — follow this repo's existing deploy flow).

- [ ] **Step 2: Register and connect from Claude**

In Claude (claude.ai → Settings → Connectors → Add custom connector), enter `https://<preview-url>/api/mcp`. Approve the consent screen when redirected to `/login`. Confirm the 5 tools (`create_catalog_item`, `update_catalog_item`, `get_catalog_item`, `list_categories`, `list_subcategories`) appear as available tools.

- [ ] **Step 3: Create a test item via chat**

Ask Claude to create a catalog item, giving it a description, an image URL, a price, and asking it to pick a category via `list_categories` first. Confirm in `/admin/items` that the item was created with `status: draft`, the correct thumbnail, title, and localized SEO metadata.

- [ ] **Step 4: Verify update and revoke**

Ask Claude to change the price via `update_catalog_item`; confirm the change lands in `/admin/items/<id>`. Then visit `/admin/connectors`, revoke the Claude connection, and confirm the next tool call from Claude fails with an authorization error (may require Claude to re-attempt the call, since it may cache the token client-side until expiry — confirm it fails on the *next fresh* OAuth handshake at minimum).

- [ ] **Step 5: Repeat for ChatGPT**

In ChatGPT (Settings → Connectors → Advanced → Developer mode, per developers.openai.com/apps-sdk/deploy/connect-chatgpt), connect to the same `/api/mcp` URL and repeat Steps 3–4.

---

## Self-Review

**Spec coverage:**
- Scope table (description/image/price/category from admin; title/SEO/notes from the LLM; status always draft; everything else deferred) — Tasks 8, 9 (`create-catalog-item.ts`, `update-catalog-item.ts`).
- Tool surface (5 tools) — Tasks 7, 8, 9, wired in Task 12.
- Auth architecture (3 tables, register/authorize/token endpoints, live permission re-check) — Tasks 1, 2, 3, 6, 10, 11.
- Connected Apps page — Task 13.
- Shared core logic extraction — Task 5.
- SSRF-guarded image fetch — Task 4.
- Error handling (401/403/structured tool errors/image-fetch-fails-the-whole-call/audit trail) — covered across Tasks 6, 8, 9, 11, 13 (`created_by`/`updated_by` already flows through unchanged via `createCatalogItemCore`/`updateCatalogItemCore`'s existing `user.id` plumbing).
- Testing section (SSRF unit tests prioritized, core-extraction regression tests, token verification tests, manual e2e) — Tasks 4, 5, 6, 14.
- Rate limiting is named in the spec's Error Handling section but has no dedicated task: this repo has no existing rate-limiting utility to extend (confirmed via search during planning), and building one is a cross-cutting concern independent of this feature's core value. Deliberately deferred — flag to the user before or during execution rather than silently dropping it.

**Placeholder scan:** no TBD/TODO; the one intentionally-open item (rate limiting) is called out explicitly above, not hidden.

**Type consistency:** `createCatalogItemCore`/`updateCatalogItemCore` signatures (Task 5) match their call sites in Tasks 8 and 9 (`(supabase, user, item, thumbnailPath, formData?)` / `(supabase, id, user, item, thumbnailPath, formData?)`). `AuthInfo.extra.userId` (Task 6) matches `requireAuthedUserId`'s read path (Task 7) and the `McpToolExtra` shape it defines. `ConnectedApp` fields (`tokenId`, `clientId`, `clientName`, `expiresAt`, `refreshExpiresAt`) match the page's usage in Task 13. `MCP_OAUTH_SCOPE` is defined once in Task 3 and imported everywhere else that needs it (Tasks 6, 10, 11, 12) rather than restated as a literal.
