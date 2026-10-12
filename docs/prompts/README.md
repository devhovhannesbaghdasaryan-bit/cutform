# Night-light generation prompts

Source of truth for the night-light prompt content stored in the database and
in the private `uploads` bucket. Edit here first, then apply the change through
the admin UI (or SQL) so the repo and the live data stay in sync.

## Two-step generation

For a style with a **manufacturing prompt**, customer generation in
`app/personalize/actions.ts` runs two image calls per selected style:

1. **Manufacturing PNG.** Input: the style's manufacturing prompt and the
   customer photo only. Output: the production file (print image or engraving
   line drawing). Stored on the preview option as `manufacturing_file_path`.
   Engraving styles also get an SVG traced from it automatically.
2. **Preview.** Input: the item's skill document, the item's system prompt,
   the style's preview instruction, the customer's text and colour, then the
   manufacturing PNG (labelled MANUFACTURING ARTWORK) and the style's template
   image (labelled PRODUCT TEMPLATE). The customer photo is deliberately not
   sent, so the preview can only show the artwork that will be produced.

Customer text reaches the manufacturing PNG only through placeholders:
`{{#text}}…{{/text}}` is kept only when text was entered, and inside it
`{{text}}` is the exact text and `{{textStyle}}` the chosen styling. A style
that produces its text elsewhere (e.g. engraved on the wooden base) leaves the
placeholders out, so the text appears only in the preview step.

## Files and where they live

| File | Database field | Used in step |
| --- | --- | --- |
| `boilerplates/<style>.manufacturing.txt` | `personalization_boilerplates.manufacturing_prompt` | 1 |
| `boilerplates/<style>.preview.txt` | `personalization_boilerplates.generation_instruction` | 2 |
| `items/night-light.system-prompt.txt` | `catalog_items.system_prompt` of every night-light item | 2 |
| `skills/night-light-preview/SKILL.md` | skill of *Personalized Acrylic LED Night Light* (`catalog_items.skill_id` / `skill_path`) | 2 |
| `skills/contour-night-light-preview/SKILL.md` | skill of *Contour Laser Engraved Acrylic Night Light* | 2 |

Styles: `rectangular-uv-print` (Rectangular UV print), `round-uv-print`
(Round UV print), `contour-laser-engraved` (Contour laser engraved).

The system prompt and skills are shared by every style attached to an item, so
they stay style-agnostic; anything specific to one style belongs in that
style's two files.
