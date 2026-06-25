'use client';

import { useMemo, useState } from 'react';
import { ImagePlus, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PERSONALIZED_NIGHT_LIGHT } from '@/lib/marketplace-constants';
import { generatePersonalizedNightLightAction } from '@/app/personalize/actions';

export function PersonalizedNightLightForm({ modelId }: { modelId: string }) {
  const [multiColor, setMultiColor] = useState(false);
  const [text, setText] = useState('');
  const remaining = useMemo(
    () => PERSONALIZED_NIGHT_LIGHT.maxTextLength - text.length,
    [text.length],
  );

  return (
    <form action={generatePersonalizedNightLightAction} className="space-y-6 rounded-lg border p-5">
      <input type="hidden" name="modelId" value={modelId} />
      <div className="space-y-2">
        <Label htmlFor="images">Images</Label>
        <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <input type="checkbox" name="uploadRightsConfirmed" className="mt-1" required />
          <span>I have the rights to use the uploaded images.</span>
        </label>
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
          <ImagePlus className="h-8 w-8" />
          Upload up to {PERSONALIZED_NIGHT_LIGHT.maxImages} images
          <Input
            id="images"
            name="images"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ledColor">LED color</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="multiColor"
              checked={multiColor}
              onChange={(event) => setMultiColor(event.target.checked)}
            />
            Multi color
          </label>
        </div>
        <select
          id="ledColor"
          name="ledColor"
          disabled={multiColor}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
        >
          {PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.map((color) => (
            <span
              key={color.value}
              className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"
            >
              <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: color.hex }} />
              {color.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customText">Text</Label>
        <Textarea
          id="customText"
          name="customText"
          maxLength={PERSONALIZED_NIGHT_LIGHT.maxTextLength}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Short text for the wooden base"
        />
        <p className="text-xs text-muted-foreground">{remaining} characters remaining</p>
      </div>

      <Button type="submit" className="w-full">
        <WandSparkles className="mr-2 h-4 w-4" />
        Generate previews
      </Button>
      <p className="text-xs text-muted-foreground">
        Generated previews are approximations and require production review. The generation endpoint will create 3 previews plus hidden SVG production files in the next slice.
      </p>
    </form>
  );
}
