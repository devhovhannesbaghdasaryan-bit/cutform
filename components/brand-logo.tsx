'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function BrandLogo({ className }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    const observer = new MutationObserver(syncTheme);

    syncTheme();
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <span className={cn('relative block h-8 w-[132px] shrink-0', className)}>
      <Image
        key={theme}
        src={`/brand/uniqraft-logo-${theme}.png?v=20260704`}
        alt="Uniqraft"
        fill
        priority
        unoptimized
        sizes="132px"
        className="object-contain"
      />
    </span>
  );
}
