-- Credits-only accounting refactor.
-- Credits are now the only generation currency. This migration keeps existing
-- local balances by folding old token balance + banner credit balance into one
-- credit account balance, then removes token-specific schema.

alter table if exists public.token_accounts rename to credit_accounts;
alter table if exists public.token_ledger rename to credit_ledger;

alter index if exists public.token_ledger_user_created_idx rename to credit_ledger_user_created_idx;

update public.credit_accounts
set balance = balance + coalesce(credit_balance, 0)
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'credit_accounts'
    and column_name = 'credit_balance'
);

alter table public.credit_accounts
  drop column if exists credit_balance;

drop trigger if exists token_accounts_set_updated_at on public.credit_accounts;
drop trigger if exists credit_accounts_set_updated_at on public.credit_accounts;
create trigger credit_accounts_set_updated_at
before update on public.credit_accounts
for each row execute function public.set_updated_at();

drop policy if exists "users read own token account" on public.credit_accounts;
drop policy if exists "users read own credit account" on public.credit_accounts;
create policy "users read own credit account"
  on public.credit_accounts for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users read own token ledger" on public.credit_ledger;
drop policy if exists "users read own credit ledger" on public.credit_ledger;
create policy "users read own credit ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

alter table public.transactions
  rename column token_ledger_id to credit_ledger_id;

alter table public.transactions
  drop constraint if exists transactions_token_ledger_id_fkey,
  drop constraint if exists transactions_credit_ledger_id_fkey;

alter table public.transactions
  add constraint transactions_credit_ledger_id_fkey
  foreign key (credit_ledger_id) references public.credit_ledger(id) on delete set null;

update public.transactions
set type = case type
  when 'token_purchase' then 'credit_purchase'
  when 'token_spend' then 'credit_spend'
  when 'token_refund' then 'credit_refund'
  else type
end;

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('payment', 'refund', 'credit_purchase', 'credit_spend', 'credit_refund', 'manual_adjustment', 'reversal'));

update public.generated_items
set credit_cost = credit_cost + coalesce(token_cost, 0)
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'generated_items'
    and column_name = 'token_cost'
);

alter table public.generated_items
  drop column if exists token_cost;

update public.personalization_models
set form_schema = (form_schema - 'tokenCost')
  || jsonb_build_object('creditCost', coalesce((form_schema->>'tokenCost')::integer, 0))
where form_schema ? 'tokenCost';

alter table if exists public.generation_sessions
  rename column input_tokens to input_units;

alter table if exists public.generation_sessions
  rename column output_tokens to output_units;

alter table if exists public.products
  rename column input_tokens to input_units;

alter table if exists public.products
  rename column output_tokens to output_units;

alter table if exists public.products
  rename column token_cost_cents to api_cost_cents;

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

  insert into public.credit_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.credit_accounts (user_id)
select id
from auth.users
on conflict (user_id) do nothing;
