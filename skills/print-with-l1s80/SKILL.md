---
name: print-with-l1s80
description: Plan, assess, and prepare additive fff jobs for the Large-format FFF 3D printer L1S80, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Large-format FFF 3D printer L1S80

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

- Tool ID: `fff_printer_l1s80`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Additive Fff / Primary Production
- Status: Quoted Candidate
- Materials: PLA; PETG; TPU; ABS if enclosed/heated conditions are verified
- Operations: single-material FFF printing; large prototype printing; jigs and fixtures
- Work envelope: X 800 mm, Y 800 mm, Z 100 mm. Quote says 800x800x100; verify whether Z is 100 or 1000 mm before production planning. Confidence: quoted.
- Power: 600 W; confidence: quoted.
- Accepted inputs: STL; 3MF; OBJ; G-code
- Software or controller: slicer TBD

## Hard limits

- 0.4 mm quoted nozzle.
- Quoted layer height range is 0.16-0.6 mm.
- Large flat prints can warp without enclosure, bed adhesion, and material controls.

## Design rules

- Use wall thickness at least 2-3 nozzle widths.
- Avoid unsupported overhangs above roughly 45 degrees unless supports are acceptable.
- Split very large parts into keyed sections if tolerance or warping risk is high.
- Use fillets and ribs instead of thick solid masses.

## Setup and safety

- Setup: slicer profile; filament drying; bed leveling; test coupon
- Safety: ventilation for ABS/ASA; thermal runaway checks; fire-safe operating area

## Suitability

- Prefer for: large prototypes; patterns; fixtures; display objects
- Avoid for: tight high-temperature engineering parts without verified enclosure; transparent optical parts

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: L1S80 printer manual; slicer profile; material profiles
- Missing: confirmed build volume; firmware and slicer compatibility


## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
