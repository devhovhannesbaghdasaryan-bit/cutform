---
name: collect-dust-with-xc-7500
description: Plan, assess, and prepare dust collection jobs for the Woodworking dust collector XC-7500, including feasibility, design, input preparation, setup, safety, and verification. Use when a request names this machine or model, asks whether a part or material fits its capabilities, or needs feasibility review, production planning, source-file preparation, or an operator handoff.
---

# Woodworking dust collector XC-7500

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

- Tool ID: `dust_collector_xc_7500`
- Dataset basis: `docs/manufacturing/tools.json` v0.1.0, generated 2026-06-15
- Process / role: Dust Collection / Support
- Status: Quoted Candidate
- Materials: wood dust; MDF dust; plywood dust
- Operations: dust extraction; chip collection
- Work envelope: Not specified.
- Power: Not specified.
- Accepted inputs: None specified
- Software or controller: None specified

## Hard limits

- Airflow, filtration class, and duct sizing are not listed in the quote.

## Design rules

- Treat as required support equipment for CNC routing and wood cutting.
- Validate airflow at each machine, not only motor power.
- Use antistatic ducting and fire-safe dust handling.

## Setup and safety

- Setup: ducting; blast gates; filter maintenance schedule
- Safety: respiratory dust control; spark/fire precautions; regular emptying

## Suitability

- Prefer for: CNC router dust collection; wood shop cleanup
- Avoid for: metal sparks; fine hazardous dust without certified filtration

## Evidence gaps

- Manual search status: needs_vendor_manual
- Seek: XC-7500 dust collector manual; filter datasheet
- Missing: airflow rating; filter class; duct diameter
- Source note: Quote summary also lists a separate 7.5 kW woodworking dust collector.

## Deliverable

Return a compact manufacturing handoff with: decision and rationale; confirmed inputs; assumptions and blockers; required design/file changes; setup and test plan; inspection criteria; safety controls; and documents or measurements still required. Distinguish confirmed facts from quoted claims and recommendations.
