---
name: print-with-t1-100
description: Plan, assess, and prepare additive fff jobs for the Very-large-format FFF 3D printer T1-100, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Very-large-format FFF 3D printer T1-100

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

- Tool ID: `fff_printer_t1_100`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Additive Fff / Primary Production
- Status: Quoted Candidate
- Materials: PLA; PETG; TPU; ABS/ASA if enclosure is verified
- Operations: large-format FFF printing; full-scale prototypes; molds/patterns
- Work envelope: X 1000 mm, Y 1000 mm, Z 1000 mm. Quoted working area is 1000x1000x1000 mm. Confidence: quoted.
- Power: 900 W; confidence: quoted.
- Accepted inputs: STL; 3MF; OBJ; G-code
- Software or controller: slicer TBD

## Hard limits

- Quoted nozzles: 0.4, 0.6, 0.8 mm.
- Quoted print speed is 150 mm/s.
- Large prints can take days and need monitored thermal/fire risk controls.

## Design rules

- Prefer modular splits for parts with tight tolerances.
- Use thicker walls and larger radii than small-format FFF.
- Design hidden alignment pins or lap joints for assembled sections.
- Run scaled test coupons before full-size production.

## Setup and safety

- Setup: large-format slicer profile; filament drying; adhesion plan; print monitoring
- Safety: ventilation; fire-safe area; overnight monitoring policy

## Suitability

- Prefer for: large display parts; furniture prototypes; molds; signage forms
- Avoid for: high-precision mechanical assemblies in one piece; thin tall parts without bracing

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: T1-100 printer manual; firmware guide; slicer profile
- Missing: material compatibility; bed temperature; enclosure specification


## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
