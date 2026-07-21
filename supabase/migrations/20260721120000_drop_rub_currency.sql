-- Drop RUB from the storefront: disable the row and purge cached RUB rates.
-- Historical transactions keep their stored currency string untouched.
update public.currencies set is_enabled = false where code = 'RUB';

delete from public.exchange_rates
where base_currency = 'RUB' or target_currency = 'RUB';
