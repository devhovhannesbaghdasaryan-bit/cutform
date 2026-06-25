-- Marketplace platform foundation:
-- subcategories, carts, SEO metadata, audit/transactions, generated artifacts,
-- banner/personalization storage, and richer order snapshots.

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists preferred_locale text,
  add column if not exists region_code text,
  add column if not exists internal_notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'suspended', 'disabled'));

alter table public.profiles drop constraint if exists profiles_preferred_locale_check;
alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale is null or preferred_locale in ('en', 'ru', 'am'));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create index if not exists profiles_role_status_created_idx
  on public.profiles (role, status, created_at desc);

create table if not exists public.admin_permissions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  permission text not null check (
    permission in (
      'catalog_manage',
      'seo_manage',
      'orders_manage',
      'generated_review',
      'users_manage',
      'transactions_manage',
      'balances_adjust'
    )
  ),
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

alter table public.admin_permissions enable row level security;

drop policy if exists "admins read admin permissions" on public.admin_permissions;
create policy "admins read admin permissions"
  on public.admin_permissions for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins manage admin permissions" on public.admin_permissions;
create policy "admins manage admin permissions"
  on public.admin_permissions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.admin_audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  reason         text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_created_idx
  on public.admin_audit_log (actor_user_id, created_at desc);

create index if not exists admin_audit_log_target_created_idx
  on public.admin_audit_log (target_user_id, created_at desc);

create index if not exists admin_audit_log_entity_created_idx
  on public.admin_audit_log (entity_type, entity_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admins read audit log" on public.admin_audit_log;
create policy "admins read audit log"
  on public.admin_audit_log for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins insert audit log" on public.admin_audit_log;
create policy "admins insert audit log"
  on public.admin_audit_log for insert
  with check (public.is_admin(auth.uid()));

create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  slug        text not null,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (category_id, slug)
);

create index if not exists subcategories_category_sort_idx
  on public.subcategories (category_id, sort_order);

alter table public.subcategories enable row level security;

drop trigger if exists subcategories_set_updated_at on public.subcategories;
create trigger subcategories_set_updated_at
before update on public.subcategories
for each row execute function public.set_updated_at();

drop policy if exists "public reads active subcategories" on public.subcategories;
create policy "public reads active subcategories"
  on public.subcategories for select
  using (is_active or public.is_admin(auth.uid()));

drop policy if exists "admins manage subcategories" on public.subcategories;
create policy "admins manage subcategories"
  on public.subcategories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.catalog_items
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null,
  add column if not exists item_type text not null default 'standard',
  add column if not exists sizes jsonb not null default '[]'::jsonb,
  add column if not exists characteristics text;

alter table public.catalog_items drop constraint if exists catalog_items_item_type_check;
alter table public.catalog_items
  add constraint catalog_items_item_type_check
  check (item_type in ('standard', 'toy', 'decoration', 'night_light', 'personalized_night_light', 'banner'));

create index if not exists catalog_items_subcategory_idx
  on public.catalog_items (subcategory_id, created_at desc)
  where status = 'published';

create index if not exists catalog_items_item_type_status_idx
  on public.catalog_items (item_type, status, created_at desc);

create table if not exists public.catalog_item_translations (
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  locale          text not null check (locale in ('en', 'ru', 'am')),
  title           text not null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (catalog_item_id, locale)
);

alter table public.catalog_item_translations enable row level security;

drop trigger if exists catalog_item_translations_set_updated_at on public.catalog_item_translations;
create trigger catalog_item_translations_set_updated_at
before update on public.catalog_item_translations
for each row execute function public.set_updated_at();

drop policy if exists "public reads published catalog translations" on public.catalog_item_translations;
create policy "public reads published catalog translations"
  on public.catalog_item_translations for select
  using (
    exists (
      select 1
      from public.catalog_items
      where catalog_items.id = catalog_item_translations.catalog_item_id
        and (catalog_items.status = 'published' or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "admins manage catalog translations" on public.catalog_item_translations;
create policy "admins manage catalog translations"
  on public.catalog_item_translations for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.catalog_item_seo_metadata (
  catalog_item_id    uuid not null references public.catalog_items(id) on delete cascade,
  locale             text not null check (locale in ('en', 'ru', 'am')),
  seo_title          text,
  seo_description    text,
  seo_slug           text,
  keywords           text[] not null default '{}',
  og_title           text,
  og_description     text,
  social_image_path  text,
  noindex            boolean not null default false,
  generated_by_ai    boolean not null default false,
  reviewed_by_admin  boolean not null default false,
  updated_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (catalog_item_id, locale),
  unique (locale, seo_slug)
);

alter table public.catalog_item_seo_metadata enable row level security;

drop trigger if exists catalog_item_seo_metadata_set_updated_at on public.catalog_item_seo_metadata;
create trigger catalog_item_seo_metadata_set_updated_at
before update on public.catalog_item_seo_metadata
for each row execute function public.set_updated_at();

drop policy if exists "public reads published seo metadata" on public.catalog_item_seo_metadata;
create policy "public reads published seo metadata"
  on public.catalog_item_seo_metadata for select
  using (
    not noindex
    and exists (
      select 1
      from public.catalog_items
      where catalog_items.id = catalog_item_seo_metadata.catalog_item_id
        and (catalog_items.status = 'published' or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "admins manage seo metadata" on public.catalog_item_seo_metadata;
create policy "admins manage seo metadata"
  on public.catalog_item_seo_metadata for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  session_id  text,
  status      text not null default 'active' check (status in ('active', 'converted', 'abandoned')),
  currency    text not null default 'USD',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (user_id is not null or session_id is not null)
);

create unique index if not exists carts_active_user_idx
  on public.carts (user_id)
  where status = 'active' and user_id is not null;

create unique index if not exists carts_active_session_idx
  on public.carts (session_id)
  where status = 'active' and session_id is not null;

alter table public.carts enable row level security;

drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at
before update on public.carts
for each row execute function public.set_updated_at();

drop policy if exists "users read own carts" on public.carts;
create policy "users read own carts"
  on public.carts for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users manage own carts" on public.carts;
create policy "users manage own carts"
  on public.carts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "admins read carts" on public.carts;
create policy "admins read carts"
  on public.carts for select
  using (public.is_admin(auth.uid()));

create table if not exists public.cart_items (
  id                 uuid primary key default gen_random_uuid(),
  cart_id            uuid not null references public.carts(id) on delete cascade,
  catalog_item_id    uuid references public.catalog_items(id) on delete set null,
  generated_item_id  uuid references public.generated_items(id) on delete set null,
  banner_sample_id   uuid,
  title              text not null,
  quantity           integer not null default 1 check (quantity > 0),
  unit_price_cents   integer not null check (unit_price_cents >= 0),
  currency           text not null default 'USD',
  configuration      jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (
    (catalog_item_id is not null)::integer
    + (generated_item_id is not null)::integer
    + (banner_sample_id is not null)::integer = 1
  )
);

create index if not exists cart_items_cart_idx
  on public.cart_items (cart_id, created_at);

alter table public.cart_items enable row level security;

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

drop policy if exists "users read own cart items" on public.cart_items;
create policy "users read own cart items"
  on public.cart_items for select
  using (
    exists (
      select 1
      from public.carts
      where carts.id = cart_items.cart_id
        and (carts.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "users manage own cart items" on public.cart_items;
create policy "users manage own cart items"
  on public.cart_items for all
  using (
    exists (
      select 1
      from public.carts
      where carts.id = cart_items.cart_id
        and carts.user_id = auth.uid()
        and carts.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.carts
      where carts.id = cart_items.cart_id
        and carts.user_id = auth.uid()
        and carts.status = 'active'
    )
  );

alter table public.token_accounts
  add column if not exists credit_balance integer not null default 0 check (credit_balance >= 0);

create table if not exists public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete set null,
  order_id              uuid references public.orders(id) on delete set null,
  token_ledger_id       uuid references public.token_ledger(id) on delete set null,
  type                  text not null check (
    type in ('payment', 'refund', 'token_purchase', 'token_spend', 'token_refund', 'credit_spend', 'credit_refund', 'manual_adjustment', 'reversal')
  ),
  status                text not null default 'pending' check (
    status in ('pending', 'succeeded', 'failed', 'cancelled', 'reversed')
  ),
  amount_cents          integer not null default 0,
  currency              text not null default 'USD',
  provider              text,
  provider_reference    text,
  admin_reason          text,
  metadata              jsonb not null default '{}'::jsonb,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

create index if not exists transactions_order_idx
  on public.transactions (order_id);

create index if not exists transactions_type_status_idx
  on public.transactions (type, status, created_at desc);

create index if not exists transactions_provider_reference_idx
  on public.transactions (provider, provider_reference)
  where provider_reference is not null;

alter table public.transactions enable row level security;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop policy if exists "users read own transactions" on public.transactions;
create policy "users read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "admins manage transactions" on public.transactions;
create policy "admins manage transactions"
  on public.transactions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.generated_items drop constraint if exists generated_items_product_type_check;
alter table public.generated_items
  add constraint generated_items_product_type_check
  check (
    product_type in (
      'night_light',
      'personalized_night_light',
      'laser_cut_2d_toy',
      'laser_cut_2d_decoration',
      'laser_cut_2d_constructor',
      'banner'
    )
  );

alter table public.generated_items
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null,
  add column if not exists selected_preview_path text,
  add column if not exists hidden_svg_path text,
  add column if not exists original_image_paths text[] not null default '{}',
  add column if not exists color text,
  add column if not exists multi_color boolean not null default false,
  add column if not exists generation_options jsonb not null default '{}'::jsonb,
  add column if not exists credit_cost integer not null default 0 check (credit_cost >= 0);

alter table public.generation_sessions
  add column if not exists upload_rights_confirmed boolean not null default false;

create table if not exists public.generated_item_artifacts (
  id                uuid primary key default gen_random_uuid(),
  generated_item_id uuid not null references public.generated_items(id) on delete cascade,
  artifact_type     text not null check (
    artifact_type in ('original_image', 'reference_image', 'preview_image', 'hidden_svg', 'manufacturing_svg', 'manufacturing_pdf', 'instruction_json')
  ),
  storage_path      text,
  content_text      text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  check (storage_path is not null or content_text is not null)
);

create index if not exists generated_item_artifacts_item_idx
  on public.generated_item_artifacts (generated_item_id, artifact_type);

alter table public.generated_item_artifacts enable row level security;

drop policy if exists "users read own generated artifacts" on public.generated_item_artifacts;
create policy "users read own generated artifacts"
  on public.generated_item_artifacts for select
  using (
    exists (
      select 1
      from public.generated_items
      where generated_items.id = generated_item_artifacts.generated_item_id
        and (generated_items.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "users insert own generated artifacts" on public.generated_item_artifacts;
create policy "users insert own generated artifacts"
  on public.generated_item_artifacts for insert
  with check (
    exists (
      select 1
      from public.generated_items
      where generated_items.id = generated_item_artifacts.generated_item_id
        and generated_items.user_id = auth.uid()
    )
  );

drop policy if exists "admins manage generated artifacts" on public.generated_item_artifacts;
create policy "admins manage generated artifacts"
  on public.generated_item_artifacts for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.personalized_preview_options (
  id                 uuid primary key default gen_random_uuid(),
  generated_item_id  uuid not null references public.generated_items(id) on delete cascade,
  option_index       integer not null check (option_index between 1 and 3),
  preview_image_path text not null,
  hidden_svg_path    text not null,
  status             text not null default 'generated' check (status in ('generated', 'selected', 'discarded')),
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (generated_item_id, option_index)
);

create index if not exists personalized_preview_options_generated_idx
  on public.personalized_preview_options (generated_item_id, status, option_index);

alter table public.personalized_preview_options enable row level security;

drop trigger if exists personalized_preview_options_set_updated_at on public.personalized_preview_options;
create trigger personalized_preview_options_set_updated_at
before update on public.personalized_preview_options
for each row execute function public.set_updated_at();

drop policy if exists "users read own personalized preview options" on public.personalized_preview_options;
create policy "users read own personalized preview options"
  on public.personalized_preview_options for select
  using (
    exists (
      select 1
      from public.generated_items
      where generated_items.id = personalized_preview_options.generated_item_id
        and (generated_items.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "users manage own personalized preview options" on public.personalized_preview_options;
create policy "users manage own personalized preview options"
  on public.personalized_preview_options for all
  using (
    exists (
      select 1
      from public.generated_items
      where generated_items.id = personalized_preview_options.generated_item_id
        and generated_items.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.generated_items
      where generated_items.id = personalized_preview_options.generated_item_id
        and generated_items.user_id = auth.uid()
    )
  );

drop policy if exists "admins manage personalized preview options" on public.personalized_preview_options;
create policy "admins manage personalized preview options"
  on public.personalized_preview_options for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.banner_size_presets (
  id              uuid primary key default gen_random_uuid(),
  key             text unique not null,
  name            text not null,
  width_mm        integer not null check (width_mm > 0),
  height_mm       integer not null check (height_mm > 0),
  material        text,
  finish          text,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.banner_size_presets enable row level security;

drop policy if exists "public reads active banner presets" on public.banner_size_presets;
create policy "public reads active banner presets"
  on public.banner_size_presets for select
  using (is_active or public.is_admin(auth.uid()));

drop policy if exists "admins manage banner presets" on public.banner_size_presets;
create policy "admins manage banner presets"
  on public.banner_size_presets for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.banner_samples (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  prompt           text,
  image_path       text not null,
  reference_paths  text[] not null default '{}',
  size_preset_id   uuid references public.banner_size_presets(id) on delete set null,
  material_assumptions text,
  production_notes text,
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.banner_samples
  add column if not exists description text,
  add column if not exists material_assumptions text,
  add column if not exists production_notes text;

create index if not exists banner_samples_status_created_idx
  on public.banner_samples (status, created_at desc);

alter table public.banner_samples enable row level security;

drop trigger if exists banner_samples_set_updated_at on public.banner_samples;
create trigger banner_samples_set_updated_at
before update on public.banner_samples
for each row execute function public.set_updated_at();

drop policy if exists "public reads published banner samples" on public.banner_samples;
create policy "public reads published banner samples"
  on public.banner_samples for select
  using (status = 'published' or public.is_admin(auth.uid()));

drop policy if exists "admins manage banner samples" on public.banner_samples;
create policy "admins manage banner samples"
  on public.banner_samples for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.cart_items
  drop constraint if exists cart_items_banner_sample_id_fkey;

alter table public.cart_items
  add constraint cart_items_banner_sample_id_fkey
  foreign key (banner_sample_id) references public.banner_samples(id) on delete set null;

create table if not exists public.banner_manufacturing_instructions (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid references public.orders(id) on delete cascade,
  order_item_id     uuid references public.order_items(id) on delete cascade,
  generated_item_id uuid references public.generated_items(id) on delete set null,
  source_image_path text not null,
  instructions      jsonb not null,
  drawing_paths     text[] not null default '{}',
  status            text not null default 'review_required' check (
    status in ('not_started', 'generating', 'ready', 'review_required', 'failed')
  ),
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists banner_manufacturing_order_idx
  on public.banner_manufacturing_instructions (order_id, created_at desc);

alter table public.banner_manufacturing_instructions
  add column if not exists status text not null default 'review_required' check (
    status in ('not_started', 'generating', 'ready', 'review_required', 'failed')
  );

alter table public.banner_manufacturing_instructions enable row level security;

drop policy if exists "admins manage banner manufacturing instructions" on public.banner_manufacturing_instructions;
create policy "admins manage banner manufacturing instructions"
  on public.banner_manufacturing_instructions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.personalization_models (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  title          text not null,
  slug           text unique not null,
  mock_image_path text,
  boilerplate_image_path text,
  form_schema    jsonb not null default '{}'::jsonb,
  status         text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists personalization_models_subcategory_idx
  on public.personalization_models (subcategory_id, sort_order);

alter table public.personalization_models enable row level security;

drop trigger if exists personalization_models_set_updated_at on public.personalization_models;
create trigger personalization_models_set_updated_at
before update on public.personalization_models
for each row execute function public.set_updated_at();

drop policy if exists "public reads published personalization models" on public.personalization_models;
create policy "public reads published personalization models"
  on public.personalization_models for select
  using (status = 'published' or public.is_admin(auth.uid()));

drop policy if exists "admins manage personalization models" on public.personalization_models;
create policy "admins manage personalization models"
  on public.personalization_models for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.orders
  add column if not exists locale text check (locale is null or locale in ('en', 'ru', 'am')),
  add column if not exists cart_id uuid references public.carts(id) on delete set null,
  add column if not exists transaction_id uuid;

alter table public.order_items
  add column if not exists item_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists personalization_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists production_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists image_path text,
  add column if not exists selected_preview_path text,
  add column if not exists hidden_svg_path text,
  add column if not exists original_image_paths text[] not null default '{}',
  add column if not exists custom_text text,
  add column if not exists led_color text,
  add column if not exists multi_color boolean not null default false,
  add column if not exists banner_size_key text;

insert into public.categories (slug, name, description, sort_order)
values
  ('banners', 'Banners', 'Marketing banners for stores, campaigns, and product promotions.', 50)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.subcategories (category_id, slug, name, description, sort_order)
select id, 'personalized', 'Personalized', 'Personalized night lights generated from images, color, and short text.', 10
from public.categories
where slug = 'night-lights'
on conflict (category_id, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.banner_size_presets (key, name, width_mm, height_mm, material, finish, sort_order)
values
  ('store-window-small', 'Store window small', 600, 300, 'vinyl', 'matte', 10),
  ('store-front-medium', 'Store front medium', 1200, 500, 'vinyl', 'matte', 20),
  ('promo-wide', 'Promo wide', 2000, 800, 'vinyl', 'matte', 30)
on conflict (key) do update
set
  name = excluded.name,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  material = excluded.material,
  finish = excluded.finish,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.personalization_models (
  category_id,
  subcategory_id,
  title,
  slug,
  mock_image_path,
  form_schema,
  status,
  sort_order
)
select
  c.id,
  s.id,
  'Portrait Personalized Night Light',
  'portrait-personalized-night-light',
  '/mock/night-lights/personalized-portrait.png',
  '{
    "maxImages": 3,
    "textMaxLength": 100,
    "comfortableColors": ["warm_white", "soft_amber", "soft_peach", "mint", "sky_blue"],
    "supportsMultiColor": true
  }'::jsonb,
  'published',
  10
from public.categories c
join public.subcategories s on s.category_id = c.id and s.slug = 'personalized'
where c.slug = 'night-lights'
on conflict (slug) do update
set
  category_id = excluded.category_id,
  subcategory_id = excluded.subcategory_id,
  title = excluded.title,
  mock_image_path = excluded.mock_image_path,
  form_schema = excluded.form_schema,
  status = excluded.status,
  sort_order = excluded.sort_order;

insert into public.banner_samples (
  title,
  description,
  prompt,
  image_path,
  reference_paths,
  size_preset_id,
  material_assumptions,
  production_notes,
  status
)
select
  seed.title,
  seed.description,
  seed.prompt,
  seed.image_path,
  '{}'::text[],
  p.id,
  seed.material_assumptions,
  seed.production_notes,
  'published'
from (
  values
    (
      'Grand Opening Store Banner',
      'Bold storefront banner sample for opening announcements and launch offers.',
      'Bright grand opening banner with large readable text and room for product imagery.',
      '/mock/banners/grand-opening.svg',
      'Matte vinyl, indoor or short-term outdoor display.',
      'Confirm final dimensions and mounting method before production.',
      'store-front-medium'
    ),
    (
      'Seasonal Sale Banner',
      'Reusable promotional banner sample for store discounts and seasonal campaigns.',
      'Wide sale banner with strong contrast, simple shapes, and clear discount text.',
      '/mock/banners/seasonal-sale.svg',
      'Matte vinyl with high-contrast printed artwork.',
      'Review brand colors, bleed, and installation constraints before production.',
      'promo-wide'
    )
) as seed(title, description, prompt, image_path, material_assumptions, production_notes, preset_key)
left join public.banner_size_presets p on p.key = seed.preset_key
where not exists (
  select 1 from public.banner_samples existing where existing.title = seed.title
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'catalog-assets',
    'catalog-assets',
    true,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  ),
  (
    'banner-assets',
    'banner-assets',
    true,
    20971520,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']
  ),
  (
    'user-uploads',
    'user-uploads',
    false,
    20971520,
    array['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'generated-assets',
    'generated-assets',
    false,
    20971520,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf', 'application/json']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads catalog assets" on storage.objects;
create policy "public reads catalog assets"
  on storage.objects for select
  using (bucket_id = 'catalog-assets');

drop policy if exists "public reads banner assets" on storage.objects;
create policy "public reads banner assets"
  on storage.objects for select
  using (bucket_id = 'banner-assets');

drop policy if exists "admins manage catalog assets" on storage.objects;
create policy "admins manage catalog assets"
  on storage.objects for all
  using (bucket_id = 'catalog-assets' and public.is_admin(auth.uid()))
  with check (bucket_id = 'catalog-assets' and public.is_admin(auth.uid()));

drop policy if exists "admins manage banner assets" on storage.objects;
create policy "admins manage banner assets"
  on storage.objects for all
  using (bucket_id = 'banner-assets' and public.is_admin(auth.uid()))
  with check (bucket_id = 'banner-assets' and public.is_admin(auth.uid()));

drop policy if exists "users manage own uploads" on storage.objects;
create policy "users manage own uploads"
  on storage.objects for all
  using (
    bucket_id = 'user-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'user-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users manage own generated assets" on storage.objects;
create policy "users manage own generated assets"
  on storage.objects for all
  using (
    bucket_id = 'generated-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'generated-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "admins manage private marketplace assets" on storage.objects;
create policy "admins manage private marketplace assets"
  on storage.objects for all
  using (
    bucket_id in ('user-uploads', 'generated-assets')
    and public.is_admin(auth.uid())
  )
  with check (
    bucket_id in ('user-uploads', 'generated-assets')
    and public.is_admin(auth.uid())
  );
