import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TRACE_OPTIONS,
  inkCoverageOf,
  renderTracedSvg,
  SvgTraceQualityError,
  thresholdImage,
  traceImage,
  traceImageToSvg,
} from '@/lib/svg-trace';

/** Greyscale PNG from a luminance byte per pixel. */
function greyPng(width: number, height: number, paint: (x: number, y: number) => number) {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = paint(x, y);
  }
  return sharp(data, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

/** RGBA PNG; `paint` returns [r, g, b, a]. */
function rgbaPng(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4);
  }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

const inSquare = (x: number, y: number) => x >= 10 && x < 30 && y >= 10 && y < 30;
const squarePng = () => greyPng(64, 64, (x, y) => (inSquare(x, y) ? 0 : 255));

function pathData(svg: string): string {
  return svg.match(/ d="([^"]*)"/)?.[1] ?? '';
}

/**
 * Bounding box of every coordinate in the path data. Only meaningful for
 * traces made with `alphaMax: 0`: Bézier control points of smoothed corners
 * lie outside the shape.
 */
function extremes(d: string) {
  const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe('thresholdImage / inkCoverageOf', () => {
  it('marks pixels at or below the threshold as ink and reports their share', () => {
    const bitmap = thresholdImage(
      { width: 4, height: 1, data: Uint8Array.from([0, 128, 129, 255]) },
      128,
    );
    expect(Array.from(bitmap.data)).toEqual([1, 1, 0, 0]);
    expect(inkCoverageOf(bitmap)).toBe(0.5);
    expect(inkCoverageOf({ width: 0, height: 0, data: new Uint8Array(0) })).toBe(0);
  });
});

describe('traceImageToSvg', () => {
  it('emits an SVG in source pixels by default with the square where it was drawn', async () => {
    const result = await traceImageToSvg(await squarePng(), { alphaMax: 0 });
    expect(result.svg).toContain('width="64" height="64" viewBox="0 0 64 64"');
    expect(result.svg).toContain('fill="#000000" fill-rule="evenodd" stroke="none"');
    expect(result.pathCount).toBe(1);
    expect(result.sourceWidth).toBe(64);
    expect(result.sourceHeight).toBe(64);
    expect(result.threshold).toBe(DEFAULT_TRACE_OPTIONS.threshold);
    expect(result.scale).toBe(DEFAULT_TRACE_OPTIONS.scale);
    expect(result.inkCoverage).toBeCloseTo(400 / 4096, 2);

    const { minX, maxX, minY, maxY } = extremes(pathData(result.svg));
    expect(minX).toBeCloseTo(10, 0);
    expect(maxX).toBeCloseTo(30, 0);
    expect(minY).toBeCloseTo(10, 0);
    expect(maxY).toBeCloseTo(30, 0);
  });

  it('upscaling keeps edges within a third of a source pixel', async () => {
    const result = await traceImageToSvg(await squarePng(), { scale: 3, alphaMax: 0 });
    const { minX, maxX } = extremes(pathData(result.svg));
    expect(Math.abs(minX - 10)).toBeLessThanOrEqual(1 / 3);
    expect(Math.abs(maxX - 30)).toBeLessThanOrEqual(1 / 3);
  });

  it('emits millimetres when the physical width is known', async () => {
    const result = await traceImageToSvg(await squarePng(), { widthMm: 150, alphaMax: 0 });
    expect(result.svg).toContain('width="150mm" height="150mm" viewBox="0 0 150 150"');
    const { minX, maxX } = extremes(pathData(result.svg));
    // 10 px of 64 → 23.44 mm, 30 px → 70.31 mm.
    expect(minX).toBeCloseTo(23.44, 0);
    expect(maxX).toBeCloseTo(70.31, 0);
  });

  it('derives the height in millimetres from the aspect ratio', async () => {
    const png = await greyPng(64, 32, (x, y) => (x >= 10 && x < 30 && y >= 8 && y < 24 ? 0 : 255));
    const result = await traceImageToSvg(png, { widthMm: 100 });
    expect(result.svg).toContain('width="100mm" height="50mm" viewBox="0 0 100 50"');
    const explicit = await traceImageToSvg(png, { widthMm: 100, heightMm: 40 });
    expect(explicit.svg).toContain('width="100mm" height="40mm"');
  });

  it('treats transparent pixels as white background', async () => {
    const png = await rgbaPng(64, 64, (x, y) => (inSquare(x, y) ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    const result = await traceImageToSvg(png);
    expect(result.pathCount).toBe(1);
    expect(result.inkCoverage).toBeCloseTo(400 / 4096, 2);
  });

  it('uses luminance, so dark colours are ink and light colours are not', async () => {
    const png = await rgbaPng(64, 64, (x, y) =>
      inSquare(x, y) ? [20, 20, 120, 255] : [250, 250, 200, 255],
    );
    const result = await traceImageToSvg(png);
    expect(result.pathCount).toBe(1);
  });

  it('applies the threshold to decide what counts as ink', async () => {
    const png = await greyPng(64, 64, (x, y) => (inSquare(x, y) ? 200 : 255));
    await expect(traceImageToSvg(png, { threshold: 128 })).rejects.toBeInstanceOf(
      SvgTraceQualityError,
    );
    const result = await traceImageToSvg(png, { threshold: 220 });
    expect(result.pathCount).toBe(1);
  });

  it('drops specks below minSpeckleArea but keeps real marks', async () => {
    const png = await greyPng(64, 64, (x, y) =>
      inSquare(x, y) || (x === 50 && y === 50) ? 0 : 255,
    );
    expect((await traceImageToSvg(png)).pathCount).toBe(1);
    expect((await traceImageToSvg(png, { minSpeckleArea: 0 })).pathCount).toBe(2);
  });

  it('rejects an almost empty page', async () => {
    const png = await greyPng(64, 64, () => 255);
    const error = await traceImageToSvg(png).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SvgTraceQualityError);
    expect((error as SvgTraceQualityError).inkCoverage).toBe(0);
    expect((error as SvgTraceQualityError).message).toContain('almost empty');
  });

  it('rejects a page that is mostly ink', async () => {
    const png = await greyPng(64, 64, (x, y) => (inSquare(x, y) ? 255 : 0));
    const error = await traceImageToSvg(png).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SvgTraceQualityError);
    expect((error as SvgTraceQualityError).inkCoverage).toBeCloseTo(1 - 400 / 4096, 2);
    expect((error as SvgTraceQualityError).message).toContain('above the 25% limit');
  });

  it('can disable or customise the coverage check', async () => {
    const blank = await greyPng(64, 64, () => 255);
    const result = await traceImageToSvg(blank, { inkCoverage: false });
    expect(result.pathCount).toBe(0);
    expect(pathData(result.svg)).toBe('');

    await expect(
      traceImageToSvg(await squarePng(), { inkCoverage: { min: 0.2, max: 0.5 } }),
    ).rejects.toBeInstanceOf(SvgTraceQualityError);
  });

  it('validates its options', async () => {
    const png = await squarePng();
    await expect(traceImageToSvg(png, { threshold: 300 })).rejects.toThrow('threshold');
    await expect(traceImageToSvg(png, { scale: 0 })).rejects.toThrow('scale');
    await expect(traceImageToSvg(png, { widthMm: -1 })).rejects.toThrow('widthMm');
  });

  it('rejects data that is not an image', async () => {
    await expect(traceImageToSvg(Buffer.from('not a png'))).rejects.toThrow();
  });

  it('paints with fill by default and reports it', async () => {
    const result = await traceImageToSvg(await squarePng());
    expect(result.paint).toBe('fill');
    expect(result.svg).not.toContain('stroke-width');
  });

  it('emits the same outlines as stroke-only lines when asked', async () => {
    const png = await squarePng();
    const fill = await traceImageToSvg(png, { alphaMax: 0 });
    const stroke = await traceImageToSvg(png, { alphaMax: 0, paint: 'stroke' });
    expect(stroke.paint).toBe('stroke');
    expect(stroke.svg).toContain(
      `fill="none" stroke="#000000" stroke-width="${DEFAULT_STROKE_WIDTH.px}" stroke-linecap="round" stroke-linejoin="round"`,
    );
    expect(stroke.svg).not.toContain('fill-rule');
    expect(pathData(stroke.svg)).toBe(pathData(fill.svg));
    expect(stroke.pathCount).toBe(fill.pathCount);
  });

  it('uses a hairline stroke in millimetres and honours a custom width', async () => {
    const png = await squarePng();
    const stroke = await traceImageToSvg(png, { widthMm: 150, paint: 'stroke' });
    expect(stroke.svg).toContain('width="150mm" height="150mm"');
    expect(stroke.svg).toContain(`stroke-width="${DEFAULT_STROKE_WIDTH.mm}"`);
    const custom = await traceImageToSvg(png, { widthMm: 150, paint: 'stroke', strokeWidth: 0.25 });
    expect(custom.svg).toContain('stroke-width="0.25"');
  });
});

describe('traceImage / renderTracedSvg', () => {
  it('traces once and renders both paint variants from the same geometry', async () => {
    const traced = await traceImage(await squarePng(), { widthMm: 100 });
    expect(traced.units).toBe('mm');
    expect(traced.viewWidth).toBe(100);
    expect(traced.viewHeight).toBe(100);
    expect(traced.pathCount).toBe(1);
    expect(traced.pathData).toMatch(/^M/);

    const fill = renderTracedSvg(traced);
    const stroke = renderTracedSvg(traced, { paint: 'stroke' });
    expect(fill).toContain('fill="#000000" fill-rule="evenodd" stroke="none"');
    expect(stroke).toContain('fill="none" stroke="#000000"');
    expect(pathData(fill)).toBe(traced.pathData);
    expect(pathData(stroke)).toBe(traced.pathData);
    expect(fill).toContain('width="100mm" height="100mm" viewBox="0 0 100 100"');
    expect(stroke).toContain('width="100mm" height="100mm" viewBox="0 0 100 100"');
  });

  it('reports pixel units without a physical size', async () => {
    const traced = await traceImage(await squarePng());
    expect(traced.units).toBe('px');
    expect(renderTracedSvg(traced)).toContain('width="64" height="64"');
  });

  it('rejects a non-positive stroke width', async () => {
    const traced = await traceImage(await squarePng());
    expect(() => renderTracedSvg(traced, { paint: 'stroke', strokeWidth: 0 })).toThrow(
      'strokeWidth',
    );
  });
});
