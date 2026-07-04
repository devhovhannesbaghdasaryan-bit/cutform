---
name: cut-with-hx-260g
description: Plan, assess, and prepare band saw cutting jobs for the Metal band saw HX-260G, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Metal band saw HX-260G

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

- Tool ID: `band_saw_hx_260g`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Band Saw Cutting / Support
- Status: Quoted Candidate
- Materials: steel tube; aluminum tube; solid bar; rectangular tube; round pipe
- Operations: 90 degree cuts; 45 degree miter cuts; stock preparation
- Work envelope: width 260 mm, height 200 mm, diameter 227 mm. Quoted 90 degree capacity: round 227 mm, rectangular 260x200 mm. Quoted 45 degree capacity: round 150 mm, rectangular 150x125 mm. Confidence: quoted.
- Power: 1.5 kW; confidence: quoted.
- Accepted inputs: cut list
- Software or controller: None specified

## Hard limits

- Cut quality depends on blade pitch, feed, coolant, and clamping.
- Not a precision finishing process for final mating surfaces.
- Miter capacity is lower than 90 degree capacity.

## Design rules

- Generate cut lists with material, profile, length, angle, and quantity.
- Include kerf allowance and trim allowance.
- Deburr and square critical faces after cutting if needed.

## Setup and safety

- Setup: correct blade; vise/clamping; coolant; stop block for repeated cuts
- Safety: eye protection; blade guard; clamping before cut; chip handling

## Suitability

- Prefer for: frame stock prep; tube cuts before welding; bar stock cutting
- Avoid for: intricate profiles; sheet cutting; finished decorative edges

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: HX-260G band saw manual; blade selection guide
- Missing: blade sizes; speed settings; coolant requirements
- Source note: Quote lists 380 V, 50 Hz.

## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
