import { describe, expect, it } from 'vitest';
import { type BinaryBitmap, curveToPathData, traceBitmap } from '@/lib/svg-trace/potrace';

/** Builds a bitmap from ASCII art: `#` is ink, anything else background. */
function bitmapFrom(rows: string[]): BinaryBitmap {
  const width = rows[0].length;
  const data = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) data[y * width + x] = row[x] === '#' ? 1 : 0;
  });
  return { width, height: rows.length, data };
}

function filledRect(width: number, height: number, x0: number, y0: number, w: number, h: number) {
  const data = new Uint8Array(width * height);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data[y * width + x] = 1;
  return { width, height, data };
}

function disc(size: number, cx: number, cy: number, radius: number): BinaryBitmap {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) data[y * size + x] = 1;
    }
  }
  return { width: size, height: size, data };
}

function coordinatesOf(pathData: string): { xs: number[]; ys: number[] } {
  const numbers = pathData.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  numbers.forEach((n, i) => {
    (i % 2 === 0 ? xs : ys).push(n);
  });
  return { xs, ys };
}

describe('traceBitmap', () => {
  it('returns no paths for an empty bitmap', () => {
    expect(traceBitmap({ width: 8, height: 8, data: new Uint8Array(64) })).toEqual([]);
  });

  it('rejects a bitmap whose data does not match its size', () => {
    expect(() => traceBitmap({ width: 4, height: 4, data: new Uint8Array(3) })).toThrow(
      'does not match',
    );
  });

  it('traces a filled rectangle as one outer path with the exact pixel area and bounds', () => {
    const [path, ...rest] = traceBitmap(filledRect(40, 40, 10, 12, 16, 8), { alphaMax: 0 });
    expect(rest).toHaveLength(0);
    expect(path.sign).toBe('+');
    expect(path.area).toBe(16 * 8);

    const d = curveToPathData(path.curve);
    expect(d).toMatch(/^M /);
    expect(d).toMatch(/ Z$/);
    const { xs, ys } = coordinatesOf(d);
    expect(Math.min(...xs)).toBe(10);
    expect(Math.max(...xs)).toBe(26);
    expect(Math.min(...ys)).toBe(12);
    expect(Math.max(...ys)).toBe(20);
  });

  it('keeps right angles sharp and smooths shallow corners at the default alphaMax', () => {
    const square = filledRect(40, 40, 10, 10, 20, 20);
    const squareD = curveToPathData(traceBitmap(square)[0].curve);
    expect(squareD).not.toContain('C ');
    expect(squareD).toContain('L ');

    const circleD = curveToPathData(traceBitmap(disc(64, 32, 32, 20))[0].curve);
    expect(circleD).toContain('C ');
    expect(
      curveToPathData(traceBitmap(disc(64, 32, 32, 20), { alphaMax: 0 })[0].curve),
    ).not.toContain('C ');
  });

  it('traces a hole as a separate negative path', () => {
    const paths = traceBitmap(
      bitmapFrom([
        '..........',
        '.########.',
        '.#......#.',
        '.#......#.',
        '.#......#.',
        '.########.',
        '..........',
      ]),
    );
    expect(paths.map((p) => p.sign).sort()).toEqual(['+', '-']);
    const hole = paths.find((p) => p.sign === '-');
    expect(hole?.area).toBe(6 * 3);
  });

  it('drops regions no larger than turdSize', () => {
    const bitmap = bitmapFrom([
      '............',
      '.##.........',
      '............',
      '.....##.....',
      '.....##.....',
      '............',
    ]);
    expect(traceBitmap(bitmap, { turdSize: 2 })).toHaveLength(1);
    expect(traceBitmap(bitmap, { turdSize: 0 })).toHaveLength(2);
    expect(traceBitmap(bitmap, { turdSize: 4 })).toHaveLength(0);
  });

  it('produces fewer segments with curve optimisation than without', () => {
    const bitmap = disc(64, 32, 32, 20);
    const optimised = traceBitmap(bitmap, { optCurve: true })[0].curve.n;
    const raw = traceBitmap(bitmap, { optCurve: false })[0].curve.n;
    expect(optimised).toBeLessThan(raw);
    expect(optimised).toBeGreaterThanOrEqual(4);
  });

  it('respects the turn policy at ambiguous diagonal joins', () => {
    // Two squares touching only at a corner: "black" keeps them as one region,
    // "white" splits them.
    const bitmap = bitmapFrom(['##..', '##..', '..##', '..##']);
    expect(traceBitmap(bitmap, { turnPolicy: 'black', turdSize: 0 })).toHaveLength(1);
    expect(traceBitmap(bitmap, { turnPolicy: 'white', turdSize: 0 })).toHaveLength(2);
  });
});

describe('curveToPathData', () => {
  it('scales every coordinate and emits only M, L, C and Z commands', () => {
    const [path] = traceBitmap(filledRect(20, 20, 4, 4, 8, 8), { alphaMax: 0 });
    const d = curveToPathData(path.curve, 2.5);
    expect(d.replace(/[\d.,\s-]/g, '')).toMatch(/^M[LC]+Z$/);
    const { xs, ys } = coordinatesOf(d);
    expect(Math.min(...xs)).toBe(10);
    expect(Math.max(...xs)).toBe(30);
    expect(Math.min(...ys)).toBe(10);
    expect(Math.max(...ys)).toBe(30);
  });
});
