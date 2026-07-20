-- Reverts 20260714120000_laser_glass_engraving_styles.sql. The per-item laser
-- engraving feature is replaced by ordinary boilerplates (Solid/Contour) plus a
-- percentage price adjustment on personalization_boilerplates. No backfill: any
-- item currently relying on these flags loses that behavior on drop.
alter table "public"."catalog_items"
  drop constraint if exists "catalog_items_laser_solid_price_cents_check",
  drop column if exists "laser_contour_enabled",
  drop column if exists "laser_solid_enabled",
  drop column if exists "laser_solid_price_cents",
  drop column if exists "laser_solid_prompt";
