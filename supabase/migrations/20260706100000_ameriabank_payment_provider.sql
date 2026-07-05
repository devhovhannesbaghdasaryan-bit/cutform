-- Ameriabank vPOS payment provider support.
-- Numeric OrderID source (vPOS requires unique integer order ids within a
-- bank-assigned range; the env-level AMERIA_ORDER_ID_BASE offset aligns this
-- sequence to that range per environment).

create sequence if not exists public.ameria_order_ids;

create or replace function public.next_ameria_order_id()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.ameria_order_ids');
$$;

revoke all on function public.next_ameria_order_id() from public;
revoke all on function public.next_ameria_order_id() from anon;
revoke all on function public.next_ameria_order_id() from authenticated;
grant execute on function public.next_ameria_order_id() to service_role;

-- Allow the new route value. Keep 'stripe' so historical rows stay valid.
alter table public.orders
  drop constraint if exists orders_payment_provider_route_check;
alter table public.orders
  add constraint orders_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'ameria'));

alter table public.transactions
  drop constraint if exists transactions_payment_provider_route_check;
alter table public.transactions
  add constraint transactions_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'manual', 'ameria'));

alter table public.currencies
  drop constraint if exists currencies_payment_route_check;
alter table public.currencies
  add constraint currencies_payment_route_check
    check (payment_route in ('stripe', 'bank_manual', 'ameria'));

-- Route all currencies to Ameriabank by default; admins can flip individual
-- currencies back to bank_manual from /admin/currencies.
update public.currencies
set payment_route = 'ameria'
where code in ('AMD', 'USD', 'EUR', 'RUB');
