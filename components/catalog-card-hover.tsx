'use client';

import { createContext, useContext, useState } from 'react';

const CardHoverContext = createContext(false);

export function useCardHover() {
  return useContext(CardHoverContext);
}

// Lets the media slider start its slideshow on hover anywhere on the card
// (title, price, footer), not just when the pointer is over the image itself.
// Wraps with display:contents so it doesn't affect the card's grid sizing.
export function CardHoverBoundary({ children }: { children: React.ReactNode }) {
  const [isHovering, setIsHovering] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: purely visual hover boundary for a non-essential slideshow enhancement, mirrors catalog-media-slider.tsx
    <div
      className="contents"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <CardHoverContext.Provider value={isHovering}>{children}</CardHoverContext.Provider>
    </div>
  );
}
