import { trace, type PotraceOptions } from 'potrace';

/** Traces a raster image (PNG/JPEG buffer) into an SVG string using potrace. */
export function tracePngToSvg(image: Buffer, options?: Partial<PotraceOptions>): Promise<string> {
  return new Promise((resolve, reject) => {
    trace(image, options ?? {}, (error, svg) => {
      if (error) reject(error instanceof Error ? error : new Error(String(error)));
      else resolve(svg);
    });
  });
}
