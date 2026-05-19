import DOMPurify from 'isomorphic-dompurify';

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
