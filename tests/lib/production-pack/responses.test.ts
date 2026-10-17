import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildTechSheet, type TechSheetInput } from '@/lib/production-pack/build';
import type { ProductionPack } from '@/lib/production-pack/load';
import {
  productionPackDownloadResponse,
  techSheetHtmlResponse,
} from '@/lib/production-pack/responses';

type StorageClient = Parameters<typeof productionPackDownloadResponse>[0];

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="280mm" height="280mm"></svg>';

function fakeStorage() {
  const signed: string[] = [];
  const client = {
    storage: {
      from(bucket: string) {
        return {
          async download(path: string) {
            return path.endsWith('.svg')
              ? { data: new Blob([SVG]), error: null }
              : { data: null, error: { message: 'Object not found' } };
          },
          async createSignedUrl(path: string) {
            signed.push(`${bucket}/${path}`);
            return { data: { signedUrl: `https://storage.test/${bucket}/${path}?token=t` } };
          },
        };
      },
    },
  } as unknown as StorageClient;
  return { client, signed };
}

function pack(): ProductionPack {
  const input: TechSheetInput = {
    reference: {
      kind: 'order',
      label: 'Order 1a2b3c4d · item 1 of 1',
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
    order: { status: 'paid', paymentStatus: 'paid', createdAt: null, destinationCountry: null },
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
      preview: null,
      customerPhotos: [],
    },
    bannerInstruction: null,
  };
  return {
    sheet: buildTechSheet(input),
    slug: 'item-1-botanical-wreath-lid',
    orderItemId: 'item-1',
    previewOptionId: null,
  };
}

describe('productionPackDownloadResponse', () => {
  it('streams the zip as an attachment without touching storage uploads', async () => {
    const { client } = fakeStorage();
    const response = await productionPackDownloadResponse(client, [pack()], {
      fileName: 'uniqraft-order-1a2b3c4d-item 1.zip',
      adminUrl: null,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="uniqraft-order-1a2b3c4d-item-1.zip"',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get('content-length')).toBe(String(bytes.byteLength));
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual([
      'files/02-engrave-fill.svg',
      'tech-sheet.html',
      'tech-sheet.json',
      'tech-sheet.md',
    ]);
    expect(strFromU8(entries['tech-sheet.md'])).toContain('could not be downloaded');
  });
});

describe('techSheetHtmlResponse', () => {
  it('renders the sheet with signed links to the production files', async () => {
    const { client, signed } = fakeStorage();
    const response = await techSheetHtmlResponse(client, pack(), {
      adminUrl: 'https://uniqraft.org/admin/orders/1a2b3c4d-0000-4000-8000-000000000000',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(signed.sort()).toEqual([
      'generated-assets/u1/manufacturing/a-fill.svg',
      'generated-assets/u1/manufacturing/a.png',
    ]);
    expect(html).toContain(
      'href="https://storage.test/generated-assets/u1/manufacturing/a-fill.svg?token=t"',
    );
    expect(html).toContain('Open in admin');
  });
});
