import 'server-only';

import { strToU8, zipSync, type Zippable } from 'fflate';
import sharp from 'sharp';
import type { ProductionPack } from '@/lib/production-pack/load';
import { renderTechSheetHtml } from '@/lib/production-pack/render-html';
import { renderTechSheetMarkdown } from '@/lib/production-pack/render-markdown';
import type { ProductionFile, TechSheet } from '@/lib/production-pack/types';
import type { TypedSupabaseClient } from '@/lib/supabase/types';

type StorageClient = Pick<TypedSupabaseClient, 'storage'>;

/** Longest edge of reference images (preview, customer photo) inside the pack. Production files are never resampled. */
const REFERENCE_IMAGE_MAX_PX = 1400;

interface LoadedFile {
  file: ProductionFile;
  bytes: Uint8Array | null;
}

async function downloadFile(supabase: StorageClient, file: ProductionFile) {
  if (file.content !== null) return strToU8(file.content);
  if (!file.bucket || !file.storagePath) return null;
  const { data, error } = await supabase.storage.from(file.bucket).download(file.storagePath);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Reference images only exist for the operator to look at, so they are shrunk
 * to keep the pack small; a failure to decode keeps the original bytes.
 */
async function shrinkReferenceImage(file: ProductionFile, bytes: Uint8Array) {
  if (!file.reference || !/^image\/(png|jpeg|webp)$/.test(file.contentType)) {
    return { file, bytes };
  }
  try {
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({
        width: REFERENCE_IMAGE_MAX_PX,
        height: REFERENCE_IMAGE_MAX_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return {
      file: {
        ...file,
        fileName: file.fileName.replace(/\.[a-z0-9]+$/i, '.jpg'),
        contentType: 'image/jpeg',
      },
      bytes: new Uint8Array(jpeg),
    };
  } catch {
    return { file, bytes };
  }
}

async function loadPackFiles(supabase: StorageClient, sheet: TechSheet): Promise<LoadedFile[]> {
  return Promise.all(
    sheet.files.map(async (file) => {
      const bytes = await downloadFile(supabase, file);
      if (!bytes) return { file: { ...file, missing: true }, bytes: null };
      return shrinkReferenceImage(file, bytes);
    }),
  );
}

/** The sheet with the files as they were actually packed (renamed, or missing). */
function withPackedFiles(sheet: TechSheet, loaded: LoadedFile[]): TechSheet {
  const files = loaded.map((entry) => entry.file);
  const missing = files.filter((file) => file.missing);
  const missingProduction = missing.filter((file) => !file.reference);
  const warnings = [
    ...sheet.warnings,
    ...missingProduction.map(
      (file) =>
        `${file.label} could not be downloaded from storage (${file.storagePath ?? file.fileName}); regenerate it before production.`,
    ),
  ];
  return {
    ...sheet,
    files,
    warnings,
    status: warnings.length ? 'review_required' : sheet.status,
  };
}

function isCompressed(contentType: string) {
  return /^image\/(png|jpeg|webp)$/.test(contentType) || contentType === 'application/zip';
}

export interface BuildProductionPackZipOptions {
  /** Absolute admin URL the sheets link back to. */
  adminUrl?: string | null;
  /** Name of the root folder inside the zip; files sit at the root when omitted. */
  rootFolder?: string | null;
}

export interface ProductionPackZip {
  bytes: Uint8Array;
  /** Sheets as packed, for callers that want to report the final status. */
  sheets: TechSheet[];
}

/**
 * Zips one or more production packs. A single pack lands at the zip root
 * (`tech-sheet.html`, `files/…`); several packs get one folder each plus a
 * `README.md` index.
 */
export async function buildProductionPackZip(
  supabase: StorageClient,
  packs: ProductionPack[],
  options: BuildProductionPackZipOptions = {},
): Promise<ProductionPackZip> {
  const entries: Zippable = {};
  const sheets: TechSheet[] = [];
  const multi = packs.length > 1;
  const prefix = options.rootFolder ? `${options.rootFolder}/` : '';

  for (const pack of packs) {
    const loaded = await loadPackFiles(supabase, pack.sheet);
    const sheet = withPackedFiles(pack.sheet, loaded);
    sheets.push(sheet);
    const folder = multi ? `${prefix}${pack.slug}/` : prefix;

    for (const { file, bytes } of loaded) {
      if (!bytes) continue;
      entries[`${folder}files/${file.fileName}`] = [
        bytes,
        { level: isCompressed(file.contentType) ? 0 : 6 },
      ];
    }
    entries[`${folder}tech-sheet.html`] = strToU8(
      renderTechSheetHtml(sheet, {
        fileHref: (file) => (file.missing ? null : `files/${file.fileName}`),
        adminUrl: options.adminUrl ?? null,
      }),
    );
    entries[`${folder}tech-sheet.md`] = strToU8(renderTechSheetMarkdown(sheet));
    entries[`${folder}tech-sheet.json`] = strToU8(JSON.stringify(sheet, null, 2));
  }

  if (multi) {
    const lines = [
      `# Production pack · ${packs[0]?.sheet.reference.orderId ? `order ${packs[0].sheet.reference.orderId}` : packs[0]?.sheet.product.title}`,
      '',
      'One folder per item. Open `tech-sheet.html` in each folder; only files marked "production input" go to a machine.',
      '',
      '| Folder | Item | Qty | Process | Status |',
      '| --- | --- | --- | --- | --- |',
      ...packs.map(
        (pack, index) =>
          `| \`${pack.slug}/\` | ${sheets[index].product.displayTitle} | ${sheets[index].order.quantity} | ${sheets[index].process.name} | ${
            sheets[index].status === 'ready' ? 'ready' : 'REVIEW REQUIRED'
          } |`,
      ),
      '',
      `Generated ${new Date().toISOString()}.`,
      '',
    ];
    entries[`${prefix}README.md`] = strToU8(lines.join('\n'));
  }

  return { bytes: zipSync(entries), sheets };
}
