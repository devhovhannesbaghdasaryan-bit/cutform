'use client';

import { useMemo, useState } from 'react';
import { WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { customizeBannerSampleAction, generateBannerAction } from '@/app/banners/actions';

interface BannerSample {
  id: string;
  title: string;
  image_path: string;
}

interface BannerPreset {
  key: string;
  name: string;
  width_mm: number;
  height_mm: number;
  material: string;
  finish: string;
}

export function BannerCustomizer({
  samples,
  presets,
}: {
  samples: BannerSample[];
  presets: BannerPreset[];
}) {
  const [sampleId, setSampleId] = useState(samples[0]?.id ?? '');
  const [sizeKey, setSizeKey] = useState(presets[0]?.key ?? '');
  const [text, setText] = useState('Grand opening sale');
  const selectedSample = samples.find((sample) => sample.id === sampleId);
  const selectedPreset = presets.find((preset) => preset.key === sizeKey);
  const canCustomize =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sampleId)
    && Boolean(sizeKey)
    && Boolean(text.trim());
  const ratio = useMemo(() => {
    if (!selectedPreset) return '12 / 5';
    return `${selectedPreset.width_mm} / ${selectedPreset.height_mm}`;
  }, [selectedPreset]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border bg-card p-4">
        <div
          className="relative flex w-full items-center justify-center overflow-hidden rounded-md border bg-muted p-8"
          style={{ aspectRatio: ratio }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(210_40%_98%),hsl(214_32%_91%))]" />
          <div className="relative max-w-[80%] text-center text-3xl font-extrabold tracking-normal text-foreground">
            {text || 'Your banner text'}
          </div>
          <div className="absolute bottom-3 left-3 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
            {selectedSample?.title ?? 'Custom banner'}
          </div>
        </div>
      </section>

      <form action={customizeBannerSampleAction} className="space-y-4 rounded-lg border p-5">
        <div className="space-y-2">
          <Label htmlFor="sample">Sample</Label>
          <select
            id="sample"
            name="sampleId"
            value={sampleId}
            onChange={(event) => setSampleId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="size">Size</Label>
          <select
            id="size"
            name="sizeKey"
            value={sizeKey}
            onChange={(event) => setSizeKey(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {presets.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.name} - {preset.width_mm}x{preset.height_mm} mm
              </option>
            ))}
          </select>
          {selectedPreset ? (
            <p className="text-xs text-muted-foreground">
              {selectedPreset.material}, {selectedPreset.finish}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bannerText">Banner text</Label>
          <Textarea
            id="bannerText"
            name="bannerText"
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 120))}
            placeholder="Text to place inside the banner"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={!canCustomize}>
          Review customized banner
        </Button>
        {!canCustomize ? (
          <p className="text-xs text-muted-foreground">
            Publish an admin banner sample and size preset before ordering a customized sample.
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function AdvancedBannerGenerationPanel({ presets }: { presets: BannerPreset[] }) {
  return (
    <form action={generateBannerAction} className="grid gap-4 rounded-lg border p-5 md:grid-cols-[1fr_260px_auto]">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="advancedPrompt">Advanced AI prompt</Label>
        <Textarea
          id="advancedPrompt"
          name="prompt"
          placeholder="Describe the store, offer, brand colors, attached references, and desired banner style."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="advancedSize">Banner size</Label>
        <select
          id="advancedSize"
          name="sizeKey"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          required
        >
          {presets.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.name}
            </option>
          ))}
        </select>
        <Label htmlFor="advancedReference">Reference image</Label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="uploadRightsConfirmed" className="mt-0.5" required />
          <span>I have the rights to use the uploaded reference image.</span>
        </label>
        <input
          id="advancedReference"
          name="referenceFile"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm"
        />
      </div>
      <Button type="submit" className="self-end">
        <WandSparkles className="mr-2 h-4 w-4" />
        Generate with credits
      </Button>
      <p className="text-xs text-muted-foreground md:col-span-3">
        Generated banner previews are approximations and require admin production review before manufacturing.
      </p>
    </form>
  );
}
