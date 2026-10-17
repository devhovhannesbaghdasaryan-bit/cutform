# Music plaque night light requirements

Date: 2026-10-14. Status: created in the production database as one hidden
draft item with one active style; not yet published.

## Scope

Fourth night-light item (`night-lights` category, `personalized`
subcategory): a UV-printed portrait acrylic plaque styled as a music player,
built from two reference photos Hovhannes supplied (a lifestyle shot of two
finished lamps and the template he called `boilerplate.png`). Same pipeline
as the other night lights (photo, text and LED colour; two-step manufacturing
PNG plus preview), no new tables. Price fixed by Hovhannes: 30,000 AMD.

## Reference product analysis

Reference photos under `public/product-references/night-lights/`:
`music-plaque-uv-print.jpg` is the style template (the placeholder plaque
with "Your Photo Here", "Song Title", "Artist Name"); `music-plaque-lifestyle.jpg`
is the listing photo used as the thumbnail. Both are third-party listing
photography and must be replaced with our own photos before publishing.

**Music plaque.** A portrait clear acrylic panel, about 3 mm thick, with
slightly rounded corners, standing in a rectangular beech LED base with a USB
cable on the right. Printed on it, top to bottom: the customer's photo as a
rounded square (album art), the song title in a medium sans-serif, the artist
in a smaller regular weight, a progress bar with a round knob, a row of five
player glyphs (heart, previous, pause, next, repeat) and a scan-code strip (a
circle with a headphones glyph plus a row of vertical bars). Everything
except the photo is white ink; the rest of the panel is clear and glows at
the edges in the LED colour. The lifestyle photo shows a second variant with
the couple's names in script and a heart instead of the code strip; that is a
follow-up style.

## Catalog placement (live database)

Created directly in the production Supabase project on 2026-10-14 in one
atomic statement (style, item, translations, SEO, media, market rules and the
item-style link), after the template image, thumbnail and skill had been
uploaded the way the admin forms do.

| Row | Value |
| --- | --- |
| Category `night-lights` / subcategory `personalized` (existing) | `d460e03f-46da-48c1-8b2c-51fe4e34f39a` / `0e910fcc-f5f0-4c8b-83a9-93d75dad7884` |
| Item `04-music-plaque-acrylic-night-light`, 30,000 AMD | `25ade003-7018-481e-9f52-b73daf55f228` |
| Style "Music plaque UV print" (sort 150, no SVG, no `artwork_width_mm`) | `ff253802-cf9a-4406-90e5-46b3abbd082a` |
| Style template image (`catalog-assets`) | `6ee5c558-0f73-4a51-a33a-82f882633a4c/personalization-boilerplates/b5335031-d818-4b48-af00-af31375886f6.jpg` |
| Style template on OpenAI Files (`openai_file_id`) | `file-H87M7jX8gR3WAvHP6yFEtL` |
| Skill (OpenAI Skills API) | `skill_6acf52f12d488191854d2ad383d9ef3a05effb424e429ce1` |
| Skill copy (`uploads` bucket) | `6ee5c558-0f73-4a51-a33a-82f882633a4c/personalization-skills/1016c24b-0dc0-4bf7-9645-13cb38547d14.md` |
| Thumbnail and primary media (`catalog-assets`) | `night-lights/04-music-plaque-acrylic-night-light/assets/hero-1.jpg` |

Item: status `draft`, `item_type: personalized_night_light`, customizable,
popular flag set, tags `personal_color`, `personal_text`, `personal_photo`,
EN/RU/AM translations and SEO rows (marked AI-generated, not admin-reviewed,
all within the admin form limits), a flat 3,000 AMD shipping rule for all
five regions, two sizes (Standard 150 × 210 mm, Large 200 × 280 mm, 3 mm),
the shared night-light system prompt from
`docs/prompts/items/night-light.system-prompt.txt` and its own skill.

## Style, text convention and print convention

| Item | Style | Customer input | Manufacturing canvas |
| --- | --- | --- | --- |
| Music plaque night light | Music plaque UV print | one photo; text line 1 song title, line 2 artist; LED colour | square canvas, the portrait panel as a centred band spanning the full height and the middle 72 % of the width |

The print file uses a convention the operator must apply when printing:
solid black is clear, unprinted acrylic; the photo is printed in full
colour inside its rounded square; every white element is white ink. The
title and artist enter the print file through the placeholders. The bars of
the code strip are a decorative pattern, not a scannable code: there is no
song-link field yet, so the operator replaces them with a real code only
when the order notes carry a song link.

Prompt files: `docs/prompts/boilerplates/music-plaque-uv-print.{manufacturing,preview}.txt`,
`docs/prompts/skills/music-plaque-night-light-preview/SKILL.md`, and the
shared `docs/prompts/items/night-light.system-prompt.txt`. The database
rows were verified identical to these files at creation; after editing a
file, paste the new text into the admin form (and re-upload the skill) to
keep them in sync.

## Production handoff (operator)

1. Open the option's manufacturing PNG. Crop to the portrait panel band
   (full height, middle 72 % of the width) and scale it to the ordered panel
   size. Black is no ink, white is white ink, the photo prints in colour.
2. Check the song title and artist against the order before printing. If the
   order notes carry a song link, generate the real scan code from it and
   replace the decorative bars at the same size and position.
3. Cut the panel with rounded corners from 3 mm clear acrylic, print, polish
   the edges, fit into the beech LED base, test the LED colour ordered.

## Remaining steps to go live

1. In the admin item form: review the RU/AM copy, replace the thumbnail with
   our own photo, confirm the 30,000 AMD price, then publish.
2. Run a test generation with a photo, a title and an artist; check that the
   PNG background is solid black, that the photo sits in the rounded square,
   and that the preview shows clear acrylic where the file is black; then a
   real print on scrap acrylic before announcing.
3. Decide with the workshop whether the white-ink layer is printed from the
   PNG's white areas directly or needs a separate mask.

## Follow-ups

- Second style with the couple's names in script and a heart in place of the
  code strip (as in the lifestyle photo), with a generated template image.
- A song-link field on the personalize form so the real scan code can be
  rendered into the print file instead of the decorative bars.
- A landscape variant for wider photos.
