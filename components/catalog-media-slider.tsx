'use client';

import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CatalogItemMedia } from '@/lib/marketplace';
import { resolvePublicStorageUrl } from '@/lib/storage';

export function CatalogMediaSlider({
  media,
  fallbackTitle,
  fallbackCategory,
  compact = false,
}: {
  media: CatalogItemMedia[];
  fallbackTitle: string;
  fallbackCategory?: string | null;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const current = media[index] ?? null;
  const sourceUrl = current
    ? resolvePublicStorageUrl('catalog-assets', current.storage_path)
    : null;
  const posterUrl = current?.poster_path
    ? (resolvePublicStorageUrl('catalog-assets', current.poster_path) ?? undefined)
    : undefined;
  const hasMultiple = media.length > 1;

  function move(delta: number) {
    setIndex((currentIndex) => (currentIndex + delta + media.length) % media.length);
  }

  async function playVideo() {
    try {
      await videoRef.current?.play();
    } catch {
      // Browser autoplay policies can still reject in some contexts.
    }
  }

  function pauseVideo() {
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.currentTime = 0;
  }

  return (
    <div className="group/media relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white/35 text-center shadow-inner">
      {sourceUrl && current?.media_type === 'image' ? (
        // biome-ignore lint/performance/noImgElement: admin-managed storage URLs can be SVG; next/image cannot render SVG markup
        <img
          src={sourceUrl}
          alt={current.alt_text ?? fallbackTitle}
          className="h-full w-full object-cover"
        />
      ) : sourceUrl && current?.media_type === 'video' ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover play/pause is a non-essential enhancement; the video element carries its own controls
        <div className="relative h-full w-full" onMouseEnter={playVideo} onMouseLeave={pauseVideo}>
          <video
            ref={videoRef}
            src={sourceUrl}
            poster={posterUrl}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            aria-label={current.alt_text ?? fallbackTitle}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 opacity-100 transition-opacity group-hover/media:opacity-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4">
          <div className="space-y-2">
            {fallbackCategory ? (
              <p className="text-xs font-medium uppercase text-black/55">{fallbackCategory}</p>
            ) : null}
            <p
              className={
                compact
                  ? 'text-lg font-semibold leading-tight text-black/80'
                  : 'text-3xl font-bold text-black/80'
              }
            >
              {fallbackTitle}
            </p>
          </div>
        </div>
      )}

      {hasMultiple ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 opacity-0 shadow transition-opacity group-hover/media:opacity-100"
            onClick={(event) => {
              event.preventDefault();
              move(-1);
            }}
            aria-label="Previous media"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 opacity-0 shadow transition-opacity group-hover/media:opacity-100"
            onClick={(event) => {
              event.preventDefault();
              move(1);
            }}
            aria-label="Next media"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {media.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                className={
                  itemIndex === index
                    ? 'h-1.5 w-4 rounded-full bg-background shadow'
                    : 'h-1.5 w-1.5 rounded-full bg-background/70 shadow'
                }
                onClick={(event) => {
                  event.preventDefault();
                  setIndex(itemIndex);
                }}
                aria-label={`Show media ${itemIndex + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
