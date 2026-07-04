---
name: weld-with-hlw-3000
description: Plan, assess, and prepare laser welding jobs for the Handheld laser welding system HLW-3000, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Handheld laser welding system HLW-3000

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

- Tool ID: `laser_welder_hlw_3000`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Laser Welding / Primary Production
- Status: Quoted Candidate
- Materials: mild steel; stainless steel; aluminum; galvanized steel
- Operations: laser welding; thin cutting; rust removal; spot welding
- Work envelope: Not specified.
- Power: 3000 W laser source; confidence: quoted.
- Accepted inputs: operator parameters; welding procedure
- Software or controller: Super control panel

## Hard limits

- Manual process quality depends heavily on joint fit-up and operator skill.
- Quoted filler wire range is 0.8-1.6 mm.
- Reflective metals require verified parameters and safe optics setup.

## Design rules

- Prefer lap, corner, and butt joints with tight gaps.
- Specify material grade and thickness before selecting power/speed.
- Avoid inaccessible seams and joints that cannot be shielded or clamped.
- Add fixtures for repeatable production welds.

## Setup and safety

- Setup: Raycus 3000 W source; Super 23T gun; Hanli chiller; wire feeder; shielding gas
- Safety: Class 4 laser enclosure or controlled area; laser eyewear rated for wavelength/power; fume extraction; fire watch

## Suitability

- Prefer for: stainless frames; sheet metal assemblies; decorative metal products; thin-gauge production welds
- Avoid for: poorly fitted joints; unknown coated metals; structural welds without qualification

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: HLW-3000 OEM manual; Raycus 3000 W laser source manual; Super 23T welding head manual; Hanli chiller manual
- Missing: welding parameter chart by material/thickness; laser safety SOP
- Source note: Quote lists 220 V, 50 Hz input.

## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
