# Harden catalog reads against transient Supabase failures

**Date:** 2026-07-30
**Status:** Approved
**Origin:** External UI/UX + performance audit reported intermittent 503s on uniqraft.org taking down catalog data requests and silently breaking add-to-cart.

## Problem

Production intermittently returns 503 for RSC/data requests on `/`, `/catalog`, and product pages. Investigation (2026-07-30) established the cause:

- Vercel runtime error groups for the last 7 days contain a single root error: `Error: JWT issued at future`, thrown by Supabase PostgREST during `unstable_cache` revalidation of the three catalog reads in `lib/marketplace.ts` (`getCachedCategories`, `getCachedSubcategories`, `getCachedPublishedCatalogItemsPage`). ~37 occurrences across 17 users, 2026-07-24 → 2026-07-30.
- These reads use the service client (`getServiceSupabase`) with the new `sb_secret_…` key. Those keys are opaque: Supabase's gateway mints a signed JWT per request. PostgREST rejects JWTs whose `iat` is more than ~30s in the future (its fixed clock-skew leeway), so a clock-drifted minting node in Supabase's infra causes intermittent rejection bursts. User-session queries are immune (their JWTs are minted once at sign-in with a past `iat`), which is why only service-client paths fail.
- When a cache window (revalidate 3600) expires and the revalidation query throws, the request 503s. During a drift burst every uncached catalog read fails at once — matching the audit's "30–50% of requests" experience while 62/62 healthy-window probe requests (sequential + 40 concurrent) returned 200.
- Vercel capacity/throttling is ruled out (no infra 5xx under a 20-parallel burst; no 5xx in runtime logs).

## Design

### 1. `retryTransient` helper — `lib/supabase/retry.ts` (new)

`retryTransient<T>(fn: () => Promise<T>): Promise<T>` runs `fn`, retrying up to 2 extra attempts with short jittered backoff (~250ms then ~500ms, ±50% jitter) **only** when the thrown error message matches a transient allowlist:

- `JWT issued at future`
- `fetch failed`
- `ECONNRESET`
- `socket hang up`
- `ETIMEDOUT`

Any non-matching error rethrows immediately so genuine query bugs still fail loudly. A retry re-issues the HTTP request, which routes around a drifted gateway node (or lands back inside PostgREST's 30s leeway).

### 2. Call sites

Wrap the query bodies of the three cached catalog functions in `lib/marketplace.ts` with `retryTransient`. No other `getServiceSupabase` call sites are wrapped: these three are the only paths present in six days of production error groups and the only ones that take down whole pages. Widening coverage later is a one-line change per site if evidence appears.

### 3. Behavior after exhausted retries

Still throw. No empty-array fallback: `unstable_cache` would store `[]` as a successful catalog result for an hour, which is worse than a 503. Stale-serving already applies automatically when a valid cache entry exists; this change only affects cold or expired-window requests.

### 4. Testing

Vitest unit tests in `tests/lib/` for `retryTransient`:

- retries then succeeds when a transient error resolves on a later attempt
- rethrows immediately (single attempt) on a non-transient error
- gives up after max attempts and rethrows the last error
- applies backoff between attempts (fake timers)

No integration test — the failure is upstream infrastructure and cannot be reproduced deterministically.

### 5. Supabase support ticket (manual)

File from the dashboard (needs the account owner). Draft:

> **Subject:** Intermittent "JWT issued at future" from PostgREST when using sb_secret key
>
> Since at least 2026-07-24 our production project (the one backing uniqraft.org; file this ticket from that project's dashboard so the ref is attached) intermittently receives `Error: JWT issued at future` on PostgREST queries made with our `sb_secret_…` secret key via supabase-js. ~37 occurrences across 17 end users between 2026-07-24T14:21Z and 2026-07-30T07:47Z, in bursts; the same queries succeed the rest of the time, and user-session (auth JWT) queries never fail this way. Since sb_secret keys are exchanged for gateway-minted JWTs per request, and PostgREST allows 30s of iat skew, this looks like a clock >30s ahead on one of the minting nodes. Please check clock synchronization on the API gateway/key-exchange path for our project's region.

## Out of scope (tracked separately)

- **5xx alerting** on Vercel (plan-dependent).
- **Cart mutation error feedback UI** — the audit's "silent add-to-cart failure" is the frontend face of these 503s; it belongs to the cart UX workstream (feedback toast, line-item merging, badge semantics).
- **Mobile hamburger navigation**, image placeholders, search, nav contrast — separate workstreams from the same audit.

## Escalation lever

If bursts worsen before Supabase responds: set the production `SUPABASE_SECRET_KEY` env var back to the legacy `service_role` JWT (fixed past `iat` — the error class becomes impossible). Env-only change, no code. Legacy keys are retired late 2026, so this is strictly a temporary flip, reverted once Supabase confirms a fix.
