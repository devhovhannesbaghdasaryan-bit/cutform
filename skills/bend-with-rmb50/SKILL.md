---
name: bend-with-rmb50
description: Plan, assess, and prepare tube bending jobs for the Tube/profile bending machine RMB50, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Tube/profile bending machine RMB50

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

- Tool ID: `tube_bender_rmb50`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Tube Bending / Primary Production
- Status: Quoted Candidate
- Materials: mild steel tube; aluminum tube; stainless tube; rectangular profile
- Operations: tube rolling; profile bending; arc forming
- Work envelope: diameter 60 mm. Quoted shaft diameter is 50 mm; quoted capacities include 40x40x3 mm rectangular tube and 60x2 mm round tube. Confidence: quoted.
- Power: 2.2 kW; confidence: quoted.
- Accepted inputs: bend schedule; template radius
- Software or controller: None specified

## Hard limits

- Minimum bend radius depends on dies/rollers and tube material.
- Springback must be measured and compensated.
- Tight bends may wrinkle or flatten without correct tooling.

## Design rules

- Specify centerline radius, profile type, wall thickness, and bend angle.
- Keep holes and weld seams away from high-deformation zones.
- Prototype one part before batch production.

## Setup and safety

- Setup: roller set; material test bend; radius template; springback compensation
- Safety: pinch point controls; trained operator; gloves appropriate for handling only

## Suitability

- Prefer for: furniture frames; guards; rounded metal product frames; sign structures
- Avoid for: sharp-corner bends; thin-wall precision tubing without mandrel tooling

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: RMB50 machine manual; roller/die catalog
- Missing: minimum radius chart; available roller inventory
- Source note: Quote lists 380 V, 50 Hz.

## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
