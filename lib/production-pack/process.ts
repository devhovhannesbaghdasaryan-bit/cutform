import toolsJson from '@/docs/manufacturing/tools.json';
import {
  manufacturingKnowledgeBaseSchema,
  type ManufacturingKnowledgeBase,
  type ManufacturingTool,
} from '@/lib/manufacturing-schema';
import type {
  ProductionProcessKey,
  TechSheetStep,
  TechSheetTool,
} from '@/lib/production-pack/types';

let knowledgeBase: ManufacturingKnowledgeBase | null = null;

function loadKnowledgeBase() {
  if (!knowledgeBase) knowledgeBase = manufacturingKnowledgeBaseSchema.parse(toolsJson);
  return knowledgeBase;
}

/** The shop's tool capability database (`docs/manufacturing/tools.json`), validated once. */
export function getManufacturingTools(): ManufacturingTool[] {
  return loadKnowledgeBase().tools;
}

export function getManufacturingDataVersion() {
  return loadKnowledgeBase().version;
}

export interface ProcessClassificationInput {
  /** `personalization_boilerplates.manufacturing_process`, free text written by the admin. */
  processDescription: string | null;
  styleName: string | null;
  productType: string | null;
  itemType: string | null;
  bannerSizeKey: string | null;
  hasEngraveSvg: boolean;
  hasCutSvg: boolean;
  /** `Tool:` and `Material:` lines of the catalog item's characteristics. */
  characteristics: string[];
}

/**
 * Decides which production process the sheet documents. The style's process
 * text is the strongest signal (the admin wrote it for exactly this purpose);
 * the product family and the traced files are fallbacks for older items.
 */
export function classifyProcess(input: ProcessClassificationInput): ProductionProcessKey {
  if (input.bannerSizeKey || input.productType === 'banner') return 'eco_solvent_printing';

  const text = `${input.processDescription ?? ''} ${input.styleName ?? ''}`.toLowerCase();
  if (text.trim()) {
    if (/\buv\b|uv-|uv print/.test(text)) return 'uv_printing';
    if (/laser/.test(text)) {
      const vector = /stroke|score|scored|vector|contour cut|line mode/.test(text);
      const raster = /engrav|raster|fill/.test(text);
      return vector && !raster ? 'laser_vector_cutting' : 'laser_raster_engraving';
    }
    if (/eco|solvent|vinyl|banner/.test(text)) return 'eco_solvent_printing';
    if (/cnc|rout|mill/.test(text)) return 'cnc_routing';
    if (/3d|fff|fdm|filament|additive/.test(text)) return 'fff_printing';
  }

  const family = `${input.productType ?? ''} ${input.itemType ?? ''}`;
  if (/night_light/.test(family)) return 'laser_raster_engraving';
  if (/laser_cut_2d/.test(family)) return 'laser_vector_cutting';

  if (input.hasEngraveSvg) return 'laser_raster_engraving';
  if (input.hasCutSvg) return 'laser_vector_cutting';

  const tools = input.characteristics.join(' ').toLowerCase();
  if (/co2|laser/.test(tools)) return 'laser_raster_engraving';
  if (/\buv\b/.test(tools)) return 'uv_printing';
  if (/fff|bambu|3d print|pla|petg/.test(tools)) return 'fff_printing';
  if (/cnc|router/.test(tools)) return 'cnc_routing';

  return 'unknown';
}

const TOOL_PROCESSES: Record<ProductionProcessKey, ManufacturingTool['process'][]> = {
  laser_raster_engraving: ['laser_cutting'],
  laser_vector_cutting: ['laser_cutting'],
  uv_printing: ['uv_printing', 'laser_cutting'],
  eco_solvent_printing: ['eco_solvent_printing', 'vinyl_cutting'],
  cnc_routing: ['cnc_routing', 'dust_collection'],
  fff_printing: ['additive_fff'],
  unknown: [],
};

export const PROCESS_NAMES: Record<ProductionProcessKey, string> = {
  laser_raster_engraving: 'CO2 laser raster engraving',
  laser_vector_cutting: 'CO2 laser contour cut and score',
  uv_printing: 'Flatbed UV print',
  eco_solvent_printing: 'Eco-solvent banner print',
  cnc_routing: 'CNC routing',
  fff_printing: 'FFF 3D printing',
  unknown: 'Process to be assigned',
};

export const PROCESS_SUMMARIES: Record<ProductionProcessKey, string> = {
  laser_raster_engraving:
    'The engrave layer is the fill SVG (the manufacturing PNG when no SVG exists): black is engraved, white stays untouched. The part outline comes from the workshop master cut file for this product; the AI file holds the artwork only.',
  laser_vector_cutting:
    'The stroke SVG carries the artwork as hairline vectors: score the inner lines at low power and cut the outer contour along the silhouette with the margin stated in the file convention. The fill SVG is the same geometry as an engrave layer when a filled look is wanted.',
  uv_printing:
    'The manufacturing PNG is the print file. Apply the colour convention from the file convention section exactly (for example solid black = no ink / clear material, white = white ink, the photo = CMYK over a white underbase).',
  eco_solvent_printing:
    'Wide-format print on flexible banner media with optional contour cutting on the plotter. Trim size, bleed, safe area and finishing are stated in the banner drawing and instructions.',
  cnc_routing:
    'Routed from sheet or solid stock on the CNC router. Vectors come from the master cut file; the AI artwork, when present, is an engrave or pocket layer aligned to it.',
  fff_printing:
    'Printed on an FFF printer from the product model. Material, orientation and infill follow the catalog notes; personalization is embossed or printed as a separate colour where the model supports it.',
  unknown:
    'No production process is recorded for this item. Assign the process from the catalog notes and the workshop master before scheduling.',
};

function formatWorkArea(tool: ManufacturingTool) {
  const envelope = tool.workEnvelope;
  if (!envelope) return null;
  const x = envelope.xMm ?? envelope.widthMm;
  const y = envelope.yMm ?? envelope.lengthMm;
  if (!x || !y) return envelope.notes ?? null;
  const z = envelope.zMm ?? envelope.heightMm;
  const confidence = envelope.confidence !== 'confirmed' ? ` (${envelope.confidence})` : '';
  return `${x} × ${y}${z ? ` × ${z}` : ''} mm${confidence}`;
}

export function summarizeTool(tool: ManufacturingTool): TechSheetTool {
  return {
    id: tool.id,
    name: tool.name,
    model: tool.model,
    process: tool.process,
    role: tool.role,
    status: tool.status,
    workArea: formatWorkArea(tool),
    power: tool.power ? `${tool.power.value} ${tool.power.unit}` : null,
    inputFormats: tool.inputFormats,
    software: tool.software,
    materials: tool.materials,
    hardLimits: tool.hardLimits,
  };
}

function roleRank(role: ManufacturingTool['role']) {
  return role === 'primary_production' ? 0 : role === 'finishing' ? 1 : 2;
}

/** Shop tools for a process, primary production tools first. */
export function selectTools(process: ProductionProcessKey, tools = getManufacturingTools()) {
  return TOOL_PROCESSES[process]
    .flatMap((processKey) => tools.filter((tool) => tool.process === processKey))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function collectToolGuidance(tools: ManufacturingTool[]) {
  return {
    designRules: unique(tools.flatMap((tool) => tool.designRules)),
    setup: unique(tools.flatMap((tool) => tool.setupRequirements)),
    safety: unique(tools.flatMap((tool) => tool.safetyRequirements)),
  };
}

export interface ProcessPlanContext {
  quantity: number;
  artworkWidthMm: number | null;
  hasEngraveSvg: boolean;
  hasCutSvg: boolean;
  hasManufacturingPng: boolean;
  hasCustomerText: boolean;
  hasPhoto: boolean;
  materials: string[];
  sizeLabel: string | null;
  ledColor: string | null;
}

function materialPhrase(context: ProcessPlanContext) {
  return context.materials.length
    ? context.materials.join(', ')
    : 'as listed on the catalog item (confirm with the production manager)';
}

function sizePhrase(context: ProcessPlanContext) {
  return context.sizeLabel ? `the ordered size (${context.sizeLabel})` : 'the ordered size';
}

function artworkPhrase(context: ProcessPlanContext) {
  if (context.artworkWidthMm) {
    return `Confirm the document units are millimetres and the artwork reads ${context.artworkWidthMm} mm wide; if it imports in pixels, scale it to ${context.artworkWidthMm} mm wide before anything else.`;
  }
  return 'The file has no physical units: scale the artwork to the product master at true size and record the width you used on the job ticket.';
}

const TEXT_CHECK =
  'Compare every character of the customer text in this sheet with the lettering in the file (spelling, punctuation, line breaks, capitalisation). AI-rendered lettering can misspell; stop and flag the order if anything differs.';

const PREVIEW_CHECK =
  'Open the customer preview next to the production file: the finished piece must match what the customer approved. The preview is reference only and is never sent to a machine.';

function quantityLine(context: ProcessPlanContext) {
  return `Quantity to produce: ${context.quantity}. Each piece is checked separately.`;
}

/** Shop-floor steps for a process, worded for the operator. */
export function buildProcessSteps(
  process: ProductionProcessKey,
  context: ProcessPlanContext,
): TechSheetStep[] {
  const textChecks = context.hasCustomerText ? [TEXT_CHECK] : [];
  switch (process) {
    case 'laser_raster_engraving':
      return [
        {
          title: 'Preflight',
          checklist: [
            context.hasEngraveSvg
              ? `Open the engrave (fill) SVG in the laser software. ${artworkPhrase(context)}`
              : context.hasManufacturingPng
                ? 'No traced SVG exists: import the manufacturing PNG as the engrave image (black = engrave) and scale it to the product master at true size. Trace it on the generation review page first if a vector layer is needed.'
                : 'No production file exists yet. Generate the manufacturing PNG on the generation review page before scheduling this item.',
            ...textChecks,
            PREVIEW_CHECK,
            quantityLine(context),
          ],
        },
        {
          title: 'Material and blank',
          checklist: [
            `Material: ${materialPhrase(context)}. Measure the thickness of the actual batch and write it on the job ticket.`,
            `Cut or pick the blank from the product master cut file at ${sizePhrase(context)}. The AI file never contains the part outline.`,
            'Inspect the blank: no knots, cracks or scratches inside the artwork zone; wipe dust off before engraving.',
          ],
        },
        {
          title: 'Machine setup',
          checklist: [
            'Focus on the material surface, air assist on, exhaust running, CO2 extinguisher within reach.',
            'Run the power/speed test grid on an offcut of this batch and pick the setting that gives an even, matte, non-charred engraving. There are no stored settings for this product: the test strip is the reference.',
            'Load the fill SVG as the engrave layer in fill (raster) mode. Centre it on the artwork zone of the part exactly as the file convention describes; do not mirror, rotate or rescale it.',
            'Clamp or jig the part so it cannot move between the engrave pass and any cut pass.',
          ],
        },
        {
          title: 'Run',
          checklist: [
            'Raster-engrave the fill layer first, then run the vector cut layer from the master (if the part is cut in the same setup). Never move the part between passes.',
            'For sets of several pieces, engrave each piece from its own region of the file as described in the file convention.',
            'Watch the first piece through the whole job; check depth and contrast against the test strip before engraving the rest of the quantity.',
          ],
        },
        {
          title: 'Finish and quality check',
          checklist: [
            'Remove soot with a damp cloth or isopropyl alcohol where the material allows; light sand raised fibres on wood; apply the oil or finish specified for the product.',
            'Assemble hardware (hinges, clasp, base, LED module) after finishing, per the product master.',
            'Run the quality checklist at the end of this sheet and photograph the finished piece next to the job ticket.',
          ],
        },
      ];
    case 'laser_vector_cutting':
      return [
        {
          title: 'Preflight',
          checklist: [
            context.hasCutSvg
              ? `Open the stroke SVG in the laser software. ${artworkPhrase(context)}`
              : context.hasEngraveSvg
                ? 'Only the fill SVG exists: convert its outlines to hairline strokes in the laser software, or re-trace from the PNG on the generation review page to get the stroke variant.'
                : 'No vector file exists yet. Generate and trace the manufacturing PNG on the generation review page before scheduling this item.',
            ...textChecks,
            PREVIEW_CHECK,
            quantityLine(context),
          ],
        },
        {
          title: 'Material and blank',
          checklist: [
            `Material: ${materialPhrase(context)}. Measure the actual thickness; it sets the cutting power and the base-slot width.`,
            'Keep the protective film on acrylic while cutting; remove it before scoring if the score must be visible, and clean the surface with a lint-free cloth.',
          ],
        },
        {
          title: 'Layers and machine setup',
          checklist: [
            'Assign the inner lines to a score layer (line mode, low power, high speed) and build the outer contour as an offset of the silhouette with the margin stated in the file convention; add the straight base edge or tab the product master requires.',
            'Run the kerf test and the score test on an offcut of this batch; a score line must be visible but never cut through.',
            'Focus on the surface, air assist on (low for acrylic to avoid frosting), exhaust running, fire watch for the whole job.',
          ],
        },
        {
          title: 'Run',
          checklist: [
            'Order of operations: score first, then inner cut-outs, then the outer contour last so the part stays supported as long as possible.',
            'Check the first part for a clean, square cut edge and a fully closed contour before cutting the rest of the quantity.',
          ],
        },
        {
          title: 'Finish and quality check',
          checklist: [
            'Deburr or flame-polish the edges where the product calls for it; wipe the part clean.',
            'Test-fit the part into its base or joint; the fit must not need force.',
            'Run the quality checklist at the end of this sheet.',
          ],
        },
      ];
    case 'uv_printing':
      return [
        {
          title: 'Preflight',
          checklist: [
            context.hasManufacturingPng
              ? 'Open the manufacturing PNG. Crop it to the printable panel exactly as the file convention describes (the canvas outside the panel is not printed).'
              : 'No print file exists yet. Generate the manufacturing PNG on the generation review page before scheduling this item.',
            ...textChecks,
            ...(context.hasPhoto
              ? [
                  'Inspect the photo area at 100 %: no extra or missing people, altered faces, extra fingers or artefacts. Reject and regenerate the file if anything is wrong; never retouch a face by hand.',
                ]
              : []),
            PREVIEW_CHECK,
            quantityLine(context),
          ],
        },
        {
          title: 'Material and blank',
          checklist: [
            `Material: ${materialPhrase(context)}. Cut the panel from the product master on the laser at ${sizePhrase(context)}.`,
            'Peel the protective film, clean the print face with isopropyl alcohol and let it flash off; apply adhesion primer if the material or ink datasheet requires it.',
          ],
        },
        {
          title: 'RIP setup',
          checklist: [
            'Place the artwork at 100 % scale on the panel size; never use fit-to-page, which distorts proportions.',
            'Map the colours exactly as the file convention states (typically: black = no ink / knockout, white = white-ink channel, photo = CMYK). On clear or dark material print a white underbase under every coloured area.',
            'Run a test print of a small region on an offcut of the same material: check adhesion with a tape pull, white opacity and colour before the real panel.',
          ],
        },
        {
          title: 'Print',
          checklist: [
            'Register the panel in the jig, set the head height for the measured panel thickness, and print white underbase then colour (or in one pass if the printer supports it).',
            'Cure fully before handling; check for banding, misregistration or missing white.',
          ],
        },
        {
          title: 'Finish and quality check',
          checklist: [
            'Polish the panel edges, fit the panel into its base and connect the LED module.',
            context.ledColor
              ? `Test the light: the ordered LED colour is ${context.ledColor}.`
              : 'Test the light module if the product has one.',
            'Run the quality checklist at the end of this sheet.',
          ],
        },
      ];
    case 'eco_solvent_printing':
      return [
        {
          title: 'Intake and preflight',
          checklist: [
            'Confirm the ordered size, quantity, final text, language and the customer-approved preview.',
            'Open the source artwork and check resolution, colour mode, spelling, bleed and safe area against the banner drawing.',
            'Confirm the finishing: grommets, hem, adhesive backing, lamination or rigid mounting.',
            quantityLine(context),
          ],
        },
        {
          title: 'File preparation',
          checklist: [
            'Build the final artboard at the ordered dimensions with bleed and safe-area guides; keep text and logos inside the safe area.',
            'Export a printer-ready PDF or RIP raster and keep the source file with the job.',
            'Add registration marks only when the plotter will contour-cut the print.',
          ],
        },
        {
          title: 'Print and optional cut',
          checklist: [
            'Select the media profile in the RIP after the operator has verified it for this roll.',
            'Print a short test strip for colour, drying and adhesion before the full run.',
            'Use the plotter only for vinyl, masking film or other confirmed compatible media.',
          ],
        },
        {
          title: 'Finishing',
          checklist: [
            'Trim to the final size after drying or curing.',
            'Apply grommets or mounting hardware at the positions in the banner drawing.',
            'Protect the printed face while packing and mark the orientation.',
          ],
        },
        {
          title: 'Quality and safety',
          checklist: [
            'Check dimensions, colour, spelling, edge quality and hardware.',
            'Ventilation and PPE for inks and media handling; never laser-cut vinyl or PVC.',
          ],
        },
      ];
    case 'cnc_routing':
      return [
        {
          title: 'Preflight',
          checklist: [
            'Open the product master (DXF/SVG) in CAM; when an AI artwork file exists, import it as the engrave or pocket layer and align it to the master at true scale.',
            ...textChecks,
            PREVIEW_CHECK,
            quantityLine(context),
          ],
        },
        {
          title: 'Material and stock',
          checklist: [
            `Material: ${materialPhrase(context)}. Measure the sheet thickness and set slot widths to the measured value.`,
            'Plan the nest with tabs or onion skin for cut-through parts; add dogbones on tab-slot joinery.',
          ],
        },
        {
          title: 'Machine setup',
          checklist: [
            'Load the tool library, zero on the spoilboard and stock, clamp or vacuum the sheet, dust extraction on.',
            'Air-cut the first toolpath above the stock to confirm travel and tool changes.',
          ],
        },
        {
          title: 'Run and finish',
          checklist: [
            'Rough, then finish and engrave passes; stop and inspect after the first part.',
            'Remove tabs, sand edges, apply the finish specified for the product.',
            'Run the quality checklist at the end of this sheet.',
          ],
        },
      ];
    case 'fff_printing':
      return [
        {
          title: 'Preflight',
          checklist: [
            'Open the product model in the slicer; apply the personalization (text, colours) as the catalog notes describe.',
            ...textChecks,
            quantityLine(context),
          ],
        },
        {
          title: 'Material and slicing',
          checklist: [
            `Material: ${materialPhrase(context)}. Dry the filament if it has been open for more than a few days.`,
            'Orientation for strength and surface finish, supports only where unavoidable, infill and walls per the catalog notes.',
          ],
        },
        {
          title: 'Print and finish',
          checklist: [
            'Level the bed, print a first-layer test, then the parts; check the first part before printing the rest of the quantity.',
            'Remove supports, clean seams, assemble any inserts or hardware.',
            'Run the quality checklist at the end of this sheet.',
          ],
        },
      ];
    default:
      return [
        {
          title: 'Assign the process',
          checklist: [
            'Read the catalog notes and the product master to decide the production process (laser, UV print, CNC, 3D print).',
            'Record the process and the material on the style (admin → Personalization → style → manufacturing process) so the next sheet is complete.',
            ...textChecks,
            PREVIEW_CHECK,
            quantityLine(context),
          ],
        },
      ];
  }
}
