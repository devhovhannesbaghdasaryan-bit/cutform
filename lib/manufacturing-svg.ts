import { uploadToBucket } from '@/lib/storage';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { renderTracedSvg, traceImage } from '@/lib/svg-trace';

export interface ManufacturingSvgTrace {
  inkCoverage: number;
  pathCount: number;
  units: 'mm' | 'px';
}

export interface ManufacturingSvgFiles {
  /** Filled outlines: the engrave (fill) layer for the laser. */
  fillPath: string;
  /** Stroked outlines, no fill: the cut/score (line) layer for the laser. */
  strokePath: string;
  trace: ManufacturingSvgTrace;
}

export interface TraceManufacturingSvgsOptions {
  pngBytes: Uint8Array;
  /** Physical artwork width; the SVGs are emitted in millimetres when set. */
  artworkWidthMm: number | null;
  /** Storage folder inside `generated-assets`, without a trailing slash. */
  directory: string;
}

/**
 * Traces the manufacturing PNG once and stores both paint variants of the
 * result side by side as `<id>-fill.svg` and `<id>-stroke.svg`, so the
 * operator can pick the engrave or the cut version without re-tracing.
 * Throws `SvgTraceQualityError` when the PNG is not usable line work.
 */
export async function traceAndStoreManufacturingSvgs(
  supabase: Pick<TypedSupabaseClient, 'storage'>,
  { pngBytes, artworkWidthMm, directory }: TraceManufacturingSvgsOptions,
): Promise<ManufacturingSvgFiles> {
  const traced = await traceImage(pngBytes, { widthMm: artworkWidthMm });
  const basePath = `${directory}/${crypto.randomUUID()}`;
  const upload = (paint: 'fill' | 'stroke') =>
    uploadToBucket(supabase, {
      bucket: 'generated-assets',
      path: `${basePath}-${paint}.svg`,
      body: Buffer.from(renderTracedSvg(traced, { paint }), 'utf8'),
      contentType: 'image/svg+xml',
    });
  const [fillPath, strokePath] = await Promise.all([upload('fill'), upload('stroke')]);
  return {
    fillPath,
    strokePath,
    trace: {
      inkCoverage: traced.inkCoverage,
      pathCount: traced.pathCount,
      units: traced.units,
    },
  };
}
