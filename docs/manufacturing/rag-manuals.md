# Manufacturing RAG And Manual Plan

Date: 2026-06-15

## What To Put In RAG

Use RAG for text-heavy references that change by machine, material, and operator
practice:

- OEM manuals
- Controller manuals
- Slicer/CAM/RIP manuals
- Material datasheets
- Tooling catalogs
- Tested shop presets
- Maintenance schedules
- Safety SOPs
- Photos and notes from real production runs

Do not rely on RAG alone for hard constraints. Work envelopes, powers, material
bans, and known limits should live in structured data first.

## Suggested Document Metadata

```json
{
  "doc_id": "bambulab-h2c-user-guide",
  "tool_ids": ["fff_printer_bambulab_h2c"],
  "document_type": "manual",
  "source_url": "<official-or-internal-document-url>",
  "source_quality": "official|vendor|community|internal",
  "version": "unknown",
  "language": "en",
  "retrieved_at": "2026-06-15",
  "chunk_tags": ["3d-printing", "bambu-lab", "maintenance"],
  "trust_level": 3
}
```

Trust levels:

- `3`: official OEM or internal tested shop preset
- `2`: vendor/distributor manual or component manufacturer document
- `1`: community note, forum post, or non-matching similar model

## Search Results And Gaps

The PDF contains several model strings that appear to be reseller/OEM names. For
those, public manual search is weak. The correct next move is to request manuals
from the supplier for the exact units, then ingest those PDFs.

| Tool | Manual status | RAG priority |
|---|---:|---|
| KCN-16025 press brake | Needs vendor manual | KCN-16025 manual, Delem DA69S manual, tooling/capacity chart |
| HLW-3000 laser welder | Needs vendor manual | HLW-3000 manual, Raycus 3000 W source manual, Super 23T head, Hanli chiller |
| XT-3202 eco-solvent printer | Needs vendor manual | XT-3202 manual, Epson i3200 datasheet, Maintop RIP guide |
| L1S80 3D printer | Needs vendor manual | machine manual, slicer profile, material presets |
| BambuLab H2C | Candidate public sources found | official Bambu wiki/manual, Bambu Studio docs, material compatibility |
| T1-100 3D printer | Needs vendor manual | machine manual, slicer profile, maintenance guide |
| T48A plotter | Needs vendor manual | plotter manual, cutting software guide |
| HX-260G band saw | Needs vendor manual | band saw manual, blade selection charts |
| RMB50 tube bender | Needs vendor manual | machine manual, roller/die catalog, minimum radius chart |
| KD2030 CNC router | Needs vendor manual | KD2030 manual, LNC/Baoyuan MW2500 controller guide, HQD spindle manual |
| XC-7500 dust collector | Needs vendor manual | dust collector manual, airflow/filter data |
| UV printer 2500x1300 | Exact model needed | UV printer manual, RIP guide, printhead/ink datasheets |
| CO2 laser 100 W 1300x900 | Exact model needed | controller manual, tube/chiller manuals, material presets |
| Fiber metal cutter 3 kW with pipe cutter | Exact model needed | cutter manual, source/head manuals, thickness chart, tube module manual |

## Public Sources Checked

- Bambu Lab H2C public coverage and specifications were found in public search
  results, including TechRadar and Bambu Lab product references surfaced through
  search. Candidate links:
  - <https://www.techradar.com/pro/bambulab-h2c-3d-printer-review>
  - <https://en.wikipedia.org/wiki/Bambu_Lab>
  Use these only as candidate references until the official manual is downloaded.
- Public searches for the exact reseller/OEM models `KCN-16025`, `HLW-3000`,
  `XT-3202`, `L1S80`, `T1-100`, `T48A`, `HX-260G`, `RMB50`, `KD2030`, and
  `XC-7500` did not return reliable exact-model manuals during this pass.

## Recommended RAG Chunking

- Chunk manuals by section heading, not fixed token size only.
- Preserve tables as Markdown or JSON rows.
- Add metadata for material, thickness, operation, alarm code, maintenance, and
  safety.
- Keep safety sections duplicated into a high-priority safety index.
- Store internal tested presets separately and rank them above public sources.

## Retrieval Policy

1. Retrieve structured tool record by `tool_id`.
2. Apply deterministic limits from `tools.json`.
3. Retrieve RAG documents only for the selected process/tool/material.
4. If RAG conflicts with structured hard limits, show a conflict and require
   human review.
5. If no exact manual exists, answer with assumptions and mark
   `review_required`.
