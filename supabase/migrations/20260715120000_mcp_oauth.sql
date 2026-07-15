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
