-- Optional generation-skill attachments. skill_openai_file_id / catalog_items.skill_id
-- hold the OpenAI File Storage id injected into generation calls; skill_path is a
-- recovery copy of the same document in the private uploads bucket. All nullable —
-- the feature is optional end to end. catalog_items.skill_id (existing text column)
-- is reused for the item-level file id and intentionally not renamed.
alter table "public"."personalization_boilerplates"
  add column "skill_openai_file_id" text,
  add column "skill_path" text;

alter table "public"."catalog_items"
  add column "skill_path" text;
