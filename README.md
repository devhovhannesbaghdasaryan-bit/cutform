# Snip

AI image-to-SVG product generator. Upload an image, chat with GPT-4o to
produce a manufacturing-ready SVG, approve, and save it as a priced product.
Price is the OpenAI token cost of the generation plus a flat $10 markup.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript
- shadcn/ui on Tailwind CSS
- Supabase (auth, Postgres with RLS, Storage)
- Vercel AI SDK 4 + OpenAI GPT-4o (`streamObject` for structured streaming)
- `isomorphic-dompurify` for SVG sanitization
- Deploys to Vercel; pnpm package manager

## Local development

### Prerequisites

- pnpm
- A Docker engine — OrbStack, Docker Desktop, Colima, etc. (OrbStack used here)
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local Supabase

The repo includes `supabase/config.toml` (project name `snip`, ports 54321–54327)
and `supabase/migrations/0001_init.sql`. First boot pulls Docker images
(~5 min); subsequent starts are seconds.

```bash
supabase start          # boots Postgres + GoTrue + Storage + Studio + Mailpit
supabase db reset       # applies migrations to a fresh local db
supabase status         # shows API URL + keys + Studio / Mailpit URLs
```

Useful local URLs:

| Service | URL |
|---|---|
| Studio (DB + Auth admin) | <http://127.0.0.1:54323> |
| Mailpit (catches all auth emails) | <http://127.0.0.1:54324> |
| API | <http://127.0.0.1:54321> |

Auth redirect URLs (`http://localhost:3000/auth/callback`, plus the 127.0.0.1
variant) are pre-configured in `supabase/config.toml`. Email confirmation is
enabled (`enable_confirmations = true`), so signups land in Mailpit and the
verification link redirects to `/auth/callback`.

### 3. Wire env vars

Copy the keys from `supabase status --output env` into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=sk-...
```

Local Supabase ships demo JWT keys — they are stable across resets and safe to
commit only if you're sure the project never reuses them in production. For
prod, swap to your live project's URL + keys.

### 4. Run

```bash
pnpm dev
```

Open <http://localhost:3000>. Register → check Mailpit (<http://127.0.0.1:54324>) for the
verification email → click the link → land on `/dashboard`.

### Stopping

```bash
supabase stop           # stops containers; data persists in Docker volumes
supabase stop --no-backup --no-save   # nukes data too
```

## Production deployment

Same env var contract; instead of `supabase start`, provision a cloud Supabase
project, run the same migration in its SQL Editor, and set the same env vars
in Vercel.

## Email delivery

v1 ships with **Supabase's default SMTP sender**. The verification email comes
from a generic Supabase address — not from your domain. This is a deliberate
deferral; see [the plan file](/Users/harut/.claude/plans/we-need-to-generate-spicy-mccarthy.md)
for full context.

**To enable branded emails via Resend (post-v1, no code change):**

1. Verify your sender domain in Resend.
2. In Supabase Dashboard: **Authentication → SMTP Settings**.
3. Enter Resend SMTP credentials and sender (e.g. `noreply@yourdomain.com`).
4. Add SPF + DKIM DNS records as instructed by Resend.
5. Send a test from Supabase to confirm.

Auth email templates can be customized in **Authentication → Email Templates**.

## Deploy to Vercel

1. Push to a Git repo.
2. Import into Vercel.
3. Provision a cloud Supabase project; in its SQL Editor run `supabase/migrations/0001_init.sql`.
4. Set all env vars from `.env.local.example` in Vercel **Project Settings → Environment Variables**.
5. Update `NEXT_PUBLIC_SITE_URL` to the production URL.
6. Add the production `/auth/callback` URL to Supabase **Authentication → URL Configuration**.

## Pricing

Adjust the constants in [`lib/pricing.ts`](./lib/pricing.ts) when OpenAI
re-prices GPT-4o or you want to change the markup.

## Acceptance criteria — known deferral

PRD §11 step 2 (verification email from project's own domain via Resend)
is **deferred** in v1. All other criteria are implemented.

## Project layout

```
app/
  (auth)/{login,register}/        # auth screens + server actions
  auth/{callback,verify-email}/   # verification flow
  dashboard/                      # product grid
  create/                         # upload + chat + live SVG preview
  products/[id]/                  # product detail with price breakdown
  api/generate/                   # streamObject endpoint
lib/
  supabase/                       # client / server / middleware factories
  pricing.ts                      # token-cost-to-price math
  sanitize.ts                     # DOMPurify SVG sanitization
  generation-schema.ts            # Zod schema shared by API + client
  env.ts                          # Zod-validated env vars
components/
  ui/                             # shadcn primitives
  site-header.tsx product-card.tsx empty-state.tsx svg-render.tsx
middleware.ts                     # auth + verified-email gate
supabase/migrations/0001_init.sql # schema, RLS, storage bucket
```

## Verification checklist

Maps 1:1 to PRD §11:

1. Register → land on `/auth/verify-email`
2. ~~Branded Resend email~~ — DEFERRED, Supabase default in v1
3. Click verification link → land on `/dashboard` with empty state
4. Click "Create new" → upload → describe → first SVG streams in
5. ⩽5s first-token latency on GPT-4o
6. Follow-up message replaces SVG; tokens accumulated server-side
7. Approve → atomic save
8. Land on `/products/[id]` with SVG, title, price, disabled Buy + tooltip
9. Return to dashboard → card visible
10. Logout / log back in → product still there
11. Visit another user's product URL → 404 (RLS enforced)
12. Mobile browser → responsive layout works
```
