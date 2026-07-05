# Uniqraft

AI image-to-SVG product generator. Upload an image, chat with GPT-4o to
produce a manufacturing-ready SVG, approve, and save it as a priced product.
AI generation is paid with prepaid credits: users buy one of the credit packs
defined in `lib/credit-packs.ts` and each generation attempt debits its credit
cost from their balance.

## Stack

- Next.js App Router + React 19, TypeScript
- shadcn/ui on Tailwind CSS
- Supabase (auth, Postgres with RLS, Storage)
- Vercel AI SDK + OpenAI models for structured generation
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
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from supabase status>
SUPABASE_SECRET_KEY=<SECRET_KEY from supabase status>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=sk-...
```

Local Supabase ships demo JWT keys — they are stable across resets and safe to
commit only if you're sure the project never reuses them in production. For
prod, swap to your live project's URL + keys.

### 3a. Promote a local admin

After registering and verifying a local user, promote that account from
Supabase Studio SQL editor. Replace the email lookup value first:

```sql
update public.profiles
set role = 'admin'
where user_id = (
  select id
  from auth.users
  where email = 'admin@example.com'
);

insert into public.admin_permissions (user_id, permission)
select profiles.user_id, permission
from public.profiles
cross join (
  values
    ('catalog_manage'),
    ('seo_manage'),
    ('orders_manage'),
    ('generated_review'),
    ('users_manage'),
    ('transactions_manage'),
    ('balances_adjust')
) as permissions(permission)
where profiles.role = 'admin'
on conflict (user_id, permission) do nothing;
```

### 4. Run

```bash
pnpm dev
```

Open <http://localhost:3000>. Register, check Mailpit (<http://127.0.0.1:54324>) for the
verification email, click the link, then land on `/dashboard`.

With the dev server running, run the local runtime smoke check when validating public routes
and sitemap URLs:

```bash
pnpm smoke:runtime
```

With local Supabase running, run the disposable database workflow smoke when validating
cart, order snapshot, admin audit, transaction, credit, and personalized order data behavior:

```bash
pnpm smoke:db-workflows
```

With a local app server running, run the headless Chrome UI workflow smoke when validating
guest storefront/cart, language switching, banner, personalized night light, and auth-gate entry points:

```bash
pnpm smoke:ui-workflows
```

## Marketplace Setup Notes

Run `supabase db reset` after pulling migration changes. The marketplace migrations seed:

- Categories, subcategories, popular catalog items, banner size presets, and banner sample templates.
- Storage buckets: `catalog-assets`, `banner-assets`, `user-uploads`, and `generated-assets`.
- Admin permission rows used by catalog, SEO, user, transaction, balance, and generation review screens.

Important local routes:

| Flow | Route |
|---|---|
| Storefront | <http://localhost:3000/> |
| Catalog | <http://localhost:3000/catalog> |
| Cart | <http://localhost:3000/cart> |
| Credit packs | <http://localhost:3000/credits> |
| Personalized night lights | <http://localhost:3000/catalog/night-lights/personalized> |
| Admin hub | <http://localhost:3000/admin> |
| Admin create hub | <http://localhost:3000/admin/create> |
| Personalization categories | <http://localhost:3000/personalization> |
| Night light templates | <http://localhost:3000/personalization/night-lights> |

Credit packs and order payments use Stripe Checkout when Stripe environment variables are configured. Admins can still perform guarded manual credit adjustments from the admin user detail page with an audit reason.

Uploaded user images require an explicit rights confirmation. Generated previews are approximate and require admin/production review before manufacturing.

### Stopping

```bash
supabase stop           # stops containers; data persists in Docker volumes
supabase stop --no-backup --no-save   # nukes data too
```

## Production deployment

Use the cloud project's URL, `sb_publishable_...` key, and server-only
`sb_secret_...` key in the same variables. Deploy migrations with the Supabase
CLI or the connected Supabase integration before starting the app.

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

AI generation runs on a prepaid credit-pack model. The packs (credit amount,
price, currency) are defined in [`lib/credit-packs.ts`](./lib/credit-packs.ts)
and surfaced on `/credits`; buying a pack tops up the user's credit account,
and each generation attempt spends credits from that balance. Adjust the pack
definitions there to change pricing.

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
  api/generate/                   # streamObject endpoint
lib/
  supabase/                       # client / server / middleware factories
  credit-packs.ts                 # prepaid credit-pack definitions
  sanitize.ts                     # DOMPurify SVG sanitization
  generation-schema.ts            # Zod schema shared by API + client
  env.ts                          # Zod-validated env vars
components/
  ui/                             # shadcn primitives
  site-header.tsx product-card.tsx empty-state.tsx svg-render.tsx
proxy.ts                          # middleware entrypoint delegating to lib/supabase/middleware.ts (auth + verified-email gate)
supabase/migrations/0001_init.sql # schema, RLS, storage bucket
```

## Verification checklist

Maps 1:1 to PRD §11:

1. Register → land on `/auth/verify-email`
2. ~~Branded Resend email~~ — DEFERRED, Supabase default in v1
3. Click verification link → land on `/dashboard` with empty state
4. Click "Create new" → upload → describe → first SVG streams in
5. <=5s first generated-output latency on GPT-4o
6. Follow-up message replaces SVG; usage is accumulated server-side
7. Approve → atomic save
8. Land on `/products/[id]` with SVG, title, price, disabled Buy + tooltip
9. Return to dashboard → card visible
10. Logout / log back in → product still there
11. Visit another user's product URL → 404 (RLS enforced)
12. Mobile browser → responsive layout works
```
