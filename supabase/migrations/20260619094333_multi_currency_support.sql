create table if not exists public.currencies (
  code            text primary key check (code in ('AMD', 'EUR', 'USD', 'RUB')),
  name            text not null,
  symbol          text not null,
  is_enabled      boolean not null default true,
  is_default      boolean not null default false,
  payment_route   text not null check (payment_route in ('stripe', 'bank_manual')),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists currencies_single_default_idx
  on public.currencies (is_default)
  where is_default;

create or replace function public.ensure_currency_settings_valid()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.currencies where is_enabled) then
    raise exception 'At least one currency must remain enabled.';
  end if;

  if not exists (select 1 from public.currencies where is_default and is_enabled) then
    raise exception 'The default currency must remain enabled.';
  end if;

  return null;
end;
$$;

drop trigger if exists currencies_validate_after_change on public.currencies;
create trigger currencies_validate_after_change
after insert or update or delete on public.currencies
for each row execute function public.ensure_currency_settings_valid();

drop trigger if exists currencies_set_updated_at on public.currencies;
create trigger currencies_set_updated_at
before update on public.currencies
for each row execute function public.set_updated_at();

insert into public.currencies (code, name, symbol, is_enabled, is_default, payment_route, sort_order)
values
  ('AMD', 'Armenian dram', '֏', true, true, 'bank_manual', 10),
  ('EUR', 'Euro', '€', true, false, 'stripe', 20),
  ('USD', 'US dollar', '$', true, false, 'stripe', 30),
  ('RUB', 'Russian ruble', '₽', true, false, 'bank_manual', 40)
on conflict (code) do update
set
  name = excluded.name,
  symbol = excluded.symbol,
  payment_route = excluded.payment_route,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.exchange_rates (
  id               uuid primary key default gen_random_uuid(),
  base_currency    text not null references public.currencies(code),
  target_currency  text not null references public.currencies(code),
  rate             numeric(18, 8) not null check (rate > 0),
  provider         text not null,
  rate_date        date not null,
  fetched_at       timestamptz not null default now(),
  is_stale         boolean not null default false,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (base_currency, target_currency, rate_date)
);

create index if not exists exchange_rates_pair_date_idx
  on public.exchange_rates (base_currency, target_currency, rate_date desc);

insert into public.exchange_rates (base_currency, target_currency, rate, provider, rate_date, fetched_at, is_stale, metadata)
values
  ('AMD', 'AMD', 1, 'seed', current_date, now(), false, '{"source":"seed_identity"}'::jsonb),
  ('AMD', 'EUR', 0.0024, 'seed', current_date, now(), true, '{"source":"seed_fallback"}'::jsonb),
  ('AMD', 'USD', 0.0026, 'seed', current_date, now(), true, '{"source":"seed_fallback"}'::jsonb),
  ('AMD', 'RUB', 0.21, 'seed', current_date, now(), true, '{"source":"seed_fallback"}'::jsonb)
on conflict (base_currency, target_currency, rate_date) do nothing;

alter table public.profiles
  add column if not exists preferred_currency text references public.currencies(code);

alter table public.carts
  add column if not exists exchange_rate_context jsonb not null default '{}'::jsonb;

alter table public.order_items
  add column if not exists currency text not null default 'AMD',
  add column if not exists exchange_rate_context jsonb not null default '{}'::jsonb;

alter table public.orders
  add column if not exists exchange_rate_context jsonb not null default '{}'::jsonb,
  add column if not exists payment_provider_route text;

alter table public.transactions
  add column if not exists exchange_rate_context jsonb not null default '{}'::jsonb,
  add column if not exists payment_provider_route text;

update public.carts set currency = 'AMD' where currency is null or currency = 'USD';
update public.cart_items set currency = 'AMD' where currency is null or currency = 'USD';
update public.orders set currency = 'AMD' where currency is null or currency = 'USD';
update public.order_items set currency = 'AMD' where currency is null or currency = 'USD';
update public.transactions set currency = 'AMD' where currency is null or currency = 'USD';

update public.orders
set payment_provider_route = case
  when currency in ('USD', 'EUR') then 'stripe'
  else 'bank_manual'
end
where payment_provider_route is null;

update public.transactions
set payment_provider_route = case
  when provider = 'stripe' then 'stripe'
  when currency in ('USD', 'EUR') then 'stripe'
  else 'bank_manual'
end
where payment_provider_route is null;

alter table public.carts
  alter column currency set default 'AMD';

alter table public.cart_items
  alter column currency set default 'AMD';

alter table public.orders
  alter column currency set default 'AMD';

alter table public.order_items
  alter column currency set default 'AMD';

alter table public.transactions
  alter column currency set default 'AMD';

alter table public.carts
  drop constraint if exists carts_currency_fkey,
  add constraint carts_currency_fkey foreign key (currency) references public.currencies(code);

alter table public.cart_items
  drop constraint if exists cart_items_currency_fkey,
  add constraint cart_items_currency_fkey foreign key (currency) references public.currencies(code);

alter table public.orders
  drop constraint if exists orders_currency_fkey,
  add constraint orders_currency_fkey foreign key (currency) references public.currencies(code),
  drop constraint if exists orders_payment_provider_route_check,
  add constraint orders_payment_provider_route_check check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual'));

alter table public.order_items
  drop constraint if exists order_items_currency_fkey,
  add constraint order_items_currency_fkey foreign key (currency) references public.currencies(code);

alter table public.transactions
  drop constraint if exists transactions_currency_fkey,
  add constraint transactions_currency_fkey foreign key (currency) references public.currencies(code),
  drop constraint if exists transactions_payment_provider_route_check,
  add constraint transactions_payment_provider_route_check check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'manual'));

alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;

drop policy if exists "public reads currencies" on public.currencies;
create policy "public reads currencies"
  on public.currencies for select
  using (true);

drop policy if exists "admins manage currencies" on public.currencies;
create policy "admins manage currencies"
  on public.currencies for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "public reads exchange rates" on public.exchange_rates;
create policy "public reads exchange rates"
  on public.exchange_rates for select
  using (true);

drop policy if exists "admins manage exchange rates" on public.exchange_rates;
create policy "admins manage exchange rates"
  on public.exchange_rates for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
