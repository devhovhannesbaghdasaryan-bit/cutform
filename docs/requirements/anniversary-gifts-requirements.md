# Anniversary gifts requirements

Date: 2026-10-14. Status: created in the production database as three hidden
draft items with seven active styles; not yet published.

## Scope

Second text-only AI-personalized family after the keepsake boxes: engraved
wooden gifts for couples, built from three reference listing photos. Same
pipeline as the boxes (tag `personal_text`, shared boilerplate library,
two-step manufacturing PNG plus preview, traced SVG), no new tables.

## Reference product analysis

Reference photos are stored under `public/product-references/anniversary-gifts/`.
All are third-party listing photography and must be replaced with our own
product photos before publishing; until then they serve only as generation
templates.

**Table games** (`table-games.jpg`). Five laser-cut birch plywood cards about
120 × 160 mm, 3 mm thick, rounded corners, each engraved with the couple's
names and date at the top and one game: ring toss (dowel peg plus three
hexagonal walnut rings), word search (word list plus a 10 × 10 letter grid),
tic-tac-toe (walnut hearts and rings as pieces), a dice drinking game (die
faces with rules, one die) and a 5 × 5 snakes-and-ladders board (two pawns,
one die). Card outlines, pieces, peg, pawns and dice are fixed master parts;
only the card face engraving changes per order. The five cards were cropped
out of the photo into one template image per game (`game-*.jpg`).

**Cutting boards** (`cutting-boards.jpg`). Two solid hardwood boards, about
20 mm thick, that nest into one shape: a taller board with a round handle
hole, a shorter one beside it, a wavy joint and a heart cut through where they
meet. Script names near the bottom of each board. CNC-routed profiles, oiled,
names laser engraved.

**Puzzle coasters** (`puzzle-coasters.jpg`). Two interlocking walnut jigsaw
pieces about 100 mm across and 6 mm thick, each engraved with a script name,
an olive branch and a small "his" or "hers". Laser cut and engraved.

## Catalog placement (live database)

Created directly in the production Supabase project on 2026-10-14 in several
atomic blocks (category and subcategory inserts idempotent, styles first, then
each item resolving its styles by name).

| Row | Value |
| --- | --- |
| Category `anniversary-gifts` ("Anniversary gifts", sort 46) | `0a5b86e2-ae4f-4804-8c6a-dd3673e13ff8` |
| Subcategory `table-games` | `51c6fddf-091e-4b91-8c8d-1bdc6f3933f4` |
| Category `kitchen-and-dining` ("Kitchen & dining", sort 47), home of the cutting boards since 2026-10-14 | `d0017dd6-2b97-4376-8a66-0950cab66007` |
| Subcategory `cutting-boards` (moved under `kitchen-and-dining`) | `06611364-0521-4200-af5f-e25b7a6928a8` |
| Subcategory `coasters` | `99b9e5b1-4ee3-48ad-b80f-69961d785790` |
| Item `01-personalized-table-game-card`, 12 USD per card | `bbc440df-e856-48e4-bc61-40dfb695d018` |
| Item `02-couple-cutting-board-set`, 99 USD | `6da56687-a031-4180-a377-5f26018cfe72` |
| Item `03-puzzle-coaster-pair`, 29 USD | `a8ec7ae1-349f-4023-9949-0cc45c050a96` |
| Style "Tic-tac-toe" (sort 70) | `682f86d7-5f76-4eb5-b981-0206873abc90` |
| Style "Word search" (sort 80) | `cca02918-5a07-4517-96e5-ad1b509c5356` |
| Style "Dice drinking game" (sort 90) | `29e35637-82e2-419f-84ba-a5c153681040` |
| Style "Snakes and ladders" (sort 100) | `ae5153c8-487f-4280-82b7-a3e98c7ac351` |
| Style "Ring toss" (sort 110) | `ff5e28d8-ccb4-43eb-87ab-85f31acc4184` |
| Style "Script names" (sort 120) | `74c53a23-acb7-49c3-86d7-a1b5aa2782b1` |
| Style "Olive branch, his and hers" (sort 130) | `05c3daf1-aaaf-4896-b939-e51e1a8c7cbb` |
| Skill of the game card (OpenAI Skills API) | `skill_6acf367222cc8191808cbc3d00287236054c0a60f0bab4ac` |
| Skill of the cutting boards | `skill_6acf3673c32c8191a60e7a0ec7c0bfae0a2b6d3d350f8155` |
| Skill of the coasters | `skill_6acf36746d70819181d157790f2e5c3409475ba14811d2d7` |

Every item: status `draft`, `item_type: standard`, customizable, tag
`personal_text`, EN/RU/AM translations and SEO rows (marked AI-generated, not
admin-reviewed), thumbnail and primary media in `catalog-assets`, a flat
3,000 AMD shipping rule for all five regions, system prompt from
`docs/prompts/items/`, skill copy in the private `uploads` bucket. Prices are
placeholders to confirm against the workshop cost sheet.

Why one category: Hovhannes classed all three as anniversary gifts, so the
family is organised by occasion with product-type subcategories. The locale
files carry the category and subcategory copy; the landing page falls back to
a generic icon for categories it does not know.

## Items, styles and text conventions

| Item | Styles | Customer text | Manufacturing canvas |
| --- | --- | --- | --- |
| Table game card | one per game: Tic-tac-toe, Word search, Dice drinking game, Snakes and ladders, Ring toss | line 1 names, line 2 date, engraved in the card header | 160 mm square, card area a centred 70 % × 94 % portrait rectangle |
| Cutting board set | Script names | one name per line: left board, right board | 400 mm square, the nested pair at true scale |
| Puzzle coaster pair | Olive branch, his and hers | one name per line: left piece, right piece | 200 mm square, the joined pair at true scale |

The game card uses the style picker as the game picker: the customer ticks
the games they want, each becomes its own preview and its own cart line at the
per-card price. The word-search style asks the model to hide the listed words
and the couple's names in the grid, which the operator must verify before
engraving. The ring-toss card engraves only the header plus a hexagon and a
centre dot marking the peg, so its trace passes the ink-coverage check even
without text.

Prompt files: `docs/prompts/boilerplates/game-*.{manufacturing,preview}.txt`,
`cutting-board-script-names.*`, `coaster-olive-branch.*`; item prompts in
`docs/prompts/items/`; skills in `docs/prompts/skills/`. The database rows
mirror these files; after editing a file, paste the new text into the admin
form (and re-upload the skill file) to keep them in sync.

## Production handoff (operator)

1. Open the option's **fill** SVG. It is 160, 400 or 200 mm wide and holds
   only the engraving, so align it to the master cut file of the card, the
   nested boards or the joined coasters at true scale. Raster-engrave.
2. Check every name and date against the order before engraving. For the
   word search also check that every listed word and both names are in the
   grid, spelled correctly.
3. Cut parts from the masters: card outline and walnut pieces (hearts, rings,
   hexagonal rings), 8 mm dowel peg glued at the hexagon centre for the ring
   toss, pawns and dice from the printer or bought in; board profiles on the
   CNC router with the heart cut through at the joint, then food-safe oil;
   coaster pieces from 6 mm walnut, then oil.
4. Power and speed from the test strip of the current material batch.

## Remaining steps to go live

1. Deploy the branch with the text-only manufacturing change in
   `app/personalize/actions.ts`; without it these items would produce a
   preview but no production file.
2. In the admin item forms: review the RU/AM copy, replace the thumbnails with
   our own photos, confirm prices, then publish.
3. Run a test generation per style, check the manufacturing PNGs, SVGs and
   previews, and run real engravings on scrap before announcing.

## Follow-ups

- Second styles for the boards (names with wedding date) and the coasters
  (heart halves, names with date), with generated template images as for the
  keepsake-box wreath lid.
- A label-free coaster variant without "his" and "hers".
- A family puzzle coaster set with four or six pieces, as a separate item.
- A word list the customer can edit, once the text input grows beyond one
  80-character field.
