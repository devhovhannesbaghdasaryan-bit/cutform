---
name: night-light-preview
description: Rendering rules for a personalized contour-cut acrylic LED night light preview generated from a customer photo and a product template image. Injected verbatim into the image-generation request, so it contains only rendering facts, no workflow steps.
---

# Night-light preview: rendering rules

## What the attached images are
- The CUSTOMER PHOTO (attached first) is the only source of the artwork. Who is shown, how many people, their poses, relative positions, faces, hair and clothing all come from it. Nothing else from the photo (its background, street, trees, furniture) belongs on the lamp.
- The PRODUCT TEMPLATE (attached last) fixes the construction of the lamp only. The artwork engraved on its panel is a placeholder sample from another order: its people, their number, pose, composition and panel outline must never appear in the result.
- When the two images disagree about the subject, the customer photo always wins.

## Subject fidelity (highest priority)
- The number of people on the lamp equals the number of people in the customer photo. One person in the photo means exactly one person on the lamp, even if the template shows a couple or a group.
- Never add a partner, child, pet or second figure; never duplicate or mirror the subject; never remove anyone.
- The engraving is as similar to the customer photo as the engraved style allows: same pose and gesture, same facial features and expression, same hairstyle, same clothing, same body framing (a half-length photo stays half-length).
- Only the rendering style changes (photo to engraved lines). Identity, count and composition do not.

## Product construction (from the product template)
- A clear acrylic panel, cut along the outer silhouette of the customer photo's subject with a small even margin, standing upright. The panel outline follows the customer's subject, not the template's outline.
- An oval light-wood (beech) base with a slot the panel sits in, and a thin white USB cable leaving the base on the right.
- The base's LED edge-lights the panel: engraved marks glow warm amber; clear, unengraved acrylic stays transparent with only faint edge highlights.

## Artwork treatment (default; a directive may override this section only)
- The artwork is laser line art: single uniform stroke weight, monochrome, glowing amber.
- It is never a photo print. Forbidden: photographic tones, sepia or grayscale shading, gradients, halftone, colour fills, painterly rendering.
- Lines trace the real edges of the customer photo: silhouette, hair mass, facial features, hands, main clothing folds, seams and pockets. No invented details, accessories, hairstyles or scenery.

## Scene and framing
- Photorealistic product photo of the lit lamp on a wooden desk, warm ambient light, softly blurred interior behind it, lamp centred and fully in frame.
- Do not show the customer's photo anywhere in the image (no inset, no collage). Only the lamp is shown.

## Text
- If personalized text is provided, laser-engrave it once on the front face of the wooden base: centred horizontally, a single line, dark burnt-brown lettering cut into the wood grain, sized to fit the base with even margins.
- The text is engraved wood, so it does not glow and is never placed on the acrylic panel.
- Without personalized text the base stays plain wood.
- No other text, logos, labels or watermarks anywhere in the image.

## Self-check before finishing
1. The lamp shows exactly as many people as the customer photo, and nobody from the product template.
2. Same people, same pose as the customer photo, reduced to engraved lines, faces still recognizable.
3. Construction matches the product template: clear panel cut to the customer subject's contour, oval wooden base, white cable on the right.
4. No photographic or shaded rendering on the panel; only glowing lines on clear acrylic.
5. Only the requested text, engraved once on the wooden base, not on the panel; nothing else written.
