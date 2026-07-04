---
name: cut-with-t48a
description: Plan, assess, and prepare vinyl cutting jobs for the Plotter cutting machine T48A, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Plotter cutting machine T48A

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

- Tool ID: `plotter_t48a`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Vinyl Cutting / Finishing
- Status: Quoted Candidate
- Materials: vinyl film; heat-transfer vinyl; paper; masking film; thin adhesive sheet
- Operations: kiss cutting; through cutting thin films; contour cutting if optical registration exists
- Work envelope: X 1200 mm, width 1200 mm. Quoted working field is 1200 mm. Confidence: quoted.
- Power: Not specified.
- Accepted inputs: SVG; DXF; AI/EPS via cutting software
- Software or controller: cutting software TBD

## Hard limits

- Cuts thin flexible sheet/film, not rigid panels.
- Tiny islands and sharp details are difficult to weed.
- Contour cutting needs registration workflow verification.

## Design rules

- Avoid hairline strokes; convert artwork to closed paths.
- Keep small text large enough for weeding.
- Add registration marks for print-and-cut jobs.
- Use material-specific blade depth and pressure.

## Setup and safety

- Setup: blade selection; cut pressure/speed test; mat or roll feed setup
- Safety: blade handling; pinch roller awareness

## Suitability

- Prefer for: stickers; stencils; heat-transfer graphics; masking for paint/etch
- Avoid for: thick cardboard; rigid acrylic; complex tiny lettering

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: T48A plotter manual; supported cutting software manual
- Missing: blade holder type; optical registration support
- Source note: Quote lists average cutting speed as 100 square meters/hour and 220 V, 50 Hz.

## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
