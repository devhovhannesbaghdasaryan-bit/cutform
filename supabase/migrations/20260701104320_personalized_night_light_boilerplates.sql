create table if not exists public.personalization_boilerplates (
  id                  uuid primary key default gen_random_uuid(),
  model_id            uuid not null references public.personalization_models(id) on delete cascade,
  admin_name          text not null,
  name_en             text,
  name_hy             text,
  name_ru             text,
  image_path          text not null,
  manufacturing_process text not null default '',
  generation_instruction text not null default '',
  generate_hidden_svg boolean not null default false,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (model_id, admin_name)
);

create index if not exists personalization_boilerplates_model_order_idx
  on public.personalization_boilerplates (model_id, is_active, sort_order, created_at);

alter table public.personalization_boilerplates enable row level security;

drop trigger if exists personalization_boilerplates_set_updated_at on public.personalization_boilerplates;
create trigger personalization_boilerplates_set_updated_at
before update on public.personalization_boilerplates
for each row execute function public.set_updated_at();

drop policy if exists "customers read active personalization boilerplates" on public.personalization_boilerplates;
create policy "customers read active personalization boilerplates"
  on public.personalization_boilerplates for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.personalization_models
      where personalization_models.id = personalization_boilerplates.model_id
        and personalization_models.status = 'published'
    )
  );

drop policy if exists "admins manage personalization boilerplates" on public.personalization_boilerplates;
create policy "admins manage personalization boilerplates"
  on public.personalization_boilerplates for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

alter table public.personalized_preview_options
  alter column hidden_svg_path drop not null;

alter table public.personalized_preview_options
  drop constraint if exists personalized_preview_options_option_index_check;

alter table public.personalized_preview_options
  add constraint personalized_preview_options_option_index_check check (option_index > 0);

alter table public.personalized_preview_options
  add column if not exists boilerplate_id uuid references public.personalization_boilerplates(id) on delete set null;

do $$
declare
  target_model_id uuid;
begin
  select id into target_model_id
  from public.personalization_models
  where slug = 'portrait-personalized-night-light';

  if target_model_id is not null then
    insert into public.personalization_boilerplates (
      model_id, admin_name, name_en, name_hy, name_ru, image_path,
      manufacturing_process, generation_instruction,
      generate_hidden_svg, is_active, sort_order
    ) values
      (
        target_model_id, 'Rectangular UV print', 'Rectangular UV print',
        'Ուղղանկյուն UV տպագրություն', 'Прямоугольная УФ-печать',
        '/product-references/night-lights/rectangular-uv-print.jpg',
        'rectangular UV-printed acrylic',
        'Preserve the rectangular panel and base and create an elegant full-color keepsake.',
        false, true, 10
      ),
      (
        target_model_id, 'Round UV print', 'Round UV print',
        'Կլոր UV տպագրություն', 'Круглая УФ-печать',
        '/product-references/night-lights/round-uv-print.jpg',
        'round UV-printed acrylic',
        'Preserve the circular panel and round base and balance the artwork inside the circle.',
        false, true, 20
      ),
      (
        target_model_id, 'Contour laser engraved', 'Contour laser engraved',
        'Եզրագծային լազերային փորագրություն', 'Контурная лазерная гравировка',
        '/product-references/night-lights/contour-laser-engraved.jpg',
        'contour-cut CO2-laser-engraved acrylic',
        'Derive a simple outer silhouette and render the subject as monochrome engraved vector line art.',
        true, true, 30
      )
    on conflict (model_id, admin_name) do update set
      name_en = excluded.name_en,
      name_hy = excluded.name_hy,
      name_ru = excluded.name_ru,
      image_path = excluded.image_path,
      manufacturing_process = excluded.manufacturing_process,
      generation_instruction = excluded.generation_instruction,
      generate_hidden_svg = excluded.generate_hidden_svg,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;
  end if;
end $$;
