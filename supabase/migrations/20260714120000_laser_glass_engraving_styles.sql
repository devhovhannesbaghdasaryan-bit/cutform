-- Per-item laser-on-glass engraving styles: hairline contour (default, priced at
-- the item's base price) and solid scratching (optional, with its own price and
-- generation prompt). The feature is active for an item when either flag is set;
-- when both are false the item behaves exactly as before.
-- See docs/... and the plan for laser-glass print options.

alter table "public"."catalog_items"
  add column "laser_contour_enabled" boolean not null default false,
  add column "laser_solid_enabled" boolean not null default false,
  add column "laser_solid_price_cents" integer,
  add column "laser_solid_prompt" text;

alter table "public"."catalog_items"
  add constraint "catalog_items_laser_solid_price_cents_check"
  check ("laser_solid_price_cents" is null or "laser_solid_price_cents" >= 0);
