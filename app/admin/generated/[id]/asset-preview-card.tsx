'use client';

import Image from 'next/image';
import { Download, Eye, X } from 'lucide-react';
import { useRef } from 'react';

interface AssetPreviewCardProps {
  title: string;
  path: string;
  url: string | null;
  downloadUrl: string | null;
  isSvg?: boolean;
}

export function AssetPreviewCard({
  title,
  path,
  url,
  downloadUrl,
  isSvg = false,
}: AssetPreviewCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <div className="flex min-w-0 flex-col items-stretch gap-3 rounded-lg border bg-card p-3 min-[420px]:flex-row min-[420px]:items-center">
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          disabled={!url}
          className="relative h-36 w-full shrink-0 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80 disabled:cursor-default min-[420px]:h-20 min-[420px]:w-20"
          aria-label={`Preview ${title}`}
        >
          {url ? (
            isSvg ? (
              // biome-ignore lint/performance/noImgElement: sanitized SVG rendered inline; next/image cannot render SVG markup
              <img src={url} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <Image src={url} alt="" fill unoptimized sizes="80px" className="object-cover" />
            )
          ) : (
            <span className="grid h-full place-items-center px-2 text-xs text-muted-foreground">
              Unavailable
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={path}>
            {path}
          </p>
          {url ? (
            <div className="mt-3 grid grid-cols-2 gap-2 min-[420px]:flex min-[420px]:flex-wrap">
              <button
                type="button"
                onClick={() => dialogRef.current?.showModal()}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
              >
                <Eye className="size-3.5" aria-hidden="true" />
                Preview
              </button>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {url ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> closes on Escape; onClick only handles backdrop dismiss
        <dialog
          ref={dialogRef}
          aria-label={`${title} preview`}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
          className="m-auto w-[min(92vw,72rem)] max-w-none rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/70"
        >
          <div className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-3 sm:gap-4 sm:px-4">
            <div className="min-w-0">
              <p className="font-medium">{title}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{path}</p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="grid size-9 shrink-0 place-items-center rounded-md border hover:bg-muted"
              aria-label="Close preview"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid max-h-[75dvh] min-h-48 place-items-center overflow-auto bg-muted/50 p-2 sm:min-h-72 sm:p-4">
            {isSvg ? (
              // biome-ignore lint/performance/noImgElement: sanitized SVG rendered inline; next/image cannot render SVG markup
              <img src={url} alt={title} className="max-h-[70vh] max-w-full object-contain" />
            ) : (
              <Image
                src={url}
                alt={title}
                width={1600}
                height={1600}
                unoptimized
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            )}
          </div>
          <div className="flex justify-stretch border-t p-3 sm:justify-end">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:w-auto"
              >
                <Download className="size-4" aria-hidden="true" />
                Download
              </a>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
