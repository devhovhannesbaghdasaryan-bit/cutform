---
name: cut-with-3kw-fiber-laser
description: Plan, assess, and prepare fiber laser cutting jobs for the Fiber metal laser cutter with pipe cutter, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Fiber metal laser cutter with pipe cutter

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

- Tool ID: `fiber_metal_cutter_3kw_pipe`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Fiber Laser Cutting / Primary Production
- Status: Available
- Materials: mild steel; stainless steel; aluminum; galvanized steel; brass/copper if source and optics allow
- Operations: sheet metal laser cutting; pipe/tube laser cutting; engraved marking; piercing
- Work envelope: No numeric dimensions confirmed. User provided 3 kW source and pipe-cutter capability, but sheet bed and pipe diameter/length are unknown. Confidence: needs_manual.
- Power: 3000 W fiber laser; confidence: confirmed.
- Accepted inputs: DXF; DWG; STEP via nesting/CAM; tube profile files via CAM
- Software or controller: fiber laser nesting/CAM TBD

## Hard limits

- Maximum sheet size, thickness chart, and pipe diameter are unknown.
- Cut thickness depends on material, assist gas, lens, nozzle, and required edge quality.
- Reflective metals need source/head compatibility verification.

## Design rules

- Use closed clean DXF contours with no duplicate lines.
- Set minimum hole diameter based on material thickness and cut quality.
- Avoid tiny tabs or narrow bridges that overheat.
- For pipe cutting, define profile, diameter, wall thickness, rotation datum, and seam location.

## Setup and safety

- Setup: nesting software; assist gas; nozzle/lens selection; focus calibration; pierce test
- Safety: Class 4 laser safety; fume extraction; assist gas safety; fire control; eye protection for service work

## Suitability

- Prefer for: metal signs; brackets; flat sheet assemblies; tube frames; decorative metal panels
- Avoid for: nonmetal materials; thick plate beyond 3 kW capacity; unknown coated metals without fume review

## Evidence gaps

- Manual search status: not_searched
- Seek: exact fiber laser cutter manual; laser source manual; cutting head manual; tube chuck/manual; material thickness chart
- Missing: exact model; bed size; pipe diameter/length capacity; assist gas setup; source brand


## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
