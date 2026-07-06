-- Local dev seed: personalized night-light model + boilerplates, wired to
-- already-uploaded OpenAI file ids so a fresh `supabase db reset` produces a
-- working personalization setup without a live OPENAI_API_KEY. Runs
-- automatically per supabase/config.toml's [db.seed] sql_paths = ["./seed.sql"].
-- Safe to re-run: both inserts upsert by their natural unique key.

do $$
declare
  target_model_id uuid;
begin
  insert into public.personalization_models (
    category_id, subcategory_id, title, slug, mock_image_path,
    form_schema, status, sort_order
  )
  select
    c.id,
    s.id,
    'Portrait Personalized Night Light',
    'portrait-personalized-night-light',
    '/mock/night-lights/personalized-portrait.png',
    '{
      "currency": "AMD",
      "maxImages": 1,
      "textMaxLength": 80,
      "basePriceCents": 2500000,
      "defaultLedColor": "warm_white",
      "supportsRichText": true,
      "comfortableColors": ["warm_white", "soft_amber", "soft_peach", "mint", "sky_blue"],
      "supportsMultiColor": false
    }'::jsonb,
    'published',
    10
  from public.categories c
  join public.subcategories s on s.category_id = c.id and s.slug = 'personalized'
  where c.slug = 'night-lights'
  on conflict (slug) do update set
    category_id = excluded.category_id,
    subcategory_id = excluded.subcategory_id,
    title = excluded.title,
    mock_image_path = excluded.mock_image_path,
    form_schema = excluded.form_schema,
    status = excluded.status,
    sort_order = excluded.sort_order
  returning id into target_model_id;

  insert into public.personalization_boilerplates (
    model_id, admin_name, name_en, name_hy, name_ru, image_path, openai_file_id,
    manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order
  ) values
    (
      target_model_id, 'Rectangular UV print', 'Rectangular UV print',
      'Ուղղանկյուն UV տպագրություն', 'Прямоугольная УФ-печать',
      '/product-references/night-lights/rectangular-uv-print.jpg', 'file-SvvFVqDiSzBCNZVy8M96Dg',
      'rectangular UV-printed acrylic',
      'Preserve the rectangular panel and base and create an elegant full-color keepsake.',
      false, true, 10
    ),
    (
      target_model_id, 'Round UV print', 'Round UV print',
      'Կլոր UV տպագրություն', 'Круглая УФ-печать',
      '/product-references/night-lights/round-uv-print.jpg', 'file-HzYrHR6cyMgU1BukvkmMkw',
      'round UV-printed acrylic',
      'Preserve the circular panel and round base and balance the artwork inside the circle.',
      false, true, 20
    ),
    (
      target_model_id, 'Contour laser engraved', 'Contour laser engraved',
      'Եզրագծային լազերային փորագրություն', 'Контурная лазерная гравировка',
      '/product-references/night-lights/contour-laser-engraved.jpg', 'file-H18ukJkpJx9SC5zLzFdXhL',
      'contour-cut CO2-laser-engraved acrylic',
      'Derive a simple outer silhouette and render the subject as monochrome engraved vector line art.',
      true, true, 30
    )
  on conflict (model_id, admin_name) do update set
    name_en = excluded.name_en,
    name_hy = excluded.name_hy,
    name_ru = excluded.name_ru,
    image_path = excluded.image_path,
    openai_file_id = excluded.openai_file_id,
    manufacturing_process = excluded.manufacturing_process,
    generation_instruction = excluded.generation_instruction,
    generate_hidden_svg = excluded.generate_hidden_svg,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;
end $$;
