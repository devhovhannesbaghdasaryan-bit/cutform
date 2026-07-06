# OpenAI boilerplate file storage go-live gate

The migration in this branch (`supabase/migrations/20260706150000_openai_boilerplate_file_storage.sql`)
deletes every row in `personalization_boilerplates` and makes `openai_file_id`
a required column. Immediately after this migration deploys, personalized
night-light generation is **non-functional** — there are zero active
boilerplates for customers to select — until an admin completes the step
below.

## Required immediately after deploy

- Open `/personalization/night-lights` as an admin and recreate the three
  original boilerplates (Rectangular UV print, Round UV print, Contour laser
  engraved) using the images previously at
  `public/product-references/night-lights/*.jpg`. Use the same
  `manufacturing_process` and `generation_instruction` text that was in the
  deleted seed migration
  (`supabase/migrations/20260701104320_personalized_night_light_boilerplates.sql`,
  now historical) as reference.
- Confirm each saved row shows a non-empty OpenAI file id in the admin UI —
  the save action uploads to OpenAI synchronously and fails outright if that
  upload fails, so a saved row always has a valid id.
- Run one real customer generation end-to-end at `/personalize/<model-slug>`
  and confirm a preview image is produced.
- In the OpenAI dashboard, confirm the uploaded files appear under Files with
  purpose `vision`.

## If a boilerplate's OpenAI file is deleted out-of-band later

Re-save the boilerplate with its image in the admin UI — this re-uploads the
file and updates `openai_file_id`. There is no automatic recovery.
