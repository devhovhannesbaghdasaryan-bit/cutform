import { strFromU8, unzipSync } from 'fflate';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildTechSheet, type TechSheetInput } from '@/lib/production-pack/build';
import type { ProductionPack } from '@/lib/production-pack/load';
import { buildProductionPackZip } from '@/lib/production-pack/zip';

type StorageClient = Parameters<typeof buildProductionPackZip>[0];

function fakeStorage(objects: Record<string, Uint8Array>) {
  const requested: string[] = [];
  const client = {
    storage: {
      from(bucket: string) {
        return {
          async download(path: string) {
            requested.push(`${bucket}/${path}`);
            const data = objects[`${bucket}/${path}`];
            return data
              ? { data: new Blob([data as BlobPart]), error: null }
              : { data: null, error: { message: 'Object not found' } };
          },
        };
      },
    },
  } as unknown as StorageClient;
  return { client, requested };
}

async function png(size: number) {
  return new Uint8Array(
    await sharp({
      create: { width: size, height: size, channels: 3, background: { r: 20, g: 20, b: 20 } },
    })
      .png()
      .toBuffer(),
  );
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="280mm" height="280mm"></svg>';

function input(): TechSheetInput {
  return {
    reference: {
      kind: 'order',
      label: 'Order 1a2b3c4d · item 1 of 2',
      orderId: '1a2b3c4d-0000-4000-8000-000000000000',
      orderItemId: 'item-1',
      generatedItemId: null,
      previewOptionId: null,
      catalogItemId: null,
      reviewStatus: 'approved',
    },
    generatedAt: '2026-10-16T10:00:00.000Z',
    title: 'Botanical wreath lid',
    quantity: 1,
    order: { status: 'paid', paymentStatus: 'paid', createdAt: null, destinationCountry: 'AM' },
    customText: 'Anna & Aram',
    ledColor: null,
    multiColor: false,
    bannerSizeKey: null,
    productType: 'standard',
    catalog: null,
    style: {
      id: 's',
      name: 'Botanical wreath lid',
      manufacturingProcess: 'CO2-laser raster engraving, oak wood',
      manufacturingPrompt: null,
      artworkWidthMm: 280,
      requiresSvg: true,
    },
    trace: { units: 'mm', pathCount: 10, inkCoverage: 0.05 },
    files: {
      manufacturingPng: 'u1/manufacturing/a.png',
      engraveSvg: 'u1/manufacturing/a-fill.svg',
      cutSvg: null,
      legacySvgContent: null,
      bannerDrawings: [],
      preview: 'u1/previews/a.png',
      customerPhotos: ['u1/uploads/photo.png'],
    },
    bannerInstruction: null,
  };
}

describe('buildProductionPackZip', () => {
  it('packs the sheet in three formats with the production files byte-exact and reference images shrunk', async () => {
    const manufacturing = await png(64);
    const { client, requested } = fakeStorage({
      'generated-assets/u1/manufacturing/a.png': manufacturing,
      'generated-assets/u1/manufacturing/a-fill.svg': new TextEncoder().encode(SVG),
      'generated-assets/u1/previews/a.png': await png(1600),
      'user-uploads/u1/uploads/photo.png': await png(2000),
    });
    const pack: ProductionPack = {
      sheet: buildTechSheet(input()),
      slug: 'item-1-botanical-wreath-lid',
      orderItemId: 'item-1',
      previewOptionId: null,
    };

    const { bytes, sheets } = await buildProductionPackZip(client, [pack], {
      adminUrl: 'https://uniqraft.org/admin/orders/1a2b3c4d-0000-4000-8000-000000000000',
    });
    const entries = unzipSync(bytes);

    expect(Object.keys(entries).sort()).toEqual([
      'files/01-manufacturing.png',
      'files/02-engrave-fill.svg',
      'files/03-customer-preview.jpg',
      'files/04-customer-photo.jpg',
      'tech-sheet.html',
      'tech-sheet.json',
      'tech-sheet.md',
    ]);
    expect(requested).toHaveLength(4);
    // Production inputs are never resampled.
    expect(Buffer.from(entries['files/01-manufacturing.png'])).toEqual(Buffer.from(manufacturing));
    expect(strFromU8(entries['files/02-engrave-fill.svg'])).toBe(SVG);
    // Reference images become bounded JPEGs.
    const preview = await sharp(entries['files/03-customer-preview.jpg']).metadata();
    expect(preview.format).toBe('jpeg');
    expect(preview.width).toBe(1400);
    const photo = await sharp(entries['files/04-customer-photo.jpg']).metadata();
    expect(photo.width).toBe(1400);

    const html = strFromU8(entries['tech-sheet.html']);
    expect(html).toContain('href="files/02-engrave-fill.svg"');
    expect(html).toContain('<img src="files/03-customer-preview.jpg"');
    expect(html).toContain('Open in admin');
    const json = JSON.parse(strFromU8(entries['tech-sheet.json']));
    expect(json.files.map((file: { fileName: string }) => file.fileName)).toContain(
      '04-customer-photo.jpg',
    );
    expect(sheets[0].status).toBe('ready');
  });

  it('keeps going when a file is missing and flags the sheet for review', async () => {
    const { client } = fakeStorage({
      'generated-assets/u1/manufacturing/a-fill.svg': new TextEncoder().encode(SVG),
    });
    const pack: ProductionPack = {
      sheet: buildTechSheet(input()),
      slug: 'item-1',
      orderItemId: 'item-1',
      previewOptionId: null,
    };

    const { bytes, sheets } = await buildProductionPackZip(client, [pack]);
    const entries = unzipSync(bytes);

    expect(Object.keys(entries).filter((name) => name.startsWith('files/'))).toEqual([
      'files/02-engrave-fill.svg',
    ]);
    expect(sheets[0].status).toBe('review_required');
    expect(sheets[0].warnings).toEqual([
      expect.stringContaining('Manufacturing artwork (PNG) could not be downloaded'),
    ]);
    // Missing reference images do not block production, but are marked in the sheet.
    expect(sheets[0].files.find((file) => file.role === 'customer_photo')?.missing).toBe(true);
    const html = strFromU8(entries['tech-sheet.html']);
    expect(html).toContain('missing in storage');
    expect(html).toContain('could not be downloaded');
  });

  it('gives each pack its own folder plus a README index when zipping several', async () => {
    const { client } = fakeStorage({});
    const first: ProductionPack = {
      sheet: buildTechSheet({ ...input(), files: { ...input().files, customerPhotos: [] } }),
      slug: 'item-1-wreath',
      orderItemId: 'item-1',
      previewOptionId: null,
    };
    const second: ProductionPack = {
      ...first,
      sheet: buildTechSheet({ ...input(), title: 'Quote lid', quantity: 3 }),
      slug: 'item-2-quote',
      orderItemId: 'item-2',
    };

    const { bytes } = await buildProductionPackZip(client, [first, second]);
    const entries = unzipSync(bytes);

    expect(Object.keys(entries).sort()).toEqual([
      'README.md',
      'item-1-wreath/tech-sheet.html',
      'item-1-wreath/tech-sheet.json',
      'item-1-wreath/tech-sheet.md',
      'item-2-quote/tech-sheet.html',
      'item-2-quote/tech-sheet.json',
      'item-2-quote/tech-sheet.md',
    ]);
    const readme = strFromU8(entries['README.md']);
    expect(readme).toContain('| `item-2-quote/` | Quote lid · Botanical wreath lid | 3 |');
    expect(readme).toContain('REVIEW REQUIRED');
  });
});
