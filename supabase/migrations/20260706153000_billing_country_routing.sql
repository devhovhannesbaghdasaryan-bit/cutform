-- Billing-country-based payment routing: AM -> ameria, else -> polar.
-- Adds the 'polar' route value and a billing_country_code on orders.
-- 'stripe'/'bank_manual'/'manual' are kept so historical rows stay valid.

alter table public.orders
  drop constraint if exists orders_payment_provider_route_check;
alter table public.orders
  add constraint orders_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'ameria', 'polar'));

alter table public.transactions
  drop constraint if exists transactions_payment_provider_route_check;
alter table public.transactions
  add constraint transactions_payment_provider_route_check
    check (payment_provider_route is null or payment_provider_route in ('stripe', 'bank_manual', 'manual', 'ameria', 'polar'));

alter table public.orders
  add column if not exists billing_country_code text;
