---
name: cut-with-co2-laser
description: Plan, assess, and prepare laser cutting jobs for the CO2 laser cutter, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# CO2 laser cutter

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

- Tool ID: `co2_laser_100w_1300_900`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Laser Cutting / Primary Production
- Status: Available
- Materials: plywood up to 10 mm; MDF; acrylic; paper; cardboard; leather if safe/verified
- Operations: 2D cutting; engraving; scoring; kerf-based joinery
- Work envelope: X 1300 mm, Y 900 mm, width 1300 mm, length 900 mm. User-provided bed size is 1300x900 mm. Confidence: confirmed.
- Power: 100 W CO2 laser tube; confidence: confirmed.
- Accepted inputs: SVG; DXF; PDF; AI/EPS via laser software
- Software or controller: LightBurn/RDWorks or controller software TBD

## Hard limits

- User-provided plywood cutting limit is 10 mm.
- Cannot cut metals.
- PVC/vinyl/chlorinated plastics are prohibited.
- Kerf and char vary by material batch and lens/focus condition.

## Design rules

- Use closed vector paths for cuts.
- Separate cut, score, and engrave layers by color/name.
- Measure kerf before tab-slot products.
- Avoid thin bridges below roughly 2x material thickness unless tested.
- Add dogbones only when parts will later be CNC-routed; laser internal corners can be sharp.

## Setup and safety

- Setup: material focus; air assist; exhaust; power/speed test grid; kerf test
- Safety: exhaust; fire watch; laser-safe enclosure; no PVC/vinyl; CO2 extinguisher nearby

## Suitability

- Prefer for: wooden constructors; acrylic night lights; packaging prototypes; decorations; templates
- Avoid for: thick hardwood; metal cutting; load-bearing furniture joints without testing

## Evidence gaps

- Manual search status: not_searched
- Seek: exact CO2 laser controller manual; laser tube manual; chiller manual; material parameter library
- Missing: exact model; controller type; lens/focal length; chiller model


## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
