-- Run with: supabase db query -f scripts/smoke/database-rls-smoke.sql

with expected(tablename) as (
  values
    ('catalog_item_seo_metadata'),
    ('carts'),
    ('cart_items'),
    ('transactions'),
    ('generated_item_artifacts'),
    ('personalized_preview_options'),
    ('banner_samples'),
    ('banner_manufacturing_instructions'),
    ('personalization_models')
)
select expected.tablename as missing_table
from expected
where not exists (
  select 1
  from pg_tables
  where schemaname = 'public'
    and pg_tables.tablename = expected.tablename
);

select relname as table_without_rls
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and relkind = 'r'
  and relname in (
    'catalog_item_seo_metadata',
    'carts',
    'cart_items',
    'transactions',
    'generated_item_artifacts',
    'personalized_preview_options',
    'banner_samples',
    'banner_manufacturing_instructions',
    'personalization_models'
  )
  and not relrowsecurity;

select bucket_id, name
from storage.objects
where bucket_id not in ('catalog-assets', 'banner-assets', 'user-uploads', 'generated-assets')
limit 1;
