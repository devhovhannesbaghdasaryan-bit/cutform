-- Local dev seed: personalization boilerplates wired to already-uploaded
-- OpenAI file ids, so a fresh `supabase db reset` produces attachable
-- boilerplates without a live OPENAI_API_KEY. Runs automatically per
-- supabase/config.toml's [db.seed] sql_paths = ["./seed.sql"].
-- Safe to re-run: upserts by name.
--
-- Boilerplates are a shared library (see catalog_item_boilerplates) —
-- attach any of these to a customizable catalog item from the item form
-- (/admin/items) once it has boilerplates selected there.

insert into public.personalization_boilerplates (
  name, image_path, openai_file_id, manufacturing_process, generation_instruction,
  generate_hidden_svg, is_active, sort_order
) values
  (
    'Rectangular UV print',
    '/product-references/night-lights/rectangular-uv-print.jpg', 'file-SvvFVqDiSzBCNZVy8M96Dg',
    'rectangular UV-printed acrylic',
    'Preserve the rectangular panel and base and create an elegant full-color keepsake.',
    false, true, 10
  ),
  (
    'Round UV print',
    '/product-references/night-lights/round-uv-print.jpg', 'file-HzYrHR6cyMgU1BukvkmMkw',
    'round UV-printed acrylic',
    'Preserve the circular panel and round base and balance the artwork inside the circle.',
    false, true, 20
  ),
  (
    'Contour laser engraved',
    '/product-references/night-lights/contour-laser-engraved.jpg', 'file-H18ukJkpJx9SC5zLzFdXhL',
    'contour-cut CO2-laser-engraved acrylic',
    'Derive a simple outer silhouette and render the subject as monochrome engraved vector line art.',
    true, true, 30
  )
on conflict (name) do update set
  image_path = excluded.image_path,
  openai_file_id = excluded.openai_file_id,
  manufacturing_process = excluded.manufacturing_process,
  generation_instruction = excluded.generation_instruction,
  generate_hidden_svg = excluded.generate_hidden_svg,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
