-- Optional percentage adjustment applied to an item's base price when this
-- boilerplate is selected during personalization. Any sign (surcharge or
-- discount); null means no adjustment. Final price is floored at 0 in app code.
alter table "public"."personalization_boilerplates"
  add column "price_adjustment_percent" integer;
