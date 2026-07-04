---
name: print-with-xt-3202
description: Plan, assess, and prepare eco solvent printing jobs for the Wide-format eco-solvent printer XT-3202, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Wide-format eco-solvent printer XT-3202

## Operating stance

Treat this machine as a quoted candidate, not as confirmed installed or commissioned. Treat quoted or user-provided values as planning evidence, not permission to invent missing capacity, tooling, parameters, certifications, or safety procedures. Require a trained operator and the applicable shop SOP before physical operation.

## Workflow

1. Collect the job inputs: material and grade, stock dimensions, final geometry, tolerances, quantity, finish, source files, and acceptance criteria.
2. Compare the request with the supported materials, operations, work envelope, and hard limits below. Mark the result **feasible**, **conditionally feasible**, or **not feasible**.
3. Stop at any unknown that controls safety or feasibility. Request the exact manual, tooling inventory, parameter chart, or measured test named under **Evidence gaps**.
4. Apply every design rule. Explain required geometry or artwork changes and preserve the user's intent.
5. Prepare the input file or operator handoff using only the listed formats and software. Never fabricate machine code or production parameters without a verified postprocessor, profile, or procedure.
6. Specify setup, a representative test coupon or first article, inspection points, and pass/fail criteria before batch work.
7. Put safety controls before production steps. Do not reduce guarding, extraction, fire controls, PPE, or operator qualification to improve throughput.

## Machine profile

- Tool ID: `eco_solvent_printer_xt_3202`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Eco Solvent Printing / Finishing
- Status: Quoted Candidate
- Materials: vinyl; banner; backlit film; adhesive media; photo paper
- Operations: roll-to-roll printing; large-format graphics; decals before contour cutting
- Work envelope: X 3200 mm, width 3200 mm. Quoted maximum print width is 3200 mm. Confidence: quoted.
- Power: Not specified.
- Accepted inputs: PDF; TIFF; JPEG; PNG; EPS
- Software or controller: Maintop RIP

## Hard limits

- Prints graphics; does not cut or shape material.
- Outdoor durability depends on ink, media, lamination, and UV exposure.
- Color accuracy requires ICC profiles and calibration.

## Design rules

- Prepare files in CMYK where possible.
- Use sufficient bleed for trimmed graphics.
- Keep text and fine details above media/resolution limits.
- Pair with plotter or laser only when material is safe for that process.

## Setup and safety

- Setup: Epson i3200 printheads; Maintop RIP setup; media profile; drying/curing time
- Safety: ventilation for eco-solvent inks; PPE for ink handling

## Suitability

- Prefer for: signage; stickers; wall graphics; printed product surfaces
- Avoid for: direct rigid-object printing; food-contact decoration without certified materials

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: XT-3202 printer manual; Epson i3200 printhead datasheet; Maintop RIP user guide
- Missing: ink compatibility list; ICC profiles; maintenance schedule
- Source note: Quote lists two Epson i3200 printheads, dimensions 4715x1050x1440 mm, weight 550 kg, 220 V 50 Hz.

## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
