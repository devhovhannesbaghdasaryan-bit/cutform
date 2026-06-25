-- Snip marketplace MVP foundation

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'user' check (role in ('user', 'admin')),
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = uid
      and role = 'admin'
  );
$$;

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

alter table public.categories enable row level security;

create table if not exists public.catalog_items (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references public.categories(id),
  title               text not null,
  slug                text unique not null,
  description         text,
  price_cents         integer not null check (price_cents >= 0),
  currency            text not null default 'USD',
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_popular          boolean not null default false,
  is_customizable     boolean not null default false,
  product_source      text not null default 'catalog' check (product_source in ('catalog', 'admin_generated')),
  thumbnail_path      text,
  gallery_paths       text[] not null default '{}',
  manufacturing_notes text,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists catalog_items_published_category_idx
  on public.catalog_items (category_id, created_at desc)
  where status = 'published';

create index if not exists catalog_items_popular_idx
  on public.catalog_items (is_popular, created_at desc)
  where status = 'published';

alter table public.catalog_items enable row level security;

create table if not exists public.token_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.token_accounts enable row level security;

create table if not exists public.token_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  delta          integer not null,
  reason         text not null check (reason in ('purchase', 'generation_spend', 'generation_refund', 'admin_adjustment')),
  reference_type text,
  reference_id   uuid,
  created_at     timestamptz not null default now()
);

create index if not exists token_ledger_user_created_idx
  on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;

create table if not exists public.generated_items (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  generated_by           uuid references auth.users(id),
  product_type           text not null check (
    product_type in (
      'night_light',
      'laser_cut_2d_toy',
      'laser_cut_2d_decoration',
      'laser_cut_2d_constructor'
    )
  ),
  category_id            uuid references public.categories(id),
  title                  text,
  source_image_path      text,
  prompt                 text,
  custom_text            text,
  svg_content            text not null,
  preview_path           text,
  manufacturing_metadata jsonb not null default '{}'::jsonb,
  token_cost             integer not null default 0 check (token_cost >= 0),
  review_status          text not null default 'draft' check (
    review_status in ('draft', 'preview_ready', 'review_required', 'approved', 'rejected')
  ),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists generated_items_user_created_idx
  on public.generated_items (user_id, created_at desc);

create index if not exists generated_items_review_idx
  on public.generated_items (review_status, created_at desc);

alter table public.generated_items enable row level security;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'draft' check (
    status in (
      'draft',
      'pending_payment',
      'paid',
      'review_required',
      'approved_for_production',
      'in_production',
      'ready_to_ship',
      'shipped',
      'cancelled',
      'refunded'
    )
  ),
  payment_status   text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded', 'failed')),
  subtotal_cents   integer not null check (subtotal_cents >= 0),
  currency         text not null default 'USD',
  shipping_address jsonb,
  contact_email    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

alter table public.orders enable row level security;

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  catalog_item_id   uuid references public.catalog_items(id),
  generated_item_id uuid references public.generated_items(id),
  title             text not null,
  quantity          integer not null default 1 check (quantity > 0),
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  total_price_cents integer not null check (total_price_cents >= 0),
  check (
    (catalog_item_id is not null and generated_item_id is null)
    or (catalog_item_id is null and generated_item_id is not null)
  )
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

alter table public.order_items enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.token_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalog_items_set_updated_at on public.catalog_items;
create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function public.set_updated_at();

drop trigger if exists token_accounts_set_updated_at on public.token_accounts;
create trigger token_accounts_set_updated_at
before update on public.token_accounts
for each row execute function public.set_updated_at();

drop trigger if exists generated_items_set_updated_at on public.generated_items;
create trigger generated_items_set_updated_at
before update on public.generated_items
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (user_id, display_name)
select id, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
from auth.users
on conflict (user_id) do nothing;

insert into public.token_accounts (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles"
  on public.profiles for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "public reads active categories" on public.categories;
create policy "public reads active categories"
  on public.categories for select
  using (is_active or public.is_admin(auth.uid()));

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories"
  on public.categories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "public reads published catalog items" on public.catalog_items;
create policy "public reads published catalog items"
  on public.catalog_items for select
  using (status = 'published' or public.is_admin(auth.uid()));

drop policy if exists "admins manage catalog items" on public.catalog_items;
create policy "admins manage catalog items"
  on public.catalog_items for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "users read own token account" on public.token_accounts;
create policy "users read own token account"
  on public.token_accounts for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users read own token ledger" on public.token_ledger;
create policy "users read own token ledger"
  on public.token_ledger for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users read own generated items" on public.generated_items;
create policy "users read own generated items"
  on public.generated_items for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users insert own generated items" on public.generated_items;
create policy "users insert own generated items"
  on public.generated_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own draft generated items" on public.generated_items;
create policy "users update own draft generated items"
  on public.generated_items for update
  using (auth.uid() = user_id and review_status in ('draft', 'preview_ready'))
  with check (auth.uid() = user_id);

drop policy if exists "admins manage generated items" on public.generated_items;
create policy "admins manage generated items"
  on public.generated_items for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users insert own orders" on public.orders;
create policy "users insert own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

drop policy if exists "admins manage orders" on public.orders;
create policy "admins manage orders"
  on public.orders for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "users read own order items" on public.order_items;
create policy "users read own order items"
  on public.order_items for select
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and (orders.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "users insert own order items" on public.order_items;
create policy "users insert own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

drop policy if exists "admins manage order items" on public.order_items;
create policy "admins manage order items"
  on public.order_items for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.categories (slug, name, description, sort_order)
values
  ('toys', 'Toys', 'Wooden vehicles, playful kits, and crafted toy designs.', 10),
  ('constructors', 'Constructors', 'Buildable wooden kits and construction-inspired products.', 20),
  ('decorations', 'Decorations', 'Laser-cut decor for shelves, walls, holidays, and gifts.', 30),
  ('night-lights', 'Night lights', 'Custom acrylic and wooden night lights with engraved artwork.', 40)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.catalog_items (
  category_id,
  title,
  slug,
  description,
  price_cents,
  status,
  is_popular,
  is_customizable,
  manufacturing_notes
)
select categories.id, seed.title, seed.slug, seed.description, seed.price_cents, 'published', seed.is_popular, seed.is_customizable, seed.manufacturing_notes
from (
  values
    ('toys', 'Wooden Crane Truck', 'wooden-crane-truck', 'A handcrafted construction vehicle with rolling wheels and a simple lifting arm.', 3900, true, false, 'Catalog item assembled from wood parts.'),
    ('toys', 'Mini Road Roller', 'mini-road-roller', 'Compact wooden road roller inspired by classic construction toys.', 2900, false, false, 'Rounded edges recommended for production.'),
    ('constructors', 'Loader Constructor Kit', 'loader-constructor-kit', 'A flat-pack wooden kit that assembles into a small loader model.', 4900, true, false, 'Requires reviewed tab-slot files before production.'),
    ('constructors', 'Tower Crane Kit', 'tower-crane-kit', 'A display constructor kit with layered crane parts and a small hanging bucket.', 5900, true, false, 'Decorative model kit; not certified as a children''s toy.'),
    ('decorations', 'Layered Mountain Decor', 'layered-mountain-decor', 'A laser-cut layered wood decoration for shelves and desks.', 3400, true, true, 'Can later support custom image generation.'),
    ('decorations', 'Custom Name Sign', 'custom-name-sign', 'A simple wood sign product for personalized names and short phrases.', 2500, false, true, 'Manual text customization in MVP.'),
    ('night-lights', 'Portrait Night Light', 'portrait-night-light', 'An acrylic night light with pencil-style engraving and a wooden text stand.', 6500, true, true, 'Generated version uses acrylic engraving plus wood base engraving.'),
    ('night-lights', 'Pet Silhouette Night Light', 'pet-silhouette-night-light', 'A warm desk night light based on a clean engraved silhouette.', 5900, false, true, 'Generated version should simplify image details.')
) as seed(category_slug, title, slug, description, price_cents, is_popular, is_customizable, manufacturing_notes)
join public.categories on categories.slug = seed.category_slug
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  price_cents = excluded.price_cents,
  status = excluded.status,
  is_popular = excluded.is_popular,
  is_customizable = excluded.is_customizable,
  manufacturing_notes = excluded.manufacturing_notes,
  category_id = excluded.category_id;
