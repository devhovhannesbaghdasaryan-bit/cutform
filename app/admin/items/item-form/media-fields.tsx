'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  ImageOff,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  attachCatalogMediaAction,
  prepareCatalogMediaUploadsAction,
  removeCatalogMediaAction,
  replaceCatalogMediaAction,
} from '@/app/admin/items/media-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionState } from '@/lib/action-state';
import { getCatalogMediaKind, isSvgPath, sortCatalogMedia } from '@/lib/catalog-media';
import { publicEnv } from '@/lib/env';
import { resolvePublicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';
import type { CatalogMediaFormValue, ItemFormValue } from './types';

const MEDIA_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm';
// Mirrors the server-side limit in item-form-parsing.ts, so a bad file is
// flagged before any upload starts.
const MEDIA_MAX_BYTES = 50 * 1024 * 1024;

export function ThumbnailFields({ item }: { item?: Pick<ItemFormValue, 'thumbnail_path'> }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="thumbnailPath">Thumbnail path</Label>
      <p className="text-xs text-muted-foreground">
        Recommended 4:3 image, at least 1200x900 px. Accepted: PNG, JPG, WEBP, SVG up to 50 MB.
      </p>
      <Input
        id="thumbnailPath"
        name="thumbnailPath"
        defaultValue={item?.thumbnail_path ?? ''}
        placeholder="Optional storage path or URL"
      />
      <Input
        id="thumbnailFile"
        name="thumbnailFile"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Direct-to-Storage uploads for an existing item
// ---------------------------------------------------------------------------

let storageClient: Promise<SupabaseClient> | null = null;

// Only used for uploadToSignedUrl, which authorizes with the one-off token the
// server minted — no session is needed, so none is persisted or refreshed.
// Loaded on demand to keep supabase-js out of the form's initial bundle.
function getStorageClient() {
  storageClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    ),
  );
  return storageClient;
}

function assertSuccess<T>(
  state: ActionState<T>,
): asserts state is Extract<ActionState<T>, { status: 'success' }> {
  if (state.status === 'error') throw new Error(state.error);
  if (state.status !== 'success') throw new Error('Unexpected response.');
}

function fileInfo(file: File) {
  return { name: file.name, type: file.type, size: file.size };
}

/** Uploads files straight to Storage and returns what the attach/replace actions expect. */
async function uploadToGallery(itemId: string, files: File[]) {
  const prepared = await prepareCatalogMediaUploadsAction(itemId, files.map(fileInfo));
  assertSuccess(prepared);
  const tickets = prepared.data;
  const storage = (await getStorageClient()).storage.from('catalog-assets');
  await Promise.all(
    files.map(async (file, index) => {
      const { error } = await storage.uploadToSignedUrl(
        tickets[index].path,
        tickets[index].token,
        file,
        { contentType: file.type },
      );
      if (error) throw new Error(`${file.name}: ${error.message}`);
    }),
  );
  return files.map((file, index) => ({ ...fileInfo(file), path: tickets[index].path }));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// ---------------------------------------------------------------------------
// Previews
// ---------------------------------------------------------------------------

/** Object URL for a local file, revoked when the file changes or the preview unmounts. */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function MediaPreview({
  src,
  kind,
  alt,
  optimize,
}: {
  src: string | null;
  kind: 'image' | 'video';
  alt: string;
  /** False for SVGs and local blob: previews, which next/image cannot process. */
  optimize: boolean;
}) {
  if (!src) {
    return (
      <span className="grid h-full place-items-center">
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </span>
    );
  }
  if (kind === 'video') {
    return (
      <video
        src={src}
        muted
        playsInline
        controls
        preload="metadata"
        className="h-full w-full object-cover"
        aria-label={alt}
      />
    );
  }
  if (!optimize) {
    return (
      // biome-ignore lint/performance/noImgElement: SVG markup and blob: previews — next/image cannot handle either
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
      className="object-cover"
    />
  );
}

function BusyOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm font-medium">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function syncInputFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input) return;
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
}

function splitAcceptedFiles(files: File[]) {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (getCatalogMediaKind(file.type) && file.size <= MEDIA_MAX_BYTES) accepted.push(file);
    else rejected.push(file.name);
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function SavedMediaCard({
  itemId,
  media,
  position,
  total,
  onMove,
}: {
  itemId: string;
  media: CatalogMediaFormValue;
  position: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'replacing' | 'removing' | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // Shown until the refreshed row arrives with a different storage_path.
  const [replacement, setReplacement] = useState<{ file: File; replacing: string } | null>(null);
  const pendingFile =
    replacement && replacement.replacing === media.storage_path ? replacement.file : null;
  const replacementUrl = useObjectUrl(pendingFile);
  const storedUrl = resolvePublicStorageUrl('catalog-assets', media.storage_path);
  const kind = pendingFile ? (getCatalogMediaKind(pendingFile.type) ?? 'image') : media.media_type;
  const label = media.alt_text || `Gallery media ${position + 1}`;

  async function replace(file: File) {
    if (replaceInputRef.current) replaceInputRef.current.value = '';
    const { accepted } = splitAcceptedFiles([file]);
    if (!accepted.length) {
      toast.error(`${file.name}: use PNG, JPG, WEBP, SVG, MP4, or WEBM up to 50 MB.`);
      return;
    }
    setReplacement({ file, replacing: media.storage_path });
    setBusy('replacing');
    try {
      const [upload] = await uploadToGallery(itemId, [file]);
      const state = await replaceCatalogMediaAction(itemId, media.id, upload);
      assertSuccess(state);
      toast.success(state.message ?? 'Gallery media replaced.');
    } catch (error) {
      setReplacement(null);
      toast.error(errorMessage(error, 'Failed to replace gallery media.'));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setConfirmingRemove(false);
    setBusy('removing');
    try {
      const state = await removeCatalogMediaAction(itemId, media.id);
      assertSuccess(state);
      toast.success(state.message ?? 'Removed from the gallery.');
      // Stay busy: the card unmounts once the refreshed gallery arrives.
    } catch (error) {
      setBusy(null);
      toast.error(errorMessage(error, 'Failed to remove gallery media.'));
    }
  }

  return (
    <li className="overflow-hidden rounded-md border bg-background">
      <div className="relative aspect-[4/3] bg-muted">
        <div className="relative h-full w-full">
          <MediaPreview
            src={replacementUrl ?? storedUrl}
            kind={kind}
            alt={label}
            optimize={!pendingFile && !isSvgPath(media.storage_path)}
          />
        </div>
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1 text-[11px] font-medium">
          <span className="rounded bg-background/90 px-1.5 py-0.5 shadow-sm">#{position + 1}</span>
          {kind === 'video' && (
            <span className="rounded bg-background/90 px-1.5 py-0.5 uppercase shadow-sm">
              Video
            </span>
          )}
        </div>
        {busy && <BusyOverlay label={busy === 'replacing' ? 'Uploading…' : 'Removing…'} />}
      </div>

      <div className="space-y-2 p-2">
        {confirmingRemove ? (
          <div className="flex items-center gap-1">
            <span className="mr-auto text-sm font-medium text-destructive">Remove this file?</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 px-2"
              onClick={remove}
            >
              Remove
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setConfirmingRemove(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={position === 0}
              onClick={() => onMove(-1)}
              aria-label={`Move ${label} earlier`}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={position === total - 1}
              onClick={() => onMove(1)}
              aria-label={`Move ${label} later`}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={busy !== null}
                onClick={() => replaceInputRef.current?.click()}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-destructive hover:text-destructive"
                disabled={busy !== null}
                onClick={() => setConfirmingRemove(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        )}

        {/* No name: replacements upload on their own, never with the item form. */}
        <input
          ref={replaceInputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void replace(file);
          }}
        />
        <input type="hidden" name={`mediaSort_${media.id}`} value={position} />

        <div className="space-y-1">
          <Label htmlFor={`mediaAlt_${media.id}`} className="text-xs">
            Alt text
          </Label>
          <Input
            id={`mediaAlt_${media.id}`}
            name={`mediaAlt_${media.id}`}
            defaultValue={media.alt_text ?? ''}
            className="h-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mediaPrimary"
            value={media.id}
            defaultChecked={media.is_primary}
          />
          Primary
        </label>
      </div>
    </li>
  );
}

function NewMediaCard({
  file,
  uploading,
  onDiscard,
}: {
  file: File;
  uploading: boolean;
  onDiscard?: () => void;
}) {
  const url = useObjectUrl(file);
  return (
    <li className="overflow-hidden rounded-md border border-dashed bg-background">
      <div className="relative aspect-[4/3] bg-muted">
        <MediaPreview
          src={url}
          kind={getCatalogMediaKind(file.type) ?? 'image'}
          alt={file.name}
          optimize={false}
        />
        {!uploading && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground shadow-sm">
            New
          </span>
        )}
        {onDiscard && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={onDiscard}
            aria-label={`Discard ${file.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {uploading && <BusyOverlay label="Uploading…" />}
      </div>
      <p className="truncate p-2 text-xs text-muted-foreground" title={file.name}>
        {file.name}
      </p>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

/**
 * Gallery editor for catalog_item_media.
 *
 * For a saved item (`itemId` set), uploads, replacements and removals apply
 * immediately through media-actions.ts. Order, alt text and the primary pick
 * stay form fields (mediaSort_/mediaAlt_<id>, mediaPrimary) saved with the
 * item by syncCatalogItemMedia. A new item has no id to attach to yet, so its
 * files are staged in the `mediaFiles` input and uploaded on create.
 */
export function MediaSection({
  itemId,
  media,
}: {
  itemId?: string;
  media?: CatalogMediaFormValue[];
}) {
  const rootRef = useRef<HTMLElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const nextFileKey = useRef(0);
  // null = follow the saved sort order; set once the admin reorders.
  const [order, setOrder] = useState<string[] | null>(null);
  const [newFiles, setNewFiles] = useState<{ key: number; file: File }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  // React resets the form after its action runs, which clears the staged
  // `mediaFiles` input; drop the matching state with it.
  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form) return;
    const onReset = () => {
      setOrder(null);
      setNewFiles((current) => (itemId ? current : []));
      setRejectedFiles([]);
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [itemId]);

  const sorted = sortCatalogMedia(media ?? []);
  const byId = new Map(sorted.map((entry) => [entry.id, entry]));
  const ordered = order
    ? [
        ...order.flatMap((id) => byId.get(id) ?? []),
        ...sorted.filter((entry) => !order.includes(entry.id)),
      ]
    : sorted;

  function move(index: number, direction: -1 | 1) {
    const ids = ordered.map((entry) => entry.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setOrder(ids);
  }

  async function uploadNow(id: string, files: File[]) {
    const entries = files.map((file) => ({ key: nextFileKey.current++, file }));
    setNewFiles(entries);
    setUploading(true);
    try {
      const uploads = await uploadToGallery(id, files);
      const state = await attachCatalogMediaAction(id, uploads);
      assertSuccess(state);
      toast.success(state.message ?? 'Added to the gallery.');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to upload gallery media.'));
    } finally {
      setNewFiles([]);
      setUploading(false);
    }
  }

  function addFiles(files: File[]) {
    const { accepted, rejected } = splitAcceptedFiles(files);
    setRejectedFiles(rejected);
    if (!accepted.length) return;

    if (itemId) {
      void uploadNow(itemId, accepted);
      return;
    }
    const next = [...newFiles, ...accepted.map((file) => ({ key: nextFileKey.current++, file }))];
    setNewFiles(next);
    // Re-picking replaces an <input type=file>'s selection, so the input is
    // rewritten with the full staged list on every change.
    syncInputFiles(
      addInputRef.current,
      next.map((entry) => entry.file),
    );
  }

  function discardFile(key: number) {
    const next = newFiles.filter((entry) => entry.key !== key);
    setNewFiles(next);
    syncInputFiles(
      addInputRef.current,
      next.map((entry) => entry.file),
    );
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    if (!uploading) addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <section ref={rootRef} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">Product gallery</h2>
          <p className="text-sm text-muted-foreground">
            {itemId
              ? 'Uploads, replacements and removals apply immediately. Order, alt text and the primary image are saved with the item.'
              : 'Images and videos for the product slider, uploaded when the item is created.'}
          </p>
        </div>
        {itemId && (
          <p className="text-sm text-muted-foreground">
            {ordered.length} {ordered.length === 1 ? 'file' : 'files'}
          </p>
        )}
      </div>

      {itemId &&
        (ordered.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((entry, index) => (
              <SavedMediaCard
                key={entry.id}
                itemId={itemId}
                media={entry}
                position={index}
                total={ordered.length}
                onMove={(direction) => move(index, direction)}
              />
            ))}
          </ul>
        ) : (
          !newFiles.length && (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No gallery media yet. Add files below to create the product slider.
            </p>
          )
        ))}

      {newFiles.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {newFiles.map((entry) => (
            <NewMediaCard
              key={entry.key}
              file={entry.file}
              uploading={uploading}
              onDiscard={itemId ? undefined : () => discardFile(entry.key)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={uploading}
        onClick={() => addInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-6 text-sm transition-colors hover:bg-muted/40 disabled:cursor-wait disabled:opacity-60',
          dragging && 'border-primary bg-muted/60',
        )}
      >
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <span className="font-medium">{uploading ? 'Uploading…' : 'Add images or videos'}</span>
        <span className="text-xs text-muted-foreground">
          Click or drop files. PNG, JPG, WEBP, SVG, MP4, WEBM up to 50 MB each.
        </span>
      </button>
      <input
        ref={addInputRef}
        id="mediaFiles"
        // Only a new item submits files with the form; a saved item uploads directly.
        name={itemId ? undefined : 'mediaFiles'}
        type="file"
        multiple
        accept={MEDIA_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          // Snapshot before addFiles rewrites (or clears) the input's FileList.
          const files = Array.from(event.currentTarget.files ?? []);
          if (itemId) event.currentTarget.value = '';
          addFiles(files);
        }}
      />

      {rejectedFiles.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Skipped {rejectedFiles.join(', ')}: use PNG, JPG, WEBP, SVG, MP4, or WEBM up to 50 MB.
        </p>
      )}
      {order && (
        <p className="text-sm text-muted-foreground">
          New order is applied when you save the item.
        </p>
      )}
    </section>
  );
}
