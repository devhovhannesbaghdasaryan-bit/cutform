# Production notes for the AI-personalized families (October 2026)

Date: 2026-10-16. Status: **drafts, not yet applied to production** (update this line when applied).

## Purpose

The production pack (`lib/production-pack/build.ts`, `lib/production-pack/load.ts`) builds the printable tech sheet of an order item from three database fields:

- `catalog_items.characteristics`: one `Key: value` per line. `Material:` lines become the material list, `Finish:` / `Coating:` / `Surface:` lines the finish list, `Tool:` / `Machine:` / `Process:` lines feed the process classifier only, every other line (`Hardware:`, `Personalization:`, ...) is shown under workshop notes.
- `catalog_items.manufacturing_notes`: free text, split into paragraphs on blank lines and shown under workshop notes.
- `personalization_boilerplates.manufacturing_process`: `"<process>, <material>"`. The text before the first comma, semicolon or the word "on" names the process (it decides between UV print, laser raster engraving, laser vector score, CNC, FFF); every later clause is kept as a material hint unless it is shorter than three characters or contains a process word (laser, print, engrav, cut, rout, mill, uv, score, raster, vector, cnc, fff, 3d). So the material clause must not contain commas or process words.

This file records the exact text for every item and style of the five families (keepsake boxes, anniversary gifts, our-story plaque, music-plaque night light, personalized night lights), so that the repository documents production. The admin item form ("Admin-only characteristics", "Manufacturing notes") and the boilerplate form ("Manufacturing process") are the places to edit them; `characteristics` and `manufacturing_process` are not shown to customers.

## Audit of production on 2026-10-16

- All six items created on 2026-10-14 (keepsake box, game card, cutting boards, coasters, our-story plaque, music plaque) already carried `manufacturing_notes` and `characteristics`, written at creation, and every style carried a `manufacturing_process`. All six are `published`, although the requirement docs still say "draft".
- No item had a `Finish:` line, so the sheet's finish section was empty everywhere; hardware (hinges, clasp, LED base, game pieces) was folded into `Material:` lines.
- The process text of "Script names", "Music plaque UV print" and the four original night-light styles yielded no material hint under the parsing rules above, so an order whose catalog item is ever missing would show "Material: not recorded".
- The three night-light items from July 2026 (`01` draft umbrella item, `02` round UV print, `03` contour laser engraved) still carried generic seed text from July. Items `01` and `02` are linked to all four night-light styles, `03` to the two contour styles. Item `01` had no characteristics at all.
- Material facts come from the requirement docs (`personalized-keepsake-box-requirements.md`, `anniversary-gifts-requirements.md`, `our-story-timeline-plaque-requirements.md`, `music-plaque-night-light-requirements.md`) and, for the July night lights, from the styles' generation instructions; no document records the acrylic thickness or base construction of the July night lights, so those lines say "per the workshop master".

## Styles: `personalization_boilerplates.manufacturing_process`

| Style | Id | Item(s) | Before (2026-10-14) | Proposed | Sheet reads (process / material hint) |
| --- | --- | --- | --- | --- | --- |
| Engraved quote lid | `224f3b7c-69d9-454c-9337-5e49ab7a8ab4` | 01-personalized-wedding-keepsake-box | CO2-laser raster engraving, oak-toned wood (inside of the lid) | *unchanged* | laser_raster_engraving / oak-toned wood (inside of the lid) |
| Botanical wreath lid | `224f8c20-4424-4b2a-8284-647c7c8dac11` | 01-personalized-wedding-keepsake-box | CO2-laser raster engraving, oak-toned wood (inside of the lid) | *unchanged* | laser_raster_engraving / oak-toned wood (inside of the lid) |
| Tic-tac-toe | `682f86d7-5f76-4eb5-b981-0206873abc90` | 01-personalized-table-game-card | CO2-laser raster engraving, 3 mm birch plywood card | *unchanged* | laser_raster_engraving / 3 mm birch plywood card |
| Word search | `cca02918-5a07-4517-96e5-ad1b509c5356` | 01-personalized-table-game-card | CO2-laser raster engraving, 3 mm birch plywood card | *unchanged* | laser_raster_engraving / 3 mm birch plywood card |
| Dice drinking game | `29e35637-82e2-419f-84ba-a5c153681040` | 01-personalized-table-game-card | CO2-laser raster engraving, 3 mm birch plywood card | *unchanged* | laser_raster_engraving / 3 mm birch plywood card |
| Snakes and ladders | `ae5153c8-487f-4280-82b7-a3e98c7ac351` | 01-personalized-table-game-card | CO2-laser raster engraving, 3 mm birch plywood card | *unchanged* | laser_raster_engraving / 3 mm birch plywood card |
| Ring toss | `ff5e28d8-ccb4-43eb-87ab-85f31acc4184` | 01-personalized-table-game-card | CO2-laser raster engraving, 3 mm birch plywood card | *unchanged* | laser_raster_engraving / 3 mm birch plywood card |
| Script names | `74c53a23-acb7-49c3-86d7-a1b5aa2782b1` | 02-couple-cutting-board-set | CO2-laser raster engraving on CNC-routed hardwood boards | CO2-laser raster engraving, 20 mm solid beech or oak boards | laser_raster_engraving / 20 mm solid beech or oak boards |
| Olive branch, his and hers | `05c3daf1-aaaf-4896-b939-e51e1a8c7cbb` | 03-puzzle-coaster-pair | CO2-laser cut and raster engraving, 6 mm walnut | *unchanged* | laser_raster_engraving / 6 mm walnut |
| Illustrated timeline | `d2c34182-8815-492d-974b-73ec556f779e` | 04-our-story-timeline-plaque | CO2-laser raster engraving on 4 mm birch plywood, plaque cut from the master | CO2-laser raster engraving, 4 mm birch plywood (plaque face) | laser_raster_engraving / 4 mm birch plywood (plaque face) |
| Music plaque UV print | `ff253802-cf9a-4406-90e5-46b3abbd082a` | 04-music-plaque-acrylic-night-light | portrait UV-printed clear acrylic: white ink elements and a full-colour photo, black areas unprinted | UV print (white ink and full-colour photo), 3 mm clear acrylic portrait panel | uv_printing / 3 mm clear acrylic portrait panel |
| Rectangular UV print | `71c54b48-2df8-45ea-9720-070bb1ef9cc2` | night lights (02, 01 draft) | rectangular UV-printed acrylic | Full-colour UV print, clear acrylic rectangular panel | uv_printing / clear acrylic rectangular panel |
| Round UV print | `aa498cb8-4c59-4f85-bdd2-ff21de5d472f` | night lights (02, 01 draft) | round UV-printed acrylic | Full-colour UV print, clear acrylic round panel | uv_printing / clear acrylic round panel |
| Contour laser engraved | `4d26ce8d-2b00-4a09-b431-6328fff5a5ef` | night lights (03, 02, 01 draft) | contour-cut CO2-laser-engraved acrylic | CO2-laser raster engraving and contour cut, clear acrylic panel | laser_raster_engraving / clear acrylic panel |
| Contour laser stroked | `dcc31367-3623-4c58-a67d-cfb406dfee2c` | night lights (03, 02, 01 draft) | contour-cut CO2-laser-scored acrylic (stroke lines) | CO2-laser vector score and contour cut, clear acrylic panel | laser_vector_cutting / clear acrylic panel |

Reasons for the changed rows:

- Script names: The current text yields no material hint: "on" splits it and "CNC-routed" is dropped as a process word.
- Illustrated timeline: Works today; normalised to the "<process>, <material>" form so the second clause ("plaque cut from the master") no longer depends on the word filter.
- Music plaque UV print: The current text has no material clause the sheet can keep ("black areas unprinted" is dropped as a process word).
- Rectangular UV print: No material clause today.
- Round UV print: No material clause today.
- Contour laser engraved: No material clause today.
- Contour laser stroked: No material clause today; the new text still classifies as vector score (no raster word).

`artwork_width_mm` and `generate_hidden_svg` are not part of this change; the four original night-light styles have no artwork width, so their SVGs open in pixels (see follow-ups).

## Items: `catalog_items.characteristics` and `catalog_items.manufacturing_notes`

### Personalized wedding keepsake box (`01-personalized-wedding-keepsake-box`)

- Id: `aa49b47d-57c2-4c17-bfe7-8baeae26a822`
- Family: Keepsake boxes; status on 2026-10-16: published
- Styles: Engraved quote lid, Botanical wreath lid

Characteristics before:

```text
Material: oak-veneered plywood or solid oak, 8-10 mm
Material: bronze-finish butt hinges and hasp clasp
Personalization: names and wedding date (front face or inside the lid, by style)
Personalization: lid artwork style
Tool: CO2 laser cutter (engraving and plywood panel cutting)
Tool: CNC router (solid oak panels)
```

Proposed characteristics:

```text
Material: oak-veneered plywood or solid oak, 8-10 mm (box body and lid panels)
Finish: oil or satin lacquer, applied before the hardware is fitted
Hardware: 2 bronze-finish butt hinges at the back, 1 bronze-finish hasp clasp centred on the front edge
Personalization: names and wedding date, up to 80 characters with line breaks (quote lid: engraved on the front face; wreath lid: inside the wreath)
Tool: CO2 laser cutter (engraving; panel cutting for plywood builds)
Tool: CNC router (solid oak panels)
```

Manufacturing notes before:

```text
Engrave both faces flat before assembly: the inside of the lid from the order's traced fill SVG (280 mm wide for the Standard size), the front face from the order's text typeset in the house serif plus the rings emblem master file. Finish with oil or satin lacquer, then fit two bronze butt hinges at the back and the hasp clasp centred on the front. Run a power/speed test strip on each new wood batch; check every name and date against the order before engraving.
```

Proposed manufacturing notes:

```text
AI file: the fill SVG (280 mm wide, true scale for the Standard lid) holds only the artwork for the inside of the lid. Quote lid: the fixed four-line quote; the customer's text is NOT in the file. Wreath lid: the wreath with the names and date inside it. The file never contains the box cut files or joinery, the rings emblem or the front-face lettering; those are workshop masters, one per size.

1. Align the horizontal and vertical centre of the fill SVG with the inner centre of the lid and raster-engrave. For the Large size scale the artwork to the Large lid master (the 280 mm width matches the Standard lid).
2. Compare every word with the order text before engraving; AI-set lettering can misspell. Wreath lid: the names are in the file. Quote lid: they are not.
3. Front face, centred below the clasp. Quote lid: typeset the order text in the house serif (wide-spaced caps, first line largest, line breaks only where the customer broke them) and engrave the rings emblem from the master beneath it; without text the front stays plain. Wreath lid: engrave the rings emblem only.
4. Engrave both panels flat before assembly; power and speed from the test strip of the current wood batch.
5. Finish with oil or satin lacquer, then fit the two hinges and the clasp.
```

### Personalized Birch Plywood Anniversary Game Card — Engraved Names & Date (`01-personalized-table-game-card`)

- Id: `bbc440df-e856-48e4-bc61-40dfb695d018`
- Family: Anniversary gifts; status on 2026-10-16: published
- Styles: Tic-tac-toe, Word search, Dice drinking game, Snakes and ladders, Ring toss

Characteristics before:

```text
Material: 3 mm birch plywood card
Material: 3 mm walnut game pieces, wooden peg, pawns and dice
Personalization: names and date (two lines)
Personalization: choice of game
Tool: CO2 laser cutter (cut and engrave)
Tool: FFF 3D printer (pawns and dice)
```

Proposed characteristics:

```text
Material: 3 mm birch plywood (card with rounded corners)
Material: 3 mm walnut (hearts, rings and hexagonal rings)
Finish: sanded plywood, soot wiped off; no coating specified
Hardware: tic-tac-toe 5 walnut hearts and 4 walnut rings; ring toss 8 mm dowel peg glued at the hexagon centre and 3 walnut hexagonal rings; snakes and ladders 2 pawns and 1 die; dice game 1 die; word search none
Personalization: line 1 names, line 2 date, engraved in the card header; the game is the chosen style, one card per style
Tool: CO2 laser cutter (card cut, face engraving, walnut pieces)
Tool: FFF 3D printer or bought in (pawns and dice)
```

Manufacturing notes before:

```text
Cut the 120 x 160 mm rounded card from 3 mm birch plywood with the card master and engrave the face from the order's traced fill SVG (160 mm canvas, card area centred). Pieces per game from the masters: tic-tac-toe 5 walnut hearts and 4 walnut rings; ring toss an 8 mm dowel peg glued at the hexagon centre plus 3 walnut hexagonal rings; snakes and ladders 2 pawns and 1 die; dice game 1 die. Check the word-search grid against the word list and the names, and every name and date, before engraving.
```

Proposed manufacturing notes:

```text
AI file: the fill SVG (160 mm wide, true scale) holds only the face engraving of one card: the names-and-date header and the chosen game (3x3 grid; word list with a 10x10 letter grid; six die faces with rules; numbered 5x5 board with ladders and slides; or the ring-toss hexagon with a centre dot that marks the peg). The card face is a centred portrait rectangle of about 70 % x 94 % of the canvas. The file never contains the card outline, the pieces, the peg, the pawns or the dice; those are workshop masters.

1. Align the fill SVG to the card master at true scale and raster-engrave, then cut the 120 x 160 mm rounded card from 3 mm birch plywood in the same setup. Every ordered style is its own card and its own order line.
2. Check the names and the date against the order before engraving. Word search: also check that every listed word and both names are in the grid, spelled correctly.
3. Pieces from the masters: tic-tac-toe 5 walnut hearts and 4 walnut rings (3 mm walnut); ring toss an 8 mm dowel peg glued at the hexagon centre plus 3 walnut hexagonal rings; snakes and ladders 2 pawns and 1 die; dice game 1 die; word search no pieces. Pawns and dice from the FFF printer or bought in.
4. Power and speed from the test strip of the current plywood batch.
```

### Couple's nesting cutting board set (`02-couple-cutting-board-set`)

- Id: `6da56687-a031-4180-a377-5f26018cfe72`
- Family: Anniversary gifts (Kitchen & dining); status on 2026-10-16: published
- Styles: Script names

Characteristics before:

```text
Material: solid beech or oak, 20 mm, food-safe oil finish
Personalization: two names (one per line)
Tool: CNC router (board profiles and heart cutout)
Tool: CO2 laser cutter (name engraving)
```

Proposed characteristics:

```text
Material: solid beech or oak, 20 mm (two nesting boards)
Finish: food-safe oil, applied after engraving
Personalization: two names, one per line: line 1 the left (taller) board, line 2 the right board
Tool: CNC router (board profiles, handle holes and the heart cut through at the joint)
Tool: CO2 laser cutter (name engraving)
```

Manufacturing notes before:

```text
Route both profiles from the CNC master (20 mm beech or oak, heart cut through at the joint), sand, then engrave the names from the order's traced fill SVG at 400 mm width aligned to the nested pair's bounding box, and finish with food-safe oil. Check both names against the order before engraving.
```

Proposed manufacturing notes:

```text
AI file: the fill SVG (400 mm wide, true scale) holds only the two script names, one low on each board, positioned on the nested pair at true scale. It does not contain the board profiles, the handle holes or the heart cut-out; those are the CNC master.

1. Route both profiles from the CNC master out of 20 mm beech or oak, heart cut through where the boards meet, and sand.
2. Align the fill SVG to the nested pair at true scale (its 400 mm width is the pair's bounding box) and raster-engrave each name on its board, flat on the bed. Check both names against the order before engraving: line 1 is the left (taller) board, line 2 the right board.
3. Wipe soot, light sand, then finish with food-safe oil.
4. Power and speed from the test strip of the current hardwood batch.
```

### Puzzle coaster pair (`03-puzzle-coaster-pair`)

- Id: `a8ec7ae1-349f-4023-9949-0cc45c050a96`
- Family: Anniversary gifts; status on 2026-10-16: published
- Styles: Olive branch, his and hers

Characteristics before:

```text
Material: 6 mm solid walnut, oil finish
Personalization: two names (one per line)
Tool: CO2 laser cutter (cut and engrave)
```

Proposed characteristics:

```text
Material: 6 mm solid walnut (two interlocking jigsaw pieces, about 100 mm across each)
Finish: oil, applied after engraving and cutting
Personalization: two names, one per line: line 1 the left piece, line 2 the right piece; the olive branches and the "his" / "hers" labels are fixed in the artwork
Tool: CO2 laser cutter (face engraving and piece cutting)
```

Manufacturing notes before:

```text
Cut both pieces from 6 mm walnut with the puzzle master, engrave the faces from the order's traced fill SVG at 200 mm width aligned to the joined pair, light sand, oil. Check both names against the order before engraving.
```

Proposed manufacturing notes:

```text
AI file: the fill SVG (200 mm wide, true scale) holds only the engraving of the joined pair: on each piece a script name, an olive branch beneath it and a small "his" or "hers" label. It does not contain the jigsaw outlines; those are the puzzle master.

1. Align the fill SVG to the joined-pair master at true scale and raster-engrave both faces, then cut the two pieces from 6 mm walnut in the same setup so the engraving stays registered to the interlock.
2. Check both names against the order before engraving: line 1 is the left piece, line 2 the right piece.
3. Wipe soot, light sand, oil.
4. Power and speed from the test strip of the current walnut batch.
```

### Our story timeline plaque (`04-our-story-timeline-plaque`)

- Id: `96cbdc47-1156-4a78-bd5e-5257a77b0f75`
- Family: Anniversary gifts (Wall plaques); status on 2026-10-16: published
- Styles: Illustrated timeline

Characteristics before:

```text
Material: 4 mm birch plywood, rounded corners, cord hanger
Personalization: names on the first line, then one milestone per line (date and label)
Tool: CO2 laser cutter (cut and engrave)
```

Proposed characteristics:

```text
Material: 4 mm birch plywood (plaque with rounded corners)
Finish: light sand after engraving; no coating specified
Hardware: hanging cord threaded through the two holes near the top edge and knotted
Personalization: line 1 the couple's names; every further line one milestone as "date label", in chronological order; title, sprigs, path and closing phrase are fixed
Tool: CO2 laser cutter (face engraving, plaque and hole cutting)
```

Manufacturing notes before:

```text
Cut the plaque and its two hanging holes from the plaque master (400 x 280 mm, 4 mm birch plywood), engrave the face from the order's traced fill SVG at 400 mm width aligned to the master, light sand, thread and knot the cord. Check the names and every milestone date and label against the order before engraving.
```

Proposed manufacturing notes:

```text
AI file: the fill SVG (400 mm wide, true scale) holds only the face engraving, with the plaque face as a centred 400 x 280 mm band: the fixed title "Our Story", the names in script, the winding path with a filled dot per milestone, each milestone's date and label with its small illustration, the corner sprigs and the fixed closing phrase. It does not contain the plaque outline or the two hanging holes; those are the plaque master.

1. Align the fill SVG to the plaque master at true scale and raster-engrave, then cut the plaque and its two holes from 4 mm birch plywood in the same setup.
2. Check the names and every milestone date and label against the order before engraving; the model typesets them from the customer's lines, so a misread date is possible. Without milestone lines the path is engraved without dots.
3. Light sand, thread the cord through the holes and knot it.
4. Power and speed from the test strip of the current plywood batch.
```

### Music Plaque Acrylic Night Light (`04-music-plaque-acrylic-night-light`)

- Id: `25ade003-7018-481e-9f52-b73daf55f228`
- Family: Night lights; status on 2026-10-16: published
- Styles: Music plaque UV print

Characteristics before:

```text
Material: 3 mm clear acrylic, UV print (white ink and full-colour photo), beech LED base with USB cable
Personalization: one photo; song title on the first line, artist on the second; LED colour
Tool: UV flatbed printer, laser cutter for the panel
```

Proposed characteristics:

```text
Material: 3 mm clear acrylic (portrait panel with slightly rounded corners)
Finish: UV print, white ink for every white element and full colour for the photo; black areas stay clear acrylic; cut edges polished
Hardware: rectangular beech LED base with USB cable, LED module in the ordered colour
Personalization: one photo (album art in the rounded square); text line 1 song title, line 2 artist; LED colour
Tool: UV flatbed printer (panel print)
Tool: CO2 laser cutter (panel cut)
```

Manufacturing notes before:

```text
Cut the portrait panel (150 x 210 mm Standard, 200 x 280 mm Large) with rounded corners from 3 mm clear acrylic and UV-print the order's manufacturing PNG scaled to the panel: black areas unprinted, white elements in white ink, the photo in full colour. Fit the panel into the beech LED base. Check the song title and artist against the order before printing. When the order carries a song link, replace the decorative bars with the real scan code generated from it.
```

Proposed manufacturing notes:

```text
Print file: the manufacturing PNG is a square canvas; the portrait panel is the centred band spanning the full height and the middle 72 % of the width. Colour convention: solid black = no ink (clear acrylic); white = white ink; the photo inside the rounded square prints in full colour. The bars of the code strip are a decorative pattern, not a scannable code. The file does not contain the panel outline; that is the master per size.

1. Crop the PNG to the panel band and scale it to the ordered panel size (150 x 210 mm Standard, 200 x 280 mm Large). Print the white-ink layer from the PNG's white areas, or from a separate mask if the workshop's RIP needs one.
2. Check the song title and artist against the order before printing. If the order notes carry a song link, generate the real scan code from it and replace the decorative bars at the same size and position.
3. Cut the panel with rounded corners from 3 mm clear acrylic, print, polish the edges, fit the panel into the beech LED base and test the ordered LED colour.
```

### Contour Laser Engraved Acrylic Night Light (`03-contour-laser-engraved-acrylic-night-light`)

- Id: `ad023713-dbe7-4caa-82db-857b073df9c9`
- Family: Night lights (July 2026 items); status on 2026-10-16: published
- Styles: Contour laser engraved, Contour laser stroked

Characteristics before:

```text
Material: clear acrylic
Material: engraved acrylic edge-lit panel
Material: LED components
Personalization: portrait/photo upload
Personalization: custom text or name
Personalization: date or message
Personalization: light color
Tool: CO2 laser cutter
Tool: CNC router
Tool: FFF 3D printer
```

Proposed characteristics:

```text
Material: clear acrylic panel, contour-cut to the artwork's silhouette with a small even margin and a straight bottom edge (thickness per the workshop master)
Finish: line art raster-engraved (Contour laser engraved) or scored as hairlines (Contour laser stroked); cut edges cleaned and polished
Hardware: oval beech LED base with a slot, USB cable, LED module in the ordered colour
Personalization: one photo turned into line art; optional text engraved once on the front face of the base; LED colour
Tool: CO2 laser cutter (engraving or scoring, and the contour cut)
Tool: CNC router or FFF 3D printer (LED base)
```

Manufacturing notes before:

```text
Convert the selected subject into simple vector linework, simplify fragile details, cut a stable outer silhouette, engrave the clear acrylic panel, and test the edge-lighting effect in the LED base. Confirm artwork proof, text, lighting color, acrylic thickness, and rights before production.
```

Proposed manufacturing notes:

```text
AI file: the fill SVG holds the black-on-white line art derived from the customer's photo, the stroke SVG the same lines as hairlines; the manufacturing PNG is the source raster. Contour laser engraved: raster-engrave the fill layer. Contour laser stroked: score the stroke layer at low power, one pass, same weight everywhere. These styles have no artwork width set, so the SVG opens in pixels: scale the artwork to the ordered panel size on the master and write the width used on the job ticket. The file does not contain the panel outline; cut along the artwork's outer silhouette with a small even margin and a straight bottom edge for the base slot.

1. Scale the artwork to the ordered size, add the silhouette cut contour, engrave or score first, then cut in the same setup.
2. Customer text, if any, is laser-engraved once on the front face of the wooden base, centred, one line, and never on the acrylic. Check it against the order.
3. Clean the edges, fit the panel in the slot of the base and test the ordered LED colour.
4. Power and speed from the test strip of the current acrylic batch.
```

### Round UV Print Acrylic Night Light (`02-round-uv-print-acrylic-night-light`)

- Id: `533bac84-f232-4e85-a082-354c2db67028`
- Family: Night lights (July 2026 items); status on 2026-10-16: published
- Styles: Rectangular UV print, Round UV print, Contour laser engraved, Contour laser stroked

Characteristics before:

```text
Material: clear acrylic
Material: plywood or hardwood LED base
Material: LED components
Personalization: photo upload
Personalization: custom text or name
Personalization: date or short message
Personalization: light color
Tool: UV printer
Tool: CO2 laser cutter
Tool: CNC router
```

Proposed characteristics:

```text
Material: clear acrylic panel: rectangular or round for the UV-print styles, contour-cut to the artwork's silhouette for the laser styles (thickness per the workshop master)
Finish: UV-print styles full-colour print edge to edge; laser styles line art raster-engraved (Contour laser engraved) or scored as hairlines (Contour laser stroked); cut edges cleaned and polished
Hardware: beech LED base (rectangular bar for the rectangular print, cylinder for the round print, oval with a slot for the laser styles), USB cable, LED module in the ordered colour
Personalization: one photo; optional text (printed as part of the artwork for the UV styles, engraved once on the front of the base for the laser styles); LED colour
Tool: UV flatbed printer (UV-print styles)
Tool: CO2 laser cutter (panel cut; engraving or scoring for the laser styles)
Tool: CNC router or FFF 3D printer (LED base)
```

Manufacturing notes before:

```text
Prepare full-color UV artwork for clear acrylic, keep important details away from the circular cut edge, contour-cut or polish the panel, and fit it into the selected LED base. Confirm final text, lighting color, proof approval, and customer image rights before production.
```

Proposed manufacturing notes:

```text
UV-print styles (Rectangular UV print, Round UV print): the manufacturing PNG is the print file. It is printed in full colour across the whole panel, edge to edge, exactly as supplied; for the round style only the circle is the product, the white area outside it is not printed. Any customer text is already part of the artwork; the base stays plain. Scale the file to the ordered panel size on the master, cut the panel, print, polish the edges.

Laser styles (Contour laser engraved, Contour laser stroked): the fill SVG holds the black-on-white line art, the stroke SVG the same lines as hairlines. Engraved: raster-engrave the fill layer. Stroked: score the stroke layer at low power, one pass, same weight everywhere. No artwork width is set on these styles, so the SVG opens in pixels: scale the artwork to the ordered panel size and write the width used on the job ticket. The file does not contain the outline; cut along the artwork's outer silhouette with a small even margin and a straight bottom edge for the base slot, in the same setup as the engraving. Customer text, if any, is engraved once on the front face of the base, centred, one line, never on the acrylic.

Before production check the text against the order and test the ordered LED colour in the base. Power and speed from the test strip of the current acrylic batch.
```

### Personalized Acrylic LED Night Light (`01-personalized-acrylic-led-night-light`)

- Id: `59e268ce-b551-4707-a235-17c9aaed700f`
- Family: Night lights (July 2026 items, draft); status on 2026-10-16: draft
- Styles: Rectangular UV print, Round UV print, Contour laser engraved, Contour laser stroked
- Same text as `02-round-uv-print-acrylic-night-light` (same four styles).

Characteristics before:

```text
(empty)
```

Proposed characteristics:

```text
Material: clear acrylic panel: rectangular or round for the UV-print styles, contour-cut to the artwork's silhouette for the laser styles (thickness per the workshop master)
Finish: UV-print styles full-colour print edge to edge; laser styles line art raster-engraved (Contour laser engraved) or scored as hairlines (Contour laser stroked); cut edges cleaned and polished
Hardware: beech LED base (rectangular bar for the rectangular print, cylinder for the round print, oval with a slot for the laser styles), USB cable, LED module in the ordered colour
Personalization: one photo; optional text (printed as part of the artwork for the UV styles, engraved once on the front of the base for the laser styles); LED colour
Tool: UV flatbed printer (UV-print styles)
Tool: CO2 laser cutter (panel cut; engraving or scoring for the laser styles)
Tool: CNC router or FFF 3D printer (LED base)
```

Manufacturing notes before:

```text
Prepare clean vector linework or UV-print artwork, engrave and contour-cut the clear acrylic, finish exposed edges, and fit the panel into a routed or printed LED base. Confirm final dimensions, lighting color, base text, and artwork rights before production. Portrait orders require a customer proof.
```

Proposed manufacturing notes:

```text
UV-print styles (Rectangular UV print, Round UV print): the manufacturing PNG is the print file. It is printed in full colour across the whole panel, edge to edge, exactly as supplied; for the round style only the circle is the product, the white area outside it is not printed. Any customer text is already part of the artwork; the base stays plain. Scale the file to the ordered panel size on the master, cut the panel, print, polish the edges.

Laser styles (Contour laser engraved, Contour laser stroked): the fill SVG holds the black-on-white line art, the stroke SVG the same lines as hairlines. Engraved: raster-engrave the fill layer. Stroked: score the stroke layer at low power, one pass, same weight everywhere. No artwork width is set on these styles, so the SVG opens in pixels: scale the artwork to the ordered panel size and write the width used on the job ticket. The file does not contain the outline; cut along the artwork's outer silhouette with a small even margin and a straight bottom edge for the base slot, in the same setup as the engraving. Customer text, if any, is engraved once on the front face of the base, centred, one line, never on the acrylic.

Before production check the text against the order and test the ordered LED colour in the base. Power and speed from the test strip of the current acrylic batch.
```

## Open questions (answers change the text above)

1. July night lights (`01`, `02`, `03`): acrylic thickness and how the LED bases are made (routed, printed, bought in). The text says "per the workshop master".
2. Game cards and the our-story plaque: no finish is specified in the requirement docs; the text says "no coating specified". Confirm whether the workshop oils or lacquers them.
3. Item `02-round-uv-print-acrylic-night-light` is linked to all four night-light styles, including the two contour laser styles; if that is unintended, unlink them in the admin item form (not part of this change).

## Follow-ups

- Set `artwork_width_mm` on the four original night-light styles once the panel master is fixed, so their traced SVGs open in millimetres and the sheet stops warning about pixel units.
- Update the "Status" lines of the four October requirement docs: the items are published, not drafts.
- Replace "per the workshop master" and "no coating specified" with the confirmed facts once the questions above are answered.
