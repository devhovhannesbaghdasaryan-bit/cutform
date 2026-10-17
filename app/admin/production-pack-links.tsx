import { AlertTriangle, Check, Download, FileText } from 'lucide-react';
import type { TechSheet } from '@/lib/production-pack/types';

export interface ProductionPackHrefs {
  /** Printable tech sheet, opened in a new tab. */
  sheet: string;
  /** Zip with the sheet and every production file. */
  pack: string;
}

/** Hrefs for a production-pack route (`…/production-pack`), optionally scoped with a query string. */
export function productionPackHrefs(route: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams(query);
  const pack = params.size ? `${route}?${params}` : route;
  params.set('format', 'html');
  return { sheet: `${route}?${params}`, pack } satisfies ProductionPackHrefs;
}

export function ProductionPackLinks({
  hrefs,
  packLabel = 'Production pack (.zip)',
}: {
  hrefs: ProductionPackHrefs;
  packLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={hrefs.sheet}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-sm font-medium hover:bg-muted"
      >
        <FileText className="size-4" aria-hidden="true" />
        Tech sheet
      </a>
      <a
        href={hrefs.pack}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Download className="size-4" aria-hidden="true" />
        {packLabel}
      </a>
    </div>
  );
}

/**
 * Readiness of one item's technical documentation, shown on the order page:
 * what the workshop would receive and what still blocks it.
 */
export function ProductionSummary({
  sheet,
  hrefs,
}: {
  sheet: TechSheet;
  hrefs: ProductionPackHrefs;
}) {
  const ready = sheet.status === 'ready';
  const productionFiles = sheet.files.filter((file) => !file.reference);
  const referenceFiles = sheet.files.filter((file) => file.reference);

  return (
    <div
      className={`rounded-md border p-3 ${ready ? 'bg-card' : 'border-destructive/40 bg-destructive/5'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Technical documentation</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                ready ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
              }`}
            >
              {ready ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-3.5" aria-hidden="true" />
              )}
              {ready ? 'Ready for production' : 'Review required'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {sheet.process.name}
            {sheet.product.styleName ? ` · ${sheet.product.styleName}` : ''}
            {sheet.specification.materials.length
              ? ` · ${sheet.specification.materials.slice(0, 2).join(', ')}`
              : ' · material not recorded'}
            {sheet.specification.artworkWidthMm
              ? ` · artwork ${sheet.specification.artworkWidthMm} mm`
              : ''}
          </p>
        </div>
        <ProductionPackLinks hrefs={hrefs} />
      </div>

      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Production inputs in the pack</dt>
          <dd className="mt-1">
            {productionFiles.length ? (
              <ul className="space-y-0.5">
                {productionFiles.map((file) => (
                  <li key={file.fileName} className="flex items-center gap-1.5 font-medium">
                    <Check className="size-3.5 text-success" aria-hidden="true" />
                    {file.label}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="font-medium text-destructive">None yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reference material</dt>
          <dd className="mt-1 font-medium">
            {referenceFiles.length ? referenceFiles.map((file) => file.label).join(', ') : '—'}
          </dd>
        </div>
      </dl>

      {sheet.warnings.length ? (
        <ul className="mt-3 space-y-1 text-xs text-destructive">
          {sheet.warnings.slice(0, 3).map((warning) => (
            <li key={warning} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{warning}</span>
            </li>
          ))}
          {sheet.warnings.length > 3 ? (
            <li className="pl-5 text-muted-foreground">
              {sheet.warnings.length - 3} more in the tech sheet.
            </li>
          ) : null}
        </ul>
      ) : null}
      {sheet.confirmations.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {sheet.confirmations.length} point{sheet.confirmations.length === 1 ? '' : 's'} for the
          operator to confirm before starting (listed in the sheet).
        </p>
      ) : null}
    </div>
  );
}
