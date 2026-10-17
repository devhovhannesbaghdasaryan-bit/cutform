# Personalization generation prompts

Source of truth for the prompt content stored in the database and in the
private `uploads` bucket for every AI-personalized product family. Edit here
first, then apply the change through the admin UI (or SQL) so the repo and the
live data stay in sync.

## Two-step generation

For a style with a **manufacturing prompt**, customer generation in
`app/personalize/actions.ts` runs two image calls per selected style:

1. **Manufacturing PNG.** Input: the style's manufacturing prompt plus the
   customer photo when the item takes one. Output: the production file (print
   image or engraving artwork). Stored on the preview option as
   `manufacturing_file_path`. Engraving styles also get an SVG traced from it
   automatically (fill and stroke variants, in millimetres when the style has
   an `artwork_width_mm`).
2. **Preview.** Input: the item's skill document, the item's system prompt,
   the style's preview instruction, the customer's text and colour, then the
   manufacturing PNG (labelled MANUFACTURING ARTWORK) and the style's template
   image (labelled PRODUCT TEMPLATE). The customer photo is deliberately not
   sent, so the preview can only show the artwork that will be produced.

Text-only products (items without the `personal_photo` tag, such as the
keepsake boxes) run the same two steps: the manufacturing prompt builds the
engraving artwork from the customer's text alone, and the preview is rendered
from that artwork.

Customer text reaches the manufacturing PNG only through placeholders:
`{{#text}}…{{/text}}` is kept only when text was entered, and inside it
`{{text}}` is the exact text and `{{textStyle}}` the chosen styling. A style
that produces its text elsewhere (e.g. engraved on the wooden base of a night
light, or on the front face of a box) leaves the placeholders out, so the text
appears only in the preview step and the operator engraves it from the order.

The system prompt and skills are shared by every style attached to an item, so
they stay style-agnostic; anything specific to one style belongs in that
style's two files.

## Files and where they live

| File | Database field | Used in step |
| --- | --- | --- |
| `boilerplates/<style>.manufacturing.txt` | `personalization_boilerplates.manufacturing_prompt` | 1 |
| `boilerplates/<style>.preview.txt` | `personalization_boilerplates.generation_instruction` | 2 |
| `items/<family>.system-prompt.txt` | `catalog_items.system_prompt` of every item in the family | 2 |
| `skills/<skill>/SKILL.md` | skill uploaded on the item (`catalog_items.skill_id` / `skill_path`) | 2 |

Style template images live under `public/product-references/<family>/` and
are uploaded through the admin boilerplate form, which also registers them
with OpenAI (`openai_file_id`).

## Night lights

Item family: the three night-light items (`night-lights` category). Inputs:
photo, text and LED colour (`personal_photo`, `personal_text`, `personal_color`).

| File | Attached to |
| --- | --- |
| `items/night-light.system-prompt.txt` | every night-light item |
| `skills/night-light-preview/SKILL.md` | *Personalized Acrylic LED Night Light* |
| `skills/contour-night-light-preview/SKILL.md` | *Contour Laser Engraved Acrylic Night Light* |

Styles: `rectangular-uv-print` (Rectangular UV print), `round-uv-print`
(Round UV print), `contour-laser-engraved` (Contour laser engraved),
`contour-laser-stroked` (Contour laser stroked).

`contour-laser-stroked` is a copy of `contour-laser-engraved` for the laser's
vector line (score) mode: the manufacturing PNG is drawn with thin single
hairline strokes instead of ~1%-width contour lines, and the preview renders
them as fine scored lines. Its production file is the stroke variant of the
traced SVG; the engraved style uses the fill variant.

### Music plaque night light

Fourth night-light item (*Music Plaque Acrylic Night Light*, 30,000 AMD):
a portrait UV-printed clear plaque styled as a music player, with the
customer's photo as album art, the song title and artist, player glyphs and
a decorative code strip. Created directly in the production database on
2026-10-14; spec and live ids in
`docs/requirements/music-plaque-night-light-requirements.md`.

| File | Attached to |
| --- | --- |
| `items/night-light.system-prompt.txt` (shared) | *Music Plaque Acrylic Night Light* |
| `skills/music-plaque-night-light-preview/SKILL.md` | *Music Plaque Acrylic Night Light* |

One style, `music-plaque-uv-print` (Music plaque UV print), with
`public/product-references/night-lights/music-plaque-uv-print.jpg` as
template. Text convention: line 1 the song title, line 2 the artist, both
set into the print file through the placeholders. Print convention, stated
in the manufacturing prompt: solid black is clear unprinted acrylic, the
photo prints in full colour inside its rounded square, every other element
is white ink. The item has its own skill because the generic night-light
skill assumes an edge-to-edge print.

## Keepsake boxes

Item family: laser-engraved wooden keepsake boxes (`keepsake-boxes` category;
first item *Personalized wedding keepsake box*). Input: text only
(`personal_text`); no photo, no colour. Product requirements and the
production handoff are in
`docs/requirements/personalized-keepsake-box-requirements.md`.

| File | Attached to |
| --- | --- |
| `items/keepsake-box.system-prompt.txt` | every keepsake-box item |
| `skills/keepsake-box-preview/SKILL.md` | *Personalized wedding keepsake box* |

Styles: `keepsake-box-quote-lid` (Engraved quote lid), `keepsake-box-wreath-lid`
(Botanical wreath lid). Both live in the production database already (created
directly on 2026-10-14, not through the seed). Template images, uploaded as
copies to the `catalog-assets` bucket and to OpenAI:
`public/product-references/keepsake-boxes/quote-lid.jpg` (the reference
listing photo) for the quote style and `wreath-lid.jpg` (an image-model edit
of that photo with a wreath lid and sample names) for the wreath style. The
skill is uploaded to the OpenAI Skills API and attached to the item; re-upload
it through the admin item form after editing `SKILL.md`.

The manufacturing PNG of both styles is the **inside of the lid only**: a
square canvas whose width equals the lid's inner width (`artwork_width_mm`
280 for the Standard size), with the artwork kept inside a centred landscape
band and pure white elsewhere. The traced fill SVG is the raster-engrave
layer. The two styles differ in where the customer's text goes:

- *Engraved quote lid*: the lid carries a fixed quote, no placeholders; the
  customer's text (names, date) is shown engraved on the front face in the
  preview and is typeset by the operator from the order.
- *Botanical wreath lid*: the customer's text is set inside the wreath through
  the placeholders, so it is part of the production file; the front face gets
  only the fixed rings emblem.

## Anniversary gifts

Item family: engraved wooden gifts for couples (`anniversary-gifts` category,
subcategories `table-games`, `cutting-boards`, `coasters`). Input: text only
(`personal_text`); no photo, no colour. Created directly in the production
database on 2026-10-14; spec and live ids in
`docs/requirements/anniversary-gifts-requirements.md`.

| File | Attached to |
| --- | --- |
| `items/table-game-card.system-prompt.txt` | *Personalized table game card* |
| `items/cutting-board.system-prompt.txt` | *Couple's nesting cutting board set* |
| `items/puzzle-coaster.system-prompt.txt` | *Puzzle coaster pair* |
| `skills/table-game-card-preview/SKILL.md` | *Personalized table game card* |
| `skills/cutting-board-preview/SKILL.md` | *Couple's nesting cutting board set* |
| `skills/puzzle-coaster-preview/SKILL.md` | *Puzzle coaster pair* |

Styles of the table game card, one per game, so the customer's style picker
doubles as the game picker and each selected game becomes its own preview and
cart line: `game-tic-tac-toe` (Tic-tac-toe), `game-word-search` (Word search),
`game-dice` (Dice drinking game), `game-snakes-and-ladders` (Snakes and
ladders), `game-ring-toss` (Ring toss). Their template images are the five
cards cropped out of the reference photo,
`public/product-references/anniversary-gifts/game-*.jpg`. The cutting boards
have `cutting-board-script-names` (Script names) and the coasters
`coaster-olive-branch` (Olive branch, his and hers), each with the full
reference photo as template.

Text conventions for this family, repeated in every manufacturing prompt: the
game cards take the names on the first line and the date on the second, both
engraved in the card's header; the boards and coasters take one name per line,
the first on the left piece and the second on the right. The manufacturing
canvas is the card face (160 mm canvas, card area centred), the nested pair of
boards (400 mm) or the joined pair of coasters (200 mm), so the traced fill
SVG lays over the workshop's master cut file at true scale.

## Our story timeline plaque

Fourth item of the anniversary family (`anniversary-gifts` category, new
`wall-plaques` subcategory): a laser-engraved birch plywood wall plaque
(400 × 280 mm) with the couple's story as a winding timeline. Input: text only
(`personal_text`). Created directly in the production database on 2026-10-14;
spec and live ids in `docs/requirements/our-story-timeline-plaque-requirements.md`.

| File | Attached to |
| --- | --- |
| `items/our-story-plaque.system-prompt.txt` | *Our story timeline plaque* |
| `skills/our-story-plaque-preview/SKILL.md` | *Our story timeline plaque* |

One style, `our-story-illustrated-timeline` (Illustrated timeline), with the
reference photo `public/product-references/anniversary-gifts/our-story-plaque.jpg`
as template. Text convention, repeated in the manufacturing prompt: the first
line is the couple's names, every further line one milestone written as a
date followed by a short label, in chronological order. The names and
milestones enter the production file through the placeholders; the title
"Our Story", the corner sprigs, the winding path and the closing phrase are
fixed. The manufacturing canvas is 400 mm wide with the plaque face as a
full-width band in the middle 70 % of the height, so the traced fill SVG
aligns to the plaque master at true scale. The customer text limit (80
characters) must be raised before this item can be published; see the spec.
