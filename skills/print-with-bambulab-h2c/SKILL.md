---
name: print-with-bambulab-h2c
description: Plan, assess, and prepare additive fff jobs for the Bambu Lab H2C 3D printer BambuLab H2C, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Bambu Lab H2C 3D printer BambuLab H2C

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

- Tool ID: `fff_printer_bambulab_h2c`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Additive Fff / Primary Production
- Status: Quoted Candidate
- Materials: PLA; PETG; TPU; ABS; ASA; PA; PC; fiber-filled filaments if nozzle/hotend is compatible
- Operations: multi-material FFF printing; multi-color FFF printing; production prototyping; small-batch parts
- Work envelope: X 305 mm, Y 320 mm, Z 325 mm. Quote lists 305x320x325 mm. Public sources describe H2C as a H-series toolchanger; verify exact build volume for purchased configuration. Confidence: quoted.
- Power: 1800 W; confidence: quoted.
- Accepted inputs: 3MF; STL; STEP via slicer/CAD conversion; G-code
- Software or controller: Bambu Studio; Bambu Handy; Bambu Suite if laser/cutting modules are present

## Hard limits

- Quoted nozzles: 0.2, 0.4, 0.6, 0.8 mm.
- Quoted layer height range is 0.16-0.6 mm.
- Multi-material capability depends on installed AMS/Vortek configuration.
- Functional parts still require material-specific orientation and strength review.

## Design rules

- Select nozzle size before setting minimum wall/detail rules.
- Orient load-bearing parts so layer lines do not carry primary tensile load.
- Use inserts, bosses, and generous fillets for assembled products.
- Use 3MF with material assignments for multi-color or multi-material designs.

## Setup and safety

- Setup: Bambu Studio profile; filament profiles; bed plate selection; calibration flow
- Safety: ventilation for engineering polymers; hot-surface awareness; laser safety only if laser module is installed

## Suitability

- Prefer for: multi-color prototypes; small product parts; jigs; replacement parts; complex geometry
- Avoid for: large flat panels; certified load-bearing parts without testing; food-contact parts without certified workflow

## Evidence gaps

- Manual search status: candidate_found
- Seek: Bambu Lab H2C official wiki/manual; Bambu Studio documentation; material compatibility guides
- Missing: exact purchased configuration; official H2C service manual


## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
