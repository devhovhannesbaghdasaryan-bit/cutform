/**
 * Production pack: the technical documentation handed to the workshop for one
 * ordered (or generated) item. `TechSheet` is the structured content; it is
 * rendered to HTML, Markdown and JSON and zipped together with the production
 * files by `lib/production-pack/zip.ts`.
 */

export type ProductionProcessKey =
  | 'laser_raster_engraving'
  | 'laser_vector_cutting'
  | 'uv_printing'
  | 'eco_solvent_printing'
  | 'cnc_routing'
  | 'fff_printing'
  | 'unknown';

export type ProductionFileRole =
  | 'manufacturing_png'
  | 'engrave_svg'
  | 'cut_svg'
  | 'legacy_svg'
  | 'banner_drawing'
  | 'customer_preview'
  | 'customer_photo';

export type ProductionBucket = 'generated-assets' | 'user-uploads';

export interface ProductionFile {
  role: ProductionFileRole;
  /** Storage source; `content` files are generated from text instead. */
  bucket: ProductionBucket | null;
  storagePath: string | null;
  content: string | null;
  /** File name inside the pack's `files/` folder. */
  fileName: string;
  contentType: string;
  label: string;
  purpose: string;
  /** Reference material for the operator, never a production input. */
  reference: boolean;
  /** Set by the zip builder when the storage object could not be downloaded. */
  missing?: boolean;
}

export interface TechSheetSize {
  label: string;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
}

export interface TechSheetTool {
  id: string;
  name: string;
  model: string | null;
  process: string;
  role: string;
  status: string;
  workArea: string | null;
  power: string | null;
  inputFormats: string[];
  software: string[];
  materials: string[];
  hardLimits: string[];
}

export interface TechSheetStep {
  title: string;
  checklist: string[];
}

export interface TechSheetTrace {
  units: 'mm' | 'px' | null;
  pathCount: number | null;
  inkCoverage: number | null;
}

export interface TechSheet {
  version: '1';
  generatedAt: string;
  status: 'ready' | 'review_required';
  reference: {
    kind: 'order' | 'generation';
    label: string;
    orderId: string | null;
    orderItemId: string | null;
    generatedItemId: string | null;
    previewOptionId: string | null;
    catalogItemId: string | null;
    reviewStatus: string | null;
  };
  product: {
    /** The order line's title (for personalized items: the style name). */
    title: string;
    /** Heading for the sheet: catalog item and style when both are known. */
    displayTitle: string;
    catalogTitle: string | null;
    styleName: string | null;
    itemType: string | null;
    productType: string | null;
    category: string | null;
    subcategory: string | null;
    tags: string[];
  };
  order: {
    quantity: number;
    orderStatus: string | null;
    paymentStatus: string | null;
    createdAt: string | null;
    destinationCountry: string | null;
    customerText: string | null;
    textLines: string[];
    ledColor: { value: string; label: string; hex: string | null } | null;
    multiColor: boolean;
    bannerSize: {
      key: string;
      name: string;
      widthMm: number;
      heightMm: number;
      material: string;
      finish: string;
    } | null;
  };
  specification: {
    sizes: TechSheetSize[];
    sizeNote: string | null;
    materials: string[];
    finishes: string[];
    characteristics: string[];
    artworkWidthMm: number | null;
    processDescription: string | null;
    /** The manufacturing prompt: the authoritative description of the production file's layout and colour convention. */
    fileConvention: string | null;
    trace: TechSheetTrace | null;
  };
  files: ProductionFile[];
  process: {
    key: ProductionProcessKey;
    name: string;
    summary: string;
    tools: TechSheetTool[];
    steps: TechSheetStep[];
    designRules: string[];
    setup: string[];
    safety: string[];
  };
  workshopNotes: string[];
  /** Blocking problems: the item must not go to the machine until they are resolved. */
  warnings: string[];
  /** Facts the operator confirms before starting; they do not block production. */
  confirmations: string[];
  qualityChecklist: string[];
}
