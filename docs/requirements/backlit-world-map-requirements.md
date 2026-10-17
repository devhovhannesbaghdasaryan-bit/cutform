# Backlit wooden world map requirements

Date: 2026-10-14. Status: created in the production database as one hidden
draft item; not yet published. Not customizable: no personalization tags,
styles, prompts or skill.

## Scope

A standard catalog item in `decorations` / `wood-fixtures`, built from one
reference image Hovhannes supplied: a multi-piece wooden world map with warm
LED backlighting. Sold in fixed sizes, no per-order artwork.

## Reference product analysis

Reference image: the item's hero in `catalog-assets`
(`decorations/16-backlit-wooden-world-map/assets/hero-1.jpg`); it is not a
product photo of ours and must be replaced before publishing.

**Backlit world map.** Continents and larger islands laser-cut from plywood
stained dark walnut (Greenland in a lighter natural tone), country names and
borders engraved, each piece mounted on wall spacers with warm-white LED
strip behind the main land masses so the light glows around every
coastline. Typical kit: pieces, spacers, screws, a paper placement template
and a 12 V adapter with an inline switch.

## Catalog placement (live database)

Created directly in the production Supabase project on 2026-10-14 in one
atomic statement (item, translations, SEO, media, market rules).

| Row | Value |
| --- | --- |
| Category `decorations` / subcategory `wood-fixtures` (existing) | `aed9dced-7f7c-4024-bb31-d6984ba3469b` / `4f456447-3183-4e13-a3b0-0f47714c8901` |
| Item `16-backlit-wooden-world-map` | `f2d144ee-5183-4219-a189-21afe199199a` |
| Hero and primary media (`catalog-assets`) | `decorations/16-backlit-wooden-world-map/assets/hero-1.jpg` |

Item: status `draft`, `item_type: decoration`, not customizable, no tags,
popular flag set, EN/RU/AM translations and SEO rows (marked AI-generated,
not admin-reviewed, within the admin form limits), a flat 3,000 AMD
shipping rule for all five regions, three sizes (Medium 1500 × 900,
Large 2000 × 1200, XL 2500 × 1500 mm, 6 mm plywood).

**Price is a placeholder: 120,000 AMD.** Hovhannes did not give one; it was
set from the Medium size against the other wood fixtures (wine rack 35,000,
cat shelves 40,000, learning tower 60,000 AMD) and must be confirmed with
the workshop cost sheet, including the LED kit, before publishing. Sizes
carry no separate prices; if the larger sizes need their own, that is a
catalog follow-up.

## Production handoff (operator)

1. Cut the continents and islands from 6 mm birch plywood with the
   world-map master for the ordered size, engrave country names and borders.
2. Sand, stain dark walnut (Greenland left natural), matte lacquer.
3. Fix LED strip segments on spacers behind the main land masses, wire to the
   12 V adapter with the inline switch, test.
4. Pack with the paper placement template, spacers and screws.

## Remaining steps to go live

1. Confirm the price and the three sizes with the workshop.
2. In the admin item form: review the RU/AM copy, replace the hero with our
   own photo, then publish.

## Follow-ups

- Per-size pricing once the catalog supports it.
- A personalized variant (engraved names or a pinned "places we have been"
  legend) as a separate customizable item.
- Alternative finishes (natural birch, oak veneer) as sizes or a second item.
