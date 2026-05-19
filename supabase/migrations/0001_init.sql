-- Snip v1 initial schema

create extension if not exists "pgcrypto";

-- Products: approved SVGs visible on a user's dashboard
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  svg_content       text not null,
  input_tokens      integer not null default 0,
  output_tokens     integer not null default 0,
  token_cost_cents  integer not null default 0,
  markup_cents      integer not null default 1000,
  price_cents       integer not null default 0,
  created_at        timestamptz not null default now()
);
create index products_user_created_idx on public.products (user_id, created_at desc);

alter table public.products enable row level security;

create policy "owner reads products"
  on public.products for select
  using (auth.uid() = user_id);

create policy "owner inserts products"
  on public.products for insert
  with check (auth.uid() = user_id);

-- Transient generation sessions; deleted on approval
create table public.generation_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  image_path      text not null,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  last_title      text,
  last_svg        text,
  updated_at      timestamptz not null default now()
);
create index generation_sessions_user_updated_idx
  on public.generation_sessions (user_id, updated_at desc);

alter table public.generation_sessions enable row level security;

create policy "owner reads sessions"
  on public.generation_sessions for select
  using (auth.uid() = user_id);

create policy "owner inserts sessions"
  on public.generation_sessions for insert
  with check (auth.uid() = user_id);

create policy "owner updates sessions"
  on public.generation_sessions for update
  using (auth.uid() = user_id);

create policy "owner deletes sessions"
  on public.generation_sessions for delete
  using (auth.uid() = user_id);

-- Storage bucket for reference image uploads (private)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- Storage RLS: a user can only act on objects under their own user_id prefix.
-- Path convention: <user_id>/<session_id>.<ext>
create policy "owner reads own uploads"
  on storage.objects for select
  using (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner inserts own uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner deletes own uploads"
  on storage.objects for delete
  using (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
