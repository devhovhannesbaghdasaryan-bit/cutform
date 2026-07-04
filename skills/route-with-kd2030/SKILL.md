---
name: route-with-kd2030
description: Plan, assess, and prepare cnc routing jobs for the Woodworking CNC router KD2030, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Woodworking CNC router KD2030

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

- Tool ID: `cnc_router_kd2030`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Cnc Routing / Primary Production
- Status: Quoted Candidate
- Materials: plywood; MDF; hardwood; softwood; acrylic; foam; aluminum with verified tooling
- Operations: 2.5D cutting; pocketing; drilling; engraving; relief carving
- Work envelope: X 2000 mm, Y 3000 mm, Z 300 mm. Quoted work field is 2000x3000 mm with 300 mm Z travel. Confidence: quoted.
- Power: 9 kW spindle; confidence: quoted.
- Accepted inputs: DXF; SVG for 2D via CAM; STEP; STL for relief; G-code
- Software or controller: Taiwan Baoyuan/LNC MW2500 controller; CAM software TBD

## Hard limits

- Quoted positioning accuracy is +/-0.05 mm/m.
- Inside corners are limited by cutter radius.
- Undercuts require special tooling or secondary setup.
- Workholding and dust extraction are mandatory for sheet goods.

## Design rules

- Add dogbones or T-bones for tab-slot joinery.
- Keep slot width matched to measured material thickness and cutter diameter.
- Use climb/conventional strategy appropriate to material and finish.
- Specify tabs, onion skin, or vacuum strategy for cut-through parts.

## Setup and safety

- Setup: CAM toolpath; spoilboard; dust collector; tool library; workholding plan; zeroing routine
- Safety: dust extraction; eye/hearing protection; trained operator; fire control for wood dust

## Suitability

- Prefer for: furniture; wooden constructors; signs; molds; large panels
- Avoid for: very tiny details below cutter diameter; sharp internal square pockets; thin unsupported tall features

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: KD2030 CNC router manual; LNC/Baoyuan MW2500 controller manual; HQD 9 kW spindle manual; CAM postprocessor notes
- Missing: tool inventory; vacuum/dust collection specification; postprocessor
- Source note: Quote lists rack-and-pinion X/Y, ball screw Z, 1500 W servo drives, 380 V 50 Hz, and an additional printer attachment.

## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
