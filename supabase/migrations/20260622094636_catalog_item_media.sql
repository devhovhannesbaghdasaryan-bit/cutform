update storage.buckets
set
  file_size_limit = greatest(coalesce(file_size_limit, 0), 52428800),
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm'
  ]
where id = 'catalog-assets';

create table if not exists public.catalog_item_media (
  id                uuid primary key default gen_random_uuid(),
  catalog_item_id   uuid not null references public.catalog_items(id) on delete cascade,
  media_type        text not null check (media_type in ('image', 'video')),
  storage_path      text not null,
  alt_text          text,
  poster_path       text,
  sort_order        integer not null default 0,
  is_primary        boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists catalog_item_media_item_sort_idx
  on public.catalog_item_media (catalog_item_id, sort_order, created_at);

create unique index if not exists catalog_item_media_single_primary_idx
  on public.catalog_item_media (catalog_item_id)
  where is_primary;

drop trigger if exists catalog_item_media_set_updated_at on public.catalog_item_media;
create trigger catalog_item_media_set_updated_at
before update on public.catalog_item_media
for each row execute function public.set_updated_at();

insert into public.catalog_item_media (
  catalog_item_id,
  media_type,
  storage_path,
  alt_text,
  poster_path,
  sort_order,
  is_primary,
  metadata
)
select
  id,
  'image',
  thumbnail_path,
  title,
  null,
  0,
  true,
  '{"source":"legacy_thumbnail"}'::jsonb
from public.catalog_items
where thumbnail_path is not null
  and not exists (
    select 1
    from public.catalog_item_media existing
    where existing.catalog_item_id = catalog_items.id
  );

alter table public.catalog_item_media enable row level security;

drop policy if exists "public reads published catalog media" on public.catalog_item_media;
create policy "public reads published catalog media"
  on public.catalog_item_media for select
  using (
    exists (
      select 1
      from public.catalog_items item
      where item.id = catalog_item_media.catalog_item_id
        and (item.status = 'published' or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "admins manage catalog media" on public.catalog_item_media;
create policy "admins manage catalog media"
  on public.catalog_item_media for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
