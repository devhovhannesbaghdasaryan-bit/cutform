# Our story timeline plaque requirements

Date: 2026-10-14. Status: created in the production database as one hidden
draft item with one active style; not yet published.

## Scope

Fourth item of the text-only AI-personalized line, added to the
`anniversary-gifts` family: a laser-engraved plywood wall plaque that tells a
couple's story as a winding timeline. Same pipeline as the keepsake boxes and
the other anniversary gifts (tag `personal_text`, shared boilerplate library,
two-step manufacturing PNG plus preview, traced SVG), no new tables.

## Reference product analysis

Reference photo: `public/product-references/anniversary-gifts/our-story-plaque.jpg`
(third-party listing photography of a French "Notre Histoire" plaque; replace
with our own product photo before publishing, until then it is only the
generation template).

**Timeline plaque.** A landscape plaque of pale birch plywood, about
400 × 280 mm and 4 mm thick, rounded corners, two holes near the top edge with
a cord knotted through them for hanging. Everything on it is raster
engraving: a serif title ("Our Story"), the couple's names in script beneath
it, small botanical sprigs in the corners and beside the names, one continuous
path that winds across the plaque in wide S-curves, a filled dot on the path
for each milestone, each milestone's date and label beside its dot in a
rounded sans-serif, a small line-art illustration matching each milestone
(heart, lips, suitcase, key, house, ring, rings, globe and plane, cake, dog,
teddy, star, rainbow) and a script closing phrase in the lower right ("...and
the best is yet to come!"). Plaque outline and holes are the fixed master cut
file; only the face engraving changes per order.

Categorisation: an anniversary or wedding gift for couples and at the same
time wall decor. It sits in `anniversary-gifts`, which is organised by
occasion with product-type subcategories, under a new `wall-plaques`
subcategory. The alternative placement, `decorations` / `wood-fixtures`, was
not used because the family copy and the landing page group couple gifts
together.

## Catalog placement (live database)

Created directly in the production Supabase project on 2026-10-14 in one
atomic statement (subcategory, style, item, translations, SEO, media, market
rules and the item-style link), after the template image, thumbnail and
skill had been uploaded the way the admin forms do.

| Row | Value |
| --- | --- |
| Category `anniversary-gifts` (existing) | `0a5b86e2-ae4f-4804-8c6a-dd3673e13ff8` |
| Subcategory `wall-plaques` ("Wall plaques", sort 40) | `8210fb71-40e5-47a6-a0be-4d0636a25243` |
| Item `04-our-story-timeline-plaque`, 49 USD | `96cbdc47-1156-4a78-bd5e-5257a77b0f75` |
| Style "Illustrated timeline" (sort 140, `artwork_width_mm` 400) | `d2c34182-8815-492d-974b-73ec556f779e` |
| Style template image (`catalog-assets`) | `6ee5c558-0f73-4a51-a33a-82f882633a4c/personalization-boilerplates/72459d97-f69d-4053-806b-e4030d89751c.jpg` |
| Style template on OpenAI Files (`openai_file_id`) | `file-4jzYifxhLz117wJBKLZLUx` |
| Skill (OpenAI Skills API) | `skill_6acf456827148191849756257b2a91b90ba17b5101d032a8` |
| Skill copy (`uploads` bucket) | `6ee5c558-0f73-4a51-a33a-82f882633a4c/personalization-skills/6b9ea45a-e2e8-4fef-a90e-b8a7028f1354.md` |
| Thumbnail and primary media (`catalog-assets`) | `anniversary-gifts/04-our-story-timeline-plaque/assets/hero-1.jpg` |

Item: status `draft`, `item_type: standard`, customizable, tag
`personal_text`, EN/RU/AM translations and SEO rows (marked AI-generated, not
admin-reviewed), a flat 3,000 AMD shipping rule for all five regions, system
prompt from `docs/prompts/items/our-story-plaque.system-prompt.txt`, one
size (Standard, 400 × 280 × 4 mm). The price is a placeholder to confirm
against the workshop cost sheet. The locale files carry the new subcategory
copy (`subcategory.wall-plaques`) and a widened `anniversary-gifts` category
description.

## Style, text convention and manufacturing canvas

| Item | Style | Customer text | Manufacturing canvas |
| --- | --- | --- | --- |
| Our story timeline plaque | Illustrated timeline | line 1 the couple's names; every further line one milestone, `date label`, in chronological order | 400 mm square, the plaque at true scale as a full-width band in the middle 70 % of the height |

The names and milestones go into the production file through the
placeholders: the names in script under the fixed title, each milestone as a
filled dot on the path with its date and label beside it and a line-art
illustration chosen from the label (heart, lips, suitcase or plane, key,
house, ring, two rings, cake, pet, teddy or star or rainbow, graduation cap;
a small heart otherwise). The title "Our Story", the corner sprigs, the path
and the closing phrase "...and the best is yet to come!" are fixed and in
English. Without milestone lines the path is drawn without dots.

Prompt files: `docs/prompts/boilerplates/our-story-illustrated-timeline.{manufacturing,preview}.txt`,
`docs/prompts/items/our-story-plaque.system-prompt.txt`,
`docs/prompts/skills/our-story-plaque-preview/SKILL.md`. The database rows
were verified identical to these files at creation; after editing a file,
paste the new text into the admin form (and re-upload the skill) to keep them
in sync.

## Production handoff (operator)

1. Open the option's **fill** SVG. It is 400 mm wide and holds only the
   engraving, with the plaque face as a centred 400 × 280 mm band, so align
   it to the plaque master cut file at true scale. Raster-engrave.
2. Check the names and every milestone date and label against the order
   before engraving; the model typesets them from the customer's lines, so a
   misread date is possible.
3. Cut the plaque and its two holes from the master out of 4 mm birch
   plywood, light sand, thread and knot the cord.
4. Power and speed from the test strip of the current plywood batch.

## Remaining steps to go live

1. **Raise the text limit.** `MAX_PERSONALIZED_TEXT_LENGTH` in
   `lib/personalization-constants.ts` is 80 characters, enough for the names
   and two short milestones only. A timeline needs roughly 300 to 500
   characters (names plus eight to twelve milestone lines). Either raise the
   global limit (and the `errorText` copy in `messages/*.json`) or add a
   per-item limit; until then the item is not usable as intended, which is
   why it stays a draft.
2. Deploy the branch with the text-only manufacturing change in
   `app/personalize/actions.ts`; without it the item would produce a preview
   but no production file.
3. In the admin item form: review the RU/AM copy, replace the thumbnail with
   our own photo, confirm the price, then publish.
4. Run a test generation with a full set of milestones, check the
   manufacturing PNG (every milestone present, legible dates, icons not
   touching text), the traced SVG at 400 mm, and the preview; then a real
   engraving on scrap before announcing.

## Follow-ups

- A second style without illustrations (dots and text only, or small hearts
  at the milestones) with a generated template image, as for the keepsake-box
  wreath lid.
- Localised fixed strings: the title and closing phrase in Russian and
  Armenian, either as separate styles or chosen by the customer's locale.
- A portrait variant (280 × 400 mm) for a vertical timeline.
- A structured milestone editor (date field plus label per row) once the
  text input grows beyond one field, shared with the word-search card.
