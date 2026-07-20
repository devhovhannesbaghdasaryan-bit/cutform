'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutogenerateButton } from './ai-context';
import type { ItemFormValue } from './types';

/**
 * Per-item laser-on-glass engraving styles. Contour (hairline) uses the item's
 * base price; Solid (scratched fill) is opt-in and reveals its own price + prompt.
 * The feature is off unless at least one box is checked. Solid always includes
 * the base Contour style, so enabling Solid forces Contour on too.
 */
export function EngravingFields({
  item,
}: {
  item?: Pick<
    ItemFormValue,
    | 'laser_contour_enabled'
    | 'laser_solid_enabled'
    | 'laser_solid_price_cents'
    | 'laser_solid_prompt'
  >;
}) {
  const [contourEnabled, setContourEnabled] = useState(item?.laser_contour_enabled ?? false);
  const [solidEnabled, setSolidEnabled] = useState(item?.laser_solid_enabled ?? false);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <Label>Laser engraving styles (glass)</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. Enable a style to offer laser-on-glass engraving. Contour (hairline) uses this
          item&apos;s base price; Solid (scratched fill) has its own price and prompt. When Solid is
          on, both styles are generated and the customer picks which to buy.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="laserContourEnabled"
            checked={contourEnabled}
            // Solid always ships alongside the base Contour style, so it stays on
            // (and locked) while Solid is enabled.
            disabled={solidEnabled}
            onChange={(event) => setContourEnabled(event.target.checked)}
          />
          Contour (hairline)
        </label>
        {/* A disabled checkbox is not submitted, so keep Contour's value posted
            while it is locked on by Solid. */}
        {solidEnabled ? <input type="hidden" name="laserContourEnabled" value="on" /> : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="laserSolidEnabled"
            checked={solidEnabled}
            onChange={(event) => {
              const next = event.target.checked;
              setSolidEnabled(next);
              if (next) setContourEnabled(true);
            }}
          />
          Solid (scratching)
        </label>
      </div>

      {solidEnabled ? (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <div className="space-y-2">
            <Label htmlFor="laserSolidPriceCents">Solid price, cents</Label>
            <Input
              id="laserSolidPriceCents"
              name="laserSolidPriceCents"
              type="number"
              min={0}
              step={1}
              defaultValue={item?.laser_solid_price_cents ?? ''}
              placeholder="Price for the solid-scratched option, in cents."
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="laserSolidPrompt">Solid generation prompt</Label>
              <AutogenerateButton field="laserSolidPrompt" />
            </div>
            <Textarea
              id="laserSolidPrompt"
              name="laserSolidPrompt"
              rows={4}
              defaultValue={item?.laser_solid_prompt ?? ''}
              placeholder="Instructions for generating the solid-scratched glass image."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
