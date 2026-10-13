---
name: night-light-preview
description: Rendering rules for the customer preview of a personalized acrylic LED night light, rendered from the order's manufacturing artwork and the selected style's product template. Injected verbatim into the image-generation request, so it contains only rendering facts, no workflow steps.
---

# Night-light preview: rendering rules

## What the attached images are
- MANUFACTURING ARTWORK: the exact production file of this order (a full-colour print image or a black-on-white engraving drawing), already generated from the customer's photo. It is the only source of the artwork. The finished lamp carries exactly this artwork, so the preview must too.
- PRODUCT TEMPLATE: an example lamp of the selected style. It fixes construction only: panel shape, base, cable and lighting. Its sample artwork is a placeholder from another order and never appears in the result.

## Fidelity to the manufacturing artwork (highest priority)
- Same subjects and the same number of them, same faces, poses, crop, proportions and position on the panel.
- No redrawing, restyling, beautifying, simplifying, recolouring or extending of the artwork.
- No added decorations (moons, stars, hearts, flourishes), dates, names, scenery or people.
- Text that is part of the artwork appears exactly once, exactly as in the artwork.

## Construction
- One preview per style: follow only the selected style instruction and its template. Never merge shapes, bases or constructions from different styles.
- UV-printed styles: the artwork is printed in full colour across the whole panel.
- Laser-engraved styles: black lines become glowing engraved lines on clear acrylic, white areas are clear acrylic, and the panel is cut to the artwork's outer silhouette.

## Light
- Supported LED colours: warm white #f7d7a1 (default), soft amber #f4bf73, soft peach #f5b49f, mint #a8dbc2, sky blue #9fcaea.
- Soft, comfortable glow in the requested colour only: no harsh glare, lens flares or other colours.

## Personalized text
- Reproduced character-for-character: never translated, corrected, reworded or hyphenated; break lines only at existing spaces; shrink to fit, never truncate.
- Placed only where the selected style says (inside the printed artwork, or engraved on the wooden base), and never twice.

## Scene
- Photorealistic photo of the lit lamp on a nightstand or desk in a cozy, slightly dim room with a softly blurred background; lamp centred and fully in frame.
- Never show the customer photo or the artwork file as an inset, collage or second image. No logos, labels or watermarks.

## Self-check before finishing
1. The panel shows the manufacturing artwork unchanged in content, crop and placement.
2. Construction matches the selected style's template and nothing else.
3. Personalized text appears once, verbatim, where the style defines.
4. No inset, no extra text, no added decoration.
