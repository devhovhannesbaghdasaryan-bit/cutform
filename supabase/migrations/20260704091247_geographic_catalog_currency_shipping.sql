-- Geographic catalog availability, default currencies, and per-item shipping.

create table public.market_regions (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name                  text not null check (length(trim(name)) > 0),
  default_currency_code text references public.currencies(code),
  sort_order            integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.countries (
  code                  text primary key check (code ~ '^[A-Z]{2}$'),
  name                  text not null check (length(trim(name)) > 0),
  region_id             uuid not null references public.market_regions(id),
  default_currency_code text references public.currencies(code),
  sort_order            integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index countries_region_active_idx
  on public.countries (region_id, is_active, sort_order, name);

create table public.catalog_item_market_rules (
  id                    uuid primary key default gen_random_uuid(),
  catalog_item_id       uuid not null references public.catalog_items(id) on delete cascade,
  region_id             uuid references public.market_regions(id) on delete cascade,
  country_code          text references public.countries(code) on delete cascade,
  visibility_override   boolean,
  shipping_rate_cents   integer check (shipping_rate_cents >= 0),
  shipping_currency     text not null default 'AMD' references public.currencies(code),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (num_nonnulls(region_id, country_code) = 1),
  check (visibility_override is not null or shipping_rate_cents is not null),
  check (shipping_currency = 'AMD')
);

create unique index catalog_item_market_rules_region_uidx
  on public.catalog_item_market_rules (catalog_item_id, region_id)
  where region_id is not null;

create unique index catalog_item_market_rules_country_uidx
  on public.catalog_item_market_rules (catalog_item_id, country_code)
  where country_code is not null;

create index catalog_item_market_rules_item_idx
  on public.catalog_item_market_rules (catalog_item_id);

alter table public.profiles
  add column if not exists preferred_country_code text references public.countries(code);

alter table public.carts
  add column if not exists destination_country_code text references public.countries(code);

alter table public.orders
  add column if not exists destination_country_code text references public.countries(code),
  add column if not exists shipping_cents integer not null default 0 check (shipping_cents >= 0),
  add column if not exists total_cents integer check (total_cents >= 0),
  add column if not exists shipping_rate_context jsonb not null default '{}'::jsonb;

update public.orders
set total_cents = subtotal_cents + shipping_cents
where total_cents is null;

alter table public.orders alter column total_cents set not null;

alter table public.order_items
  add column if not exists shipping_unit_cents integer not null default 0 check (shipping_unit_cents >= 0),
  add column if not exists shipping_total_cents integer not null default 0 check (shipping_total_cents >= 0),
  add column if not exists shipping_rate_context jsonb not null default '{}'::jsonb;

drop trigger if exists market_regions_set_updated_at on public.market_regions;
create trigger market_regions_set_updated_at
before update on public.market_regions
for each row execute function public.set_updated_at();

drop trigger if exists countries_set_updated_at on public.countries;
create trigger countries_set_updated_at
before update on public.countries
for each row execute function public.set_updated_at();

drop trigger if exists catalog_item_market_rules_set_updated_at on public.catalog_item_market_rules;
create trigger catalog_item_market_rules_set_updated_at
before update on public.catalog_item_market_rules
for each row execute function public.set_updated_at();

insert into public.market_regions (slug, name, sort_order)
values
  ('africa', 'Africa', 10),
  ('americas', 'Americas', 20),
  ('asia', 'Asia', 30),
  ('europe', 'Europe', 40),
  ('oceania', 'Oceania', 50)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Names are rendered through Intl.DisplayNames in the application. Keeping the
-- canonical ISO code as the stored fallback makes this seed compact and locale-neutral.
with country_groups(region_slug, codes) as (
  values
    ('africa', 'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW'),
    ('americas', 'AI AG AR AW BS BB BZ BM BO BQ BR CA KY CL CO CR CU CW DM DO EC SV FK GF GL GD GP GT GY HT HN JM MQ MX MS NI PA PY PE PR BL KN LC MF PM VC SX SR TT TC US UY VE VG VI'),
    ('asia', 'AF AM AZ BH BD BT BN KH CN CX CC IO CY GE HK IN ID IR IQ IL JP JO KZ KP KR KW KG LA LB MO MY MV MN MM NP OM PK PS PH QA SA SG LK SY TW TJ TH TL TR TM AE UZ VN YE'),
    ('europe', 'AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB'),
    ('oceania', 'AQ AS AU BV CK FJ PF TF GU HM KI MH FM NR NC NZ NU NF MP PW PG PN WS SB GS TK TO TV UM VU WF')
), expanded as (
  select region_slug, unnest(string_to_array(codes, ' ')) as code
  from country_groups
)
insert into public.countries (code, name, region_id)
select expanded.code, expanded.code, regions.id
from expanded
join public.market_regions regions on regions.slug = expanded.region_slug
on conflict (code) do update set region_id = excluded.region_id;

alter table public.market_regions enable row level security;
alter table public.countries enable row level security;
alter table public.catalog_item_market_rules enable row level security;

create policy "public reads active market regions"
  on public.market_regions for select
  to anon, authenticated
  using (is_active or public.is_admin((select auth.uid())));

create policy "admins insert market regions"
  on public.market_regions for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

create policy "admins update market regions"
  on public.market_regions for update to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

create policy "admins delete market regions"
  on public.market_regions for delete to authenticated
  using (public.is_admin((select auth.uid())));

create policy "public reads active countries"
  on public.countries for select
  to anon, authenticated
  using (is_active or public.is_admin((select auth.uid())));

create policy "admins insert countries"
  on public.countries for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

create policy "admins update countries"
  on public.countries for update to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

create policy "admins delete countries"
  on public.countries for delete to authenticated
  using (public.is_admin((select auth.uid())));

create policy "public reads published catalog market rules"
  on public.catalog_item_market_rules for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.catalog_items
      where catalog_items.id = catalog_item_market_rules.catalog_item_id
        and (catalog_items.status = 'published' or public.is_admin((select auth.uid())))
    )
  );

create policy "admins insert catalog market rules"
  on public.catalog_item_market_rules for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

create policy "admins update catalog market rules"
  on public.catalog_item_market_rules for update to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

create policy "admins delete catalog market rules"
  on public.catalog_item_market_rules for delete to authenticated
  using (public.is_admin((select auth.uid())));

grant select on public.market_regions, public.countries, public.catalog_item_market_rules to anon, authenticated;
grant insert, update, delete on public.market_regions, public.countries, public.catalog_item_market_rules to authenticated;
grant all on public.market_regions, public.countries, public.catalog_item_market_rules to service_role;
