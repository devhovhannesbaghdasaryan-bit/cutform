# Tool Capability Schema

Date: 2026-06-15

Canonical implementation: `lib/manufacturing-schema.ts`

Seed data: `docs/manufacturing/tools.json`

## Purpose

The schema gives the AI a shop-aware map of what can be made physically. RAG
should enrich this with manuals and shop notes, but the structured schema should
remain the source of truth for machine selection and hard manufacturability
checks.

## Core Concepts

- `process`: manufacturing process, such as `laser_cutting`, `cnc_routing`, or
  `additive_fff`.
- `workEnvelope`: maximum usable work area or profile capacity.
- `hardLimits`: constraints that should block or force review.
- `designRules`: practical rules the AI should apply while creating or checking
  designs.
- `setupRequirements`: what must exist before a job reaches the operator.
- `rag`: manual/source status and tags for retrieval.
- `confidence`: whether the value is confirmed, quoted, assumed, or still needs
  a manual.

## First System Behavior

When a user asks to make a product:

1. Parse the product into material, size, quantity, finish, and functional needs.
2. Select candidate tools from `tools.json`.
3. Reject tools whose hard limits conflict with the request.
4. Ask only for missing values that change the tool choice or safety.
5. Return a production path with `pass`, `review_required`, or `fail`.

## Minimum Data Still Needed

- Exact model and controller for the UV printer.
- Exact model and controller for the CO2 laser.
- Exact model, bed size, source brand, cutting head, and pipe capacity for the
  3 kW fiber metal cutter.
- Actual material inventory and measured thicknesses.
- Shop-tested kerf, feeds/speeds, laser settings, print profiles, and bend
  deductions.
- Tooling inventory: router bits, press brake punches/dies, tube-bender rollers,
  laser lenses/nozzles.
