'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCardHover } from '@/components/catalog-card-hover';
import { isSvgPath } from '@/lib/catalog-media';
import type { CatalogItemMedia } from '@/lib/marketplace';
import { resolvePublicStorageUrl } from '@/lib/storage';

const SLIDE_INTERVAL_MS = 2200;
// Upper bound on how long a slide waits for the next image to finish
// downloading before advancing anyway, so a stalled request can't freeze the
// slideshow on one frame forever.
const PRELOAD_GRACE_MS = 4000;
// How long the outgoing image stays mounted underneath the incoming one so
// the two crossfade instead of the new slide fading in over an empty frame.
// Keep in sync with the `duration-*` class on the incoming layer.
const TRANSITION_MS = 600;

function SlideImage({
  media,
  alt,
  sizes,
  eager = false,
  className,
  onLoad,
  onError,
}: {
  media: CatalogItemMedia;
  alt: string;
  sizes: string;
  eager?: boolean;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const url = resolvePublicStorageUrl('catalog-assets', media.storage_path);
  if (!url) return null;
  if (isSvgPath(media.storage_path)) {
    return (
      // biome-ignore lint/performance/noImgElement: SVG markup — next/image cannot rasterize it
      <img
        src={url}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={onLoad}
        onError={onError}
        className={`h-full w-full object-cover ${className ?? ''}`}
      />
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      loading={eager ? 'eager' : undefined}
      onLoad={onLoad}
      onError={onError}
      className={`object-cover ${className ?? ''}`}
    />
  );
}

export function CatalogMediaSlider({
  media,
  fallbackTitle,
  fallbackCategory,
  compact = false,
  // Matches the catalog grid card width by default (up to 4 columns at
  // desktop width); the item-detail page passes a wider value since its
  // slider fills roughly half the page instead of one grid cell.
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
}: {
  media: CatalogItemMedia[];
  fallbackTitle: string;
  fallbackCategory?: string | null;
  compact?: boolean;
  sizes?: string;
}) {
  const [index, setIndex] = useState(0);
  // The image that was on screen before the latest slide change. It stays
  // mounted underneath the current slide for TRANSITION_MS so the swap reads
  // as a crossfade rather than a cut.
  const [previous, setPrevious] = useState<CatalogItemMedia | null>(null);
  const [isHoveringSelf, setIsHoveringSelf] = useState(false);
  const isHoveringCard = useCardHover();
  const isHovering = isHoveringSelf || isHoveringCard;
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Media ids whose image bytes have already arrived in this browser session.
  // Used to decide whether the slideshow can advance without a blank frame.
  const [loadedIds, setLoadedIds] = useState<ReadonlySet<string>>(() => new Set());
  // Set when the slide timer elapsed but the next image was still downloading;
  // the advance then happens as soon as the preload finishes.
  const [advanceWhenReady, setAdvanceWhenReady] = useState(false);

  const current = media[index] ?? null;
  const sourceUrl = current
    ? resolvePublicStorageUrl('catalog-assets', current.storage_path)
    : null;
  const posterUrl = current?.poster_path
    ? (resolvePublicStorageUrl('catalog-assets', current.poster_path) ?? undefined)
    : undefined;
  const hasMultiple = media.length > 1;

  // The slide that will show after the current one. Only image slides need
  // preloading; videos stream on their own via preload="metadata".
  const next = hasMultiple ? (media[(index + 1) % media.length] ?? null) : null;
  const nextImage = next && next.media_type === 'image' ? next : null;
  const isNextReady = !nextImage || loadedIds.has(nextImage.id);

  const markLoaded = useCallback((id: string) => {
    setLoadedIds((prev) => {
      if (prev.has(id)) return prev;
      const updated = new Set(prev);
      updated.add(id);
      return updated;
    });
  }, []);

  // Switch slides, remembering the outgoing image so it can crossfade out.
  const showSlide = useCallback(
    (nextIndex: number) => {
      setAdvanceWhenReady(false);
      if (nextIndex === index) return;
      setPrevious(current?.media_type === 'image' ? current : null);
      setIndex(nextIndex);
    },
    [index, current],
  );

  const goToNext = useCallback(() => {
    showSlide((index + 1) % media.length);
  }, [showSlide, index, media.length]);

  // Drop the outgoing layer once the incoming one has finished animating in.
  useEffect(() => {
    if (!previous) return;
    const timer = window.setTimeout(() => setPrevious(null), TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [previous]);

  // Rewind to the primary media (crossfading back to it) and drop any playback
  // progress once the pointer leaves the card. showSlide(0) is a no-op while
  // already on the first slide, so re-runs from its identity changing are free.
  useEffect(() => {
    if (!isHovering) {
      setVideoProgress(0);
      showSlide(0);
    }
  }, [isHovering, showSlide]);

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
    // When the timer fires, only swap if the next image is already in the
    // browser; otherwise flag the advance so it completes on load.
    const timer = window.setTimeout(() => setAdvanceWhenReady(true), SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [isHovering, index, media, hasMultiple]);

  // Complete a pending advance the moment the next image is ready, or after
  // the grace period if it never reports back.
  useEffect(() => {
    if (!advanceWhenReady || !isHovering) return;
    if (isNextReady) {
      goToNext();
      return;
    }
    const fallback = window.setTimeout(goToNext, PRELOAD_GRACE_MS);
    return () => window.clearTimeout(fallback);
  }, [advanceWhenReady, isHovering, isNextReady, goToNext]);

  const showPrevious = previous !== null && previous.id !== current?.id;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover slideshow is a non-essential enhancement; every media is still reachable via the progress controls
    <div
      className="group/media relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white/35 text-center shadow-inner"
      onMouseEnter={() => setIsHoveringSelf(true)}
      onMouseLeave={() => setIsHoveringSelf(false)}
    >
      {/*
        Outgoing image layer. Sits underneath the incoming slide and gently
        scales down while the new one fades in over it. It carries the same
        exit duration as the incoming layer's enter so both settle together.
      */}
      {showPrevious && previous ? (
        <div
          key={`out-${previous.id}`}
          className="pointer-events-none absolute inset-0 animate-out fill-mode-forwards zoom-out-95 duration-600 ease-in-out"
          aria-hidden="true"
        >
          <SlideImage media={previous} alt="" sizes={sizes} />
        </div>
      ) : null}

      {sourceUrl && current?.media_type === 'image' ? (
        <div
          key={current.id}
          className="absolute inset-0 animate-in fade-in-0 fill-mode-both zoom-in-105 duration-600 ease-out"
        >
          <SlideImage
            media={current}
            alt={current.alt_text ?? fallbackTitle}
            sizes={sizes}
            onLoad={() => markLoaded(current.id)}
          />
        </div>
      ) : sourceUrl && current?.media_type === 'video' ? (
        <div
          key={current.id}
          className="relative h-full w-full animate-in fade-in-0 duration-500 ease-out"
        >
          <video
            ref={videoRef}
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

      {/*
        Preload the upcoming image slide while the current one is still on
        screen. It is rendered inside the same container with the same `sizes`
        so the browser requests the exact same optimized candidate the visible
        slide will use, and stays mounted until it becomes current so the swap
        is served from cache with no blank frame. Only while hovering, so the
        idle catalog grid does not download a second image per card.
      */}
      {isHovering && nextImage && nextImage.id !== current?.id ? (
        <div
          key={`preload-${nextImage.id}`}
          className="pointer-events-none absolute inset-0 opacity-0"
          aria-hidden="true"
        >
          <SlideImage
            media={nextImage}
            alt=""
            sizes={sizes}
            eager
            onLoad={() => markLoaded(nextImage.id)}
            onError={() => markLoaded(nextImage.id)}
          />
        </div>
      ) : null}

      {hasMultiple ? (
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex gap-1">
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
                className="pointer-events-auto h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-background/40 shadow-sm backdrop-blur-sm transition-colors hover:bg-background/60"
                onClick={(event) => {
                  event.preventDefault();
                  showSlide(itemIndex);
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
