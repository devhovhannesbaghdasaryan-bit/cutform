-- Local dev seed: personalization boilerplates wired to already-uploaded
-- OpenAI file ids, so a fresh `supabase db reset` produces attachable
-- boilerplates without a live OPENAI_API_KEY. Runs automatically per
-- supabase/config.toml's [db.seed] sql_paths = ["./seed.sql"].
-- Safe to re-run: upserts by name. Prompt text mirrors docs/prompts/boilerplates/.
--
-- Boilerplates are a shared library (see catalog_item_boilerplates).
-- The generated product seed attaches all of them to every seeded night-light item.

insert into public.personalization_boilerplates (
  name, image_path, openai_file_id, manufacturing_process, generation_instruction,
  manufacturing_prompt, generate_hidden_svg, is_active, sort_order
) values
  (
    'Rectangular UV print',
    '/product-references/night-lights/rectangular-uv-print.jpg', 'file-SvvFVqDiSzBCNZVy8M96Dg',
    'rectangular UV-printed acrylic',
    $prompt$Style: rectangular UV-printed clear acrylic.
- The MANUFACTURING ARTWORK is printed in full colour across the whole square acrylic panel, edge to edge, exactly as supplied: same crop, colours, faces and any text it contains. The panel is not cut to the subject.
- The print reads as a vivid photo on glossy clear acrylic, softly lit from below by the LED in the base (LED colour glow along the panel edges; warm white when no colour is given).
- Construction from the PRODUCT TEMPLATE: a square clear panel with slightly rounded corners standing in a rectangular light-wood (beech) bar base, cable leaving the base on the right.
- Any personalized text is already part of the printed artwork. Never add it a second time; the wooden base stays plain.$prompt$,
    $prompt$Production file for a UV-printed clear acrylic night light with a square panel. Turn the attached customer photo into the exact full-colour image that will be printed on the panel.

Output: a flat, square, print-ready full-colour image that fills the whole canvas edge to edge. The entire canvas is printed onto the panel.

Subject:
- Exactly the people (or pet or object) in the customer photo: same number, pose, identity, facial features, expression, hairstyle and clothing. Never add, remove, duplicate or mirror anyone, and never change faces or body shapes.
- Keep the photo's real scene. Recompose it into a square crop centred on the subjects; if the photo is too narrow, extend only its existing background naturally — never invent new objects or people.
- Gentle photo finishing only: balanced exposure, natural colour, clean skin tones, crisp focus and slightly richer contrast for printing on clear acrylic. No painterly, cartoon, filter or vintage effects.

{{#text}}Text:
- Add the personalized text "{{text}}" exactly as written: same spelling, punctuation and capitalisation, never translated or reworded. Styling: {{textStyle}}.
- One elegant, highly legible line (two lines only if it cannot fit, breaking at a space) in the lower part of the image, at least 6% away from every edge, with clear contrast against the photo (white or dark lettering; a soft shadow is allowed).
{{/text}}
Do not draw: frame, border, rounded corners, acrylic panel, wooden base, lamp, glow, mockup, logos, watermark, or any text other than the personalized text.$prompt$,
    false, true, 10
  ),
  (
    'Round UV print',
    '/product-references/night-lights/round-uv-print.jpg', 'file-HzYrHR6cyMgU1BukvkmMkw',
    'round UV-printed acrylic',
    $prompt$Style: round UV-printed clear acrylic.
- The circle in the MANUFACTURING ARTWORK is printed in full colour across the whole round acrylic panel, edge to edge, exactly as supplied: same crop, colours, faces and any text it contains. The white area outside the circle is not part of the product.
- The print reads as a vivid photo on glossy clear acrylic, softly lit from below by the LED in the base (LED colour glow along the panel edge; warm white when no colour is given).
- Construction from the PRODUCT TEMPLATE: a round clear panel standing in a cylindrical light-wood (beech) base, cable leaving the base on the right.
- Any personalized text is already part of the printed artwork. Never add it a second time; the wooden base stays plain.$prompt$,
    $prompt$Production file for a UV-printed clear acrylic night light with a round panel. Turn the attached customer photo into the exact full-colour image that will be printed on the panel.

Output: a square canvas holding one full-colour circular image — a perfect circle touching all four canvas edges. Everything outside the circle is pure white and is not printed; the circle is printed onto the round panel.

Subject:
- Exactly the people (or pet or object) in the customer photo: same number, pose, identity, facial features, expression, hairstyle and clothing. Never add, remove, duplicate or mirror anyone, and never change faces or body shapes.
- Keep the photo's real scene. Recompose it so the subjects sit in the central area of the circle and no face or hand is cut by the circle's edge; if the photo is too narrow, extend only its existing background naturally — never invent new objects or people.
- Gentle photo finishing only: balanced exposure, natural colour, clean skin tones, crisp focus and slightly richer contrast for printing on clear acrylic. No painterly, cartoon, filter or vintage effects.

{{#text}}Text:
- Add the personalized text "{{text}}" exactly as written: same spelling, punctuation and capitalisation, never translated or reworded. Styling: {{textStyle}}.
- One elegant, highly legible line in the lower third of the circle (two lines only if it cannot fit, breaking at a space), at least 6% inside the circle's edge, with clear contrast against the photo (white or dark lettering; a soft shadow is allowed).
{{/text}}
Do not draw: ring, frame, border, acrylic panel, wooden base, lamp, glow, mockup, logos, watermark, or any text other than the personalized text.$prompt$,
    false, true, 20
  ),
  (
    'Contour laser engraved',
    '/product-references/night-lights/contour-laser-engraved.jpg', 'file-H18ukJkpJx9SC5zLzFdXhL',
    'contour-cut CO2-laser-engraved acrylic',
    $prompt$Style: contour-cut, CO2-laser-engraved clear acrylic.
- The MANUFACTURING ARTWORK is a black-on-white line drawing. On the lamp every black line is an engraved line glowing in the LED colour (warm amber when no colour is given); every white area is clear, transparent acrylic, never a white, printed or frosted surface.
- Reproduce every line one-to-one at the same position and proportion: same people, faces, hair, clothing and crop. Do not add, remove, thicken, smooth or redraw any line, and add no shading or fill.
- The acrylic panel is cut along the artwork's outer silhouette with a small even margin; its straight bottom edge sits in the slot of the base.
- Construction from the PRODUCT TEMPLATE: an oval light-wood (beech) base with a slot and a thin white USB cable leaving the base on the right. The template's sample couple is a placeholder and must not appear.
- Personalized text, if given, is laser-engraved once on the front face of the wooden base: centred, one line, dark burnt-brown lettering cut into the wood grain. It does not glow and never appears on the acrylic. Without text the base stays plain.$prompt$,
    $prompt$Production file for a contour-cut, CO2-laser-engraved clear acrylic night light. Convert the attached customer photo into the exact line drawing the laser will engrave.

Output: a flat, square, black-on-white line drawing — pure black lines on a pure white background and nothing else. Every black mark will be engraved; every white area stays clear acrylic.

Subject:
- Exactly the people (or pet or object) in the customer photo: same number, same pose and gesture, same relative positions, same framing of the body (a half-length photo stays half-length). Never add, remove, duplicate or mirror anyone.
- Keep every face recognizable: same facial features, expression, hairstyle, beard, glasses and clothing.
- Drop the photo's background entirely: no scenery, furniture, floor or sky.

Line style:
- Clean continuous contour lines of one uniform stroke weight, about 1% of the image width, as if drawn with a single fine pen.
- Lines follow only the real edges of the photo: outer silhouette, hair mass and main strands, facial features (eyes, brows, nose, lips, beard), ears, hands and fingers, and the main clothing folds, seams, collars and pockets.
- Forbidden: filled black areas, gray tones, shading, gradients, hatching, cross-hatching, stippling, halftone, colour, sketchy double lines, tiny noisy marks.
- Keep lines well separated, never closer than one stroke width, so they survive SVG tracing and engraving.

Composition:
- Centre the subjects as one connected group with a clean, closed outer silhouette: the panel is cut along this silhouette with a small even margin, so nothing may float detached from the group.
- The bottom of the drawing ends in a straight horizontal edge where the panel enters the base slot; bodies are cropped there, never floating.
- The group fills about 85% of the canvas height with even white margins on the other sides.

Do not draw: text, names, dates, frame, border, cut line, acrylic panel, wooden base, lamp, glow, shadows, background scene or watermark.$prompt$,
    true, true, 30
  ),
  (
    'Contour laser stroked',
    '/product-references/night-lights/contour-laser-stroked.jpg', 'file-EQDfh97h75q2VTGkRcXZUB',
    'contour-cut CO2-laser-scored acrylic (stroke lines)',
    $prompt$Style: contour-cut clear acrylic with CO2-laser-scored stroke lines.
- The MANUFACTURING ARTWORK is a black-on-white drawing made of thin single strokes. On the lamp every black stroke is one fine scored line glowing evenly in the LED colour (warm amber when no colour is given), crisp and hairline-thin like a scratched vector line, all of the same weight; every white area is clear, transparent acrylic, never a white, printed or frosted surface.
- Reproduce every stroke one-to-one at the same position, proportion and thin weight: same people, faces, hair, clothing and crop. Do not add, remove, thicken, bolden, smooth or redraw any stroke, and add no shading, fill, glow halo wider than a hairline, or engraved areas.
- The acrylic panel is cut along the artwork's outer silhouette with a small even margin; its straight bottom edge sits in the slot of the base.
- Construction from the PRODUCT TEMPLATE: an oval light-wood (beech) base with a slot and a thin white USB cable leaving the base on the right. The template's sample couple is a placeholder and must not appear.
- Personalized text, if given, is laser-engraved once on the front face of the wooden base: centred, one line, dark burnt-brown lettering cut into the wood grain. It does not glow and never appears on the acrylic. Without text the base stays plain.$prompt$,
    $prompt$Production file for a contour-cut clear acrylic night light whose artwork the CO2 laser scores as vector lines: the laser follows each drawn line once, so the drawing must consist of thin, single-stroke lines only. Convert the attached customer photo into the exact line drawing the laser will score.

Output: a flat, square, black-on-white stroke drawing — pure black hairline strokes on a pure white background and nothing else. Every black stroke becomes one scored line; every white area stays clear acrylic.

Subject:
- Exactly the people (or pet or object) in the customer photo: same number, same pose and gesture, same relative positions, same framing of the body (a half-length photo stays half-length). Never add, remove, duplicate or mirror anyone.
- Keep every face recognizable: same facial features, expression, hairstyle, beard, glasses and clothing.
- Drop the photo's background entirely: no scenery, furniture, floor or sky.

Stroke style:
- Thin, crisp, fully black hairline strokes of one constant width, about 0.3% of the image width (3 px on a 1024 px canvas), as if drawn with a single fine technical pen. Never thicker, never tapered, never varying in weight.
- Each stroke is a single continuous path with sharp, solid edges: no soft, blurred, grey or anti-aliased lines. One line per edge; never trace an edge twice or draw outlines around a stroke.
- Strokes follow only the real edges of the photo: outer silhouette, hair mass and main strands, facial features (eyes, brows, nose, lips, beard), ears, hands and fingers, and the main clothing folds, seams, collars and pockets.
- Forbidden: filled black areas, thick or bold lines, gray tones, shading, gradients, hatching, cross-hatching, stippling, halftone, colour, sketchy double lines, tiny noisy marks.
- Keep strokes well separated, never closer than three stroke widths, so every line stays an individual path after SVG tracing.

Composition:
- Centre the subjects as one connected group with a clean, closed outer silhouette drawn as one continuous stroke: the panel is cut along this silhouette with a small even margin, so nothing may float detached from the group.
- The bottom of the drawing ends in a straight horizontal edge where the panel enters the base slot; bodies are cropped there, never floating.
- The group fills about 85% of the canvas height with even white margins on the other sides.

Do not draw: text, names, dates, frame, border, cut line, acrylic panel, wooden base, lamp, glow, shadows, background scene or watermark.$prompt$,
    true, true, 40
  )
on conflict (name) do update set
  image_path = excluded.image_path,
  openai_file_id = excluded.openai_file_id,
  manufacturing_process = excluded.manufacturing_process,
  generation_instruction = excluded.generation_instruction,
  manufacturing_prompt = excluded.manufacturing_prompt,
  generate_hidden_svg = excluded.generate_hidden_svg,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- Local dev admin: grants full admin_permissions to the owner's account so
-- admin actions (e.g. saving a catalog item) don't silently redirect on a
-- fresh reset. profiles.role must independently be 'admin' for this to take
-- effect (set via the profiles table, not here). No-op until this email has
-- signed in locally at least once (auth.users is empty on a fresh reset).
insert into public.admin_permissions (user_id, permission)
select u.id, p.permission
from auth.users u
cross join (values
  ('catalog_manage'), ('seo_manage'), ('orders_manage'), ('generated_review'),
  ('users_manage'), ('transactions_manage'), ('balances_adjust')
) as p(permission)
where u.email = 'dev.hovhannesbaghdasaryan@gmail.com'
on conflict (user_id, permission) do nothing;
