update public.personalization_models
set form_schema = coalesce(form_schema, '{}'::jsonb) || jsonb_build_object(
  'maxImages', 1,
  'textMaxLength', 80,
  'supportsRichText', true,
  'supportsMultiColor', false,
  'defaultLedColor', 'warm_white',
  'basePriceCents', 2500000,
  'currency', 'AMD',
  'boilerplates', jsonb_build_array(
    '/product-references/night-lights/rectangular-uv-print.jpg',
    '/product-references/night-lights/round-uv-print.jpg',
    '/product-references/night-lights/contour-laser-engraved.jpg'
  )
)
where slug = 'portrait-personalized-night-light';
