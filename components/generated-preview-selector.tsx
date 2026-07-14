'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { addGeneratedItemToCartAction } from '@/app/generated/actions';
import { Button } from '@/components/ui/button';
import { type AppLocale, formatLocalizedCurrency } from '@/lib/i18n';

interface GeneratedPreviewOption {
  id: string;
  label: string;
  previewUrl: string | null;
  /** Per-option price in cents; when set it is shown on the card and summed for the selection. */
  priceCents: number | null;
}

interface GeneratedPreviewSelectorProps {
  generatedItemId: string;
  itemTitle: string;
  options: GeneratedPreviewOption[];
  fallbackPreviewUrl: string | null;
  /** Fallback price label shown when options carry no per-option price. */
  priceLabel: string | null;
  locale: AppLocale;
  currency: string;
  copy: {
    resultsTitle: string;
    resultsHelp: string;
    addSelected: string;
    previewUnavailable: string;
    noPreview: string;
    previewAlt: string;
    total: string;
  };
}

export function GeneratedPreviewSelector({
  generatedItemId,
  itemTitle,
  options,
  fallbackPreviewUrl,
  priceLabel,
  locale,
  currency,
  copy,
}: GeneratedPreviewSelectorProps) {
  const firstOptionId = options[0]?.id ?? null;
  const [activeId, setActiveId] = useState<string | null>(firstOptionId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(firstOptionId ? [firstOptionId] : []),
  );
  const activeOption = options.find((option) => option.id === activeId) ?? options[0];
  const activePreviewUrl = activeOption?.previewUrl ?? fallbackPreviewUrl;
  const hasPerOptionPrices = options.some((option) => option.priceCents !== null);
  const selectedTotalCents = options
    .filter((option) => selectedIds.has(option.id))
    .reduce((sum, option) => sum + (option.priceCents ?? 0), 0);

  function updateSelection(optionId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(optionId);
      else next.delete(optionId);
      return next;
    });
    setActiveId(optionId);
  }

  return (
    <form action={addGeneratedItemToCartAction} className="space-y-6">
      <input type="hidden" name="generatedItemId" value={generatedItemId} />

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-muted text-sm text-muted-foreground">
          {activePreviewUrl ? (
            <Image
              src={activePreviewUrl}
              alt={copy.previewAlt.replace('{name}', activeOption?.label ?? itemTitle)}
              fill
              unoptimized
              priority
              sizes="(min-width: 1024px) 720px, 100vw"
              className="object-contain"
            />
          ) : (
            copy.noPreview
          )}
        </div>
      </div>

      {options.length ? (
        <section className="space-y-4" aria-labelledby="generated-options-title">
          <div>
            <h2 id="generated-options-title" className="text-xl font-semibold tracking-tight">
              {copy.resultsTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{copy.resultsHelp}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {options.map((option) => {
              const selected = selectedIds.has(option.id);
              const active = option.id === activeOption?.id;
              return (
                <label
                  key={option.id}
                  className={`group cursor-pointer rounded-lg border-2 p-3 transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : active
                        ? 'border-cyber-cyan/60'
                        : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="optionIds"
                    value={option.id}
                    checked={selected}
                    onChange={(event) => updateSelection(option.id, event.target.checked)}
                    className="sr-only"
                  />
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted text-xs text-muted-foreground">
                    {option.previewUrl ? (
                      <Image
                        src={option.previewUrl}
                        alt={copy.previewAlt.replace('{name}', option.label)}
                        fill
                        unoptimized
                        sizes="(min-width: 640px) 30vw, 100vw"
                        className="object-contain"
                      />
                    ) : (
                      copy.previewUnavailable
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      {option.priceCents !== null ? (
                        <p className="text-sm text-muted-foreground">
                          {formatLocalizedCurrency(locale, option.priceCents, currency)}
                        </p>
                      ) : null}
                    </div>
                    <span
                      aria-hidden="true"
                      className={`grid h-6 w-6 place-items-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'opacity-0'}`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            {hasPerOptionPrices ? (
              <p className="font-semibold">
                {copy.total.replace(
                  '{price}',
                  formatLocalizedCurrency(locale, selectedTotalCents, currency),
                )}
              </p>
            ) : priceLabel ? (
              <p className="font-semibold">{priceLabel}</p>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={!selectedIds.size}>
              {copy.addSelected}
            </Button>
          </div>
        </section>
      ) : null}
    </form>
  );
}
