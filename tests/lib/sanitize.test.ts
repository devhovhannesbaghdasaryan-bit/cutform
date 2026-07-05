import { describe, expect, it } from 'vitest';
import { preflightSvg, sanitizeSvg } from '@/lib/sanitize';

const SAFE_SVG =
  '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path id="cut-outline" d="M0 0h10v10H0z"/></svg>';

describe('sanitizeSvg', () => {
  it('strips script tags and event handlers', () => {
    const dirty =
      '<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10" onclick="alert(1)"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).toContain('<rect');
  });

  it('throws when the input is not an SVG', () => {
    expect(() => sanitizeSvg('<div>not svg</div>')).toThrow('not a valid SVG');
  });
});

describe('preflightSvg', () => {
  it('accepts a production-ready SVG without warnings', () => {
    const result = preflightSvg(SAFE_SVG);
    expect(result.warnings).toEqual([]);
    expect(result.cleanSvg).toContain('<svg');
  });

  it('warns about missing viewBox and cuttable elements', () => {
    const result = preflightSvg('<svg xmlns="http://www.w3.org/2000/svg"><text>hi</text></svg>');
    expect(result.warnings).toContain('SVG is missing a viewBox.');
    expect(result.warnings).toContain('SVG does not contain common cuttable vector elements.');
  });
});
