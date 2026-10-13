'use client';

import Image from 'next/image';
import { Download, X } from 'lucide-react';
import { useRef } from 'react';

interface AssetFigureProps {
  title: string;
  path: string;
  url: string | null;
  downloadUrl: string | null;
  isSvg?: boolean;
  /** Short tag shown next to the title, e.g. the file extension or "Engraved". */
  tag?: string;
  /** Outlines the figure in the primary colour: the file the laser will produce. */
  emphasized?: boolean;
}

function fileName(path: string) {
  return path.split('/').pop() ?? path;
}

/** Large square asset preview with a full-size dialog, for the production comparison row. */
export function AssetFigure({
  title,
  path,
  url,
  downloadUrl,
  isSvg = false,
  tag,
  emphasized = false,
}: AssetFigureProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frame = emphasized ? 'border-2 border-primary' : 'border';
  const surface = isSvg || emphasized ? 'bg-white' : 'bg-muted';

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2.5">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={!url}
        aria-label={`Preview ${title}`}
        className={`relative block aspect-square w-full overflow-hidden rounded-lg ${frame} ${surface} transition-opacity hover:opacity-90 disabled:cursor-default disabled:hover:opacity-100`}
      >
        {url ? (
          isSvg ? (
            // biome-ignore lint/performance/noImgElement: sanitized SVG rendered inline; next/image cannot render SVG markup
            <img src={url} alt="" className="h-full w-full object-contain p-2" />
          ) : (
            <Image
              src={url}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1024px) 280px, 90vw"
              className="object-contain"
            />
          )
        ) : (
          <span className="grid h-full place-items-center px-2 text-xs text-muted-foreground">
            Unavailable
          </span>
        )}
      </button>
      <figcaption className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{title}</span>
          {tag ? (
            emphasized ? (
              <span className="rounded-full bg-primary px-2 py-px text-[11px] font-bold text-primary-foreground">
                {tag}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground">{tag}</span>
            )
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs text-muted-foreground" title={path}>
            {fileName(path)}
          </span>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Download
            </a>
          ) : null}
        </div>
      </figcaption>

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
              <img
                src={url}
                alt={title}
                className="max-h-[70vh] max-w-full bg-white object-contain"
              />
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
          {downloadUrl ? (
            <div className="flex justify-stretch border-t p-3 sm:justify-end">
              <a
                href={downloadUrl}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:w-auto"
              >
                <Download className="size-4" aria-hidden="true" />
                Download
              </a>
            </div>
          ) : null}
        </dialog>
      ) : null}
    </figure>
  );
}
