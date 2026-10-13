-- Optional prompt that turns the customer photo into the flat manufacturing
-- PNG for this boilerplate. When set, customer generation runs in two steps:
-- the manufacturing PNG is generated first, then the preview is rendered from
-- that PNG plus the template image, so the preview shows the exact artwork
-- that will be produced. Null keeps the single-step preview flow.
alter table "public"."personalization_boilerplates"
  add column "manufacturing_prompt" text;
