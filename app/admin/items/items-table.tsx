'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { ImageOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { idleState } from '@/lib/action-state';
import { isSvgPath } from '@/lib/catalog-media';
import { resolvePublicStorageUrl } from '@/lib/storage';
import { formatPrice } from '@/lib/utils';
import { deleteCatalogItemsAction } from './actions';

export interface AdminItemRow {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  status: string;
  is_popular: boolean;
  is_customizable: boolean;
  category: { name: string; slug: string } | null;
  previewPath: string | null;
}

function ItemPreview({ item }: { item: AdminItemRow }) {
  const url = resolvePublicStorageUrl('catalog-assets', item.previewPath);

  return (
    <Link
      href={`/admin/items/${item.id}`}
      // The title cell already names the item, so this is decorative for screen
      // readers; hide it from the tab order rather than repeat the same link.
      tabIndex={-1}
      aria-hidden="true"
      className="relative block h-10 w-10 overflow-hidden rounded-md border bg-muted"
    >
      {url ? (
        isSvgPath(item.previewPath ?? '') ? (
          // biome-ignore lint/performance/noImgElement: next/image cannot rasterize SVG markup
          <img src={url} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <Image src={url} alt="" fill sizes="40px" className="object-cover" />
        )
      ) : (
        <span className="grid h-full place-items-center">
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        </span>
      )}
    </Link>
  );
}

export function ItemsTable({ items, canDelete }: { items: AdminItemRow[]; canDelete: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteCatalogItemsAction, idleState);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allSelected = items.length > 0 && selected.size === items.length;

  // Partial selection has no declarative attribute — it must be set on the node.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && !allSelected;
    }
  }, [selected.size, allSelected]);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message);
      setSelected(new Set());
      setConfirming(false);
    } else if (state.status === 'error') {
      toast.error(state.error);
    }
  }, [state]);

  // Rows change under us after a delete revalidates the page; drop stale ids.
  useEffect(() => {
    setSelected((current) => {
      const ids = new Set(items.map((item) => item.id));
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
    setConfirming(false);
  }

  const selectedIds = items.filter((item) => selected.has(item.id)).map((item) => item.id);

  return (
    <div className="space-y-3">
      {canDelete && selectedIds.length > 0 ? (
        <form
          action={action}
          className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="itemIds" value={id} />
          ))}

          <p className="text-sm">
            {confirming ? (
              <span className="font-medium text-destructive">
                Delete {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'}? This
                cannot be undone.
              </span>
            ) : (
              <span className="text-muted-foreground">{selectedIds.length} selected</span>
            )}
          </p>

          <div className="flex gap-2">
            {confirming ? (
              <>
                <Button type="submit" variant="destructive" size="sm" disabled={pending}>
                  {pending ? 'Deleting...' : 'Confirm delete'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete selected
              </Button>
            )}
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {canDelete ? (
                <th className="w-10 px-4 py-3">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all items"
                  />
                </th>
              ) : null}
              <th className="w-16 px-4 py-3 font-medium">
                <span className="sr-only">Preview</span>
              </th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                {canDelete ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={`Select ${item.title}`}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <ItemPreview item={item} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/items/${item.id}`} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.slug}</p>
                </td>
                <td className="px-4 py-3">{item.category?.name ?? '-'}</td>
                <td className="px-4 py-3">{formatPrice(item.price_cents)}</td>
                <td className="px-4 py-3 capitalize">{item.status}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {[item.is_popular && 'popular', item.is_customizable && 'custom']
                    .filter(Boolean)
                    .join(', ') || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
