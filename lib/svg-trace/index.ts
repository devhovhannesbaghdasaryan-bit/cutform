import sharp from 'sharp';
import {
  type BinaryBitmap,
  curveToPathData,
  DEFAULT_POTRACE_PARAMS,
  type PotraceParams,
  traceBitmap,
} from './potrace';

export interface TraceImageOptions extends Partial<PotraceParams> {
  /** Luminance (0–255) at or below which a pixel counts as ink. */
  threshold?: number;
  /**
   * Upscale factor applied before thresholding. The resampler's anti-aliased
   * edges become sub-pixel-accurate boundaries, so curves fit the artwork
   * instead of the source pixel grid.
   */
  scale?: number;
  /**
   * Ink regions smaller than this many source-image pixels are dropped as
   * noise (scaled with `scale`). Overrides `turdSize`, which is in bitmap
   * pixels after upscaling.
   */
  minSpeckleArea?: number;
  /** Physical width of the whole canvas. When set, the SVG is emitted in millimetres. */
  widthMm?: number | null;
  /** Physical height; derived from the aspect ratio when only `widthMm` is set. */
  heightMm?: number | null;
  /**
   * Accepted share of ink pixels after thresholding. Traces outside the range
   * (an empty page, or a grey wash that thresholded into a blob) throw
   * {@link SvgTraceQualityError}. `false` disables the check.
   */
  inkCoverage?: { min: number; max: number } | false;
}

export interface TraceImageResult {
  svg: string;
  /** Share of ink pixels after thresholding, 0–1. */
  inkCoverage: number;
  /** Closed curves in the SVG (outer boundaries and holes). */
  pathCount: number;
  /** Source image size in pixels. */
  sourceWidth: number;
  sourceHeight: number;
  threshold: number;
  scale: number;
}

export const DEFAULT_TRACE_OPTIONS = {
  threshold: 128,
  scale: 3,
  minSpeckleArea: 10,
  inkCoverage: { min: 0.005, max: 0.25 },
} as const;

export class SvgTraceQualityError extends Error {
  readonly inkCoverage: number;
  readonly bounds: { min: number; max: number };

  constructor(inkCoverage: number, bounds: { min: number; max: number }) {
    const percent = (inkCoverage * 100).toFixed(2);
    super(
      inkCoverage < bounds.min
        ? `Traced artwork is almost empty (${percent}% ink). The manufacturing PNG probably has no usable line work.`
        : `Traced artwork is ${percent}% ink, above the ${(bounds.max * 100).toFixed(0)}% limit. The manufacturing PNG probably contains shading or filled areas.`,
    );
    this.name = 'SvgTraceQualityError';
    this.inkCoverage = inkCoverage;
    this.bounds = bounds;
  }
}

/** Grey image, one luminance byte per pixel, row-major. */
export interface LuminanceImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Marks every pixel at or below `threshold` as ink. */
export function thresholdImage(image: LuminanceImage, threshold: number): BinaryBitmap {
  const data = new Uint8Array(image.width * image.height);
  for (let i = 0; i < data.length; i++) {
    data[i] = image.data[i] <= threshold ? 1 : 0;
  }
  return { width: image.width, height: image.height, data };
}

export function inkCoverageOf(bitmap: BinaryBitmap): number {
  if (bitmap.data.length === 0) return 0;
  let ink = 0;
  for (let i = 0; i < bitmap.data.length; i++) ink += bitmap.data[i];
  return ink / bitmap.data.length;
}

/**
 * Decodes a PNG/JPEG/WebP, composites transparency over white, converts to
 * greyscale and upscales it with bicubic interpolation.
 */
export async function decodeToLuminance(
  image: Uint8Array | Buffer,
  scale: number,
): Promise<LuminanceImage & { sourceWidth: number; sourceHeight: number }> {
  const metadata = await sharp(image).metadata();
  const sourceWidth = metadata.width;
  const sourceHeight = metadata.height;
  if (!sourceWidth || !sourceHeight) throw new Error('Image has no dimensions.');

  // `resize` samples at pixel corners, which lands samples exactly on hard
  // edges and biases the thresholded shape by one upscaled pixel. An affine
  // scale with a half-pixel input offset samples at pixel centres instead.
  const centreOffset = 0.5 - 0.5 / scale;
  const { data, info } = await sharp(image)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .affine(
      [
        [scale, 0],
        [0, scale],
      ],
      { interpolator: 'bicubic', idx: centreOffset, idy: centreOffset, background: '#ffffff' },
    )
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1)
    throw new Error(`Expected a single-channel image, got ${info.channels}.`);

  return {
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    sourceWidth,
    sourceHeight,
  };
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/**
 * Traces a raster line drawing into a single-colour SVG for laser work.
 *
 * Coordinates are in millimetres when `widthMm` is given (1 user unit = 1 mm,
 * which is what Inkscape and laser software expect), otherwise in source-image
 * pixels.
 */
export async function traceImageToSvg(
  image: Uint8Array | Buffer,
  options: TraceImageOptions = {},
): Promise<TraceImageResult> {
  const threshold = options.threshold ?? DEFAULT_TRACE_OPTIONS.threshold;
  const scale = options.scale ?? DEFAULT_TRACE_OPTIONS.scale;
  const minSpeckleArea = options.minSpeckleArea ?? DEFAULT_TRACE_OPTIONS.minSpeckleArea;
  const coverageBounds =
    options.inkCoverage === undefined ? DEFAULT_TRACE_OPTIONS.inkCoverage : options.inkCoverage;
  if (!(threshold >= 0 && threshold <= 255)) throw new Error('threshold must be within 0..255.');
  if (!(scale > 0)) throw new Error('scale must be positive.');

  const luminance = await decodeToLuminance(image, scale);
  const bitmap = thresholdImage(luminance, threshold);

  const inkCoverage = inkCoverageOf(bitmap);
  if (coverageBounds && (inkCoverage < coverageBounds.min || inkCoverage > coverageBounds.max)) {
    throw new SvgTraceQualityError(inkCoverage, coverageBounds);
  }

  const paths = traceBitmap(bitmap, {
    turnPolicy: options.turnPolicy ?? DEFAULT_POTRACE_PARAMS.turnPolicy,
    turdSize: options.turdSize ?? minSpeckleArea * scale * scale,
    alphaMax: options.alphaMax ?? DEFAULT_POTRACE_PARAMS.alphaMax,
    optCurve: options.optCurve ?? DEFAULT_POTRACE_PARAMS.optCurve,
    optTolerance: options.optTolerance ?? DEFAULT_POTRACE_PARAMS.optTolerance,
  });

  const { sourceWidth, sourceHeight } = luminance;
  const widthMm = options.widthMm ?? null;
  const heightMm = widthMm ? (options.heightMm ?? (widthMm * sourceHeight) / sourceWidth) : null;
  if (widthMm !== null && !(widthMm > 0)) throw new Error('widthMm must be positive.');
  if (heightMm !== null && !(heightMm > 0)) throw new Error('heightMm must be positive.');

  // User units: millimetres when a physical size is known, else source pixels.
  const unitsPerPixel = widthMm ? widthMm / bitmap.width : 1 / scale;
  const viewWidth = widthMm ?? sourceWidth;
  const viewHeight = heightMm ?? sourceHeight;
  const sizeAttrs = widthMm
    ? `width="${formatNumber(viewWidth)}mm" height="${formatNumber(viewHeight)}mm"`
    : `width="${formatNumber(viewWidth)}" height="${formatNumber(viewHeight)}"`;

  const pathData = paths.map((path) => curveToPathData(path.curve, unitsPerPixel)).join(' ');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ${sizeAttrs} ` +
    `viewBox="0 0 ${formatNumber(viewWidth)} ${formatNumber(viewHeight)}">\n` +
    `\t<path d="${pathData}" fill="#000000" fill-rule="evenodd" stroke="none"/>\n` +
    '</svg>';

  return {
    svg,
    inkCoverage,
    pathCount: paths.length,
    sourceWidth,
    sourceHeight,
    threshold,
    scale,
  };
}
