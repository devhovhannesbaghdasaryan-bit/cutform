import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { traceAndStoreManufacturingSvgs } from '@/lib/manufacturing-svg';
import { SvgTraceQualityError } from '@/lib/svg-trace';

type StorageClient = Parameters<typeof traceAndStoreManufacturingSvgs>[0];

function fakeStorageClient() {
  const uploads: { bucket: string; path: string; body: Buffer; contentType: string }[] = [];
  const client = {
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, body: Buffer, options: { contentType: string }) {
            uploads.push({ bucket, path, body, contentType: options.contentType });
            return { error: null };
          },
        };
      },
    },
  } as unknown as StorageClient;
  return { client, uploads };
}

function greyPng(paint: (x: number, y: number) => number) {
  const size = 64;
  const data = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data[y * size + x] = paint(x, y);
  return sharp(data, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
}

const squarePng = () => greyPng((x, y) => (x >= 10 && x < 30 && y >= 10 && y < 30 ? 0 : 255));

describe('traceAndStoreManufacturingSvgs', () => {
  it('stores a fill and a stroke SVG from one trace under a shared id', async () => {
    const { client, uploads } = fakeStorageClient();
    const files = await traceAndStoreManufacturingSvgs(client, {
      pngBytes: new Uint8Array(await squarePng()),
      artworkWidthMm: 120,
      directory: 'user-1/personalized-items/manufacturing',
    });

    expect(uploads).toHaveLength(2);
    for (const upload of uploads) {
      expect(upload.bucket).toBe('generated-assets');
      expect(upload.contentType).toBe('image/svg+xml');
    }
    const fill = uploads.find((u) => u.path === files.fillPath);
    const stroke = uploads.find((u) => u.path === files.strokePath);
    expect(fill?.path).toMatch(
      /^user-1\/personalized-items\/manufacturing\/[0-9a-f-]{36}-fill\.svg$/,
    );
    expect(stroke?.path).toBe(files.fillPath.replace(/-fill\.svg$/, '-stroke.svg'));
    expect(fill?.body.toString('utf8')).toContain('fill="#000000"');
    expect(stroke?.body.toString('utf8')).toContain('fill="none" stroke="#000000"');
    expect(fill?.body.toString('utf8')).toContain('width="120mm"');

    expect(files.trace.units).toBe('mm');
    expect(files.trace.pathCount).toBe(1);
    expect(files.trace.inkCoverage).toBeCloseTo(400 / 4096, 2);
  });

  it('reports pixel units without an artwork width', async () => {
    const { client } = fakeStorageClient();
    const files = await traceAndStoreManufacturingSvgs(client, {
      pngBytes: new Uint8Array(await squarePng()),
      artworkWidthMm: null,
      directory: 'user-1/x',
    });
    expect(files.trace.units).toBe('px');
  });

  it('stores nothing when the PNG fails the quality check', async () => {
    const { client, uploads } = fakeStorageClient();
    await expect(
      traceAndStoreManufacturingSvgs(client, {
        pngBytes: new Uint8Array(await greyPng(() => 255)),
        artworkWidthMm: 100,
        directory: 'user-1/x',
      }),
    ).rejects.toBeInstanceOf(SvgTraceQualityError);
    expect(uploads).toHaveLength(0);
  });
});
