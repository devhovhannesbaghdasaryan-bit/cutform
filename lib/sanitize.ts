import DOMPurify from 'isomorphic-dompurify';

export interface SvgPreflightResult {
  cleanSvg: string;
  warnings: string[];
}

/**
 * Sanitize SVG markup before persisting. Strips <script>, on*= handlers,
 * external xlink:href, javascript: URIs, and <foreignObject>.
 * Throws if the result doesn't contain a valid <svg root.
 */
export function sanitizeSvg(input: string): string {
  const clean = DOMPurify.sanitize(input, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover'],
  });
  if (!clean.includes('<svg')) {
    throw new Error('Sanitized output is not a valid SVG');
  }
  return clean;
}

export function preflightSvg(input: string): SvgPreflightResult {
  const warnings: string[] = [];
  const cleanSvg = sanitizeSvg(input);
  const lower = cleanSvg.toLowerCase();

  if (!/viewbox\s*=/.test(lower)) warnings.push('SVG is missing a viewBox.');
  if (/<image[\s>]/i.test(cleanSvg)) warnings.push('SVG contains raster image elements.');
  if (/<a[\s>]/i.test(cleanSvg)) warnings.push('SVG contains links; remove before production.');
  if (/href\s*=\s*["']https?:/i.test(cleanSvg)) warnings.push('SVG references external URLs.');
  if (/javascript:/i.test(cleanSvg)) warnings.push('SVG contains a javascript: URI.');
  if (/<style[\s>]/i.test(cleanSvg)) warnings.push('SVG contains embedded CSS; verify cutter compatibility.');
  if (!/(<path[\s>]|<polygon[\s>]|<polyline[\s>]|<circle[\s>]|<rect[\s>])/i.test(cleanSvg)) {
    warnings.push('SVG does not contain common cuttable vector elements.');
  }
  if (!/(data-layer|inkscape:label|id=["'][^"']*(cut|engrave|score|outline|base)[^"']*["'])/i.test(cleanSvg)) {
    warnings.push('SVG is missing obvious cut/engrave layer markers.');
  }

  const fatalPatterns = [
    /<script[\s>]/i,
    /<foreignObject[\s>]/i,
    /on[a-z]+\s*=/i,
    /javascript:/i,
    /href\s*=\s*["']https?:/i,
  ];
  if (fatalPatterns.some((pattern) => pattern.test(cleanSvg))) {
    throw new Error('SVG contains unsafe or external references.');
  }

  return { cleanSvg, warnings };
}
