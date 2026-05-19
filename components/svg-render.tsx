'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';

/**
 * Renders SVG markup safely:
 *   1. DOMPurify sanitizes the input (strips scripts, handlers, externals).
 *   2. Returns a real DocumentFragment — works even on mid-stream partial
 *      SVG, where strict XML parsing would fail.
 *   3. Appends the resulting <svg> element to a ref'd host node.
 */
export function SvgRender({ svg, className }: { svg: string; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!svg) return;

    try {
      const fragment = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['script', 'foreignObject'],
        FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover'],
        RETURN_DOM_FRAGMENT: true,
      }) as unknown as DocumentFragment;
      host.appendChild(fragment);
    } catch {
      // Ignore — preview stays empty until the next valid update.
    }
  }, [svg]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Generated SVG"
      className={cn('flex items-center justify-center [&>svg]:h-full [&>svg]:w-full', className)}
    />
  );
}
