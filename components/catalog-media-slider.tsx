'use client';

import { Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogItemMedia } from '@/lib/marketplace';
import { resolvePublicStorageUrl } from '@/lib/storage';

const SLIDE_INTERVAL_MS = 2200;

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
  const [isHovering, setIsHovering] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = media[index] ?? null;
  const sourceUrl = current
    ? resolvePublicStorageUrl('catalog-assets', current.storage_path)
    : null;
  const posterUrl = current?.poster_path
    ? (resolvePublicStorageUrl('catalog-assets', current.poster_path) ?? undefined)
    : undefined;
  const hasMultiple = media.length > 1;

  const goToNext = useCallback(() => {
    setIndex((currentIndex) => (currentIndex + 1) % media.length);
  }, [media.length]);

  // Rewind to the primary media and drop any playback progress once the
  // pointer leaves the card.
  useEffect(() => {
    if (!isHovering) {
      setIndex(0);
      setVideoProgress(0);
    }
  }, [isHovering]);

  // Drive the slideshow while hovering: images auto-advance on a timer, videos
  // play through and then hand off to the next media when they finish.
  useEffect(() => {
    if (!isHovering) return;
    const active = media[index];
    if (!active) return;

    if (active.media_type === 'video') {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        setVideoProgress(0);
        void video.play().catch(() => {
          // Browser autoplay policies can still reject in some contexts.
        });
      }
      return () => {
        video?.pause();
      };
    }

    if (!hasMultiple) return;
    const timer = window.setTimeout(goToNext, SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [isHovering, index, media, hasMultiple, goToNext]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover slideshow is a non-essential enhancement; every media is still reachable via the progress controls
    <div
      className="group/media relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white/35 text-center shadow-inner"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {sourceUrl && current?.media_type === 'image' ? (
        // biome-ignore lint/performance/noImgElement: admin-managed storage URLs can be SVG; next/image cannot render SVG markup
        <img
          key={current.id}
          src={sourceUrl}
          alt={current.alt_text ?? fallbackTitle}
          className="h-full w-full animate-in fade-in-0 object-cover duration-500"
        />
      ) : sourceUrl && current?.media_type === 'video' ? (
        <div className="relative h-full w-full">
          <video
            ref={videoRef}
            key={current.id}
            src={sourceUrl}
            poster={posterUrl}
            muted
            loop={!hasMultiple}
            playsInline
            preload="metadata"
            onEnded={hasMultiple ? goToNext : undefined}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (video.duration > 0) {
                setVideoProgress(video.currentTime / video.duration);
              }
            }}
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
        <div className="pointer-events-none absolute inset-x-2 top-2 flex gap-1">
          {media.map((item, itemIndex) => {
            const isPast = itemIndex < index;
            const isActive = itemIndex === index;
            const isImageSlide = current?.media_type === 'image';
            let fill = '0%';
            if (isPast) {
              fill = '100%';
            } else if (isActive && isHovering) {
              fill = isImageSlide ? '100%' : `${Math.round(videoProgress * 100)}%`;
            }
            const animateFill = isActive && isHovering && isImageSlide;
            return (
              <button
                key={item.id}
                type="button"
                className="pointer-events-auto h-1 flex-1 overflow-hidden rounded-full bg-background/40 shadow-sm backdrop-blur-sm transition-colors hover:bg-background/60"
                onClick={(event) => {
                  event.preventDefault();
                  setIndex(itemIndex);
                }}
                aria-label={`Show media ${itemIndex + 1}`}
              >
                <span
                  className="block h-full rounded-full bg-background ease-linear"
                  style={{
                    width: fill,
                    transitionProperty: 'width',
                    transitionDuration: animateFill ? `${SLIDE_INTERVAL_MS}ms` : '120ms',
                  }}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
