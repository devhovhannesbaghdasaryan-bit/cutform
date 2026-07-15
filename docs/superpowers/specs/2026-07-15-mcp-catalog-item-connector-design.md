# ChatGPT/Claude Catalog Item Connector — Design

**Date:** 2026-07-15
**Status:** Approved for planning

## Problem

Admins currently create catalog items only through the `/admin/items` form,
typing in the description, title, and localized SEO copy by hand (with an
in-dashboard AI-autogenerate assist added 2026-07-14, see
`2026-07-14-admin-item-ai-autogenerate-design.md`). There's no way to create
an item from a conversation in ChatGPT or Claude, where an admin could hand
the assistant a product photo, a price, and a short brief, and have the
assistant do the writing.

## Goal

Let admins connect the Uniqraft admin account to ChatGPT and Claude as a
remote MCP ("Model Context Protocol") server, and create catalog items by
chatting. The admin supplies the minimal brief (description, image, price,
category); the calling LLM (Claude or ChatGPT itself) generates the title
and localized SEO copy and includes it in the same tool call. The resulting
item is always created as a hidden draft — publishing, and every field not
covered here, remains a manual dashboard step. Access is restricted to users
with the existing `catalog_manage` admin permission.

## Why MCP, and why OAuth

As of mid-2026 both ChatGPT (Apps SDK / developer mode) and Claude (custom
connectors) have converged on remote MCP servers as their extensibility
surface, and both require OAuth 2.1 for any tool that performs write
actions — a bare API key is not a supported auth path for either platform
for this kind of tool. Building one MCP server serves both clients; there's
no need for a separate integration per platform (e.g. ChatGPT's older
OpenAPI-based "Custom GPT Actions" would only cover ChatGPT and is being
superseded by the Apps SDK).

Sources consulted during design: Claude's
[custom connector docs](https://claude.com/docs/connectors/building) and
[authentication reference](https://claude.com/docs/connectors/building/authentication);
OpenAI's [Apps SDK connect guide](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)
and [auth guide](https://developers.openai.com/apps-sdk/build/auth); Vercel's
[`mcp-handler` deployment guide](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel).

## Scope: what `create_catalog_item` accepts

| Field | Source | Notes |
|---|---|---|
| `description` | Admin | Source brief text, single field (matches existing `catalog_items.description`) |
| `imageUrl` | Admin | Server fetches and stores as the thumbnail — see Security below |
| `priceCents` | Admin | |
| `categoryId` / `subcategoryId` | Admin, via `list_categories`/`list_subcategories` | subcategory optional |
| `title` | LLM-generated | |
| `seo.{en,ru,am}` | LLM-generated | Same shape as existing `seoLocaleSchema`: seoTitle/seoDescription/seoKeywords/ogTitle/ogDescription, each optional |
| `manufacturingNotes`, `characteristics` | LLM-generated, optional | Same intent as the existing in-dashboard autogenerate fields, just authored by the external LLM instead of a server-side OpenAI call |
| `slug` | Server-generated | `slugify(title)` + uniqueness suffix, same pattern as `generateToyDecorationDraftAction` |
| `status` | Always `'draft'` | **Not exposed as a parameter.** A chat-created item can only go live via an admin explicitly publishing it from `/admin/items`. |

**Explicitly out of scope for v1** — admin adds these manually in the
dashboard after review: `tags`, personalization config
(`isCustomizable`/`systemPrompt`/`skillId`/`boilerplateIds`), engraving
config (`laserContourEnabled`/`laserSolidEnabled`/price/prompt), market
rules, `isPopular`, gallery images beyond the one thumbnail, hard delete.

### Tool surface

- `create_catalog_item(input)` — the only write tool for v1. Returns
  `{ id, slug, adminUrl }`.
- `update_catalog_item(id, patch)` — same field set as create, for
  conversational corrections ("actually make the price 15000 AMD"). Cannot
  change `status`.
- `get_catalog_item(id)` — read current values, for the LLM to confirm state
  before/after an update.
- `list_categories()` / `list_subcategories(categoryId)` — read-only lookups
  so the LLM resolves real IDs instead of guessing.

No `list_catalog_items`/search tool in v1 — updates are expected to happen
in the same conversation right after a create, where the `id` is already
known from the create response.

## Auth architecture

Both platforms expect a clean separation between the **resource server**
(validates tokens, serves tools) and an **authorization server** (issues
tokens). Uniqraft plays both roles, but the authorization server is a thin
layer over the *existing* Supabase Auth session and `hasAdminPermission` —
"logging in" to the connector is just the admin's normal Uniqraft login.

### New tables (server-only, no anon/authenticated RLS grants)

- **`mcp_oauth_clients`** — one row per registered external app (Claude,
  ChatGPT), created automatically via Dynamic Client Registration the first
  time an admin adds the connector URL: `client_id`, `client_name`,
  `redirect_uris text[]`, `created_at`.
- **`mcp_oauth_authorization_codes`** — short-lived (~60s), single-use:
  `code_hash`, `client_id`, `user_id`, `redirect_uri`, `code_challenge`
  (PKCE, S256 only), `scope`, `expires_at`, `used boolean`.
- **`mcp_oauth_tokens`** — `access_token_hash`, `refresh_token_hash`,
  `client_id`, `user_id`, `scope`, `expires_at`, `refresh_expires_at`,
  `revoked_at`. Access tokens ~1h, refresh tokens ~30d, rotated on refresh.

Tokens and codes are stored hashed (never the raw secret), matching how the
codebase already avoids storing raw secrets elsewhere.

### Endpoints (`app/api/mcp/...`)

Built on Vercel's `mcp-handler` package (`createMcpHandler` +
`withMcpAuth`) for the resource-server side, plus hand-written route
handlers for the authorization-server side (using
`@modelcontextprotocol/sdk`'s auth types/PKCE helpers for spec compliance,
implemented directly as Next.js Route Handlers rather than mounting the
SDK's Express-based router):

- `POST/GET /api/mcp` — the MCP tool-call endpoint, wrapped in
  `withMcpAuth(handler, verifyAccessToken, { required: true, requiredScopes: ['catalog:write'] })`.
- `POST /api/mcp/register` — Dynamic Client Registration (automatic, no
  admin action needed).
- `GET /api/mcp/authorize` — redirects to `/login?next=...` if not
  authenticated (reusing the existing Supabase session, same as
  `requireAdmin()`); checks `hasAdminPermission(userId, 'catalog_manage')` —
  non-admins see a plain "not authorized" page, no consent screen. Admins
  see a one-screen consent prompt and, on approval, get an authorization
  code bound to their `user_id`.
- `POST /api/mcp/token` — exchanges an authorization code (+ PKCE verifier)
  or a refresh token for an access token.
- `app/.well-known/oauth-protected-resource/route.ts` and
  `app/.well-known/oauth-authorization-server/route.ts` — metadata routes
  both platforms fetch to discover the flow.

**Per-call enforcement:** `verifyAccessToken` looks up the hashed bearer
token, checks expiry/revocation, and re-checks `catalog_manage` live (not
just at issuance) — demoting an admin's role cuts off their connector
immediately. Every tool handler re-checks permission again before writing,
matching the defense-in-depth already present in every existing Server
Action.

Note: `catalog:write` is the OAuth scope string granted to the token (what
Claude/ChatGPT display on the consent screen and request in the token
request); `catalog_manage` is this app's existing internal
`AdminPermission` enum value from `lib/admin.ts`. `verifyAccessToken` holds
both concepts — it confirms the token carries the `catalog:write` scope,
then separately re-checks the resolved user still has the `catalog_manage`
permission. They're intentionally two different identifiers for two
different layers (OAuth grant vs. app-level authorization), not aliases of
each other.

### Connected Apps admin page (`/admin/connectors`)

New nav entry in `admin-nav.tsx`. Lists the *current* admin's own connected
apps only (join of `mcp_oauth_tokens`/`mcp_oauth_clients` filtered to
`user_id = auth.uid()` — each admin manages their own connections, no
cross-admin visibility in v1) with a Revoke button that deletes/expires
that admin's token rows for the selected client.

## Server-side data flow & code reuse

To avoid the dashboard form and the MCP tool silently diverging on business
rules (slug uniqueness, category/subcategory validation, etc.), the DB-write
portion of `createCatalogItemAction`/`updateCatalogItemAction` is extracted
into shared core functions used by both entry points:

- `lib/catalog-items/core.ts` — `createCatalogItemCore(supabase, user, item, { thumbnailPath })`
  / `updateCatalogItemCore(...)`, containing the insert/update plus the
  existing `ensureCatalogSlugIsAvailable`, `validateCategoryExists`,
  `validateSubcategoryBelongsToCategory`, `parseSizesJson` calls that
  `item-form-parsing.ts` already exposes as plain (non-`FormData`)
  functions. The Server Actions call this after their `FormData` parsing
  step; the MCP tool handler calls it after building the same
  `itemSchema`-shaped object directly from the validated tool-call JSON
  (no `FormData` involved on this path — simpler than the browser path,
  not harder).
- `lib/catalog-items/upload-from-url.ts` —
  `fetchAndStoreCatalogImage(supabase, userId, imageUrl)`:
  - **SSRF guards**: reject non-`https` URLs; resolve the hostname and
    reject private/loopback/link-local/cloud-metadata IP ranges before
    fetching; redirects are followed manually with the same check
    re-applied at each hop (no blind auto-follow).
  - Enforces `Content-Type: image/*` on the response and the existing
    50MB `CATALOG_ASSET_MAX_BYTES` cap (aborted early if exceeded), plus a
    fetch timeout.
  - On success, stores via the same `uploadToBucket` helper
    `uploadAdminCatalogAsset` already uses, landing in the `catalog-assets`
    bucket identically to a dashboard upload.

Tool handlers live in `lib/mcp/tools/` (`create-catalog-item.ts`,
`update-catalog-item.ts`, `get-catalog-item.ts`, `list-categories.ts`,
`list-subcategories.ts`), each re-checking
`hasAdminPermission(userId, 'catalog_manage')` using the `user_id` resolved
from the verified token before doing anything else.

## Error handling & security

- **Auth failures** (expired/revoked/invalid token): `401` with the MCP-spec
  `www_authenticate` metadata, so Claude/ChatGPT trigger their re-auth UI
  automatically rather than failing silently.
- **Permission failures** (valid token, role since demoted): `403` with a
  clear message the LLM can relay to the admin.
- **Validation failures** (bad category, slug collision, missing required
  field): returned as a structured tool error (not a thrown exception), so
  the calling LLM can correct and retry within the same conversation —
  mirrors `actionError()` in the existing Server Actions.
- **Image fetch failures** (SSRF-blocked, wrong content-type, too large,
  timeout, 404): fails the whole `create_catalog_item` call rather than
  silently creating an item with no image.
- **Rate limiting**: a light per-token limit on `/api/mcp` to bound abuse if
  a token ever leaks.
- **Audit trail**: `created_by`/`updated_by` on `catalog_items` is set to
  the real `user_id` resolved from the token — chat-created items are
  attributed exactly like dashboard-created ones.

## Testing

- Unit tests for `fetchAndStoreCatalogImage`'s SSRF guard (private IP
  ranges, redirect-to-private rejected, oversized/wrong-content-type
  rejected) — the highest-risk new surface, gets the most direct coverage.
- Unit tests for `createCatalogItemCore`/`updateCatalogItemCore` —
  confirm existing Server Action behavior (slug suffixing,
  category/subcategory validation) is unchanged now that it's shared.
- Unit tests for OAuth token issuance/verification (`verifyAccessToken`
  rejects expired/revoked tokens, re-checks live admin permission).
- No new browser/e2e test for the chat flow itself — verified manually by
  connecting a real Claude and ChatGPT account to a preview deployment and
  creating a test item end-to-end, per this repo's existing
  manual-verification norm for admin features.

## Out of scope / explicit non-goals for v1

- Publishing, tags, personalization config, engraving config, market
  rules, gallery images beyond one thumbnail, item deletion — all remain
  dashboard-only.
- Cross-admin visibility/management of other admins' connected apps.
- Search/list tool for finding items to update outside the
  just-created-it-this-conversation case.
