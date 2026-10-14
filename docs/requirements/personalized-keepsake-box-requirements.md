# Personalized keepsake box requirements

Date: 2026-10-14. Status: created in the production database as a hidden
draft item with two active styles; not yet published.

## Scope

Adds the first text-only AI-personalized product family: laser-engraved
wooden keepsake boxes, starting with a wedding memory box. It reuses the
generic item personalization pipeline (tags, shared boilerplate library,
two-step manufacturing PNG + preview, traced SVG) without new tables.

## Reference product analysis

Source: one listing photo of an open wedding keepsake box, stored as the
quote style's template image at
`public/product-references/keepsake-boxes/quote-lid.jpg`. It is third-party
photography: replace it with our own product photo before the item is
published, and use it only as the generation template until then. The wreath
style's template, `wreath-lid.jpg`, is an image-model edit of the same photo
(wreath with sample names inside the lid, rings emblem on the front, empty
box) made on 2026-10-14 so the two styles look different in the style picker.

What the photo shows:

- **Object.** Rectangular wooden box, oak-toned satin finish with straight
  grain, hinged lid, about 300 × 200 × 100 mm (the envelope inside is C5-sized,
  which puts the inner width near 280 mm). Wall thickness looks like 8–10 mm:
  oak-veneered plywood or solid oak.
- **Hardware.** Two small bronze-finish butt hinges at the back, one bronze
  hasp clasp centred on the front edge.
- **Engraving zone 1, inside of the lid.** A four-line quote, centred:
  "Two souls" (script) / "WITH BUT A SINGLE THOUGHT" (wide-spaced serif caps)
  / "two hearts" (script) / "THAT BEAT AS ONE" (serif caps). The quote is
  Friedrich Halm's, in Maria Lovell's 1851 translation, and is public domain.
- **Engraving zone 2, front face.** Below the clasp, centred: "LIAM & SOPHIA"
  (serif caps), "20 OCTOBER 2023" (smaller serif caps), and a small
  interlocking double-ring emblem beneath.
- **Engraving look.** Raster-engraved, matte dark burnt-brown, slightly sunk,
  grain visible through it. No colour fill, no paint, no inlay.
- **Props.** Feather, two rings, cream envelope, greenery, lace cloth and the
  model's hands are styling only and are not part of the product.

Manufacturing on our tools: CO2 laser (100 W, 1300 × 900 mm bed) for the
engraving and, for plywood builds, the panel cutting; CNC router for solid
oak panels; hinges and clasp screwed on after finishing. Engraving before
assembly keeps both faces flat on the bed.

## Catalog placement (live database)

Created directly in the production Supabase project on 2026-10-14; the seed
scripts are no longer used for this family.

| Row | Value |
| --- | --- |
| Category `keepsake-boxes` ("Keepsake boxes", sort 45) | `53ee0d1e-3380-46e0-8279-cd0fa0bcb461` |
| Subcategory `wedding` | `5360d0c3-f3f8-478c-a0c8-9b27ac1f568c` |
| Item `01-personalized-wedding-keepsake-box` | `aa49b47d-57c2-4c17-bfe7-8baeae26a822` |
| Style "Engraved quote lid" (sort 50) | `224f3b7c-69d9-454c-9337-5e49ab7a8ab4` |
| Style "Botanical wreath lid" (sort 60) | `224f8c20-4424-4b2a-8284-647c7c8dac11` |
| Item skill (OpenAI Skills API) | `skill_6acf2e004ce08191b1170eb431e184b70a463db6b3941f95` |

Item settings: status `draft`, `item_type: standard`, customizable, tag
`personal_text` only, 79 USD placeholder price, sizes Standard
300 × 200 × 100 mm and Large 350 × 250 × 120 mm, system prompt from
`docs/prompts/items/keepsake-box.system-prompt.txt`, skill copy in the private
`uploads` bucket, thumbnail and primary media
`keepsake-boxes/01-personalized-wedding-keepsake-box/assets/hero-1.jpg` in
`catalog-assets`, EN/RU/AM translations and SEO rows (marked AI-generated, not
yet admin-reviewed), and a flat 3,000 AMD shipping rule for all five regions
so the item does not vanish once a visitor's region resolves.

Why its own category: a box is a functional object, not a decoration, and the
family will grow (anniversary, baby, memorial, ring-bearer, jewellery and
watch boxes). The landing page falls back to a generic icon for categories it
does not know, and the locale files already carry the category and
subcategory copy.

## Personalization inputs

- Tags: `personal_text` only. No photo (the lid artwork is typographic or
  botanical), no LED colour.
- Text: optional, 80 characters, line breaks allowed (the editor keeps them),
  typically two lines: names, then the date. The styles reproduce it
  character-for-character and break lines only where the customer did.
- Styles: at least one, each costing one credit and producing one preview
  option with its own manufacturing PNG and traced SVGs.

## Styles (shared boilerplate library)

| Style | Lid artwork (manufacturing PNG) | Customer text | Front face |
| --- | --- | --- | --- |
| Engraved quote lid | Fixed four-line quote, script + serif caps | Not in the artwork; engraved on the front face (preview shows it, operator typesets it from the order) | Text + rings emblem; plain without text |
| Botanical wreath lid | Eucalyptus/olive line-art wreath | Inside the wreath through `{{text}}` placeholders, so it is in the production file | Rings emblem only |

Prompt files: `docs/prompts/boilerplates/keepsake-box-quote-lid.*` and
`keepsake-box-wreath-lid.*`; item prompt `docs/prompts/items/keepsake-box.system-prompt.txt`;
skill `docs/prompts/skills/keepsake-box-preview/SKILL.md`. The database rows
mirror these files; after editing a file, paste the new text into the admin
boilerplate or item form (and re-upload the skill file) to keep them in sync.

Both styles are active with `generate_hidden_svg` on, `artwork_width_mm` 280,
`manufacturing_process` "CO2-laser raster engraving, oak-toned wood (inside of
the lid)", no price adjustment, and their own OpenAI vision file of the
template image (one per style, because removing a style deletes its file).

## Generation pipeline

Both styles are two-step. Because the item has no photo, the manufacturing
step runs with the customer's text alone; `app/personalize/actions.ts` no
longer skips the manufacturing prompt when no photo is attached (photo items
are unchanged, since their photo is mandatory). That code change must be
deployed before the item is published, or generation would fall back to a
single-step preview without a production file. The manufacturing PNG is
generated at 1024 × 1024, high quality, opaque, and traced to the fill and
stroke SVGs; the ink-coverage check (0.5–25 %) passes for a lid-filling
typographic or wreath artwork and rejects an empty or washed-out page.

The preview is rendered from the manufacturing PNG and the template image,
with the item skill, the system prompt and the style's preview instruction,
exactly as for the night lights.

## Production handoff (operator)

1. Open the option's **fill** SVG; it is 280 mm wide. Its content is the
   artwork only, so align its horizontal centre and its vertical centre with
   the lid's inner centre. Raster-engrave.
2. Compare every word against the order text before engraving (AI-set text
   can misspell; the admin review page shows the PNG). For the wreath style
   the names are in the file; for the quote style they are not.
3. Front face: typeset the order text in the house serif (wide-spaced caps,
   first line largest, centred below the clasp) and add the rings emblem from
   the master file. For the wreath style engrave the emblem only.
4. Engrave both panels flat before assembly; power/speed from the test strip
   of the current wood batch. Finish, then fit hinges and clasp.

Not covered by the AI file: the box's own cut files and joinery (a fixed
master per size), the emblem master and the house serif. These are prepared
once in the workshop.

## Remaining steps to go live

1. Deploy the branch with the text-only manufacturing change.
2. In the admin item form: review the RU/AM copy, replace the thumbnail with
   our own product photo, confirm the price, then publish (the personalize
   page only serves published items, so a customer-side test generation needs
   the item published, even if briefly).
3. Generate a test order, check the manufacturing PNG, SVGs and preview, and
   run a real engraving on scrap before announcing the product.

## Follow-ups

- A photo style (couple's portrait line-engraved inside the lid) would reuse
  the contour-laser prompts, but the `personal_photo` tag makes the photo
  mandatory for every style of an item, so it belongs on a separate item.
- Deterministic vector typesetting of the customer's text (instead of tracing
  AI-rendered letters) would remove the spelling risk for the wreath style.
- Own product photography for both styles, and RU/AM copy review.
- Additional family members: anniversary, baby, memorial and ring-bearer boxes
  with their own lid styles.
