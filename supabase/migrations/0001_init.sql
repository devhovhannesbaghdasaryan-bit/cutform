create extension if not exists "pgcrypto";

create schema if not exists "private";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where user_id = uid
      and role = 'admin'
  );
$function$
;

create sequence "public"."ameria_order_ids";


  create table "public"."admin_audit_log" (
    "id" uuid not null default gen_random_uuid(),
    "actor_user_id" uuid,
    "target_user_id" uuid,
    "action" text not null,
    "entity_type" text not null,
    "entity_id" uuid,
    "reason" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."admin_audit_log" enable row level security;


  create table "public"."admin_permissions" (
    "user_id" uuid not null,
    "permission" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."admin_permissions" enable row level security;


  create table "public"."banner_manufacturing_instructions" (
    "id" uuid not null default gen_random_uuid(),
    "order_id" uuid,
    "order_item_id" uuid,
    "generated_item_id" uuid,
    "source_image_path" text not null,
    "instructions" jsonb not null,
    "drawing_paths" text[] not null default '{}'::text[],
    "status" text not null default 'review_required'::text,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."banner_manufacturing_instructions" enable row level security;


  create table "public"."banner_samples" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "prompt" text,
    "image_path" text not null,
    "reference_paths" text[] not null default '{}'::text[],
    "size_preset_id" uuid,
    "material_assumptions" text,
    "production_notes" text,
    "status" text not null default 'draft'::text,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."banner_samples" enable row level security;


  create table "public"."banner_size_presets" (
    "id" uuid not null default gen_random_uuid(),
    "key" text not null,
    "name" text not null,
    "width_mm" integer not null,
    "height_mm" integer not null,
    "material" text,
    "finish" text,
    "is_active" boolean not null default true,
    "sort_order" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."banner_size_presets" enable row level security;


  create table "public"."cart_items" (
    "id" uuid not null default gen_random_uuid(),
    "cart_id" uuid not null,
    "catalog_item_id" uuid,
    "generated_item_id" uuid,
    "banner_sample_id" uuid,
    "title" text not null,
    "quantity" integer not null default 1,
    "unit_price_cents" integer not null,
    "currency" text not null default 'AMD'::text,
    "configuration" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."cart_items" enable row level security;


  create table "public"."carts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "session_id" text,
    "status" text not null default 'active'::text,
    "currency" text not null default 'AMD'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "exchange_rate_context" jsonb not null default '{}'::jsonb,
    "destination_country_code" text
      );


alter table "public"."carts" enable row level security;


  create table "public"."catalog_item_market_rules" (
    "id" uuid not null default gen_random_uuid(),
    "catalog_item_id" uuid not null,
    "region_id" uuid,
    "country_code" text,
    "visibility_override" boolean,
    "shipping_rate_cents" integer,
    "shipping_currency" text not null default 'AMD'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."catalog_item_market_rules" enable row level security;


  create table "public"."catalog_item_media" (
    "id" uuid not null default gen_random_uuid(),
    "catalog_item_id" uuid not null,
    "media_type" text not null,
    "storage_path" text not null,
    "alt_text" text,
    "poster_path" text,
    "sort_order" integer not null default 0,
    "is_primary" boolean not null default false,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."catalog_item_media" enable row level security;


  create table "public"."catalog_item_seo_metadata" (
    "catalog_item_id" uuid not null,
    "locale" text not null,
    "seo_title" text,
    "seo_description" text,
    "seo_slug" text,
    "keywords" text[] not null default '{}'::text[],
    "og_title" text,
    "og_description" text,
    "social_image_path" text,
    "noindex" boolean not null default false,
    "generated_by_ai" boolean not null default false,
    "reviewed_by_admin" boolean not null default false,
    "updated_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."catalog_item_seo_metadata" enable row level security;


  create table "public"."catalog_item_translations" (
    "catalog_item_id" uuid not null,
    "locale" text not null,
    "title" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."catalog_item_translations" enable row level security;


  create table "public"."catalog_items" (
    "id" uuid not null default gen_random_uuid(),
    "category_id" uuid not null,
    "title" text not null,
    "slug" text not null,
    "description" text,
    "price_cents" integer not null,
    "currency" text not null default 'USD'::text,
    "status" text not null default 'draft'::text,
    "is_popular" boolean not null default false,
    "is_customizable" boolean not null default false,
    "product_source" text not null default 'catalog'::text,
    "thumbnail_path" text,
    "gallery_paths" text[] not null default '{}'::text[],
    "manufacturing_notes" text,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "subcategory_id" uuid,
    "item_type" text not null default 'standard'::text,
    "sizes" jsonb not null default '[]'::jsonb,
    "characteristics" text
      );


alter table "public"."catalog_items" enable row level security;


  create table "public"."categories" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "name" text not null,
    "description" text,
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true
      );


alter table "public"."categories" enable row level security;


  create table "public"."countries" (
    "code" text not null,
    "name" text not null,
    "region_id" uuid not null,
    "default_currency_code" text,
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."countries" enable row level security;


  create table "public"."credit_accounts" (
    "user_id" uuid not null,
    "balance" integer not null default 0,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."credit_accounts" enable row level security;


  create table "public"."credit_ledger" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "delta" integer not null,
    "reason" text not null,
    "reference_type" text,
    "reference_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."credit_ledger" enable row level security;


  create table "public"."currencies" (
    "code" text not null,
    "name" text not null,
    "symbol" text not null,
    "is_enabled" boolean not null default true,
    "is_default" boolean not null default false,
    "payment_route" text not null,
    "sort_order" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."currencies" enable row level security;


  create table "public"."exchange_rates" (
    "id" uuid not null default gen_random_uuid(),
    "base_currency" text not null,
    "target_currency" text not null,
    "rate" numeric(18,8) not null,
    "provider" text not null,
    "rate_date" date not null,
    "fetched_at" timestamp with time zone not null default now(),
    "is_stale" boolean not null default false,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."exchange_rates" enable row level security;


  create table "public"."generated_item_artifacts" (
    "id" uuid not null default gen_random_uuid(),
    "generated_item_id" uuid not null,
    "artifact_type" text not null,
    "storage_path" text,
    "content_text" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."generated_item_artifacts" enable row level security;


  create table "public"."generated_items" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "generated_by" uuid,
    "product_type" text not null,
    "category_id" uuid,
    "title" text,
    "source_image_path" text,
    "prompt" text,
    "custom_text" text,
    "svg_content" text not null,
    "preview_path" text,
    "manufacturing_metadata" jsonb not null default '{}'::jsonb,
    "review_status" text not null default 'draft'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "subcategory_id" uuid,
    "selected_preview_path" text,
    "manufacturing_file_path" text,
    "original_image_paths" text[] not null default '{}'::text[],
    "color" text,
    "multi_color" boolean not null default false,
    "generation_options" jsonb not null default '{}'::jsonb,
    "credit_cost" integer not null default 0
      );


alter table "public"."generated_items" enable row level security;


  create table "public"."generation_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "image_path" text not null,
    "input_units" integer not null default 0,
    "output_units" integer not null default 0,
    "last_title" text,
    "last_svg" text,
    "updated_at" timestamp with time zone not null default now(),
    "upload_rights_confirmed" boolean not null default false
      );


alter table "public"."generation_sessions" enable row level security;


  create table "public"."market_regions" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "name" text not null,
    "default_currency_code" text,
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."market_regions" enable row level security;


  create table "public"."order_items" (
    "id" uuid not null default gen_random_uuid(),
    "order_id" uuid not null,
    "catalog_item_id" uuid,
    "generated_item_id" uuid,
    "title" text not null,
    "quantity" integer not null default 1,
    "unit_price_cents" integer not null,
    "total_price_cents" integer not null,
    "item_snapshot" jsonb not null default '{}'::jsonb,
    "personalization_snapshot" jsonb not null default '{}'::jsonb,
    "production_snapshot" jsonb not null default '{}'::jsonb,
    "image_path" text,
    "selected_preview_path" text,
    "manufacturing_file_path" text,
    "original_image_paths" text[] not null default '{}'::text[],
    "custom_text" text,
    "led_color" text,
    "multi_color" boolean not null default false,
    "banner_size_key" text,
    "currency" text not null default 'AMD'::text,
    "exchange_rate_context" jsonb not null default '{}'::jsonb,
    "shipping_unit_cents" integer not null default 0,
    "shipping_total_cents" integer not null default 0,
    "shipping_rate_context" jsonb not null default '{}'::jsonb
      );


alter table "public"."order_items" enable row level security;


  create table "public"."orders" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "status" text not null default 'draft'::text,
    "payment_status" text not null default 'unpaid'::text,
    "subtotal_cents" integer not null,
    "currency" text not null default 'AMD'::text,
    "shipping_address" jsonb,
    "contact_email" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "locale" text,
    "cart_id" uuid,
    "transaction_id" uuid,
    "exchange_rate_context" jsonb not null default '{}'::jsonb,
    "payment_provider_route" text,
    "destination_country_code" text,
    "shipping_cents" integer not null default 0,
    "total_cents" integer not null,
    "shipping_rate_context" jsonb not null default '{}'::jsonb,
    "billing_country_code" text
      );


alter table "public"."orders" enable row level security;


  create table "public"."personalization_boilerplates" (
    "id" uuid not null default gen_random_uuid(),
    "model_id" uuid not null,
    "admin_name" text not null,
    "name_en" text,
    "name_hy" text,
    "name_ru" text,
    "image_path" text not null,
    "manufacturing_process" text not null default ''::text,
    "generation_instruction" text not null default ''::text,
    "generate_hidden_svg" boolean not null default false,
    "is_active" boolean not null default true,
    "sort_order" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "openai_file_id" text not null
      );


alter table "public"."personalization_boilerplates" enable row level security;


  create table "public"."personalization_models" (
    "id" uuid not null default gen_random_uuid(),
    "category_id" uuid not null,
    "subcategory_id" uuid,
    "title" text not null,
    "slug" text not null,
    "mock_image_path" text,
    "boilerplate_image_path" text,
    "form_schema" jsonb not null default '{}'::jsonb,
    "status" text not null default 'draft'::text,
    "sort_order" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."personalization_models" enable row level security;


  create table "public"."personalized_preview_options" (
    "id" uuid not null default gen_random_uuid(),
    "generated_item_id" uuid not null,
    "option_index" integer not null,
    "preview_image_path" text not null,
    "manufacturing_file_path" text,
    "status" text not null default 'generated'::text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "boilerplate_id" uuid
      );


alter table "public"."personalized_preview_options" enable row level security;


  create table "public"."products" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text not null,
    "svg_content" text not null,
    "input_units" integer not null default 0,
    "output_units" integer not null default 0,
    "api_cost_cents" integer not null default 0,
    "markup_cents" integer not null default 1000,
    "price_cents" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."products" enable row level security;


  create table "public"."profiles" (
    "user_id" uuid not null,
    "role" text not null default 'user'::text,
    "display_name" text,
    "created_at" timestamp with time zone not null default now(),
    "status" text not null default 'active'::text,
    "preferred_locale" text,
    "region_code" text,
    "internal_notes" text,
    "updated_at" timestamp with time zone not null default now(),
    "preferred_currency" text,
    "preferred_country_code" text
      );


alter table "public"."profiles" enable row level security;


  create table "public"."subcategories" (
    "id" uuid not null default gen_random_uuid(),
    "category_id" uuid not null,
    "slug" text not null,
    "name" text not null,
    "description" text,
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."subcategories" enable row level security;


  create table "public"."transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "order_id" uuid,
    "credit_ledger_id" uuid,
    "type" text not null,
    "status" text not null default 'pending'::text,
    "amount_cents" integer not null default 0,
    "currency" text not null default 'AMD'::text,
    "provider" text,
    "provider_reference" text,
    "admin_reason" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "exchange_rate_context" jsonb not null default '{}'::jsonb,
    "payment_provider_route" text
      );


alter table "public"."transactions" enable row level security;

CREATE INDEX admin_audit_log_actor_created_idx ON public.admin_audit_log USING btree (actor_user_id, created_at DESC);

CREATE INDEX admin_audit_log_entity_created_idx ON public.admin_audit_log USING btree (entity_type, entity_id, created_at DESC);

CREATE UNIQUE INDEX admin_audit_log_pkey ON public.admin_audit_log USING btree (id);

CREATE INDEX admin_audit_log_target_created_idx ON public.admin_audit_log USING btree (target_user_id, created_at DESC);

CREATE UNIQUE INDEX admin_permissions_pkey ON public.admin_permissions USING btree (user_id, permission);

CREATE UNIQUE INDEX banner_manufacturing_instructions_pkey ON public.banner_manufacturing_instructions USING btree (id);

CREATE INDEX banner_manufacturing_order_idx ON public.banner_manufacturing_instructions USING btree (order_id, created_at DESC);

CREATE UNIQUE INDEX banner_samples_pkey ON public.banner_samples USING btree (id);

CREATE INDEX banner_samples_status_created_idx ON public.banner_samples USING btree (status, created_at DESC);

CREATE UNIQUE INDEX banner_size_presets_key_key ON public.banner_size_presets USING btree (key);

CREATE UNIQUE INDEX banner_size_presets_pkey ON public.banner_size_presets USING btree (id);

CREATE INDEX cart_items_cart_idx ON public.cart_items USING btree (cart_id, created_at);

CREATE UNIQUE INDEX cart_items_pkey ON public.cart_items USING btree (id);

CREATE UNIQUE INDEX carts_active_session_idx ON public.carts USING btree (session_id) WHERE ((status = 'active'::text) AND (session_id IS NOT NULL));

CREATE UNIQUE INDEX carts_active_user_idx ON public.carts USING btree (user_id) WHERE ((status = 'active'::text) AND (user_id IS NOT NULL));

CREATE UNIQUE INDEX carts_pkey ON public.carts USING btree (id);

CREATE UNIQUE INDEX catalog_item_market_rules_country_uidx ON public.catalog_item_market_rules USING btree (catalog_item_id, country_code) WHERE (country_code IS NOT NULL);

CREATE INDEX catalog_item_market_rules_item_idx ON public.catalog_item_market_rules USING btree (catalog_item_id);

CREATE UNIQUE INDEX catalog_item_market_rules_pkey ON public.catalog_item_market_rules USING btree (id);

CREATE UNIQUE INDEX catalog_item_market_rules_region_uidx ON public.catalog_item_market_rules USING btree (catalog_item_id, region_id) WHERE (region_id IS NOT NULL);

CREATE INDEX catalog_item_media_item_sort_idx ON public.catalog_item_media USING btree (catalog_item_id, sort_order, created_at);

CREATE UNIQUE INDEX catalog_item_media_pkey ON public.catalog_item_media USING btree (id);

CREATE UNIQUE INDEX catalog_item_media_single_primary_idx ON public.catalog_item_media USING btree (catalog_item_id) WHERE is_primary;

CREATE UNIQUE INDEX catalog_item_seo_metadata_locale_seo_slug_key ON public.catalog_item_seo_metadata USING btree (locale, seo_slug);

CREATE UNIQUE INDEX catalog_item_seo_metadata_pkey ON public.catalog_item_seo_metadata USING btree (catalog_item_id, locale);

CREATE UNIQUE INDEX catalog_item_translations_pkey ON public.catalog_item_translations USING btree (catalog_item_id, locale);

CREATE INDEX catalog_items_item_type_status_idx ON public.catalog_items USING btree (item_type, status, created_at DESC);

CREATE UNIQUE INDEX catalog_items_pkey ON public.catalog_items USING btree (id);

CREATE INDEX catalog_items_popular_idx ON public.catalog_items USING btree (is_popular, created_at DESC) WHERE (status = 'published'::text);

CREATE INDEX catalog_items_published_category_idx ON public.catalog_items USING btree (category_id, created_at DESC) WHERE (status = 'published'::text);

CREATE UNIQUE INDEX catalog_items_slug_key ON public.catalog_items USING btree (slug);

CREATE INDEX catalog_items_subcategory_idx ON public.catalog_items USING btree (subcategory_id, created_at DESC) WHERE (status = 'published'::text);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);

CREATE UNIQUE INDEX countries_pkey ON public.countries USING btree (code);

CREATE INDEX countries_region_active_idx ON public.countries USING btree (region_id, is_active, sort_order, name);

CREATE INDEX credit_ledger_user_created_idx ON public.credit_ledger USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX currencies_pkey ON public.currencies USING btree (code);

CREATE UNIQUE INDEX currencies_single_default_idx ON public.currencies USING btree (is_default) WHERE is_default;

CREATE UNIQUE INDEX exchange_rates_base_currency_target_currency_rate_date_key ON public.exchange_rates USING btree (base_currency, target_currency, rate_date);

CREATE INDEX exchange_rates_pair_date_idx ON public.exchange_rates USING btree (base_currency, target_currency, rate_date DESC);

CREATE UNIQUE INDEX exchange_rates_pkey ON public.exchange_rates USING btree (id);

CREATE INDEX generated_item_artifacts_item_idx ON public.generated_item_artifacts USING btree (generated_item_id, artifact_type);

CREATE UNIQUE INDEX generated_item_artifacts_pkey ON public.generated_item_artifacts USING btree (id);

CREATE UNIQUE INDEX generated_items_pkey ON public.generated_items USING btree (id);

CREATE INDEX generated_items_review_idx ON public.generated_items USING btree (review_status, created_at DESC);

CREATE INDEX generated_items_user_created_idx ON public.generated_items USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX generation_sessions_pkey ON public.generation_sessions USING btree (id);

CREATE INDEX generation_sessions_user_updated_idx ON public.generation_sessions USING btree (user_id, updated_at DESC);

CREATE UNIQUE INDEX market_regions_pkey ON public.market_regions USING btree (id);

CREATE UNIQUE INDEX market_regions_slug_key ON public.market_regions USING btree (slug);

CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);

CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id);

CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id);

CREATE INDEX orders_status_created_idx ON public.orders USING btree (status, created_at DESC);

CREATE INDEX orders_user_created_idx ON public.orders USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX personalization_boilerplates_model_id_admin_name_key ON public.personalization_boilerplates USING btree (model_id, admin_name);

CREATE INDEX personalization_boilerplates_model_order_idx ON public.personalization_boilerplates USING btree (model_id, is_active, sort_order, created_at);

CREATE UNIQUE INDEX personalization_boilerplates_pkey ON public.personalization_boilerplates USING btree (id);

CREATE UNIQUE INDEX personalization_models_pkey ON public.personalization_models USING btree (id);

CREATE UNIQUE INDEX personalization_models_slug_key ON public.personalization_models USING btree (slug);

CREATE INDEX personalization_models_subcategory_idx ON public.personalization_models USING btree (subcategory_id, sort_order);

CREATE INDEX personalized_preview_options_generated_idx ON public.personalized_preview_options USING btree (generated_item_id, status, option_index);

CREATE UNIQUE INDEX personalized_preview_options_generated_item_id_option_index_key ON public.personalized_preview_options USING btree (generated_item_id, option_index);

CREATE UNIQUE INDEX personalized_preview_options_pkey ON public.personalized_preview_options USING btree (id);

CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);

CREATE INDEX products_user_created_idx ON public.products USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (user_id);

CREATE INDEX profiles_role_status_created_idx ON public.profiles USING btree (role, status, created_at DESC);

CREATE UNIQUE INDEX subcategories_category_id_slug_key ON public.subcategories USING btree (category_id, slug);

CREATE INDEX subcategories_category_sort_idx ON public.subcategories USING btree (category_id, sort_order);

CREATE UNIQUE INDEX subcategories_pkey ON public.subcategories USING btree (id);

CREATE UNIQUE INDEX token_accounts_pkey ON public.credit_accounts USING btree (user_id);

CREATE UNIQUE INDEX token_ledger_pkey ON public.credit_ledger USING btree (id);

CREATE INDEX transactions_order_idx ON public.transactions USING btree (order_id);

CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id);

CREATE INDEX transactions_provider_reference_idx ON public.transactions USING btree (provider, provider_reference) WHERE (provider_reference IS NOT NULL);

CREATE INDEX transactions_type_status_idx ON public.transactions USING btree (type, status, created_at DESC);

CREATE INDEX transactions_user_created_idx ON public.transactions USING btree (user_id, created_at DESC);

alter table "public"."admin_audit_log" add constraint "admin_audit_log_pkey" PRIMARY KEY using index "admin_audit_log_pkey";

alter table "public"."admin_permissions" add constraint "admin_permissions_pkey" PRIMARY KEY using index "admin_permissions_pkey";

alter table "public"."banner_manufacturing_instructions" add constraint "banner_manufacturing_instructions_pkey" PRIMARY KEY using index "banner_manufacturing_instructions_pkey";

alter table "public"."banner_samples" add constraint "banner_samples_pkey" PRIMARY KEY using index "banner_samples_pkey";

alter table "public"."banner_size_presets" add constraint "banner_size_presets_pkey" PRIMARY KEY using index "banner_size_presets_pkey";

alter table "public"."cart_items" add constraint "cart_items_pkey" PRIMARY KEY using index "cart_items_pkey";

alter table "public"."carts" add constraint "carts_pkey" PRIMARY KEY using index "carts_pkey";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_pkey" PRIMARY KEY using index "catalog_item_market_rules_pkey";

alter table "public"."catalog_item_media" add constraint "catalog_item_media_pkey" PRIMARY KEY using index "catalog_item_media_pkey";

alter table "public"."catalog_item_seo_metadata" add constraint "catalog_item_seo_metadata_pkey" PRIMARY KEY using index "catalog_item_seo_metadata_pkey";

alter table "public"."catalog_item_translations" add constraint "catalog_item_translations_pkey" PRIMARY KEY using index "catalog_item_translations_pkey";

alter table "public"."catalog_items" add constraint "catalog_items_pkey" PRIMARY KEY using index "catalog_items_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."countries" add constraint "countries_pkey" PRIMARY KEY using index "countries_pkey";

alter table "public"."credit_accounts" add constraint "token_accounts_pkey" PRIMARY KEY using index "token_accounts_pkey";

alter table "public"."credit_ledger" add constraint "token_ledger_pkey" PRIMARY KEY using index "token_ledger_pkey";

alter table "public"."currencies" add constraint "currencies_pkey" PRIMARY KEY using index "currencies_pkey";

alter table "public"."exchange_rates" add constraint "exchange_rates_pkey" PRIMARY KEY using index "exchange_rates_pkey";

alter table "public"."generated_item_artifacts" add constraint "generated_item_artifacts_pkey" PRIMARY KEY using index "generated_item_artifacts_pkey";

alter table "public"."generated_items" add constraint "generated_items_pkey" PRIMARY KEY using index "generated_items_pkey";

alter table "public"."generation_sessions" add constraint "generation_sessions_pkey" PRIMARY KEY using index "generation_sessions_pkey";

alter table "public"."market_regions" add constraint "market_regions_pkey" PRIMARY KEY using index "market_regions_pkey";

alter table "public"."order_items" add constraint "order_items_pkey" PRIMARY KEY using index "order_items_pkey";

alter table "public"."orders" add constraint "orders_pkey" PRIMARY KEY using index "orders_pkey";

alter table "public"."personalization_boilerplates" add constraint "personalization_boilerplates_pkey" PRIMARY KEY using index "personalization_boilerplates_pkey";

alter table "public"."personalization_models" add constraint "personalization_models_pkey" PRIMARY KEY using index "personalization_models_pkey";

alter table "public"."personalized_preview_options" add constraint "personalized_preview_options_pkey" PRIMARY KEY using index "personalized_preview_options_pkey";

alter table "public"."products" add constraint "products_pkey" PRIMARY KEY using index "products_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."subcategories" add constraint "subcategories_pkey" PRIMARY KEY using index "subcategories_pkey";

alter table "public"."transactions" add constraint "transactions_pkey" PRIMARY KEY using index "transactions_pkey";

alter table "public"."admin_audit_log" add constraint "admin_audit_log_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_audit_log" validate constraint "admin_audit_log_actor_user_id_fkey";

alter table "public"."admin_audit_log" add constraint "admin_audit_log_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_audit_log" validate constraint "admin_audit_log_target_user_id_fkey";

alter table "public"."admin_permissions" add constraint "admin_permissions_permission_check" CHECK ((permission = ANY (ARRAY['catalog_manage'::text, 'seo_manage'::text, 'orders_manage'::text, 'generated_review'::text, 'users_manage'::text, 'transactions_manage'::text, 'balances_adjust'::text]))) not valid;

alter table "public"."admin_permissions" validate constraint "admin_permissions_permission_check";

alter table "public"."admin_permissions" add constraint "admin_permissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."admin_permissions" validate constraint "admin_permissions_user_id_fkey";

alter table "public"."banner_manufacturing_instructions" add constraint "banner_manufacturing_instructions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."banner_manufacturing_instructions" validate constraint "banner_manufacturing_instructions_created_by_fkey";

alter table "public"."banner_manufacturing_instructions" add constraint "banner_manufacturing_instructions_generated_item_id_fkey" FOREIGN KEY (generated_item_id) REFERENCES public.generated_items(id) ON DELETE SET NULL not valid;

alter table "public"."banner_manufacturing_instructions" validate constraint "banner_manufacturing_instructions_generated_item_id_fkey";

alter table "public"."banner_manufacturing_instructions" add constraint "banner_manufacturing_instructions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."banner_manufacturing_instructions" validate constraint "banner_manufacturing_instructions_order_id_fkey";

alter table "public"."banner_manufacturing_instructions" add constraint "banner_manufacturing_instructions_order_item_id_fkey" FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE not valid;

alter table "public"."banner_manufacturing_instructions" validate constraint "banner_manufacturing_instructions_order_item_id_fkey";

alter table "public"."banner_manufacturing_instructions" add constraint "banner_manufacturing_instructions_status_check" CHECK ((status = ANY (ARRAY['not_started'::text, 'generating'::text, 'ready'::text, 'review_required'::text, 'failed'::text]))) not valid;

alter table "public"."banner_manufacturing_instructions" validate constraint "banner_manufacturing_instructions_status_check";

alter table "public"."banner_samples" add constraint "banner_samples_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."banner_samples" validate constraint "banner_samples_created_by_fkey";

alter table "public"."banner_samples" add constraint "banner_samples_size_preset_id_fkey" FOREIGN KEY (size_preset_id) REFERENCES public.banner_size_presets(id) ON DELETE SET NULL not valid;

alter table "public"."banner_samples" validate constraint "banner_samples_size_preset_id_fkey";

alter table "public"."banner_samples" add constraint "banner_samples_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))) not valid;

alter table "public"."banner_samples" validate constraint "banner_samples_status_check";

alter table "public"."banner_size_presets" add constraint "banner_size_presets_height_mm_check" CHECK ((height_mm > 0)) not valid;

alter table "public"."banner_size_presets" validate constraint "banner_size_presets_height_mm_check";

alter table "public"."banner_size_presets" add constraint "banner_size_presets_key_key" UNIQUE using index "banner_size_presets_key_key";

alter table "public"."banner_size_presets" add constraint "banner_size_presets_width_mm_check" CHECK ((width_mm > 0)) not valid;

alter table "public"."banner_size_presets" validate constraint "banner_size_presets_width_mm_check";

alter table "public"."cart_items" add constraint "cart_items_banner_sample_id_fkey" FOREIGN KEY (banner_sample_id) REFERENCES public.banner_samples(id) ON DELETE SET NULL not valid;

alter table "public"."cart_items" validate constraint "cart_items_banner_sample_id_fkey";

alter table "public"."cart_items" add constraint "cart_items_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE not valid;

alter table "public"."cart_items" validate constraint "cart_items_cart_id_fkey";

alter table "public"."cart_items" add constraint "cart_items_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE SET NULL not valid;

alter table "public"."cart_items" validate constraint "cart_items_catalog_item_id_fkey";

alter table "public"."cart_items" add constraint "cart_items_check" CHECK ((((((catalog_item_id IS NOT NULL))::integer + ((generated_item_id IS NOT NULL))::integer) + ((banner_sample_id IS NOT NULL))::integer) = 1)) not valid;

alter table "public"."cart_items" validate constraint "cart_items_check";

alter table "public"."cart_items" add constraint "cart_items_currency_fkey" FOREIGN KEY (currency) REFERENCES public.currencies(code) not valid;

alter table "public"."cart_items" validate constraint "cart_items_currency_fkey";

alter table "public"."cart_items" add constraint "cart_items_generated_item_id_fkey" FOREIGN KEY (generated_item_id) REFERENCES public.generated_items(id) ON DELETE SET NULL not valid;

alter table "public"."cart_items" validate constraint "cart_items_generated_item_id_fkey";

alter table "public"."cart_items" add constraint "cart_items_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."cart_items" validate constraint "cart_items_quantity_check";

alter table "public"."cart_items" add constraint "cart_items_unit_price_cents_check" CHECK ((unit_price_cents >= 0)) not valid;

alter table "public"."cart_items" validate constraint "cart_items_unit_price_cents_check";

alter table "public"."carts" add constraint "carts_check" CHECK (((user_id IS NOT NULL) OR (session_id IS NOT NULL))) not valid;

alter table "public"."carts" validate constraint "carts_check";

alter table "public"."carts" add constraint "carts_currency_fkey" FOREIGN KEY (currency) REFERENCES public.currencies(code) not valid;

alter table "public"."carts" validate constraint "carts_currency_fkey";

alter table "public"."carts" add constraint "carts_destination_country_code_fkey" FOREIGN KEY (destination_country_code) REFERENCES public.countries(code) not valid;

alter table "public"."carts" validate constraint "carts_destination_country_code_fkey";

alter table "public"."carts" add constraint "carts_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'converted'::text, 'abandoned'::text]))) not valid;

alter table "public"."carts" validate constraint "carts_status_check";

alter table "public"."carts" add constraint "carts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."carts" validate constraint "carts_user_id_fkey";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_catalog_item_id_fkey";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_check" CHECK ((num_nonnulls(region_id, country_code) = 1)) not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_check";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_check1" CHECK (((visibility_override IS NOT NULL) OR (shipping_rate_cents IS NOT NULL))) not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_check1";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_country_code_fkey" FOREIGN KEY (country_code) REFERENCES public.countries(code) ON DELETE CASCADE not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_country_code_fkey";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_region_id_fkey" FOREIGN KEY (region_id) REFERENCES public.market_regions(id) ON DELETE CASCADE not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_region_id_fkey";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_shipping_currency_check" CHECK ((shipping_currency = 'AMD'::text)) not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_shipping_currency_check";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_shipping_currency_fkey" FOREIGN KEY (shipping_currency) REFERENCES public.currencies(code) not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_shipping_currency_fkey";

alter table "public"."catalog_item_market_rules" add constraint "catalog_item_market_rules_shipping_rate_cents_check" CHECK ((shipping_rate_cents >= 0)) not valid;

alter table "public"."catalog_item_market_rules" validate constraint "catalog_item_market_rules_shipping_rate_cents_check";

alter table "public"."catalog_item_media" add constraint "catalog_item_media_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE not valid;

alter table "public"."catalog_item_media" validate constraint "catalog_item_media_catalog_item_id_fkey";

alter table "public"."catalog_item_media" add constraint "catalog_item_media_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."catalog_item_media" validate constraint "catalog_item_media_created_by_fkey";

alter table "public"."catalog_item_media" add constraint "catalog_item_media_media_type_check" CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text]))) not valid;

alter table "public"."catalog_item_media" validate constraint "catalog_item_media_media_type_check";

alter table "public"."catalog_item_seo_metadata" add constraint "catalog_item_seo_metadata_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE not valid;

alter table "public"."catalog_item_seo_metadata" validate constraint "catalog_item_seo_metadata_catalog_item_id_fkey";

alter table "public"."catalog_item_seo_metadata" add constraint "catalog_item_seo_metadata_locale_check" CHECK ((locale = ANY (ARRAY['en'::text, 'ru'::text, 'am'::text]))) not valid;

alter table "public"."catalog_item_seo_metadata" validate constraint "catalog_item_seo_metadata_locale_check";

alter table "public"."catalog_item_seo_metadata" add constraint "catalog_item_seo_metadata_locale_seo_slug_key" UNIQUE using index "catalog_item_seo_metadata_locale_seo_slug_key";

alter table "public"."catalog_item_seo_metadata" add constraint "catalog_item_seo_metadata_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."catalog_item_seo_metadata" validate constraint "catalog_item_seo_metadata_updated_by_fkey";

alter table "public"."catalog_item_translations" add constraint "catalog_item_translations_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE not valid;

alter table "public"."catalog_item_translations" validate constraint "catalog_item_translations_catalog_item_id_fkey";

alter table "public"."catalog_item_translations" add constraint "catalog_item_translations_locale_check" CHECK ((locale = ANY (ARRAY['en'::text, 'ru'::text, 'am'::text]))) not valid;

alter table "public"."catalog_item_translations" validate constraint "catalog_item_translations_locale_check";

alter table "public"."catalog_items" add constraint "catalog_items_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) not valid;

alter table "public"."catalog_items" validate constraint "catalog_items_category_id_fkey";

alter table "public"."catalog_items" add constraint "catalog_items_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."catalog_items" validate constraint "catalog_items_created_by_fkey";

alter table "public"."catalog_items" add constraint "catalog_items_item_type_check" CHECK ((item_type = ANY (ARRAY['standard'::text, 'toy'::text, 'decoration'::text, 'night_light'::text, 'personalized_night_light'::text, 'banner'::text]))) not valid;

alter table "public"."catalog_items" validate constraint "catalog_items_item_type_check";

alter table "public"."catalog_items" add constraint "catalog_items_price_cents_check" CHECK ((price_cents >= 0)) not valid;

alter table "public"."catalog_items" validate constraint "catalog_items_price_cents_check";

alter table "public"."catalog_items" add constraint "catalog_items_product_source_check" CHECK ((product_source = ANY (ARRAY['catalog'::text, 'admin_generated'::text]))) not valid;

alter table "public"."catalog_items" validate constraint "catalog_items_product_source_check";

alter table "public"."catalog_items" add constraint "catalog_items_slug_key" UNIQUE using index "catalog_items_slug_key";

alter table "public"."catalog_items" add constraint "catalog_items_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))) not valid;

alter table "public"."catalog_items" validate constraint "catalog_items_status_check";

alter table "public"."catalog_items" add constraint "catalog_items_subcategory_id_fkey" FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL not valid;

alter table "public"."catalog_items" validate constraint "catalog_items_subcategory_id_fkey";

alter table "public"."categories" add constraint "categories_slug_key" UNIQUE using index "categories_slug_key";

alter table "public"."countries" add constraint "countries_code_check" CHECK ((code ~ '^[A-Z]{2}$'::text)) not valid;

alter table "public"."countries" validate constraint "countries_code_check";

alter table "public"."countries" add constraint "countries_default_currency_code_fkey" FOREIGN KEY (default_currency_code) REFERENCES public.currencies(code) not valid;

alter table "public"."countries" validate constraint "countries_default_currency_code_fkey";

alter table "public"."countries" add constraint "countries_name_check" CHECK ((length(TRIM(BOTH FROM name)) > 0)) not valid;

alter table "public"."countries" validate constraint "countries_name_check";

alter table "public"."countries" add constraint "countries_region_id_fkey" FOREIGN KEY (region_id) REFERENCES public.market_regions(id) not valid;

alter table "public"."countries" validate constraint "countries_region_id_fkey";

alter table "public"."credit_accounts" add constraint "token_accounts_balance_check" CHECK ((balance >= 0)) not valid;

alter table "public"."credit_accounts" validate constraint "token_accounts_balance_check";

alter table "public"."credit_accounts" add constraint "token_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."credit_accounts" validate constraint "token_accounts_user_id_fkey";

alter table "public"."credit_ledger" add constraint "token_ledger_reason_check" CHECK ((reason = ANY (ARRAY['purchase'::text, 'generation_spend'::text, 'generation_refund'::text, 'admin_adjustment'::text]))) not valid;

alter table "public"."credit_ledger" validate constraint "token_ledger_reason_check";

alter table "public"."credit_ledger" add constraint "token_ledger_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."credit_ledger" validate constraint "token_ledger_user_id_fkey";

alter table "public"."currencies" add constraint "currencies_code_check" CHECK ((code = ANY (ARRAY['AMD'::text, 'EUR'::text, 'USD'::text, 'RUB'::text]))) not valid;

alter table "public"."currencies" validate constraint "currencies_code_check";

alter table "public"."currencies" add constraint "currencies_payment_route_check" CHECK ((payment_route = ANY (ARRAY['stripe'::text, 'bank_manual'::text, 'ameria'::text]))) not valid;

alter table "public"."currencies" validate constraint "currencies_payment_route_check";

alter table "public"."exchange_rates" add constraint "exchange_rates_base_currency_fkey" FOREIGN KEY (base_currency) REFERENCES public.currencies(code) not valid;

alter table "public"."exchange_rates" validate constraint "exchange_rates_base_currency_fkey";

alter table "public"."exchange_rates" add constraint "exchange_rates_base_currency_target_currency_rate_date_key" UNIQUE using index "exchange_rates_base_currency_target_currency_rate_date_key";

alter table "public"."exchange_rates" add constraint "exchange_rates_rate_check" CHECK ((rate > (0)::numeric)) not valid;

alter table "public"."exchange_rates" validate constraint "exchange_rates_rate_check";

alter table "public"."exchange_rates" add constraint "exchange_rates_target_currency_fkey" FOREIGN KEY (target_currency) REFERENCES public.currencies(code) not valid;

alter table "public"."exchange_rates" validate constraint "exchange_rates_target_currency_fkey";

alter table "public"."generated_item_artifacts" add constraint "generated_item_artifacts_artifact_type_check" CHECK ((artifact_type = ANY (ARRAY['original_image'::text, 'reference_image'::text, 'preview_image'::text, 'hidden_svg'::text, 'manufacturing_svg'::text, 'manufacturing_pdf'::text, 'instruction_json'::text]))) not valid;

alter table "public"."generated_item_artifacts" validate constraint "generated_item_artifacts_artifact_type_check";

alter table "public"."generated_item_artifacts" add constraint "generated_item_artifacts_check" CHECK (((storage_path IS NOT NULL) OR (content_text IS NOT NULL))) not valid;

alter table "public"."generated_item_artifacts" validate constraint "generated_item_artifacts_check";

alter table "public"."generated_item_artifacts" add constraint "generated_item_artifacts_generated_item_id_fkey" FOREIGN KEY (generated_item_id) REFERENCES public.generated_items(id) ON DELETE CASCADE not valid;

alter table "public"."generated_item_artifacts" validate constraint "generated_item_artifacts_generated_item_id_fkey";

alter table "public"."generated_items" add constraint "generated_items_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) not valid;

alter table "public"."generated_items" validate constraint "generated_items_category_id_fkey";

alter table "public"."generated_items" add constraint "generated_items_credit_cost_check" CHECK ((credit_cost >= 0)) not valid;

alter table "public"."generated_items" validate constraint "generated_items_credit_cost_check";

alter table "public"."generated_items" add constraint "generated_items_generated_by_fkey" FOREIGN KEY (generated_by) REFERENCES auth.users(id) not valid;

alter table "public"."generated_items" validate constraint "generated_items_generated_by_fkey";

alter table "public"."generated_items" add constraint "generated_items_product_type_check" CHECK ((product_type = ANY (ARRAY['night_light'::text, 'personalized_night_light'::text, 'laser_cut_2d_toy'::text, 'laser_cut_2d_decoration'::text, 'laser_cut_2d_constructor'::text, 'banner'::text]))) not valid;

alter table "public"."generated_items" validate constraint "generated_items_product_type_check";

alter table "public"."generated_items" add constraint "generated_items_review_status_check" CHECK ((review_status = ANY (ARRAY['draft'::text, 'preview_ready'::text, 'review_required'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."generated_items" validate constraint "generated_items_review_status_check";

alter table "public"."generated_items" add constraint "generated_items_subcategory_id_fkey" FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL not valid;

alter table "public"."generated_items" validate constraint "generated_items_subcategory_id_fkey";

alter table "public"."generated_items" add constraint "generated_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."generated_items" validate constraint "generated_items_user_id_fkey";

alter table "public"."generation_sessions" add constraint "generation_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."generation_sessions" validate constraint "generation_sessions_user_id_fkey";

alter table "public"."market_regions" add constraint "market_regions_default_currency_code_fkey" FOREIGN KEY (default_currency_code) REFERENCES public.currencies(code) not valid;

alter table "public"."market_regions" validate constraint "market_regions_default_currency_code_fkey";

alter table "public"."market_regions" add constraint "market_regions_name_check" CHECK ((length(TRIM(BOTH FROM name)) > 0)) not valid;

alter table "public"."market_regions" validate constraint "market_regions_name_check";

alter table "public"."market_regions" add constraint "market_regions_slug_check" CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)) not valid;

alter table "public"."market_regions" validate constraint "market_regions_slug_check";

alter table "public"."market_regions" add constraint "market_regions_slug_key" UNIQUE using index "market_regions_slug_key";

alter table "public"."order_items" add constraint "order_items_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) not valid;

alter table "public"."order_items" validate constraint "order_items_catalog_item_id_fkey";

alter table "public"."order_items" add constraint "order_items_check" CHECK ((((catalog_item_id IS NOT NULL) AND (generated_item_id IS NULL)) OR ((catalog_item_id IS NULL) AND (generated_item_id IS NOT NULL)))) not valid;

alter table "public"."order_items" validate constraint "order_items_check";

alter table "public"."order_items" add constraint "order_items_currency_fkey" FOREIGN KEY (currency) REFERENCES public.currencies(code) not valid;

alter table "public"."order_items" validate constraint "order_items_currency_fkey";

alter table "public"."order_items" add constraint "order_items_generated_item_id_fkey" FOREIGN KEY (generated_item_id) REFERENCES public.generated_items(id) not valid;

alter table "public"."order_items" validate constraint "order_items_generated_item_id_fkey";

alter table "public"."order_items" add constraint "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."order_items" validate constraint "order_items_order_id_fkey";

alter table "public"."order_items" add constraint "order_items_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_quantity_check";

alter table "public"."order_items" add constraint "order_items_shipping_total_cents_check" CHECK ((shipping_total_cents >= 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_shipping_total_cents_check";

alter table "public"."order_items" add constraint "order_items_shipping_unit_cents_check" CHECK ((shipping_unit_cents >= 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_shipping_unit_cents_check";

alter table "public"."order_items" add constraint "order_items_total_price_cents_check" CHECK ((total_price_cents >= 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_total_price_cents_check";

alter table "public"."order_items" add constraint "order_items_unit_price_cents_check" CHECK ((unit_price_cents >= 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_unit_price_cents_check";

alter table "public"."orders" add constraint "orders_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE SET NULL not valid;

alter table "public"."orders" validate constraint "orders_cart_id_fkey";

alter table "public"."orders" add constraint "orders_currency_fkey" FOREIGN KEY (currency) REFERENCES public.currencies(code) not valid;

alter table "public"."orders" validate constraint "orders_currency_fkey";

alter table "public"."orders" add constraint "orders_destination_country_code_fkey" FOREIGN KEY (destination_country_code) REFERENCES public.countries(code) not valid;

alter table "public"."orders" validate constraint "orders_destination_country_code_fkey";

alter table "public"."orders" add constraint "orders_locale_check" CHECK (((locale IS NULL) OR (locale = ANY (ARRAY['en'::text, 'ru'::text, 'am'::text])))) not valid;

alter table "public"."orders" validate constraint "orders_locale_check";

alter table "public"."orders" add constraint "orders_payment_provider_route_check" CHECK (((payment_provider_route IS NULL) OR (payment_provider_route = ANY (ARRAY['stripe'::text, 'bank_manual'::text, 'ameria'::text, 'polar'::text])))) not valid;

alter table "public"."orders" validate constraint "orders_payment_provider_route_check";

alter table "public"."orders" add constraint "orders_payment_status_check" CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'refunded'::text, 'failed'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_payment_status_check";

alter table "public"."orders" add constraint "orders_shipping_cents_check" CHECK ((shipping_cents >= 0)) not valid;

alter table "public"."orders" validate constraint "orders_shipping_cents_check";

alter table "public"."orders" add constraint "orders_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'pending_payment'::text, 'paid'::text, 'review_required'::text, 'approved_for_production'::text, 'in_production'::text, 'ready_to_ship'::text, 'shipped'::text, 'cancelled'::text, 'refunded'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_status_check";

alter table "public"."orders" add constraint "orders_subtotal_cents_check" CHECK ((subtotal_cents >= 0)) not valid;

alter table "public"."orders" validate constraint "orders_subtotal_cents_check";

alter table "public"."orders" add constraint "orders_total_cents_check" CHECK ((total_cents >= 0)) not valid;

alter table "public"."orders" validate constraint "orders_total_cents_check";

alter table "public"."orders" add constraint "orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."orders" validate constraint "orders_user_id_fkey";

alter table "public"."personalization_boilerplates" add constraint "personalization_boilerplates_model_id_admin_name_key" UNIQUE using index "personalization_boilerplates_model_id_admin_name_key";

alter table "public"."personalization_boilerplates" add constraint "personalization_boilerplates_model_id_fkey" FOREIGN KEY (model_id) REFERENCES public.personalization_models(id) ON DELETE CASCADE not valid;

alter table "public"."personalization_boilerplates" validate constraint "personalization_boilerplates_model_id_fkey";

alter table "public"."personalization_models" add constraint "personalization_models_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;

alter table "public"."personalization_models" validate constraint "personalization_models_category_id_fkey";

alter table "public"."personalization_models" add constraint "personalization_models_slug_key" UNIQUE using index "personalization_models_slug_key";

alter table "public"."personalization_models" add constraint "personalization_models_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))) not valid;

alter table "public"."personalization_models" validate constraint "personalization_models_status_check";

alter table "public"."personalization_models" add constraint "personalization_models_subcategory_id_fkey" FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL not valid;

alter table "public"."personalization_models" validate constraint "personalization_models_subcategory_id_fkey";

alter table "public"."personalized_preview_options" add constraint "personalized_preview_options_boilerplate_id_fkey" FOREIGN KEY (boilerplate_id) REFERENCES public.personalization_boilerplates(id) ON DELETE SET NULL not valid;

alter table "public"."personalized_preview_options" validate constraint "personalized_preview_options_boilerplate_id_fkey";

alter table "public"."personalized_preview_options" add constraint "personalized_preview_options_generated_item_id_fkey" FOREIGN KEY (generated_item_id) REFERENCES public.generated_items(id) ON DELETE CASCADE not valid;

alter table "public"."personalized_preview_options" validate constraint "personalized_preview_options_generated_item_id_fkey";

alter table "public"."personalized_preview_options" add constraint "personalized_preview_options_generated_item_id_option_index_key" UNIQUE using index "personalized_preview_options_generated_item_id_option_index_key";

alter table "public"."personalized_preview_options" add constraint "personalized_preview_options_option_index_check" CHECK ((option_index > 0)) not valid;

alter table "public"."personalized_preview_options" validate constraint "personalized_preview_options_option_index_check";

alter table "public"."personalized_preview_options" add constraint "personalized_preview_options_status_check" CHECK ((status = ANY (ARRAY['generated'::text, 'selected'::text, 'discarded'::text]))) not valid;

alter table "public"."personalized_preview_options" validate constraint "personalized_preview_options_status_check";

alter table "public"."products" add constraint "products_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."products" validate constraint "products_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_preferred_country_code_fkey" FOREIGN KEY (preferred_country_code) REFERENCES public.countries(code) not valid;

alter table "public"."profiles" validate constraint "profiles_preferred_country_code_fkey";

alter table "public"."profiles" add constraint "profiles_preferred_currency_fkey" FOREIGN KEY (preferred_currency) REFERENCES public.currencies(code) not valid;

alter table "public"."profiles" validate constraint "profiles_preferred_currency_fkey";

alter table "public"."profiles" add constraint "profiles_preferred_locale_check" CHECK (((preferred_locale IS NULL) OR (preferred_locale = ANY (ARRAY['en'::text, 'ru'::text, 'am'::text])))) not valid;

alter table "public"."profiles" validate constraint "profiles_preferred_locale_check";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."profiles" add constraint "profiles_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'disabled'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_status_check";

alter table "public"."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_user_id_fkey";

alter table "public"."subcategories" add constraint "subcategories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;

alter table "public"."subcategories" validate constraint "subcategories_category_id_fkey";

alter table "public"."subcategories" add constraint "subcategories_category_id_slug_key" UNIQUE using index "subcategories_category_id_slug_key";

alter table "public"."transactions" add constraint "transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."transactions" validate constraint "transactions_created_by_fkey";

alter table "public"."transactions" add constraint "transactions_credit_ledger_id_fkey" FOREIGN KEY (credit_ledger_id) REFERENCES public.credit_ledger(id) ON DELETE SET NULL not valid;

alter table "public"."transactions" validate constraint "transactions_credit_ledger_id_fkey";

alter table "public"."transactions" add constraint "transactions_currency_fkey" FOREIGN KEY (currency) REFERENCES public.currencies(code) not valid;

alter table "public"."transactions" validate constraint "transactions_currency_fkey";

alter table "public"."transactions" add constraint "transactions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL not valid;

alter table "public"."transactions" validate constraint "transactions_order_id_fkey";

alter table "public"."transactions" add constraint "transactions_payment_provider_route_check" CHECK (((payment_provider_route IS NULL) OR (payment_provider_route = ANY (ARRAY['stripe'::text, 'bank_manual'::text, 'manual'::text, 'ameria'::text, 'polar'::text])))) not valid;

alter table "public"."transactions" validate constraint "transactions_payment_provider_route_check";

alter table "public"."transactions" add constraint "transactions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'reversed'::text]))) not valid;

alter table "public"."transactions" validate constraint "transactions_status_check";

alter table "public"."transactions" add constraint "transactions_type_check" CHECK ((type = ANY (ARRAY['payment'::text, 'refund'::text, 'credit_purchase'::text, 'credit_spend'::text, 'credit_refund'::text, 'manual_adjustment'::text, 'reversal'::text]))) not valid;

alter table "public"."transactions" validate constraint "transactions_type_check";

alter table "public"."transactions" add constraint "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."transactions" validate constraint "transactions_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ensure_currency_settings_valid()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.currencies where is_enabled) then
    raise exception 'At least one currency must remain enabled.';
  end if;

  if not exists (select 1 from public.currencies where is_default and is_enabled) then
    raise exception 'The default currency must remain enabled.';
  end if;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.credit_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.next_ameria_order_id()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select nextval('public.ameria_order_ids');
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

grant delete on table "public"."admin_audit_log" to "anon";

grant insert on table "public"."admin_audit_log" to "anon";

grant references on table "public"."admin_audit_log" to "anon";

grant select on table "public"."admin_audit_log" to "anon";

grant trigger on table "public"."admin_audit_log" to "anon";

grant truncate on table "public"."admin_audit_log" to "anon";

grant update on table "public"."admin_audit_log" to "anon";

grant delete on table "public"."admin_audit_log" to "authenticated";

grant insert on table "public"."admin_audit_log" to "authenticated";

grant references on table "public"."admin_audit_log" to "authenticated";

grant select on table "public"."admin_audit_log" to "authenticated";

grant trigger on table "public"."admin_audit_log" to "authenticated";

grant truncate on table "public"."admin_audit_log" to "authenticated";

grant update on table "public"."admin_audit_log" to "authenticated";

grant delete on table "public"."admin_audit_log" to "service_role";

grant insert on table "public"."admin_audit_log" to "service_role";

grant references on table "public"."admin_audit_log" to "service_role";

grant select on table "public"."admin_audit_log" to "service_role";

grant trigger on table "public"."admin_audit_log" to "service_role";

grant truncate on table "public"."admin_audit_log" to "service_role";

grant update on table "public"."admin_audit_log" to "service_role";

grant delete on table "public"."admin_permissions" to "anon";

grant insert on table "public"."admin_permissions" to "anon";

grant references on table "public"."admin_permissions" to "anon";

grant select on table "public"."admin_permissions" to "anon";

grant trigger on table "public"."admin_permissions" to "anon";

grant truncate on table "public"."admin_permissions" to "anon";

grant update on table "public"."admin_permissions" to "anon";

grant delete on table "public"."admin_permissions" to "authenticated";

grant insert on table "public"."admin_permissions" to "authenticated";

grant references on table "public"."admin_permissions" to "authenticated";

grant select on table "public"."admin_permissions" to "authenticated";

grant trigger on table "public"."admin_permissions" to "authenticated";

grant truncate on table "public"."admin_permissions" to "authenticated";

grant update on table "public"."admin_permissions" to "authenticated";

grant delete on table "public"."admin_permissions" to "service_role";

grant insert on table "public"."admin_permissions" to "service_role";

grant references on table "public"."admin_permissions" to "service_role";

grant select on table "public"."admin_permissions" to "service_role";

grant trigger on table "public"."admin_permissions" to "service_role";

grant truncate on table "public"."admin_permissions" to "service_role";

grant update on table "public"."admin_permissions" to "service_role";

grant delete on table "public"."banner_manufacturing_instructions" to "anon";

grant insert on table "public"."banner_manufacturing_instructions" to "anon";

grant references on table "public"."banner_manufacturing_instructions" to "anon";

grant select on table "public"."banner_manufacturing_instructions" to "anon";

grant trigger on table "public"."banner_manufacturing_instructions" to "anon";

grant truncate on table "public"."banner_manufacturing_instructions" to "anon";

grant update on table "public"."banner_manufacturing_instructions" to "anon";

grant delete on table "public"."banner_manufacturing_instructions" to "authenticated";

grant insert on table "public"."banner_manufacturing_instructions" to "authenticated";

grant references on table "public"."banner_manufacturing_instructions" to "authenticated";

grant select on table "public"."banner_manufacturing_instructions" to "authenticated";

grant trigger on table "public"."banner_manufacturing_instructions" to "authenticated";

grant truncate on table "public"."banner_manufacturing_instructions" to "authenticated";

grant update on table "public"."banner_manufacturing_instructions" to "authenticated";

grant delete on table "public"."banner_manufacturing_instructions" to "service_role";

grant insert on table "public"."banner_manufacturing_instructions" to "service_role";

grant references on table "public"."banner_manufacturing_instructions" to "service_role";

grant select on table "public"."banner_manufacturing_instructions" to "service_role";

grant trigger on table "public"."banner_manufacturing_instructions" to "service_role";

grant truncate on table "public"."banner_manufacturing_instructions" to "service_role";

grant update on table "public"."banner_manufacturing_instructions" to "service_role";

grant delete on table "public"."banner_samples" to "anon";

grant insert on table "public"."banner_samples" to "anon";

grant references on table "public"."banner_samples" to "anon";

grant select on table "public"."banner_samples" to "anon";

grant trigger on table "public"."banner_samples" to "anon";

grant truncate on table "public"."banner_samples" to "anon";

grant update on table "public"."banner_samples" to "anon";

grant delete on table "public"."banner_samples" to "authenticated";

grant insert on table "public"."banner_samples" to "authenticated";

grant references on table "public"."banner_samples" to "authenticated";

grant select on table "public"."banner_samples" to "authenticated";

grant trigger on table "public"."banner_samples" to "authenticated";

grant truncate on table "public"."banner_samples" to "authenticated";

grant update on table "public"."banner_samples" to "authenticated";

grant delete on table "public"."banner_samples" to "service_role";

grant insert on table "public"."banner_samples" to "service_role";

grant references on table "public"."banner_samples" to "service_role";

grant select on table "public"."banner_samples" to "service_role";

grant trigger on table "public"."banner_samples" to "service_role";

grant truncate on table "public"."banner_samples" to "service_role";

grant update on table "public"."banner_samples" to "service_role";

grant delete on table "public"."banner_size_presets" to "anon";

grant insert on table "public"."banner_size_presets" to "anon";

grant references on table "public"."banner_size_presets" to "anon";

grant select on table "public"."banner_size_presets" to "anon";

grant trigger on table "public"."banner_size_presets" to "anon";

grant truncate on table "public"."banner_size_presets" to "anon";

grant update on table "public"."banner_size_presets" to "anon";

grant delete on table "public"."banner_size_presets" to "authenticated";

grant insert on table "public"."banner_size_presets" to "authenticated";

grant references on table "public"."banner_size_presets" to "authenticated";

grant select on table "public"."banner_size_presets" to "authenticated";

grant trigger on table "public"."banner_size_presets" to "authenticated";

grant truncate on table "public"."banner_size_presets" to "authenticated";

grant update on table "public"."banner_size_presets" to "authenticated";

grant delete on table "public"."banner_size_presets" to "service_role";

grant insert on table "public"."banner_size_presets" to "service_role";

grant references on table "public"."banner_size_presets" to "service_role";

grant select on table "public"."banner_size_presets" to "service_role";

grant trigger on table "public"."banner_size_presets" to "service_role";

grant truncate on table "public"."banner_size_presets" to "service_role";

grant update on table "public"."banner_size_presets" to "service_role";

grant delete on table "public"."cart_items" to "anon";

grant insert on table "public"."cart_items" to "anon";

grant references on table "public"."cart_items" to "anon";

grant select on table "public"."cart_items" to "anon";

grant trigger on table "public"."cart_items" to "anon";

grant truncate on table "public"."cart_items" to "anon";

grant update on table "public"."cart_items" to "anon";

grant delete on table "public"."cart_items" to "authenticated";

grant insert on table "public"."cart_items" to "authenticated";

grant references on table "public"."cart_items" to "authenticated";

grant select on table "public"."cart_items" to "authenticated";

grant trigger on table "public"."cart_items" to "authenticated";

grant truncate on table "public"."cart_items" to "authenticated";

grant update on table "public"."cart_items" to "authenticated";

grant delete on table "public"."cart_items" to "service_role";

grant insert on table "public"."cart_items" to "service_role";

grant references on table "public"."cart_items" to "service_role";

grant select on table "public"."cart_items" to "service_role";

grant trigger on table "public"."cart_items" to "service_role";

grant truncate on table "public"."cart_items" to "service_role";

grant update on table "public"."cart_items" to "service_role";

grant delete on table "public"."carts" to "anon";

grant insert on table "public"."carts" to "anon";

grant references on table "public"."carts" to "anon";

grant select on table "public"."carts" to "anon";

grant trigger on table "public"."carts" to "anon";

grant truncate on table "public"."carts" to "anon";

grant update on table "public"."carts" to "anon";

grant delete on table "public"."carts" to "authenticated";

grant insert on table "public"."carts" to "authenticated";

grant references on table "public"."carts" to "authenticated";

grant select on table "public"."carts" to "authenticated";

grant trigger on table "public"."carts" to "authenticated";

grant truncate on table "public"."carts" to "authenticated";

grant update on table "public"."carts" to "authenticated";

grant delete on table "public"."carts" to "service_role";

grant insert on table "public"."carts" to "service_role";

grant references on table "public"."carts" to "service_role";

grant select on table "public"."carts" to "service_role";

grant trigger on table "public"."carts" to "service_role";

grant truncate on table "public"."carts" to "service_role";

grant update on table "public"."carts" to "service_role";

grant delete on table "public"."catalog_item_market_rules" to "anon";

grant insert on table "public"."catalog_item_market_rules" to "anon";

grant references on table "public"."catalog_item_market_rules" to "anon";

grant select on table "public"."catalog_item_market_rules" to "anon";

grant trigger on table "public"."catalog_item_market_rules" to "anon";

grant truncate on table "public"."catalog_item_market_rules" to "anon";

grant update on table "public"."catalog_item_market_rules" to "anon";

grant delete on table "public"."catalog_item_market_rules" to "authenticated";

grant insert on table "public"."catalog_item_market_rules" to "authenticated";

grant references on table "public"."catalog_item_market_rules" to "authenticated";

grant select on table "public"."catalog_item_market_rules" to "authenticated";

grant trigger on table "public"."catalog_item_market_rules" to "authenticated";

grant truncate on table "public"."catalog_item_market_rules" to "authenticated";

grant update on table "public"."catalog_item_market_rules" to "authenticated";

grant delete on table "public"."catalog_item_market_rules" to "service_role";

grant insert on table "public"."catalog_item_market_rules" to "service_role";

grant references on table "public"."catalog_item_market_rules" to "service_role";

grant select on table "public"."catalog_item_market_rules" to "service_role";

grant trigger on table "public"."catalog_item_market_rules" to "service_role";

grant truncate on table "public"."catalog_item_market_rules" to "service_role";

grant update on table "public"."catalog_item_market_rules" to "service_role";

grant delete on table "public"."catalog_item_media" to "anon";

grant insert on table "public"."catalog_item_media" to "anon";

grant references on table "public"."catalog_item_media" to "anon";

grant select on table "public"."catalog_item_media" to "anon";

grant trigger on table "public"."catalog_item_media" to "anon";

grant truncate on table "public"."catalog_item_media" to "anon";

grant update on table "public"."catalog_item_media" to "anon";

grant delete on table "public"."catalog_item_media" to "authenticated";

grant insert on table "public"."catalog_item_media" to "authenticated";

grant references on table "public"."catalog_item_media" to "authenticated";

grant select on table "public"."catalog_item_media" to "authenticated";

grant trigger on table "public"."catalog_item_media" to "authenticated";

grant truncate on table "public"."catalog_item_media" to "authenticated";

grant update on table "public"."catalog_item_media" to "authenticated";

grant delete on table "public"."catalog_item_media" to "service_role";

grant insert on table "public"."catalog_item_media" to "service_role";

grant references on table "public"."catalog_item_media" to "service_role";

grant select on table "public"."catalog_item_media" to "service_role";

grant trigger on table "public"."catalog_item_media" to "service_role";

grant truncate on table "public"."catalog_item_media" to "service_role";

grant update on table "public"."catalog_item_media" to "service_role";

grant delete on table "public"."catalog_item_seo_metadata" to "anon";

grant insert on table "public"."catalog_item_seo_metadata" to "anon";

grant references on table "public"."catalog_item_seo_metadata" to "anon";

grant select on table "public"."catalog_item_seo_metadata" to "anon";

grant trigger on table "public"."catalog_item_seo_metadata" to "anon";

grant truncate on table "public"."catalog_item_seo_metadata" to "anon";

grant update on table "public"."catalog_item_seo_metadata" to "anon";

grant delete on table "public"."catalog_item_seo_metadata" to "authenticated";

grant insert on table "public"."catalog_item_seo_metadata" to "authenticated";

grant references on table "public"."catalog_item_seo_metadata" to "authenticated";

grant select on table "public"."catalog_item_seo_metadata" to "authenticated";

grant trigger on table "public"."catalog_item_seo_metadata" to "authenticated";

grant truncate on table "public"."catalog_item_seo_metadata" to "authenticated";

grant update on table "public"."catalog_item_seo_metadata" to "authenticated";

grant delete on table "public"."catalog_item_seo_metadata" to "service_role";

grant insert on table "public"."catalog_item_seo_metadata" to "service_role";

grant references on table "public"."catalog_item_seo_metadata" to "service_role";

grant select on table "public"."catalog_item_seo_metadata" to "service_role";

grant trigger on table "public"."catalog_item_seo_metadata" to "service_role";

grant truncate on table "public"."catalog_item_seo_metadata" to "service_role";

grant update on table "public"."catalog_item_seo_metadata" to "service_role";

grant delete on table "public"."catalog_item_translations" to "anon";

grant insert on table "public"."catalog_item_translations" to "anon";

grant references on table "public"."catalog_item_translations" to "anon";

grant select on table "public"."catalog_item_translations" to "anon";

grant trigger on table "public"."catalog_item_translations" to "anon";

grant truncate on table "public"."catalog_item_translations" to "anon";

grant update on table "public"."catalog_item_translations" to "anon";

grant delete on table "public"."catalog_item_translations" to "authenticated";

grant insert on table "public"."catalog_item_translations" to "authenticated";

grant references on table "public"."catalog_item_translations" to "authenticated";

grant select on table "public"."catalog_item_translations" to "authenticated";

grant trigger on table "public"."catalog_item_translations" to "authenticated";

grant truncate on table "public"."catalog_item_translations" to "authenticated";

grant update on table "public"."catalog_item_translations" to "authenticated";

grant delete on table "public"."catalog_item_translations" to "service_role";

grant insert on table "public"."catalog_item_translations" to "service_role";

grant references on table "public"."catalog_item_translations" to "service_role";

grant select on table "public"."catalog_item_translations" to "service_role";

grant trigger on table "public"."catalog_item_translations" to "service_role";

grant truncate on table "public"."catalog_item_translations" to "service_role";

grant update on table "public"."catalog_item_translations" to "service_role";

grant delete on table "public"."catalog_items" to "anon";

grant insert on table "public"."catalog_items" to "anon";

grant references on table "public"."catalog_items" to "anon";

grant select on table "public"."catalog_items" to "anon";

grant trigger on table "public"."catalog_items" to "anon";

grant truncate on table "public"."catalog_items" to "anon";

grant update on table "public"."catalog_items" to "anon";

grant delete on table "public"."catalog_items" to "authenticated";

grant insert on table "public"."catalog_items" to "authenticated";

grant references on table "public"."catalog_items" to "authenticated";

grant select on table "public"."catalog_items" to "authenticated";

grant trigger on table "public"."catalog_items" to "authenticated";

grant truncate on table "public"."catalog_items" to "authenticated";

grant update on table "public"."catalog_items" to "authenticated";

grant delete on table "public"."catalog_items" to "service_role";

grant insert on table "public"."catalog_items" to "service_role";

grant references on table "public"."catalog_items" to "service_role";

grant select on table "public"."catalog_items" to "service_role";

grant trigger on table "public"."catalog_items" to "service_role";

grant truncate on table "public"."catalog_items" to "service_role";

grant update on table "public"."catalog_items" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."countries" to "anon";

grant insert on table "public"."countries" to "anon";

grant references on table "public"."countries" to "anon";

grant select on table "public"."countries" to "anon";

grant trigger on table "public"."countries" to "anon";

grant truncate on table "public"."countries" to "anon";

grant update on table "public"."countries" to "anon";

grant delete on table "public"."countries" to "authenticated";

grant insert on table "public"."countries" to "authenticated";

grant references on table "public"."countries" to "authenticated";

grant select on table "public"."countries" to "authenticated";

grant trigger on table "public"."countries" to "authenticated";

grant truncate on table "public"."countries" to "authenticated";

grant update on table "public"."countries" to "authenticated";

grant delete on table "public"."countries" to "service_role";

grant insert on table "public"."countries" to "service_role";

grant references on table "public"."countries" to "service_role";

grant select on table "public"."countries" to "service_role";

grant trigger on table "public"."countries" to "service_role";

grant truncate on table "public"."countries" to "service_role";

grant update on table "public"."countries" to "service_role";

grant delete on table "public"."credit_accounts" to "anon";

grant insert on table "public"."credit_accounts" to "anon";

grant references on table "public"."credit_accounts" to "anon";

grant select on table "public"."credit_accounts" to "anon";

grant trigger on table "public"."credit_accounts" to "anon";

grant truncate on table "public"."credit_accounts" to "anon";

grant update on table "public"."credit_accounts" to "anon";

grant delete on table "public"."credit_accounts" to "authenticated";

grant insert on table "public"."credit_accounts" to "authenticated";

grant references on table "public"."credit_accounts" to "authenticated";

grant select on table "public"."credit_accounts" to "authenticated";

grant trigger on table "public"."credit_accounts" to "authenticated";

grant truncate on table "public"."credit_accounts" to "authenticated";

grant update on table "public"."credit_accounts" to "authenticated";

grant delete on table "public"."credit_accounts" to "service_role";

grant insert on table "public"."credit_accounts" to "service_role";

grant references on table "public"."credit_accounts" to "service_role";

grant select on table "public"."credit_accounts" to "service_role";

grant trigger on table "public"."credit_accounts" to "service_role";

grant truncate on table "public"."credit_accounts" to "service_role";

grant update on table "public"."credit_accounts" to "service_role";

grant delete on table "public"."credit_ledger" to "anon";

grant insert on table "public"."credit_ledger" to "anon";

grant references on table "public"."credit_ledger" to "anon";

grant select on table "public"."credit_ledger" to "anon";

grant trigger on table "public"."credit_ledger" to "anon";

grant truncate on table "public"."credit_ledger" to "anon";

grant update on table "public"."credit_ledger" to "anon";

grant delete on table "public"."credit_ledger" to "authenticated";

grant insert on table "public"."credit_ledger" to "authenticated";

grant references on table "public"."credit_ledger" to "authenticated";

grant select on table "public"."credit_ledger" to "authenticated";

grant trigger on table "public"."credit_ledger" to "authenticated";

grant truncate on table "public"."credit_ledger" to "authenticated";

grant update on table "public"."credit_ledger" to "authenticated";

grant delete on table "public"."credit_ledger" to "service_role";

grant insert on table "public"."credit_ledger" to "service_role";

grant references on table "public"."credit_ledger" to "service_role";

grant select on table "public"."credit_ledger" to "service_role";

grant trigger on table "public"."credit_ledger" to "service_role";

grant truncate on table "public"."credit_ledger" to "service_role";

grant update on table "public"."credit_ledger" to "service_role";

grant delete on table "public"."currencies" to "anon";

grant insert on table "public"."currencies" to "anon";

grant references on table "public"."currencies" to "anon";

grant select on table "public"."currencies" to "anon";

grant trigger on table "public"."currencies" to "anon";

grant truncate on table "public"."currencies" to "anon";

grant update on table "public"."currencies" to "anon";

grant delete on table "public"."currencies" to "authenticated";

grant insert on table "public"."currencies" to "authenticated";

grant references on table "public"."currencies" to "authenticated";

grant select on table "public"."currencies" to "authenticated";

grant trigger on table "public"."currencies" to "authenticated";

grant truncate on table "public"."currencies" to "authenticated";

grant update on table "public"."currencies" to "authenticated";

grant delete on table "public"."currencies" to "service_role";

grant insert on table "public"."currencies" to "service_role";

grant references on table "public"."currencies" to "service_role";

grant select on table "public"."currencies" to "service_role";

grant trigger on table "public"."currencies" to "service_role";

grant truncate on table "public"."currencies" to "service_role";

grant update on table "public"."currencies" to "service_role";

grant delete on table "public"."exchange_rates" to "anon";

grant insert on table "public"."exchange_rates" to "anon";

grant references on table "public"."exchange_rates" to "anon";

grant select on table "public"."exchange_rates" to "anon";

grant trigger on table "public"."exchange_rates" to "anon";

grant truncate on table "public"."exchange_rates" to "anon";

grant update on table "public"."exchange_rates" to "anon";

grant delete on table "public"."exchange_rates" to "authenticated";

grant insert on table "public"."exchange_rates" to "authenticated";

grant references on table "public"."exchange_rates" to "authenticated";

grant select on table "public"."exchange_rates" to "authenticated";

grant trigger on table "public"."exchange_rates" to "authenticated";

grant truncate on table "public"."exchange_rates" to "authenticated";

grant update on table "public"."exchange_rates" to "authenticated";

grant delete on table "public"."exchange_rates" to "service_role";

grant insert on table "public"."exchange_rates" to "service_role";

grant references on table "public"."exchange_rates" to "service_role";

grant select on table "public"."exchange_rates" to "service_role";

grant trigger on table "public"."exchange_rates" to "service_role";

grant truncate on table "public"."exchange_rates" to "service_role";

grant update on table "public"."exchange_rates" to "service_role";

grant delete on table "public"."generated_item_artifacts" to "anon";

grant insert on table "public"."generated_item_artifacts" to "anon";

grant references on table "public"."generated_item_artifacts" to "anon";

grant select on table "public"."generated_item_artifacts" to "anon";

grant trigger on table "public"."generated_item_artifacts" to "anon";

grant truncate on table "public"."generated_item_artifacts" to "anon";

grant update on table "public"."generated_item_artifacts" to "anon";

grant delete on table "public"."generated_item_artifacts" to "authenticated";

grant insert on table "public"."generated_item_artifacts" to "authenticated";

grant references on table "public"."generated_item_artifacts" to "authenticated";

grant select on table "public"."generated_item_artifacts" to "authenticated";

grant trigger on table "public"."generated_item_artifacts" to "authenticated";

grant truncate on table "public"."generated_item_artifacts" to "authenticated";

grant update on table "public"."generated_item_artifacts" to "authenticated";

grant delete on table "public"."generated_item_artifacts" to "service_role";

grant insert on table "public"."generated_item_artifacts" to "service_role";

grant references on table "public"."generated_item_artifacts" to "service_role";

grant select on table "public"."generated_item_artifacts" to "service_role";

grant trigger on table "public"."generated_item_artifacts" to "service_role";

grant truncate on table "public"."generated_item_artifacts" to "service_role";

grant update on table "public"."generated_item_artifacts" to "service_role";

grant delete on table "public"."generated_items" to "anon";

grant insert on table "public"."generated_items" to "anon";

grant references on table "public"."generated_items" to "anon";

grant select on table "public"."generated_items" to "anon";

grant trigger on table "public"."generated_items" to "anon";

grant truncate on table "public"."generated_items" to "anon";

grant update on table "public"."generated_items" to "anon";

grant delete on table "public"."generated_items" to "authenticated";

grant insert on table "public"."generated_items" to "authenticated";

grant references on table "public"."generated_items" to "authenticated";

grant select on table "public"."generated_items" to "authenticated";

grant trigger on table "public"."generated_items" to "authenticated";

grant truncate on table "public"."generated_items" to "authenticated";

grant update on table "public"."generated_items" to "authenticated";

grant delete on table "public"."generated_items" to "service_role";

grant insert on table "public"."generated_items" to "service_role";

grant references on table "public"."generated_items" to "service_role";

grant select on table "public"."generated_items" to "service_role";

grant trigger on table "public"."generated_items" to "service_role";

grant truncate on table "public"."generated_items" to "service_role";

grant update on table "public"."generated_items" to "service_role";

grant delete on table "public"."generation_sessions" to "anon";

grant insert on table "public"."generation_sessions" to "anon";

grant references on table "public"."generation_sessions" to "anon";

grant select on table "public"."generation_sessions" to "anon";

grant trigger on table "public"."generation_sessions" to "anon";

grant truncate on table "public"."generation_sessions" to "anon";

grant update on table "public"."generation_sessions" to "anon";

grant delete on table "public"."generation_sessions" to "authenticated";

grant insert on table "public"."generation_sessions" to "authenticated";

grant references on table "public"."generation_sessions" to "authenticated";

grant select on table "public"."generation_sessions" to "authenticated";

grant trigger on table "public"."generation_sessions" to "authenticated";

grant truncate on table "public"."generation_sessions" to "authenticated";

grant update on table "public"."generation_sessions" to "authenticated";

grant delete on table "public"."generation_sessions" to "service_role";

grant insert on table "public"."generation_sessions" to "service_role";

grant references on table "public"."generation_sessions" to "service_role";

grant select on table "public"."generation_sessions" to "service_role";

grant trigger on table "public"."generation_sessions" to "service_role";

grant truncate on table "public"."generation_sessions" to "service_role";

grant update on table "public"."generation_sessions" to "service_role";

grant delete on table "public"."market_regions" to "anon";

grant insert on table "public"."market_regions" to "anon";

grant references on table "public"."market_regions" to "anon";

grant select on table "public"."market_regions" to "anon";

grant trigger on table "public"."market_regions" to "anon";

grant truncate on table "public"."market_regions" to "anon";

grant update on table "public"."market_regions" to "anon";

grant delete on table "public"."market_regions" to "authenticated";

grant insert on table "public"."market_regions" to "authenticated";

grant references on table "public"."market_regions" to "authenticated";

grant select on table "public"."market_regions" to "authenticated";

grant trigger on table "public"."market_regions" to "authenticated";

grant truncate on table "public"."market_regions" to "authenticated";

grant update on table "public"."market_regions" to "authenticated";

grant delete on table "public"."market_regions" to "service_role";

grant insert on table "public"."market_regions" to "service_role";

grant references on table "public"."market_regions" to "service_role";

grant select on table "public"."market_regions" to "service_role";

grant trigger on table "public"."market_regions" to "service_role";

grant truncate on table "public"."market_regions" to "service_role";

grant update on table "public"."market_regions" to "service_role";

grant delete on table "public"."order_items" to "anon";

grant insert on table "public"."order_items" to "anon";

grant references on table "public"."order_items" to "anon";

grant select on table "public"."order_items" to "anon";

grant trigger on table "public"."order_items" to "anon";

grant truncate on table "public"."order_items" to "anon";

grant update on table "public"."order_items" to "anon";

grant delete on table "public"."order_items" to "authenticated";

grant insert on table "public"."order_items" to "authenticated";

grant references on table "public"."order_items" to "authenticated";

grant select on table "public"."order_items" to "authenticated";

grant trigger on table "public"."order_items" to "authenticated";

grant truncate on table "public"."order_items" to "authenticated";

grant update on table "public"."order_items" to "authenticated";

grant delete on table "public"."order_items" to "service_role";

grant insert on table "public"."order_items" to "service_role";

grant references on table "public"."order_items" to "service_role";

grant select on table "public"."order_items" to "service_role";

grant trigger on table "public"."order_items" to "service_role";

grant truncate on table "public"."order_items" to "service_role";

grant update on table "public"."order_items" to "service_role";

grant delete on table "public"."orders" to "anon";

grant insert on table "public"."orders" to "anon";

grant references on table "public"."orders" to "anon";

grant select on table "public"."orders" to "anon";

grant trigger on table "public"."orders" to "anon";

grant truncate on table "public"."orders" to "anon";

grant update on table "public"."orders" to "anon";

grant delete on table "public"."orders" to "authenticated";

grant insert on table "public"."orders" to "authenticated";

grant references on table "public"."orders" to "authenticated";

grant select on table "public"."orders" to "authenticated";

grant trigger on table "public"."orders" to "authenticated";

grant truncate on table "public"."orders" to "authenticated";

grant update on table "public"."orders" to "authenticated";

grant delete on table "public"."orders" to "service_role";

grant insert on table "public"."orders" to "service_role";

grant references on table "public"."orders" to "service_role";

grant select on table "public"."orders" to "service_role";

grant trigger on table "public"."orders" to "service_role";

grant truncate on table "public"."orders" to "service_role";

grant update on table "public"."orders" to "service_role";

grant delete on table "public"."personalization_boilerplates" to "anon";

grant insert on table "public"."personalization_boilerplates" to "anon";

grant references on table "public"."personalization_boilerplates" to "anon";

grant select on table "public"."personalization_boilerplates" to "anon";

grant trigger on table "public"."personalization_boilerplates" to "anon";

grant truncate on table "public"."personalization_boilerplates" to "anon";

grant update on table "public"."personalization_boilerplates" to "anon";

grant delete on table "public"."personalization_boilerplates" to "authenticated";

grant insert on table "public"."personalization_boilerplates" to "authenticated";

grant references on table "public"."personalization_boilerplates" to "authenticated";

grant select on table "public"."personalization_boilerplates" to "authenticated";

grant trigger on table "public"."personalization_boilerplates" to "authenticated";

grant truncate on table "public"."personalization_boilerplates" to "authenticated";

grant update on table "public"."personalization_boilerplates" to "authenticated";

grant delete on table "public"."personalization_boilerplates" to "service_role";

grant insert on table "public"."personalization_boilerplates" to "service_role";

grant references on table "public"."personalization_boilerplates" to "service_role";

grant select on table "public"."personalization_boilerplates" to "service_role";

grant trigger on table "public"."personalization_boilerplates" to "service_role";

grant truncate on table "public"."personalization_boilerplates" to "service_role";

grant update on table "public"."personalization_boilerplates" to "service_role";

grant delete on table "public"."personalization_models" to "anon";

grant insert on table "public"."personalization_models" to "anon";

grant references on table "public"."personalization_models" to "anon";

grant select on table "public"."personalization_models" to "anon";

grant trigger on table "public"."personalization_models" to "anon";

grant truncate on table "public"."personalization_models" to "anon";

grant update on table "public"."personalization_models" to "anon";

grant delete on table "public"."personalization_models" to "authenticated";

grant insert on table "public"."personalization_models" to "authenticated";

grant references on table "public"."personalization_models" to "authenticated";

grant select on table "public"."personalization_models" to "authenticated";

grant trigger on table "public"."personalization_models" to "authenticated";

grant truncate on table "public"."personalization_models" to "authenticated";

grant update on table "public"."personalization_models" to "authenticated";

grant delete on table "public"."personalization_models" to "service_role";

grant insert on table "public"."personalization_models" to "service_role";

grant references on table "public"."personalization_models" to "service_role";

grant select on table "public"."personalization_models" to "service_role";

grant trigger on table "public"."personalization_models" to "service_role";

grant truncate on table "public"."personalization_models" to "service_role";

grant update on table "public"."personalization_models" to "service_role";

grant delete on table "public"."personalized_preview_options" to "anon";

grant insert on table "public"."personalized_preview_options" to "anon";

grant references on table "public"."personalized_preview_options" to "anon";

grant select on table "public"."personalized_preview_options" to "anon";

grant trigger on table "public"."personalized_preview_options" to "anon";

grant truncate on table "public"."personalized_preview_options" to "anon";

grant update on table "public"."personalized_preview_options" to "anon";

grant delete on table "public"."personalized_preview_options" to "authenticated";

grant insert on table "public"."personalized_preview_options" to "authenticated";

grant references on table "public"."personalized_preview_options" to "authenticated";

grant select on table "public"."personalized_preview_options" to "authenticated";

grant trigger on table "public"."personalized_preview_options" to "authenticated";

grant truncate on table "public"."personalized_preview_options" to "authenticated";

grant update on table "public"."personalized_preview_options" to "authenticated";

grant delete on table "public"."personalized_preview_options" to "service_role";

grant insert on table "public"."personalized_preview_options" to "service_role";

grant references on table "public"."personalized_preview_options" to "service_role";

grant select on table "public"."personalized_preview_options" to "service_role";

grant trigger on table "public"."personalized_preview_options" to "service_role";

grant truncate on table "public"."personalized_preview_options" to "service_role";

grant update on table "public"."personalized_preview_options" to "service_role";

grant delete on table "public"."products" to "anon";

grant insert on table "public"."products" to "anon";

grant references on table "public"."products" to "anon";

grant select on table "public"."products" to "anon";

grant trigger on table "public"."products" to "anon";

grant truncate on table "public"."products" to "anon";

grant update on table "public"."products" to "anon";

grant delete on table "public"."products" to "authenticated";

grant insert on table "public"."products" to "authenticated";

grant references on table "public"."products" to "authenticated";

grant select on table "public"."products" to "authenticated";

grant trigger on table "public"."products" to "authenticated";

grant truncate on table "public"."products" to "authenticated";

grant update on table "public"."products" to "authenticated";

grant delete on table "public"."products" to "service_role";

grant insert on table "public"."products" to "service_role";

grant references on table "public"."products" to "service_role";

grant select on table "public"."products" to "service_role";

grant trigger on table "public"."products" to "service_role";

grant truncate on table "public"."products" to "service_role";

grant update on table "public"."products" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."subcategories" to "anon";

grant insert on table "public"."subcategories" to "anon";

grant references on table "public"."subcategories" to "anon";

grant select on table "public"."subcategories" to "anon";

grant trigger on table "public"."subcategories" to "anon";

grant truncate on table "public"."subcategories" to "anon";

grant update on table "public"."subcategories" to "anon";

grant delete on table "public"."subcategories" to "authenticated";

grant insert on table "public"."subcategories" to "authenticated";

grant references on table "public"."subcategories" to "authenticated";

grant select on table "public"."subcategories" to "authenticated";

grant trigger on table "public"."subcategories" to "authenticated";

grant truncate on table "public"."subcategories" to "authenticated";

grant update on table "public"."subcategories" to "authenticated";

grant delete on table "public"."subcategories" to "service_role";

grant insert on table "public"."subcategories" to "service_role";

grant references on table "public"."subcategories" to "service_role";

grant select on table "public"."subcategories" to "service_role";

grant trigger on table "public"."subcategories" to "service_role";

grant truncate on table "public"."subcategories" to "service_role";

grant update on table "public"."subcategories" to "service_role";

grant delete on table "public"."transactions" to "anon";

grant insert on table "public"."transactions" to "anon";

grant references on table "public"."transactions" to "anon";

grant select on table "public"."transactions" to "anon";

grant trigger on table "public"."transactions" to "anon";

grant truncate on table "public"."transactions" to "anon";

grant update on table "public"."transactions" to "anon";

grant delete on table "public"."transactions" to "authenticated";

grant insert on table "public"."transactions" to "authenticated";

grant references on table "public"."transactions" to "authenticated";

grant select on table "public"."transactions" to "authenticated";

grant trigger on table "public"."transactions" to "authenticated";

grant truncate on table "public"."transactions" to "authenticated";

grant update on table "public"."transactions" to "authenticated";

grant delete on table "public"."transactions" to "service_role";

grant insert on table "public"."transactions" to "service_role";

grant references on table "public"."transactions" to "service_role";

grant select on table "public"."transactions" to "service_role";

grant trigger on table "public"."transactions" to "service_role";

grant truncate on table "public"."transactions" to "service_role";

grant update on table "public"."transactions" to "service_role";


  create policy "admins insert audit log"
  on "public"."admin_audit_log"
  as permissive
  for insert
  to public
with check (private.is_admin(auth.uid()));



  create policy "admins read audit log"
  on "public"."admin_audit_log"
  as permissive
  for select
  to public
using (private.is_admin(auth.uid()));



  create policy "admins manage admin permissions"
  on "public"."admin_permissions"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "admins read admin permissions"
  on "public"."admin_permissions"
  as permissive
  for select
  to public
using (private.is_admin(auth.uid()));



  create policy "admins manage banner manufacturing instructions"
  on "public"."banner_manufacturing_instructions"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "admins manage banner samples"
  on "public"."banner_samples"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads published banner samples"
  on "public"."banner_samples"
  as permissive
  for select
  to public
using (((status = 'published'::text) OR private.is_admin(auth.uid())));



  create policy "admins manage banner presets"
  on "public"."banner_size_presets"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads active banner presets"
  on "public"."banner_size_presets"
  as permissive
  for select
  to public
using ((is_active OR private.is_admin(auth.uid())));



  create policy "users manage own cart items"
  on "public"."cart_items"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND (carts.user_id = auth.uid()) AND (carts.status = 'active'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND (carts.user_id = auth.uid()) AND (carts.status = 'active'::text)))));



  create policy "users read own cart items"
  on "public"."cart_items"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND ((carts.user_id = auth.uid()) OR private.is_admin(auth.uid()))))));



  create policy "admins read carts"
  on "public"."carts"
  as permissive
  for select
  to public
using (private.is_admin(auth.uid()));



  create policy "users manage own carts"
  on "public"."carts"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "users read own carts"
  on "public"."carts"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR private.is_admin(auth.uid())));



  create policy "admins delete catalog market rules"
  on "public"."catalog_item_market_rules"
  as permissive
  for delete
  to authenticated
using (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "admins insert catalog market rules"
  on "public"."catalog_item_market_rules"
  as permissive
  for insert
  to authenticated
with check (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "admins update catalog market rules"
  on "public"."catalog_item_market_rules"
  as permissive
  for update
  to authenticated
using (private.is_admin(( SELECT auth.uid() AS uid)))
with check (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "public reads published catalog market rules"
  on "public"."catalog_item_market_rules"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.catalog_items
  WHERE ((catalog_items.id = catalog_item_market_rules.catalog_item_id) AND ((catalog_items.status = 'published'::text) OR private.is_admin(( SELECT auth.uid() AS uid)))))));



  create policy "admins manage catalog media"
  on "public"."catalog_item_media"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads published catalog media"
  on "public"."catalog_item_media"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.catalog_items item
  WHERE ((item.id = catalog_item_media.catalog_item_id) AND ((item.status = 'published'::text) OR private.is_admin(auth.uid()))))));



  create policy "admins manage seo metadata"
  on "public"."catalog_item_seo_metadata"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads published seo metadata"
  on "public"."catalog_item_seo_metadata"
  as permissive
  for select
  to public
using (((NOT noindex) AND (EXISTS ( SELECT 1
   FROM public.catalog_items
  WHERE ((catalog_items.id = catalog_item_seo_metadata.catalog_item_id) AND ((catalog_items.status = 'published'::text) OR private.is_admin(auth.uid())))))));



  create policy "admins manage catalog translations"
  on "public"."catalog_item_translations"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads published catalog translations"
  on "public"."catalog_item_translations"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.catalog_items
  WHERE ((catalog_items.id = catalog_item_translations.catalog_item_id) AND ((catalog_items.status = 'published'::text) OR private.is_admin(auth.uid()))))));



  create policy "admins manage catalog items"
  on "public"."catalog_items"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads published catalog items"
  on "public"."catalog_items"
  as permissive
  for select
  to public
using (((status = 'published'::text) OR private.is_admin(auth.uid())));



  create policy "admins manage categories"
  on "public"."categories"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads active categories"
  on "public"."categories"
  as permissive
  for select
  to public
using ((is_active OR private.is_admin(auth.uid())));



  create policy "admins delete countries"
  on "public"."countries"
  as permissive
  for delete
  to authenticated
using (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "admins insert countries"
  on "public"."countries"
  as permissive
  for insert
  to authenticated
with check (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "admins update countries"
  on "public"."countries"
  as permissive
  for update
  to authenticated
using (private.is_admin(( SELECT auth.uid() AS uid)))
with check (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "public reads active countries"
  on "public"."countries"
  as permissive
  for select
  to anon, authenticated
using ((is_active OR private.is_admin(( SELECT auth.uid() AS uid))));



  create policy "users read own credit account"
  on "public"."credit_accounts"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR private.is_admin(auth.uid())));



  create policy "users read own credit ledger"
  on "public"."credit_ledger"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR private.is_admin(auth.uid())));



  create policy "admins manage currencies"
  on "public"."currencies"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads currencies"
  on "public"."currencies"
  as permissive
  for select
  to public
using (true);



  create policy "admins manage exchange rates"
  on "public"."exchange_rates"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads exchange rates"
  on "public"."exchange_rates"
  as permissive
  for select
  to public
using (true);



  create policy "admins manage generated artifacts"
  on "public"."generated_item_artifacts"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "users insert own generated artifacts"
  on "public"."generated_item_artifacts"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.generated_items
  WHERE ((generated_items.id = generated_item_artifacts.generated_item_id) AND (generated_items.user_id = auth.uid())))));



  create policy "users read own generated artifacts"
  on "public"."generated_item_artifacts"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.generated_items
  WHERE ((generated_items.id = generated_item_artifacts.generated_item_id) AND ((generated_items.user_id = auth.uid()) OR private.is_admin(auth.uid()))))));



  create policy "admins manage generated items"
  on "public"."generated_items"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "users insert own generated items"
  on "public"."generated_items"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "users read own generated items"
  on "public"."generated_items"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR private.is_admin(auth.uid())));



  create policy "users update own draft generated items"
  on "public"."generated_items"
  as permissive
  for update
  to public
using (((auth.uid() = user_id) AND (review_status = ANY (ARRAY['draft'::text, 'preview_ready'::text]))))
with check ((auth.uid() = user_id));



  create policy "owner deletes sessions"
  on "public"."generation_sessions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "owner inserts sessions"
  on "public"."generation_sessions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "owner reads sessions"
  on "public"."generation_sessions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "owner updates sessions"
  on "public"."generation_sessions"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "admins delete market regions"
  on "public"."market_regions"
  as permissive
  for delete
  to authenticated
using (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "admins insert market regions"
  on "public"."market_regions"
  as permissive
  for insert
  to authenticated
with check (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "admins update market regions"
  on "public"."market_regions"
  as permissive
  for update
  to authenticated
using (private.is_admin(( SELECT auth.uid() AS uid)))
with check (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "public reads active market regions"
  on "public"."market_regions"
  as permissive
  for select
  to anon, authenticated
using ((is_active OR private.is_admin(( SELECT auth.uid() AS uid))));



  create policy "admins manage order items"
  on "public"."order_items"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "users insert own order items"
  on "public"."order_items"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));



  create policy "users read own order items"
  on "public"."order_items"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND ((orders.user_id = auth.uid()) OR private.is_admin(auth.uid()))))));



  create policy "admins manage orders"
  on "public"."orders"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "users insert own orders"
  on "public"."orders"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "users read own orders"
  on "public"."orders"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR private.is_admin(auth.uid())));



  create policy "admins manage personalization boilerplates"
  on "public"."personalization_boilerplates"
  as permissive
  for all
  to authenticated
using (private.is_admin(( SELECT auth.uid() AS uid)))
with check (private.is_admin(( SELECT auth.uid() AS uid)));



  create policy "customers read active personalization boilerplates"
  on "public"."personalization_boilerplates"
  as permissive
  for select
  to anon, authenticated
using ((is_active AND (EXISTS ( SELECT 1
   FROM public.personalization_models
  WHERE ((personalization_models.id = personalization_boilerplates.model_id) AND (personalization_models.status = 'published'::text))))));



  create policy "admins manage personalization models"
  on "public"."personalization_models"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads published personalization models"
  on "public"."personalization_models"
  as permissive
  for select
  to public
using (((status = 'published'::text) OR private.is_admin(auth.uid())));



  create policy "admins manage personalized preview options"
  on "public"."personalized_preview_options"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "users manage own personalized preview options"
  on "public"."personalized_preview_options"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.generated_items
  WHERE ((generated_items.id = personalized_preview_options.generated_item_id) AND (generated_items.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.generated_items
  WHERE ((generated_items.id = personalized_preview_options.generated_item_id) AND (generated_items.user_id = auth.uid())))));



  create policy "users read own personalized preview options"
  on "public"."personalized_preview_options"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.generated_items
  WHERE ((generated_items.id = personalized_preview_options.generated_item_id) AND ((generated_items.user_id = auth.uid()) OR private.is_admin(auth.uid()))))));



  create policy "owner inserts products"
  on "public"."products"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "owner reads products"
  on "public"."products"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "admins update profiles"
  on "public"."profiles"
  as permissive
  for update
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "users read own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR private.is_admin(auth.uid())));



  create policy "admins manage subcategories"
  on "public"."subcategories"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "public reads active subcategories"
  on "public"."subcategories"
  as permissive
  for select
  to public
using ((is_active OR private.is_admin(auth.uid())));



  create policy "admins manage transactions"
  on "public"."transactions"
  as permissive
  for all
  to public
using (private.is_admin(auth.uid()))
with check (private.is_admin(auth.uid()));



  create policy "users read own transactions"
  on "public"."transactions"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR private.is_admin(auth.uid())));


CREATE TRIGGER banner_samples_set_updated_at BEFORE UPDATE ON public.banner_samples FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER cart_items_set_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER carts_set_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER catalog_item_market_rules_set_updated_at BEFORE UPDATE ON public.catalog_item_market_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER catalog_item_media_set_updated_at BEFORE UPDATE ON public.catalog_item_media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER catalog_item_seo_metadata_set_updated_at BEFORE UPDATE ON public.catalog_item_seo_metadata FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER catalog_item_translations_set_updated_at BEFORE UPDATE ON public.catalog_item_translations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER catalog_items_set_updated_at BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER countries_set_updated_at BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER credit_accounts_set_updated_at BEFORE UPDATE ON public.credit_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER currencies_set_updated_at BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER currencies_validate_after_change AFTER INSERT OR DELETE OR UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.ensure_currency_settings_valid();

CREATE TRIGGER generated_items_set_updated_at BEFORE UPDATE ON public.generated_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER market_regions_set_updated_at BEFORE UPDATE ON public.market_regions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER personalization_boilerplates_set_updated_at BEFORE UPDATE ON public.personalization_boilerplates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER personalization_models_set_updated_at BEFORE UPDATE ON public.personalization_models FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER personalized_preview_options_set_updated_at BEFORE UPDATE ON public.personalized_preview_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subcategories_set_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


  create policy "admins manage banner assets"
  on "storage"."objects"
  as permissive
  for all
  to public
using (((bucket_id = 'banner-assets'::text) AND private.is_admin(auth.uid())))
with check (((bucket_id = 'banner-assets'::text) AND private.is_admin(auth.uid())));



  create policy "admins manage catalog assets"
  on "storage"."objects"
  as permissive
  for all
  to public
using (((bucket_id = 'catalog-assets'::text) AND private.is_admin(auth.uid())))
with check (((bucket_id = 'catalog-assets'::text) AND private.is_admin(auth.uid())));



  create policy "admins manage private marketplace assets"
  on "storage"."objects"
  as permissive
  for all
  to public
using (((bucket_id = ANY (ARRAY['user-uploads'::text, 'generated-assets'::text])) AND private.is_admin(auth.uid())))
with check (((bucket_id = ANY (ARRAY['user-uploads'::text, 'generated-assets'::text])) AND private.is_admin(auth.uid())));



  create policy "owner deletes own uploads"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "owner inserts own uploads"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "owner reads own uploads"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "users manage own generated assets"
  on "storage"."objects"
  as permissive
  for all
  to public
using (((bucket_id = 'generated-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
with check (((bucket_id = 'generated-assets'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "users manage own uploads"
  on "storage"."objects"
  as permissive
  for all
  to public
using (((bucket_id = 'user-uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
with check (((bucket_id = 'user-uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();



-- Privilege hardening: restrict privileged/internal functions and the
-- private helper schema beyond Postgres/Supabase defaults.
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_admin(uuid) to anon, authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.next_ameria_order_id() from public, anon, authenticated;
grant execute on function public.next_ameria_order_id() to service_role;

-- Reference/lookup and sample catalog data.
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types") VALUES
	('uploads', 'uploads', false, NULL, NULL),
	('banner-assets', 'banner-assets', true, 20971520, '{image/png,image/jpeg,image/webp,image/svg+xml,application/pdf}'),
	('user-uploads', 'user-uploads', false, 20971520, '{image/png,image/jpeg,image/webp}'),
	('generated-assets', 'generated-assets', false, 20971520, '{image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,application/json}'),
	('catalog-assets', 'catalog-assets', true, 52428800, '{image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm}')
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
INSERT INTO "public"."currencies" ("code", "name", "symbol", "is_enabled", "is_default", "payment_route", "sort_order", "created_at", "updated_at") VALUES
	('AMD', 'Armenian dram', '֏', true, true, 'ameria', 10, '2026-07-06 16:56:43.347246+00', '2026-07-06 16:56:43.406495+00'),
	('EUR', 'Euro', '€', true, false, 'ameria', 20, '2026-07-06 16:56:43.347246+00', '2026-07-06 16:56:43.406495+00'),
	('USD', 'US dollar', '$', true, false, 'ameria', 30, '2026-07-06 16:56:43.347246+00', '2026-07-06 16:56:43.406495+00'),
	('RUB', 'Russian ruble', '₽', true, false, 'ameria', 40, '2026-07-06 16:56:43.347246+00', '2026-07-06 16:56:43.406495+00');
INSERT INTO "public"."market_regions" ("id", "slug", "name", "default_currency_code", "sort_order", "is_active", "created_at", "updated_at") VALUES
	('b5747630-67c9-492c-827a-18d5999e575d', 'africa', 'Africa', NULL, 10, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', 'americas', 'Americas', NULL, 20, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('1d2f6fc6-1259-478e-9c7f-d94a32530de5', 'asia', 'Asia', NULL, 30, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('1772afaa-927b-4241-8c17-7b7eab828180', 'europe', 'Europe', NULL, 40, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', 'oceania', 'Oceania', NULL, 50, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00');
INSERT INTO "public"."countries" ("code", "name", "region_id", "default_currency_code", "sort_order", "is_active", "created_at", "updated_at") VALUES
	('ZW', 'ZW', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ZM', 'ZM', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('EH', 'EH', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('UG', 'UG', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TN', 'TN', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TG', 'TG', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TZ', 'TZ', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SD', 'SD', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SS', 'SS', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ZA', 'ZA', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SO', 'SO', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SL', 'SL', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SC', 'SC', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SN', 'SN', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ST', 'ST', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SH', 'SH', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('RW', 'RW', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('RE', 'RE', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NG', 'NG', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NE', 'NE', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NA', 'NA', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MZ', 'MZ', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MA', 'MA', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('YT', 'YT', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MU', 'MU', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MR', 'MR', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ML', 'ML', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MW', 'MW', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MG', 'MG', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LY', 'LY', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LR', 'LR', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LS', 'LS', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KE', 'KE', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GW', 'GW', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GN', 'GN', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GH', 'GH', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GM', 'GM', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GA', 'GA', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ET', 'ET', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SZ', 'SZ', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ER', 'ER', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GQ', 'GQ', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('EG', 'EG', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('DJ', 'DJ', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CI', 'CI', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CD', 'CD', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CG', 'CG', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KM', 'KM', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TD', 'TD', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CF', 'CF', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CM', 'CM', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CV', 'CV', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BI', 'BI', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BF', 'BF', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BW', 'BW', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BJ', 'BJ', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AO', 'AO', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('DZ', 'DZ', 'b5747630-67c9-492c-827a-18d5999e575d', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('VI', 'VI', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('VG', 'VG', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('VE', 'VE', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('UY', 'UY', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('US', 'US', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TC', 'TC', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TT', 'TT', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SR', 'SR', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SX', 'SX', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('VC', 'VC', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PM', 'PM', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MF', 'MF', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LC', 'LC', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KN', 'KN', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BL', 'BL', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PR', 'PR', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PE', 'PE', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PY', 'PY', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PA', 'PA', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NI', 'NI', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MS', 'MS', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MX', 'MX', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MQ', 'MQ', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('JM', 'JM', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('HN', 'HN', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('HT', 'HT', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GY', 'GY', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GT', 'GT', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GP', 'GP', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GD', 'GD', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GL', 'GL', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GF', 'GF', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('FK', 'FK', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SV', 'SV', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('EC', 'EC', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('DO', 'DO', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('DM', 'DM', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CW', 'CW', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CU', 'CU', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CR', 'CR', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CO', 'CO', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CL', 'CL', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KY', 'KY', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CA', 'CA', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BR', 'BR', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BQ', 'BQ', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BO', 'BO', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BM', 'BM', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BZ', 'BZ', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BB', 'BB', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BS', 'BS', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AW', 'AW', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AR', 'AR', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AG', 'AG', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AI', 'AI', '5bde5acf-4ea3-4b98-bdbe-8e456aed5e93', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('YE', 'YE', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('VN', 'VN', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('UZ', 'UZ', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AE', 'AE', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TM', 'TM', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TR', 'TR', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TL', 'TL', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TH', 'TH', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TJ', 'TJ', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TW', 'TW', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SY', 'SY', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LK', 'LK', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SG', 'SG', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SA', 'SA', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('QA', 'QA', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PH', 'PH', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PS', 'PS', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PK', 'PK', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('OM', 'OM', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NP', 'NP', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MM', 'MM', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MN', 'MN', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MV', 'MV', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MY', 'MY', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MO', 'MO', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LB', 'LB', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LA', 'LA', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KG', 'KG', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KW', 'KW', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KR', 'KR', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KP', 'KP', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KZ', 'KZ', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('JO', 'JO', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('JP', 'JP', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IL', 'IL', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IQ', 'IQ', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IR', 'IR', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ID', 'ID', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IN', 'IN', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('HK', 'HK', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GE', 'GE', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CY', 'CY', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IO', 'IO', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CC', 'CC', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CX', 'CX', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CN', 'CN', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KH', 'KH', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BN', 'BN', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BT', 'BT', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BD', 'BD', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BH', 'BH', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AZ', 'AZ', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AM', 'AM', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AF', 'AF', '1d2f6fc6-1259-478e-9c7f-d94a32530de5', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GB', 'GB', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('UA', 'UA', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CH', 'CH', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SE', 'SE', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SJ', 'SJ', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ES', 'ES', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SI', 'SI', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SK', 'SK', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('RS', 'RS', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SM', 'SM', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('RU', 'RU', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('RO', 'RO', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PT', 'PT', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PL', 'PL', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NO', 'NO', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MK', 'MK', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NL', 'NL', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('ME', 'ME', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MC', 'MC', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MD', 'MD', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MT', 'MT', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LU', 'LU', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LT', 'LT', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LI', 'LI', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('LV', 'LV', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('JE', 'JE', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IT', 'IT', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IM', 'IM', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IE', 'IE', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('IS', 'IS', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('HU', 'HU', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('VA', 'VA', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GG', 'GG', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GR', 'GR', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GI', 'GI', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('DE', 'DE', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('FR', 'FR', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('FI', 'FI', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('FO', 'FO', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('EE', 'EE', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('DK', 'DK', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CZ', 'CZ', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('HR', 'HR', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BG', 'BG', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BA', 'BA', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BE', 'BE', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BY', 'BY', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AT', 'AT', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AD', 'AD', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AL', 'AL', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AX', 'AX', '1772afaa-927b-4241-8c17-7b7eab828180', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('WF', 'WF', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('VU', 'VU', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('UM', 'UM', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TV', 'TV', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TO', 'TO', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TK', 'TK', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GS', 'GS', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('SB', 'SB', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('WS', 'WS', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PN', 'PN', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PG', 'PG', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PW', 'PW', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MP', 'MP', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NF', 'NF', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NU', 'NU', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NZ', 'NZ', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NC', 'NC', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('NR', 'NR', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('FM', 'FM', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('MH', 'MH', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('KI', 'KI', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('HM', 'HM', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('GU', 'GU', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('TF', 'TF', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('PF', 'PF', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('FJ', 'FJ', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('CK', 'CK', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('BV', 'BV', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AU', 'AU', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AS', 'AS', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00'),
	('AQ', 'AQ', 'a1cfaad5-177e-4b1e-ad0b-96244ee8dcbb', NULL, 0, true, '2026-07-06 16:56:43.378292+00', '2026-07-06 16:56:43.378292+00');
INSERT INTO "public"."categories" ("id", "slug", "name", "description", "sort_order", "is_active") VALUES
	('d1a96f20-f296-4a41-b009-8eae9843b374', 'toys', 'Toys', 'Wooden vehicles, playful kits, and crafted toy designs.', 10, true),
	('847f1451-fac1-4c1f-9f51-6c6bf367b19d', 'constructors', 'Constructors', 'Buildable wooden kits and construction-inspired products.', 20, true),
	('aed9dced-7f7c-4024-bb31-d6984ba3469b', 'decorations', 'Decorations', 'Laser-cut decor for shelves, walls, holidays, and gifts.', 30, true),
	('d460e03f-46da-48c1-8b2c-51fe4e34f39a', 'night-lights', 'Night lights', 'Custom acrylic and wooden night lights with engraved artwork.', 40, true),
	('91253881-03f5-4331-aff0-27fa13a66905', 'banners', 'Banners', 'Marketing banners for stores, campaigns, and product promotions.', 50, true);
INSERT INTO "public"."subcategories" ("id", "category_id", "slug", "name", "description", "sort_order", "is_active", "created_at", "updated_at") VALUES
	('0e910fcc-f5f0-4c8b-83a9-93d75dad7884', 'd460e03f-46da-48c1-8b2c-51fe4e34f39a', 'personalized', 'Personalized', 'Personalized night lights generated from images, color, and short text.', 10, true, '2026-07-06 16:56:43.294688+00', '2026-07-06 16:56:43.294688+00');
INSERT INTO "public"."banner_size_presets" ("id", "key", "name", "width_mm", "height_mm", "material", "finish", "is_active", "sort_order", "created_at") VALUES
	('318e6cf5-d02b-4c2c-b2d6-bf7e55719880', 'store-window-small', 'Store window small', 600, 300, 'vinyl', 'matte', true, 10, '2026-07-06 16:56:43.294688+00'),
	('603702e2-4dda-45b4-9dfa-5cf83e636d47', 'store-front-medium', 'Store front medium', 1200, 500, 'vinyl', 'matte', true, 20, '2026-07-06 16:56:43.294688+00'),
	('a5e74834-f9de-431a-8834-f52491cc1ee6', 'promo-wide', 'Promo wide', 2000, 800, 'vinyl', 'matte', true, 30, '2026-07-06 16:56:43.294688+00');
INSERT INTO "public"."banner_samples" ("id", "title", "description", "prompt", "image_path", "reference_paths", "size_preset_id", "material_assumptions", "production_notes", "status", "created_by", "created_at", "updated_at") VALUES
	('29e9a7ae-e65b-4a1c-a475-d474fda99b9f', 'Seasonal Sale Banner', 'Reusable promotional banner sample for store discounts and seasonal campaigns.', 'Wide sale banner with strong contrast, simple shapes, and clear discount text.', '/mock/banners/seasonal-sale.svg', '{}', 'a5e74834-f9de-431a-8834-f52491cc1ee6', 'Matte vinyl with high-contrast printed artwork.', 'Review brand colors, bleed, and installation constraints before production.', 'published', NULL, '2026-07-06 16:56:43.294688+00', '2026-07-06 16:56:43.294688+00'),
	('23b4b822-b373-4f73-bfdc-3185c5593923', 'Grand Opening Store Banner', 'Bold storefront banner sample for opening announcements and launch offers.', 'Bright grand opening banner with large readable text and room for product imagery.', '/mock/banners/grand-opening.svg', '{}', '603702e2-4dda-45b4-9dfa-5cf83e636d47', 'Matte vinyl, indoor or short-term outdoor display.', 'Confirm final dimensions and mounting method before production.', 'published', NULL, '2026-07-06 16:56:43.294688+00', '2026-07-06 16:56:43.294688+00');
INSERT INTO "public"."exchange_rates" ("id", "base_currency", "target_currency", "rate", "provider", "rate_date", "fetched_at", "is_stale", "metadata", "created_at") VALUES
	('0be8f720-61d4-42f0-844a-aaf8ace36400', 'AMD', 'AMD', 1.00000000, 'seed', '2026-07-06', '2026-07-06 16:56:43.347246+00', false, '{"source": "seed_identity"}', '2026-07-06 16:56:43.347246+00'),
	('0ac4231c-0464-4ddf-80c7-b83f5699a990', 'AMD', 'EUR', 0.00240000, 'seed', '2026-07-06', '2026-07-06 16:56:43.347246+00', true, '{"source": "seed_fallback"}', '2026-07-06 16:56:43.347246+00'),
	('b903ae2f-40d9-471b-ba4f-0f6af819adf7', 'AMD', 'USD', 0.00260000, 'seed', '2026-07-06', '2026-07-06 16:56:43.347246+00', true, '{"source": "seed_fallback"}', '2026-07-06 16:56:43.347246+00'),
	('91a44e6b-00bd-4e3d-bb71-3bc5ea63591c', 'AMD', 'RUB', 0.21000000, 'seed', '2026-07-06', '2026-07-06 16:56:43.347246+00', true, '{"source": "seed_fallback"}', '2026-07-06 16:56:43.347246+00');
INSERT INTO "public"."personalization_models" ("id", "category_id", "subcategory_id", "title", "slug", "mock_image_path", "boilerplate_image_path", "form_schema", "status", "sort_order", "created_at", "updated_at") VALUES
	('2f1d98af-3ec2-4a81-a4dc-e3090743cbe6', 'd460e03f-46da-48c1-8b2c-51fe4e34f39a', '0e910fcc-f5f0-4c8b-83a9-93d75dad7884', 'Portrait Personalized Night Light', 'portrait-personalized-night-light', '/mock/night-lights/personalized-portrait.png', NULL, '{"currency": "AMD", "maxImages": 1, "boilerplates": ["/product-references/night-lights/rectangular-uv-print.jpg", "/product-references/night-lights/round-uv-print.jpg", "/product-references/night-lights/contour-laser-engraved.jpg"], "textMaxLength": 80, "basePriceCents": 2500000, "defaultLedColor": "warm_white", "supportsRichText": true, "comfortableColors": ["warm_white", "soft_amber", "soft_peach", "mint", "sky_blue"], "supportsMultiColor": false}', 'published', 10, '2026-07-06 16:56:43.294688+00', '2026-07-06 16:56:43.366192+00');
