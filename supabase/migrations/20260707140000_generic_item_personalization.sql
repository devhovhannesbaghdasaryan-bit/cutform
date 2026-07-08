-- Generic per-catalog-item personalization: replaces the night-lights-specific
-- personalization_models system. No backfill (dev-stage data; admin
-- reconfigures affected items after deploy per
-- docs/superpowers/specs/2026-07-07-generic-item-personalization-design.md).

alter table "public"."catalog_items"
  add column "system_prompt" text,
  add column "skill_id" text,
  add column "tags" text[] not null default '{}'::text[];

alter table "public"."catalog_items"
  add constraint "catalog_items_tags_check"
  check (tags <@ ARRAY['personal_color', 'personal_text', 'personal_photo']::text[]);

alter table "public"."generated_items"
  add column "catalog_item_id" uuid references public.catalog_items(id) on delete set null;

alter table "public"."generated_items" drop constraint "generated_items_product_type_check";
alter table "public"."generated_items" add constraint "generated_items_product_type_check"
  check ((product_type = ANY (ARRAY['night_light'::text, 'personalized_night_light'::text, 'laser_cut_2d_toy'::text, 'laser_cut_2d_decoration'::text, 'laser_cut_2d_constructor'::text, 'banner'::text, 'standard'::text])));

-- Boilerplates become a shared library: drop per-model ownership and the
-- localized-name columns that only made sense scoped to one model's UI.
-- No backfill — existing rows (night-lights seed data) are discarded.
delete from public.personalization_boilerplates;

-- Must drop this policy before dropping model_id: its USING clause
-- references personalization_boilerplates.model_id, which blocks the
-- column drop below otherwise. The replacement policy (readable whenever
-- active, no model gating) is created further down, once
-- personalization_models is gone.
drop policy "customers read active personalization boilerplates" on "public"."personalization_boilerplates";

alter table "public"."personalization_boilerplates"
  drop constraint "personalization_boilerplates_model_id_fkey",
  drop constraint "personalization_boilerplates_model_id_admin_name_key";

alter table "public"."personalization_boilerplates"
  drop column "model_id",
  drop column "name_en",
  drop column "name_hy",
  drop column "name_ru";

alter table "public"."personalization_boilerplates"
  rename column "admin_name" to "name";

alter table "public"."personalization_boilerplates"
  add constraint "personalization_boilerplates_name_key" unique ("name");

create table "public"."catalog_item_boilerplates" (
  "catalog_item_id" uuid not null references public.catalog_items(id) on delete cascade,
  "boilerplate_id" uuid not null references public.personalization_boilerplates(id) on delete cascade,
  "sort_order" integer not null default 0,
  primary key ("catalog_item_id", "boilerplate_id")
);

alter table "public"."catalog_item_boilerplates" enable row level security;

drop table "public"."personalization_models" cascade;

-- Boilerplates are no longer gated by a model's published status; the shared
-- library is readable whenever active, same as any other catalog asset.
create policy "customers read active personalization boilerplates"
  on "public"."personalization_boilerplates"
  as permissive
  for select
  to anon, authenticated
  using (is_active);

create policy "admins manage catalog item boilerplates"
  on "public"."catalog_item_boilerplates"
  as permissive
  for all
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

create policy "public reads catalog item boilerplates for published items"
  on "public"."catalog_item_boilerplates"
  as permissive
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.catalog_items
      where catalog_items.id = catalog_item_boilerplates.catalog_item_id
        and (catalog_items.status = 'published' or private.is_admin((select auth.uid())))
    )
  );

grant delete, insert, references, select, trigger, truncate, update
  on table "public"."catalog_item_boilerplates" to "anon";
grant delete, insert, references, select, trigger, truncate, update
  on table "public"."catalog_item_boilerplates" to "authenticated";
grant delete, insert, references, select, trigger, truncate, update
  on table "public"."catalog_item_boilerplates" to "service_role";
