import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BANNER_PRESETS } from '@/lib/marketplace-constants';
import {
  manufacturingKnowledgeBaseSchema,
  type ManufacturingKnowledgeBase,
  type ManufacturingTool,
} from '@/lib/manufacturing-schema';
import type { Json } from '@/lib/supabase/types';

export interface BannerManufacturingInput {
  orderId: string;
  orderItemId: string;
  generatedItemId: string | null;
  title: string;
  quantity: number;
  bannerSizeKey: string | null;
  sourceImagePath: string;
  selectedPreviewPath: string | null;
  prompt: string | null;
  customText: string | null;
  itemSnapshot: Record<string, Json | undefined>;
  personalizationSnapshot: Record<string, Json | undefined>;
  productionSnapshot: Record<string, Json | undefined>;
  generatedOptions: Record<string, Json | undefined>;
}

export interface BannerManufacturingResult {
  status: 'ready' | 'review_required';
  instructions: Json;
  drawingSvg: string;
}

const BANNER_PROCESSES = new Set(['eco_solvent_printing', 'vinyl_cutting', 'uv_printing']);

let knowledgeBaseCache: ManufacturingKnowledgeBase | null = null;
let guidanceCache: Record<string, string> | null = null;

async function loadKnowledgeBase() {
  if (!knowledgeBaseCache) {
    const file = await readFile(
      path.join(process.cwd(), 'docs', 'manufacturing', 'tools.json'),
      'utf8',
    );
    knowledgeBaseCache = manufacturingKnowledgeBaseSchema.parse(JSON.parse(file));
  }
  return knowledgeBaseCache;
}

async function loadManufacturingGuidance() {
  if (!guidanceCache) {
    const files = [
      'ai-skills.md',
      'tool-capability-schema.md',
      'rag-manuals.md',
    ];
    const entries = await Promise.all(
      files.map(async (file) => {
        const content = await readFile(
          path.join(process.cwd(), 'docs', 'manufacturing', file),
          'utf8',
        );
        return [file, content] as const;
      }),
    );
    guidanceCache = Object.fromEntries(entries);
  }
  return guidanceCache;
}

function pickBannerPreset(key: string | null) {
  return key ? BANNER_PRESETS.find((preset) => preset.key === key) ?? null : null;
}

function summarizeTool(tool: ManufacturingTool) {
  return {
    id: tool.id,
    name: tool.name,
    model: tool.model,
    process: tool.process,
    role: tool.role,
    status: tool.status,
    materials: tool.materials,
    operations: tool.operations,
    workEnvelope: tool.workEnvelope,
    inputFormats: tool.inputFormats,
    software: tool.software,
    hardLimits: tool.hardLimits,
    designRules: tool.designRules,
    setupRequirements: tool.setupRequirements,
    safetyRequirements: tool.safetyRequirements,
    rag: tool.rag,
    notes: tool.notes ?? null,
  };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getReviewWarnings(tools: ManufacturingTool[], input: BannerManufacturingInput) {
  const preset = pickBannerPreset(input.bannerSizeKey);
  const warnings = [
    'Operator must verify final material roll, print profile, bleed, and finishing details before production.',
    'Machine manuals and media profiles are not fully verified in the local manufacturing knowledge base.',
  ];

  if (!preset) warnings.push('Ordered banner size preset is missing or not mapped to dimensions.');
  if (!input.sourceImagePath) warnings.push('No source image path was available for production input.');
  if (!input.quantity || input.quantity < 1) warnings.push('Quantity must be confirmed before production.');
  if (tools.some((tool) => tool.rag.manualSearchStatus !== 'found')) {
    warnings.push('One or more selected tools require vendor manual review before final machine settings are used.');
  }

  return unique(warnings);
}

function buildDrawingDescription(input: BannerManufacturingInput) {
  const preset = pickBannerPreset(input.bannerSizeKey);
  const widthMm = preset?.widthMm ?? null;
  const heightMm = preset?.heightMm ?? null;
  const bleedMm = widthMm && heightMm ? 10 : null;
  const safeAreaMm = widthMm && heightMm ? 25 : null;

  return {
    type: 'banner_layout',
    sizePresetKey: input.bannerSizeKey,
    widthMm,
    heightMm,
    materialAssumption: preset?.material ?? 'vinyl/banner media to be confirmed',
    finishAssumption: preset?.finish ?? 'finish to be confirmed',
    bleedMm,
    safeAreaMm,
    grommetPlan:
      widthMm && heightMm
        ? {
            corners: true,
            edgeSpacingMm: 300,
            note: 'Confirm mounting method with customer or production manager.',
          }
        : null,
    sourceImagePath: input.sourceImagePath,
    selectedPreviewPath: input.selectedPreviewPath,
  };
}

function escapeSvgText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderBannerManufacturingDrawing(input: BannerManufacturingInput) {
  const preset = pickBannerPreset(input.bannerSizeKey);
  const label = preset
    ? `${preset.name} - ${preset.widthMm}x${preset.heightMm} mm`
    : input.bannerSizeKey ?? 'Size requires review';
  const title = escapeSvgText(input.title.slice(0, 80));
  const source = escapeSvgText(input.sourceImagePath.slice(0, 110));
  const displayLabel = escapeSvgText(label);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-label="Banner manufacturing drawing">
  <rect width="1200" height="720" fill="#f8fafc"/>
  <rect x="90" y="110" width="1020" height="408" fill="#ffffff" stroke="#111827" stroke-width="4"/>
  <rect x="120" y="140" width="960" height="348" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="16 12"/>
  <rect x="165" y="185" width="870" height="258" fill="none" stroke="#2563eb" stroke-width="3" stroke-dasharray="10 10"/>
  <circle cx="120" cy="140" r="13" fill="#111827"/>
  <circle cx="1080" cy="140" r="13" fill="#111827"/>
  <circle cx="120" cy="488" r="13" fill="#111827"/>
  <circle cx="1080" cy="488" r="13" fill="#111827"/>
  <text x="600" y="68" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#111827">${title}</text>
  <text x="600" y="575" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#111827">${displayLabel}</text>
  <text x="600" y="615" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#334155">Black: final trim, red: bleed review, blue: safe text/art area</text>
  <text x="600" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#475569">Source: ${source}</text>
</svg>`;
}

export async function buildBannerManufacturingInstructions(
  input: BannerManufacturingInput,
): Promise<BannerManufacturingResult> {
  const [knowledgeBase, guidance] = await Promise.all([
    loadKnowledgeBase(),
    loadManufacturingGuidance(),
  ]);
  const selectedTools = knowledgeBase.tools.filter((tool) => BANNER_PROCESSES.has(tool.process));
  const drawing = buildDrawingDescription(input);
  const warnings = getReviewWarnings(selectedTools, input);
  const status = warnings.length ? 'review_required' : 'ready';

  const instructions = {
    status,
    manufacturingDataVersion: knowledgeBase.version,
    generatedAt: new Date().toISOString(),
    sourceGuidance: {
      skills: 'docs/manufacturing/ai-skills.md',
      toolCapabilities: 'docs/manufacturing/tools.json',
      schemaRules: 'docs/manufacturing/tool-capability-schema.md',
      ragPolicy: 'docs/manufacturing/rag-manuals.md',
      loadedFiles: Object.fromEntries(
        Object.entries(guidance).map(([file, content]) => [file, { bytes: content.length }]),
      ),
      appliedPolicies: [
        'Structured tool capability data is treated as source of truth.',
        'Manual/RAG gaps produce review_required output instead of authoritative machine settings.',
        'Operator checklist is included before release to production.',
      ],
    },
    order: {
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      generatedItemId: input.generatedItemId,
      title: input.title,
      quantity: input.quantity,
      bannerSizeKey: input.bannerSizeKey,
      sourceImagePath: input.sourceImagePath,
      selectedPreviewPath: input.selectedPreviewPath,
      prompt: input.prompt,
      customText: input.customText,
    },
    selectedTools: selectedTools.map(summarizeTool),
    rejectedProcessNotes: [
      'Laser cutting is not selected for vinyl/PVC banner media because chlorinated plastics are prohibited for laser processing.',
      'CNC routing and welding tools are not part of the default flexible banner production path.',
    ],
    materialAssumptions: {
      primaryMedia: drawing.materialAssumption,
      finish: drawing.finishAssumption,
      ink: 'Eco-solvent or UV ink profile must be confirmed against the selected media.',
      mounting: 'Grommets, hem, adhesive backing, or frame mounting must be confirmed before production.',
    },
    drawings: [drawing],
    productionPath: [
      {
        step: 'Intake and preflight',
        checklist: [
          'Confirm ordered size, quantity, final text, language, and customer-approved preview.',
          'Open the source artwork and verify resolution, color mode, spelling, bleed, and safe area.',
          'Confirm whether finishing requires grommets, hems, adhesive backing, lamination, or rigid mounting.',
        ],
      },
      {
        step: 'File preparation',
        checklist: [
          'Create final artboard at ordered dimensions with bleed and safe-area guides.',
          'Keep text and important logos inside the safe area.',
          'Export printer-ready PDF or RIP-compatible raster file and preserve the source file.',
          'Add registration marks only when contour cutting or plotter finishing is required.',
        ],
      },
      {
        step: 'Print and optional cut',
        checklist: [
          'Select media profile in RIP after operator verification.',
          'Run a small test strip for color, drying, and adhesion before full production.',
          'Use the plotter only for vinyl film, masking film, or confirmed compatible media.',
        ],
      },
      {
        step: 'Finishing',
        checklist: [
          'Trim to final dimensions after drying/curing.',
          'Apply grommets or mounting hardware according to confirmed customer placement.',
          'Protect finished surface during packing and label orientation when needed.',
        ],
      },
      {
        step: 'Quality and safety',
        checklist: [
          'Check dimensions, color, spelling, edge quality, and mounting hardware.',
          'Verify ventilation and PPE requirements for inks and media handling.',
          'Do not substitute laser processing for vinyl or PVC media.',
        ],
      },
    ],
    warnings,
    originalMetadata: {
      itemSnapshot: input.itemSnapshot,
      personalizationSnapshot: input.personalizationSnapshot,
      productionSnapshot: input.productionSnapshot,
      generatedOptions: input.generatedOptions,
    },
  };

  return {
    status,
    instructions,
    drawingSvg: renderBannerManufacturingDrawing(input),
  };
}
