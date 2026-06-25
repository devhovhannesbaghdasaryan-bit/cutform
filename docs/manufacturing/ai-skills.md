# Manufacturing AI Skills

Date: 2026-06-15

These are the first skills the AI should expose over `docs/manufacturing/tools.json`.
They are intentionally deterministic: use the capability database first, then use
RAG/manuals for parameter lookup and operator detail.

## 1. Product Intake

Purpose: convert a vague product idea, image, SVG, CAD file, or text prompt into a
manufacturing request.

Inputs:

- Product description
- Target material, size, quantity, finish, deadline
- Uploaded source file type: SVG, DXF, STEP, STL, 3MF, image, PDF

Output:

- Product category
- Required processes
- Unknowns to ask the user
- Candidate materials
- Manufacturing risk level

Rules:

- If material, size, or quantity is missing, mark the result as incomplete.
- If the product is child-facing, load-bearing, electrical, food-contact, or
  safety-critical, force admin/manual review.

## 2. Tool Selection

Purpose: select which machines can produce the item.

Inputs:

- Normalized product request
- Tool capability database

Output:

- Recommended tool chain
- Alternative tool chains
- Rejected tools with reasons
- Required file conversions

Example:

```text
Input: 300x200 mm acrylic night light panel with engraved portrait.
Output: CO2 laser for acrylic cut/engrave, UV printer optional for color face,
CNC router only if making a wooden base.
```

## 3. Manufacturability Check

Purpose: catch designs that look good digitally but fail physically.

Checks:

- Fits inside work envelope
- Material is supported
- Minimum feature size is realistic
- Wall thickness and tabs are strong enough
- Slots match measured material thickness
- Internal corners/tool radius are possible
- Bend reliefs and bend order are plausible
- File has clean closed vectors where required
- Safety/material bans are respected

Output:

- `pass`, `review_required`, or `fail`
- Specific warnings
- Required design changes
- Tool-specific setup notes

## 4. File Preparation

Purpose: transform design files into machine-ready manufacturing layers.

Outputs by process:

- CO2 laser: cut, score, engrave layers; kerf compensation notes.
- CNC router: CAM intent, cutter diameter assumptions, tabs, dogbones.
- UV/eco-solvent print: CMYK/RIP notes, bleed, white ink mask if needed.
- FFF 3D print: orientation, nozzle, layer height, supports, infill.
- Sheet metal: flat pattern, bend table, bend sequence, reliefs.
- Fiber laser: DXF cleanup, lead-ins, pierce points, nesting notes.
- Tube/pipe: cut list, rotation datum, bend schedule.

## 5. Quote And Production Estimate

Purpose: estimate time, cost, and production path.

Inputs:

- Selected tool chain
- Material and dimensions
- Quantity
- Setup complexity
- Finishing requirements

Output:

- Setup time
- Machine time
- Material usage
- Consumables
- Review blockers

Important: keep estimates as ranges until measured shop rates are available.

## 6. Operator Checklist

Purpose: produce a short shop-floor checklist for approved jobs.

Output sections:

- Material and file
- Machine setup
- Test cut/print/weld
- Production run
- Quality checks
- Safety checks

Rule: never output final machine parameters as authoritative unless they come
from verified machine manuals, tested shop presets, or operator-approved records.

## 7. Learning From Production

Purpose: close the loop after a physical job.

Capture:

- Actual material thickness
- Kerf/tool compensation
- Machine settings
- Failures and fixes
- Photos of result
- Time and scrap

Store this as shop-specific knowledge with higher priority than generic web docs.
