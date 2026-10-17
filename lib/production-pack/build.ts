import { BANNER_PRESETS } from '@/lib/marketplace-constants';
import { COMFORTABLE_COLORS } from '@/lib/personalization-constants';
import {
  buildProcessSteps,
  classifyProcess,
  collectToolGuidance,
  getManufacturingTools,
  PROCESS_NAMES,
  PROCESS_SUMMARIES,
  selectTools,
  summarizeTool,
} from '@/lib/production-pack/process';
import type {
  ProductionFile,
  ProductionFileRole,
  TechSheet,
  TechSheetSize,
  TechSheetTrace,
} from '@/lib/production-pack/types';
import type { ManufacturingTool } from '@/lib/manufacturing-schema';

export interface TechSheetCatalogInput {
  id: string;
  title: string;
  itemType: string | null;
  /** `catalog_items.sizes` as stored: an array of `{ label, widthMm, heightMm, depthMm? }`. */
  sizes: unknown;
  characteristics: string | null;
  manufacturingNotes: string | null;
  tags: string[];
  category: string | null;
  subcategory: string | null;
}

export interface TechSheetStyleInput {
  id: string | null;
  name: string | null;
  manufacturingProcess: string | null;
  manufacturingPrompt: string | null;
  artworkWidthMm: number | null;
  requiresSvg: boolean;
}

export interface TechSheetFilesInput {
  manufacturingPng: string | null;
  engraveSvg: string | null;
  cutSvg: string | null;
  /** `generated_items.svg_content` of the legacy single-SVG pipeline. */
  legacySvgContent: string | null;
  bannerDrawings: string[];
  preview: string | null;
  customerPhotos: string[];
}

export interface TechSheetInput {
  reference: TechSheet['reference'];
  generatedAt?: string;
  title: string;
  quantity: number;
  order: {
    status: string | null;
    paymentStatus: string | null;
    createdAt: string | null;
    destinationCountry: string | null;
  } | null;
  customText: string | null;
  ledColor: string | null;
  multiColor: boolean;
  bannerSizeKey: string | null;
  productType: string | null;
  catalog: TechSheetCatalogInput | null;
  style: TechSheetStyleInput | null;
  /** Trace statistics recorded on the preview option when the SVGs were produced. */
  trace: TechSheetTrace | null;
  files: TechSheetFilesInput;
  /** Latest banner manufacturing artifact for banner items. */
  bannerInstruction: { status: string; warnings: string[] } | null;
  /** Override the shop tool database (tests). */
  tools?: ManufacturingTool[];
}

const PROCESS_WORDS = /laser|print|engrav|cut|rout|mill|uv|score|raster|vector|cnc|fff|3d/i;

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

/** Normalizes the free-form `sizes` JSON of a catalog item. */
export function parseSizes(value: unknown): TechSheetSize[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): TechSheetSize[] => {
    if (typeof entry === 'string') {
      return entry.trim()
        ? [{ label: entry.trim(), widthMm: null, heightMm: null, depthMm: null }]
        : [];
    }
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const label =
      typeof record.label === 'string' && record.label.trim()
        ? record.label.trim()
        : typeof record.name === 'string' && record.name.trim()
          ? record.name.trim()
          : `Size ${index + 1}`;
    return [
      {
        label,
        widthMm: asNumber(record.widthMm ?? record.width_mm ?? record.width),
        heightMm: asNumber(record.heightMm ?? record.height_mm ?? record.height),
        depthMm: asNumber(record.depthMm ?? record.depth_mm ?? record.depth),
      },
    ];
  });
}

export interface ParsedCharacteristics {
  materials: string[];
  finishes: string[];
  tools: string[];
  other: string[];
}

/**
 * Splits the catalog item's `characteristics` text (one `Key: value` per
 * line) into the facets the tech sheet shows separately.
 */
export function parseCharacteristics(text: string | null): ParsedCharacteristics {
  const result: ParsedCharacteristics = { materials: [], finishes: [], tools: [], other: [] };
  if (!text) return result;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*•]\s*/, '');
    if (!line) continue;
    const match = line.match(/^([^:]{1,40}):\s*(.+)$/);
    const key = match?.[1]?.trim().toLowerCase() ?? '';
    const value = match?.[2]?.trim() ?? line;
    if (/^material/.test(key)) result.materials.push(value);
    else if (/^(finish|coating|surface)/.test(key)) result.finishes.push(value);
    else if (/^(tool|machine|process)/.test(key)) result.tools.push(value);
    else result.other.push(line);
  }
  return result;
}

/** Material hints hidden in the style's process text, e.g. "CO2-laser raster engraving, oak-toned wood (inside of the lid)". */
export function materialsFromProcessDescription(description: string | null) {
  if (!description) return [];
  const [, ...rest] = description.split(/,|;|\bon\b/);
  return rest
    .map((part) => part.trim().replace(/[.]$/, ''))
    .filter((part) => part.length > 2 && !PROCESS_WORDS.test(part));
}

function materialsFromNotes(notes: string | null) {
  if (!notes) return [];
  const match = notes.match(/candidate materials?:\s*([^\n]+)/i);
  if (!match) return [];
  return match[1]
    .split(/,/)
    .map((part) => part.trim().replace(/[.]$/, ''))
    .filter(Boolean);
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitParagraphs(text: string | null) {
  return (text ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function fileName(path: string) {
  return path.split('/').at(-1) ?? path;
}

function extensionOf(path: string, fallback: string) {
  const ext = fileName(path).split('.').at(-1)?.toLowerCase();
  return ext && ext !== fileName(path) ? ext : fallback;
}

function contentTypeFor(ext: string) {
  switch (ext) {
    case 'svg':
      return 'image/svg+xml';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'json':
      return 'application/json';
    default:
      return 'image/png';
  }
}

interface FileSpec {
  role: ProductionFileRole;
  bucket: ProductionFile['bucket'];
  storagePath: string | null;
  content?: string;
  baseName: string;
  defaultExt: string;
  label: string;
  purpose: string;
  reference: boolean;
}

function toProductionFile(spec: FileSpec, index: number): ProductionFile {
  const ext = spec.storagePath ? extensionOf(spec.storagePath, spec.defaultExt) : spec.defaultExt;
  return {
    role: spec.role,
    bucket: spec.bucket,
    storagePath: spec.storagePath,
    content: spec.content ?? null,
    fileName: `${String(index + 1).padStart(2, '0')}-${spec.baseName}.${ext}`,
    contentType: contentTypeFor(ext),
    label: spec.label,
    purpose: spec.purpose,
    reference: spec.reference,
  };
}

function describeSvgScale(artworkWidthMm: number | null, trace: TechSheetTrace | null) {
  if (trace?.units === 'mm' && artworkWidthMm) return `${artworkWidthMm} mm wide, true scale.`;
  if (trace?.units === 'mm') return 'Millimetre units, true scale.';
  if (artworkWidthMm) return `Intended width ${artworkWidthMm} mm; verify the units on import.`;
  return 'No physical units: scale to the product master before use.';
}

/**
 * Heading of the sheet. Personalized order lines are titled after their style,
 * so the catalog item name is prepended when it is known; otherwise the style
 * is appended when it adds information.
 */
export function buildDisplayTitle(
  title: string,
  catalogTitle: string | null,
  styleName: string | null,
) {
  const same = (a: string | null, b: string | null) =>
    Boolean(a && b) && a?.trim().toLowerCase() === b?.trim().toLowerCase();
  if (styleName && catalogTitle && same(title, styleName) && !same(catalogTitle, styleName)) {
    return `${catalogTitle} · ${styleName}`;
  }
  if (styleName && !same(title, styleName)) return `${title} · ${styleName}`;
  return title;
}

export function buildTechSheet(input: TechSheetInput): TechSheet {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const tools = input.tools ?? getManufacturingTools();
  const catalog = input.catalog;
  const style = input.style;
  const characteristics = parseCharacteristics(catalog?.characteristics ?? null);
  const sizes = parseSizes(catalog?.sizes);
  const warnings: string[] = [];
  const confirmations: string[] = [];

  const materials = unique([
    ...materialsFromProcessDescription(style?.manufacturingProcess ?? null),
    ...characteristics.materials,
    ...materialsFromNotes(catalog?.manufacturingNotes ?? null),
  ]);

  const bannerPreset = input.bannerSizeKey
    ? (BANNER_PRESETS.find((preset) => preset.key === input.bannerSizeKey) ?? null)
    : null;
  if (bannerPreset) materials.push(`${bannerPreset.material} banner media, ${bannerPreset.finish}`);

  const processKey = classifyProcess({
    processDescription: style?.manufacturingProcess ?? null,
    styleName: style?.name ?? null,
    productType: input.productType,
    itemType: catalog?.itemType ?? null,
    bannerSizeKey: input.bannerSizeKey,
    hasEngraveSvg: Boolean(input.files.engraveSvg),
    hasCutSvg: Boolean(input.files.cutSvg),
    characteristics: [...characteristics.tools, ...characteristics.materials],
  });
  const selectedTools = selectTools(processKey, tools);
  const guidance = collectToolGuidance(selectedTools);

  const textLines = (input.customText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, all) => line.trim() || index < all.length - 1);
  const ledColor = input.ledColor
    ? (() => {
        const known = COMFORTABLE_COLORS.find((color) => color.value === input.ledColor);
        return {
          value: input.ledColor,
          label: known?.label ?? input.ledColor.replace(/_/g, ' '),
          hex: known?.hex ?? null,
        };
      })()
    : null;

  const files: FileSpec[] = [];
  const isPrintProcess = processKey === 'uv_printing' || processKey === 'eco_solvent_printing';
  if (input.files.manufacturingPng) {
    files.push({
      role: 'manufacturing_png',
      bucket: 'generated-assets',
      storagePath: input.files.manufacturingPng,
      baseName: 'manufacturing',
      defaultExt: 'png',
      label: isPrintProcess ? 'Print file (PNG)' : 'Manufacturing artwork (PNG)',
      purpose: isPrintProcess
        ? 'The file the printer RIP is fed, after the crop described in the file convention.'
        : 'Source raster of the engraving; the SVGs below were traced from it. Use it to check the artwork and as the engrave image when no SVG exists.',
      reference: false,
    });
  }
  if (input.files.engraveSvg) {
    files.push({
      role: 'engrave_svg',
      bucket: 'generated-assets',
      storagePath: input.files.engraveSvg,
      baseName: 'engrave-fill',
      defaultExt: 'svg',
      label: 'Engrave layer (fill SVG)',
      purpose: `Filled outlines for raster engraving. ${describeSvgScale(style?.artworkWidthMm ?? null, input.trace)}`,
      reference: false,
    });
  }
  if (input.files.cutSvg) {
    files.push({
      role: 'cut_svg',
      bucket: 'generated-assets',
      storagePath: input.files.cutSvg,
      baseName: 'cut-stroke',
      defaultExt: 'svg',
      label: 'Cut / score layer (stroke SVG)',
      purpose: `Same outlines as hairline strokes, no fill, for vector score or cut passes. ${describeSvgScale(style?.artworkWidthMm ?? null, input.trace)}`,
      reference: false,
    });
  }
  if (!input.files.engraveSvg && !input.files.cutSvg && input.files.legacySvgContent?.trim()) {
    files.push({
      role: 'legacy_svg',
      bucket: null,
      storagePath: null,
      content: input.files.legacySvgContent,
      baseName: 'manufacturing',
      defaultExt: 'svg',
      label: 'Manufacturing SVG',
      purpose: 'Vector file stored with the generation. Check its units and scale before use.',
      reference: false,
    });
  }
  input.files.bannerDrawings.forEach((path, index) => {
    files.push({
      role: 'banner_drawing',
      bucket: 'generated-assets',
      storagePath: path,
      baseName: `banner-drawing${input.files.bannerDrawings.length > 1 ? `-${index + 1}` : ''}`,
      defaultExt: 'svg',
      label: 'Banner layout drawing',
      purpose: 'Trim, bleed and safe-area drawing with grommet positions. Not the print artwork.',
      reference: true,
    });
  });
  if (input.files.preview) {
    files.push({
      role: 'customer_preview',
      bucket: 'generated-assets',
      storagePath: input.files.preview,
      baseName: 'customer-preview',
      defaultExt: 'png',
      label: 'Customer-approved preview',
      purpose:
        'What the customer saw and approved. Reference only: compare the finished piece against it, never print or engrave it.',
      reference: true,
    });
  }
  input.files.customerPhotos.forEach((path, index) => {
    files.push({
      role: 'customer_photo',
      bucket: 'user-uploads',
      storagePath: path,
      baseName: `customer-photo${input.files.customerPhotos.length > 1 ? `-${index + 1}` : ''}`,
      defaultExt: 'jpg',
      label: `Customer photo${input.files.customerPhotos.length > 1 ? ` ${index + 1}` : ''}`,
      purpose:
        'The original upload the artwork was derived from. Reference for likeness checks only; personal data, do not share outside the job.',
      reference: true,
    });
  });
  const productionFiles = files.map(toProductionFile);
  const hasProductionFile = productionFiles.some((file) => !file.reference);

  // Blocking problems.
  if (!hasProductionFile) {
    warnings.push(
      processKey === 'eco_solvent_printing'
        ? 'No production artwork is attached. Generate the banner instructions on the order page, or attach the print-ready artwork, before scheduling.'
        : 'No production file exists for this item. Generate the manufacturing PNG (and its SVG trace) on the generation review page before scheduling.',
    );
  }
  if (style?.requiresSvg && !input.files.engraveSvg && !input.files.cutSvg) {
    warnings.push(
      'This style needs a vector file but no traced SVG exists. Re-trace the manufacturing PNG on the generation review page; if the trace fails its quality check, regenerate the PNG.',
    );
  }
  if (input.trace?.units === 'px' && (input.files.engraveSvg || input.files.cutSvg)) {
    warnings.push(
      'The traced SVG has no physical units (pixels). Set the artwork width in millimetres on the style and re-trace, or scale the file to the product master by hand and record the width used.',
    );
  }
  if (input.reference.reviewStatus && input.reference.reviewStatus !== 'approved') {
    warnings.push(
      `The customer design has not passed admin review (status: ${input.reference.reviewStatus.replace(/_/g, ' ')}). Approve it on the generation review page before production.`,
    );
  }
  if (input.order?.paymentStatus && input.order.paymentStatus !== 'paid') {
    warnings.push(`The order is not marked paid (payment status: ${input.order.paymentStatus}).`);
  }
  if (!input.quantity || input.quantity < 1)
    warnings.push('Quantity must be confirmed before production.');
  if (input.bannerInstruction) warnings.push(...input.bannerInstruction.warnings);

  // Facts to confirm.
  let sizeNote: string | null = null;
  if (sizes.length > 1) {
    sizeNote = `The catalog lists ${sizes.length} sizes and the order does not record a size choice; the first size is the default.`;
    confirmations.push(
      `Size: confirm which of the ${sizes.length} catalog sizes was ordered (default ${sizes[0]?.label}).`,
    );
  } else if (sizes.length === 0 && !bannerPreset) {
    sizeNote = 'No sizes are recorded on the catalog item.';
    confirmations.push('Size: not recorded on the catalog item; take it from the product master.');
  }
  if (!materials.length) {
    confirmations.push(
      'Material: not recorded on the catalog item or style; confirm with the production manager and record it on the style.',
    );
  }
  if (processKey === 'unknown') {
    confirmations.push(
      'Process: not recorded; assign it from the catalog notes and record it on the style.',
    );
  }
  if (textLines.length) {
    confirmations.push(
      'Customer text: every character in the file matches the order text in this sheet.',
    );
  }
  if (ledColor || input.multiColor) {
    confirmations.push(
      `LED colour: ${input.multiColor ? 'multi-colour module' : `${ledColor?.label}${ledColor?.hex ? ` (${ledColor.hex})` : ''}`}.`,
    );
  }

  const processContext = {
    quantity: input.quantity,
    artworkWidthMm: style?.artworkWidthMm ?? null,
    hasEngraveSvg: Boolean(input.files.engraveSvg),
    hasCutSvg: Boolean(input.files.cutSvg),
    hasManufacturingPng: Boolean(input.files.manufacturingPng),
    hasCustomerText: textLines.length > 0,
    hasPhoto: input.files.customerPhotos.length > 0,
    materials,
    sizeLabel: sizes.length === 1 ? sizes[0].label : null,
    ledColor: input.multiColor ? 'multi-colour' : (ledColor?.label ?? null),
  };

  const workshopNotes = [
    ...splitParagraphs(catalog?.manufacturingNotes ?? null),
    ...characteristics.other.map((line) => line),
  ];

  const qualityChecklist = unique([
    ...(textLines.length
      ? ['Text matches the order character for character, including line breaks.']
      : []),
    'Finished piece matches the customer-approved preview (layout, proportions, placement).',
    'Dimensions match the ordered size; artwork is centred and not mirrored.',
    processKey === 'uv_printing' || processKey === 'eco_solvent_printing'
      ? 'Print is fully cured, no banding, white ink opaque, colours clean; tape-pull adhesion test passed.'
      : 'Engraving or cut is even, no charring, scorch marks cleaned, edges clean.',
    ...(ledColor || input.multiColor ? ['LED module lights in the ordered colour.'] : []),
    'No visible defects in the material (cracks, knots, scratches) inside the visible area.',
    `All ${input.quantity} piece${input.quantity === 1 ? '' : 's'} checked; packed with the job ticket, protected surface, orientation marked.`,
  ]);

  return {
    version: '1',
    generatedAt,
    status: warnings.length ? 'review_required' : 'ready',
    reference: input.reference,
    product: {
      title: input.title,
      displayTitle: buildDisplayTitle(input.title, catalog?.title ?? null, style?.name ?? null),
      catalogTitle: catalog?.title ?? null,
      styleName: style?.name ?? null,
      itemType: catalog?.itemType ?? null,
      productType: input.productType,
      category: catalog?.category ?? null,
      subcategory: catalog?.subcategory ?? null,
      tags: catalog?.tags ?? [],
    },
    order: {
      quantity: input.quantity,
      orderStatus: input.order?.status ?? null,
      paymentStatus: input.order?.paymentStatus ?? null,
      createdAt: input.order?.createdAt ?? null,
      destinationCountry: input.order?.destinationCountry ?? null,
      customerText: input.customText,
      textLines,
      ledColor,
      multiColor: input.multiColor,
      bannerSize: bannerPreset
        ? {
            key: bannerPreset.key,
            name: bannerPreset.name,
            widthMm: bannerPreset.widthMm,
            heightMm: bannerPreset.heightMm,
            material: bannerPreset.material,
            finish: bannerPreset.finish,
          }
        : null,
    },
    specification: {
      sizes,
      sizeNote,
      materials,
      finishes: characteristics.finishes,
      characteristics: characteristics.other,
      artworkWidthMm: style?.artworkWidthMm ?? null,
      processDescription: style?.manufacturingProcess ?? null,
      fileConvention: style?.manufacturingPrompt?.trim() || null,
      trace: input.trace,
    },
    files: productionFiles,
    process: {
      key: processKey,
      name: PROCESS_NAMES[processKey],
      summary: PROCESS_SUMMARIES[processKey],
      tools: selectedTools.map(summarizeTool),
      steps: buildProcessSteps(processKey, processContext),
      designRules: guidance.designRules,
      setup: guidance.setup,
      safety: guidance.safety,
    },
    workshopNotes,
    warnings: unique(warnings),
    confirmations: unique(confirmations),
    qualityChecklist,
  };
}
