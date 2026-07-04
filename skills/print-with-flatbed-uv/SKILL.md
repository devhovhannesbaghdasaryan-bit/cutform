---
name: print-with-flatbed-uv
description: Plan, assess, and prepare uv printing jobs for the Flatbed UV printer, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Flatbed UV printer

## Operating stance

Treat this machine as user-confirmed available, while preserving every stated unknown. Treat quoted or user-provided values as planning evidence, not permission to invent missing capacity, tooling, parameters, certifications, or safety procedures. Require a trained operator and the applicable shop SOP before physical operation.

## Workflow

1. Collect the job inputs: material and grade, stock dimensions, final geometry, tolerances, quantity, finish, source files, and acceptance criteria.
2. Compare the request with the supported materials, operations, work envelope, and hard limits below. Mark the result **feasible**, **conditionally feasible**, or **not feasible**.
3. Stop at any unknown that controls safety or feasibility. Request the exact manual, tooling inventory, parameter chart, or measured test named under **Evidence gaps**.
4. Apply every design rule. Explain required geometry or artwork changes and preserve the user's intent.
5. Prepare the input file or operator handoff using only the listed formats and software. Never fabricate machine code or production parameters without a verified postprocessor, profile, or procedure.
6. Specify setup, a representative test coupon or first article, inspection points, and pass/fail criteria before batch work.
7. Put safety controls before production steps. Do not reduce guarding, extraction, fire controls, PPE, or operator qualification to improve throughput.

## Machine profile

- Tool ID: `uv_printer_2500_1300`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Uv Printing / Finishing
- Status: Available
- Materials: acrylic; wood; glass; metal; PVC; foam board; ceramic tile; leather if ink-compatible
- Operations: direct-to-object printing; white ink underbase; varnish/clear coat if equipped; full-color surface graphics
- Work envelope: X 2500 mm, Y 1300 mm, width 2500 mm, length 1300 mm. User-provided bed size is 2500x1300 mm; printable object height must be verified. Confidence: confirmed.
- Power: Not specified.
- Accepted inputs: PDF; TIFF; PNG; JPEG; AI/EPS via RIP
- Software or controller: UV printer RIP TBD

## Hard limits

- Print adhesion depends on material pretreatment and ink compatibility.
- Does not cut, engrave, or form material.
- Maximum object height and white/varnish channel support are not yet known.

## Design rules

- Use bleed and registration marks for printed parts that will be CNC/laser cut later.
- Prepare white ink masks for dark/clear substrates.
- Keep critical graphics away from cut edges unless registration is proven.
- Run adhesion tests for each material.

## Setup and safety

- Setup: RIP profile; material jig; surface cleaning/primer; test print
- Safety: UV light guarding; ink PPE; ventilation

## Suitability

- Prefer for: printed acrylic signs; custom panels; decorated wood products; branded product surfaces
- Avoid for: deep textured surfaces; flexible products without tested ink; food-contact surfaces without certified ink

## Evidence gaps

- Manual search status: not_searched
- Seek: UV printer model manual; RIP manual; ink datasheets; primer datasheets
- Missing: exact model; ink set; printhead model; maximum object height


## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
