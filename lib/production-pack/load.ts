import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTechSheet,
  type TechSheetCatalogInput,
  type TechSheetStyleInput,
} from '@/lib/production-pack/build';
import type { TechSheet, TechSheetTrace } from '@/lib/production-pack/types';
import type { Json } from '@/lib/supabase/types';
import { slugify } from '@/lib/utils';

export interface ProductionPack {
  sheet: TechSheet;
  /** Folder name inside a multi-item zip and base of the download file name. */
  slug: string;
  orderItemId: string | null;
  previewOptionId: string | null;
}

type Record_ = Record<string, unknown>;

function asRecord(value: unknown): Record_ {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record_) : {};
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function uniquePaths(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function readTrace(value: unknown): TechSheetTrace | null {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;
  const units = record.units === 'mm' || record.units === 'px' ? record.units : null;
  return {
    units,
    pathCount: asNumber(record.pathCount),
    inkCoverage: asNumber(record.inkCoverage),
  };
}

interface OrderRow {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  destination_country_code: string | null;
}

interface OrderItemRow {
  id: string;
  title: string;
  quantity: number;
  catalog_item_id: string | null;
  generated_item_id: string | null;
  item_snapshot: Json;
  image_path: string | null;
  selected_preview_path: string | null;
  manufacturing_file_path: string | null;
  original_image_paths: string[];
  custom_text: string | null;
  led_color: string | null;
  multi_color: boolean;
  banner_size_key: string | null;
}

interface GeneratedRow {
  id: string;
  title: string | null;
  product_type: string;
  review_status: string;
  catalog_item_id: string | null;
  custom_text: string | null;
  color: string | null;
  multi_color: boolean;
  source_image_path: string | null;
  original_image_paths: string[];
  preview_path: string | null;
  selected_preview_path: string | null;
  manufacturing_file_path: string | null;
  svg_content: string;
}

interface OptionRow {
  id: string;
  generated_item_id: string;
  option_index: number;
  boilerplate_id: string | null;
  preview_image_path: string;
  manufacturing_file_path: string | null;
  metadata: Json;
}

interface BoilerplateRow {
  id: string;
  name: string;
  manufacturing_process: string;
  manufacturing_prompt: string | null;
  artwork_width_mm: number | null;
  generate_hidden_svg: boolean;
}

interface CatalogRow {
  id: string;
  title: string;
  item_type: string;
  sizes: Json;
  characteristics: string | null;
  manufacturing_notes: string | null;
  tags: string[];
  category: { name: string } | null;
  subcategory: { name: string } | null;
}

interface BannerInstructionRow {
  order_item_id: string | null;
  status: string;
  instructions: Json;
  drawing_paths: string[];
  created_at: string;
}

const GENERATED_COLUMNS =
  'id, title, product_type, review_status, catalog_item_id, custom_text, color, multi_color, source_image_path, original_image_paths, preview_path, selected_preview_path, manufacturing_file_path, svg_content';
const OPTION_COLUMNS =
  'id, generated_item_id, option_index, boilerplate_id, preview_image_path, manufacturing_file_path, metadata';
const BOILERPLATE_COLUMNS =
  'id, name, manufacturing_process, manufacturing_prompt, artwork_width_mm, generate_hidden_svg';
const CATALOG_COLUMNS =
  'id, title, item_type, sizes, characteristics, manufacturing_notes, tags, category:categories(name), subcategory:subcategories(name)';

async function fetchByIds<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  ids: string[],
) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, T>();
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in('id', unique)
    .returns<T[]>();
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.id, row]));
}

function toCatalogInput(row: CatalogRow | null | undefined): TechSheetCatalogInput | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    itemType: row.item_type,
    sizes: row.sizes,
    characteristics: row.characteristics,
    manufacturingNotes: row.manufacturing_notes,
    tags: row.tags ?? [],
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
  };
}

/**
 * Style facts for the sheet: the live boilerplate row when it still exists,
 * otherwise what the preview option (or the order's snapshot of it) recorded
 * at generation time.
 */
function toStyleInput(
  boilerplate: BoilerplateRow | null | undefined,
  metadata: Record_,
): TechSheetStyleInput | null {
  if (boilerplate) {
    return {
      id: boilerplate.id,
      name: boilerplate.name,
      manufacturingProcess: boilerplate.manufacturing_process || null,
      manufacturingPrompt: boilerplate.manufacturing_prompt,
      artworkWidthMm: boilerplate.artwork_width_mm,
      requiresSvg: boilerplate.generate_hidden_svg,
    };
  }
  const name = asString(metadata.boilerplateName);
  const process = asString(metadata.manufacturingProcess);
  if (!name && !process) return null;
  return {
    id: asString(metadata.boilerplateId),
    name,
    manufacturingProcess: process,
    manufacturingPrompt: asString(asRecord(metadata.manufacturingPngGeneration).prompt),
    artworkWidthMm: null,
    requiresSvg: metadata.requiresManufacturingSvg === true,
  };
}

function bannerWarnings(instruction: BannerInstructionRow | undefined) {
  if (!instruction) return null;
  return {
    status: instruction.status,
    warnings: asStringArray(asRecord(instruction.instructions).warnings),
  };
}

export interface LoadOrderPacksOptions {
  /** Restrict to one order item. */
  orderItemId?: string;
}

/**
 * Production packs for every item of an order (or one item). Returns null
 * when the order does not exist; an order without items yields an empty list.
 */
export async function loadOrderProductionPacks(
  supabase: SupabaseClient,
  orderId: string,
  options: LoadOrderPacksOptions = {},
): Promise<ProductionPack[] | null> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, payment_status, created_at, destination_country_code')
    .eq('id', orderId)
    .maybeSingle<OrderRow>();
  if (orderError || !order) return null;

  let itemsQuery = supabase
    .from('order_items')
    .select(
      'id, title, quantity, catalog_item_id, generated_item_id, item_snapshot, image_path, selected_preview_path, manufacturing_file_path, original_image_paths, custom_text, led_color, multi_color, banner_size_key',
    )
    .eq('order_id', orderId)
    .order('id', { ascending: true });
  if (options.orderItemId) itemsQuery = itemsQuery.eq('id', options.orderItemId);
  const { data: items, error: itemsError } = await itemsQuery.returns<OrderItemRow[]>();
  if (itemsError) throw new Error(itemsError.message);
  if (!items?.length) return [];

  // Position of each item in the full order, so a single-item pack still says "item 2 of 3".
  let positions = new Map(items.map((item, index) => [item.id, { index, count: items.length }]));
  if (options.orderItemId) {
    const { data: allIds } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
      .order('id', { ascending: true })
      .returns<{ id: string }[]>();
    if (allIds?.length) {
      positions = new Map(allIds.map((row, index) => [row.id, { index, count: allIds.length }]));
    }
  }

  const configurations = new Map(
    items.map((item) => [item.id, asRecord(asRecord(item.item_snapshot).configuration)]),
  );
  const optionIds = items
    .map((item) => asString(configurations.get(item.id)?.personalizedPreviewOptionId))
    .filter((value): value is string => Boolean(value));

  const [generatedById, optionById, bannerInstructions] = await Promise.all([
    fetchByIds<GeneratedRow>(
      supabase,
      'generated_items',
      GENERATED_COLUMNS,
      items.map((item) => item.generated_item_id).filter((id): id is string => Boolean(id)),
    ),
    fetchByIds<OptionRow>(supabase, 'personalized_preview_options', OPTION_COLUMNS, optionIds),
    supabase
      .from('banner_manufacturing_instructions')
      .select('order_item_id, status, instructions, drawing_paths, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .returns<BannerInstructionRow[]>()
      .then(({ data }) => data ?? []),
  ]);

  const latestBannerByItem = new Map<string, BannerInstructionRow>();
  for (const instruction of bannerInstructions) {
    if (instruction.order_item_id && !latestBannerByItem.has(instruction.order_item_id)) {
      latestBannerByItem.set(instruction.order_item_id, instruction);
    }
  }

  const boilerplateIds: string[] = [];
  const catalogIds: string[] = [];
  for (const item of items) {
    const config = configurations.get(item.id) ?? {};
    const option = optionById.get(asString(config.personalizedPreviewOptionId) ?? '');
    const snapshot = asRecord(config.boilerplateSnapshot);
    const boilerplateId = option?.boilerplate_id ?? asString(snapshot.boilerplateId);
    if (boilerplateId) boilerplateIds.push(boilerplateId);
    const generated = item.generated_item_id ? generatedById.get(item.generated_item_id) : null;
    const catalogId = item.catalog_item_id ?? generated?.catalog_item_id ?? null;
    if (catalogId) catalogIds.push(catalogId);
  }
  const [boilerplateById, catalogById] = await Promise.all([
    fetchByIds<BoilerplateRow>(
      supabase,
      'personalization_boilerplates',
      BOILERPLATE_COLUMNS,
      boilerplateIds,
    ),
    fetchByIds<CatalogRow>(supabase, 'catalog_items', CATALOG_COLUMNS, catalogIds),
  ]);

  const generatedAt = new Date().toISOString();
  return items.map((item) => {
    const config = configurations.get(item.id) ?? {};
    const snapshot = asRecord(config.boilerplateSnapshot);
    const option = optionById.get(asString(config.personalizedPreviewOptionId) ?? '') ?? null;
    const optionMetadata = option ? asRecord(option.metadata) : {};
    // The live option wins: an admin may have regenerated the file after the order was placed.
    const metadata = { ...snapshot, ...optionMetadata };
    const generated = item.generated_item_id
      ? (generatedById.get(item.generated_item_id) ?? null)
      : null;
    const catalog = catalogById.get(item.catalog_item_id ?? generated?.catalog_item_id ?? '');
    const boilerplate = boilerplateById.get(
      option?.boilerplate_id ?? asString(snapshot.boilerplateId) ?? '',
    );
    const banner = latestBannerByItem.get(item.id);
    const position = positions.get(item.id) ?? { index: 0, count: items.length };
    const label = `Order ${orderId.slice(0, 8)} · item ${position.index + 1} of ${position.count}`;

    const sheet = buildTechSheet({
      generatedAt,
      reference: {
        kind: 'order',
        label,
        orderId,
        orderItemId: item.id,
        generatedItemId: item.generated_item_id,
        previewOptionId: option?.id ?? asString(config.personalizedPreviewOptionId),
        catalogItemId: catalog?.id ?? null,
        reviewStatus: generated?.review_status ?? null,
      },
      title: item.title,
      quantity: item.quantity,
      order: {
        status: order.status,
        paymentStatus: order.payment_status,
        createdAt: order.created_at,
        destinationCountry: order.destination_country_code,
      },
      customText: item.custom_text ?? generated?.custom_text ?? null,
      ledColor: item.led_color ?? generated?.color ?? null,
      multiColor: item.multi_color || Boolean(generated?.multi_color),
      bannerSizeKey: item.banner_size_key,
      productType: generated?.product_type ?? null,
      catalog: toCatalogInput(catalog),
      style: toStyleInput(boilerplate, metadata),
      trace: readTrace(metadata.manufacturingSvgTrace),
      files: {
        manufacturingPng:
          option?.manufacturing_file_path ??
          asString(config.hiddenSvgPath) ??
          item.manufacturing_file_path ??
          generated?.manufacturing_file_path ??
          null,
        engraveSvg: asString(metadata.manufacturingSvgPath),
        cutSvg: asString(metadata.manufacturingSvgStrokePath),
        legacySvgContent: generated?.svg_content ?? null,
        bannerDrawings: banner?.drawing_paths ?? [],
        preview:
          item.selected_preview_path ??
          option?.preview_image_path ??
          item.image_path ??
          generated?.selected_preview_path ??
          generated?.preview_path ??
          null,
        customerPhotos: uniquePaths([
          ...item.original_image_paths,
          generated?.source_image_path,
          ...(generated?.original_image_paths ?? []),
        ]),
      },
      bannerInstruction: bannerWarnings(banner),
    });

    return {
      sheet,
      slug: `item-${position.index + 1}-${slugify(item.title)}`,
      orderItemId: item.id,
      previewOptionId: option?.id ?? null,
    };
  });
}

export interface LoadGeneratedPacksOptions {
  /** Restrict to one preview option. */
  optionId?: string;
}

/**
 * Production packs for a generation that has not (necessarily) been ordered:
 * one per preview option, or one for the item itself when it has no options.
 * Returns null when the generation does not exist.
 */
export async function loadGeneratedProductionPacks(
  supabase: SupabaseClient,
  generatedItemId: string,
  options: LoadGeneratedPacksOptions = {},
): Promise<ProductionPack[] | null> {
  const { data: generated, error } = await supabase
    .from('generated_items')
    .select(GENERATED_COLUMNS)
    .eq('id', generatedItemId)
    .maybeSingle<GeneratedRow>();
  if (error || !generated) return null;

  let optionsQuery = supabase
    .from('personalized_preview_options')
    .select(OPTION_COLUMNS)
    .eq('generated_item_id', generatedItemId)
    .order('option_index', { ascending: true });
  if (options.optionId) optionsQuery = optionsQuery.eq('id', options.optionId);
  const { data: optionRows, error: optionsError } = await optionsQuery.returns<OptionRow[]>();
  if (optionsError) throw new Error(optionsError.message);
  if (options.optionId && !optionRows?.length) return [];

  const [boilerplateById, catalogById] = await Promise.all([
    fetchByIds<BoilerplateRow>(
      supabase,
      'personalization_boilerplates',
      BOILERPLATE_COLUMNS,
      (optionRows ?? [])
        .map((option) => option.boilerplate_id)
        .filter((id): id is string => Boolean(id)),
    ),
    fetchByIds<CatalogRow>(
      supabase,
      'catalog_items',
      CATALOG_COLUMNS,
      generated.catalog_item_id ? [generated.catalog_item_id] : [],
    ),
  ]);
  const catalog = toCatalogInput(catalogById.get(generated.catalog_item_id ?? ''));
  const title = generated.title ?? catalog?.title ?? `Generation ${generated.id.slice(0, 8)}`;
  const generatedAt = new Date().toISOString();
  const customerPhotos = uniquePaths([
    generated.source_image_path,
    ...generated.original_image_paths,
  ]);
  const shortId = generated.id.slice(0, 8);

  const build = (option: OptionRow | null, count: number): ProductionPack => {
    const metadata = option ? asRecord(option.metadata) : {};
    const boilerplate = option?.boilerplate_id ? boilerplateById.get(option.boilerplate_id) : null;
    const style = toStyleInput(boilerplate, metadata);
    const label = option
      ? `Generation ${shortId} · option ${option.option_index}${count > 1 ? ` of ${count}` : ''} · not ordered yet`
      : `Generation ${shortId} · not ordered yet`;
    const sheet = buildTechSheet({
      generatedAt,
      reference: {
        kind: 'generation',
        label,
        orderId: null,
        orderItemId: null,
        generatedItemId: generated.id,
        previewOptionId: option?.id ?? null,
        catalogItemId: catalog?.id ?? null,
        reviewStatus: generated.review_status,
      },
      title: style?.name ? `${title}` : title,
      quantity: 1,
      order: null,
      customText: generated.custom_text,
      ledColor: generated.color,
      multiColor: generated.multi_color,
      bannerSizeKey: null,
      productType: generated.product_type,
      catalog,
      style,
      trace: readTrace(metadata.manufacturingSvgTrace),
      files: {
        manufacturingPng: option?.manufacturing_file_path ?? generated.manufacturing_file_path,
        engraveSvg: asString(metadata.manufacturingSvgPath),
        cutSvg: asString(metadata.manufacturingSvgStrokePath),
        legacySvgContent: generated.svg_content,
        bannerDrawings: [],
        preview:
          option?.preview_image_path ?? generated.selected_preview_path ?? generated.preview_path,
        customerPhotos,
      },
      bannerInstruction: null,
    });
    return {
      sheet,
      slug: option
        ? `option-${option.option_index}-${slugify(style?.name ?? title)}`
        : `generation-${shortId}`,
      orderItemId: null,
      previewOptionId: option?.id ?? null,
    };
  };

  if (!optionRows?.length) return [build(null, 1)];
  return optionRows.map((option) => build(option, optionRows.length));
}
