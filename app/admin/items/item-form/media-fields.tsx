import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CatalogMediaFormValue, ItemFormValue } from './types';

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

export function MediaSection({ media }: { media?: CatalogMediaFormValue[] }) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Product media</h2>
        <p className="text-sm text-muted-foreground">
          Upload images or videos and set their display order. Product cards play videos on hover.
        </p>
      </div>

      {media?.length ? (
        <div className="space-y-3">
          {media
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((mediaItem) => (
              <div key={mediaItem.id} className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[80px_1fr_110px_90px_90px]">
                <div className="text-xs">
                  <p className="font-medium uppercase">{mediaItem.media_type}</p>
                  <p className="break-all text-muted-foreground">{mediaItem.storage_path}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`mediaAlt_${mediaItem.id}`}>Alt text</Label>
                  <Input
                    id={`mediaAlt_${mediaItem.id}`}
                    name={`mediaAlt_${mediaItem.id}`}
                    defaultValue={mediaItem.alt_text ?? ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`mediaSort_${mediaItem.id}`}>Order</Label>
                  <Input
                    id={`mediaSort_${mediaItem.id}`}
                    name={`mediaSort_${mediaItem.id}`}
                    type="number"
                    step="1"
                    defaultValue={mediaItem.sort_order}
                  />
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="radio"
                    name="mediaPrimary"
                    value={mediaItem.id}
                    defaultChecked={mediaItem.is_primary}
                  />
                  Primary
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-destructive">
                  <input type="checkbox" name="mediaRemove" value={mediaItem.id} />
                  Remove
                </label>
              </div>
            ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No gallery media yet. Upload files below to create the product slider.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="mediaFiles">Upload images/videos</Label>
        <p className="text-xs text-muted-foreground">
          Accepted: PNG, JPG, WEBP, SVG, MP4, WEBM up to 50 MB each.
        </p>
        <Input
          id="mediaFiles"
          name="mediaFiles"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm"
        />
      </div>
    </section>
  );
}
