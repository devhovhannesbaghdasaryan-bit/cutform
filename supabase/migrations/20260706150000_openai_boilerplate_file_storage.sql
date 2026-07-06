-- OpenAI file storage for personalization boilerplates: each boilerplate's
-- reference image is uploaded to OpenAI once (admin create/edit) and reused
-- by file_id at generation time instead of being re-sent on every request.
-- No backfill: existing rows are wiped and recreated through the admin UI,
-- which exercises the new upload path. personalized_preview_options.boilerplate_id
-- already has `on delete set null`, so historical previews are unaffected.

delete from public.personalization_boilerplates;

alter table public.personalization_boilerplates
  add column if not exists openai_file_id text not null;
