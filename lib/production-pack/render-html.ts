import type { ProductionFile, TechSheet } from '@/lib/production-pack/types';

export interface RenderTechSheetHtmlOptions {
  /** Resolves where a production file can be opened from this document (relative path inside the pack, or a signed URL). */
  fileHref: (file: ProductionFile) => string | null;
  /** Link back to the admin page the sheet was generated from. */
  adminUrl?: string | null;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const e = escapeHtml;

function humanize(value: string | null | undefined) {
  if (!value) return '';
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

function formatMm(value: number | null) {
  return value === null ? '—' : `${value} mm`;
}

function sizeLabel(size: TechSheet['specification']['sizes'][number]) {
  const dims = [size.widthMm, size.heightMm, size.depthMm].filter(
    (value): value is number => value !== null,
  );
  return dims.length ? `${dims.join(' × ')} mm` : '—';
}

function list(items: string[], className = '') {
  if (!items.length) return '';
  return `<ul${className ? ` class="${className}"` : ''}>${items
    .map((item) => `<li>${e(item)}</li>`)
    .join('')}</ul>`;
}

function checklist(items: string[]) {
  return `<ol class="checklist">${items
    .map((item) => `<li><span class="box" aria-hidden="true"></span><span>${e(item)}</span></li>`)
    .join('')}</ol>`;
}

function field(label: string, value: string, options: { mono?: boolean; wide?: boolean } = {}) {
  return `<div class="field${options.wide ? ' wide' : ''}"><dt>${e(label)}</dt><dd${
    options.mono ? ' class="mono"' : ''
  }>${value || '—'}</dd></div>`;
}

function imageTag(file: ProductionFile, href: string) {
  return `<img src="${e(href)}" alt="${e(file.label)}" loading="lazy">`;
}

function fileCard(file: ProductionFile, href: string | null) {
  const isImage = /^image\//.test(file.contentType);
  const preview = href && isImage ? imageTag(file, href) : '';
  const tag = file.missing
    ? '<span class="tag tag-missing">missing in storage</span>'
    : file.reference
      ? '<span class="tag tag-ref">reference only</span>'
      : '<span class="tag tag-prod">production input</span>';
  return `<figure class="file${file.reference ? ' ref' : ' prod'}${file.missing ? ' missing' : ''}">
    <div class="thumb${file.contentType === 'image/svg+xml' ? ' svg' : ''}">${
      preview || '<span class="nofile">no preview</span>'
    }</div>
    <figcaption>
      <div class="file-head"><strong>${e(file.label)}</strong>${tag}</div>
      <div class="mono small">${href ? `<a href="${e(href)}">${e(file.fileName)}</a>` : e(file.fileName)}</div>
      <p class="small">${e(file.purpose)}</p>
    </figcaption>
  </figure>`;
}

function toolCard(tool: TechSheet['process']['tools'][number]) {
  return `<div class="tool">
    <div class="tool-head"><strong>${e(tool.name)}</strong>${
      tool.model ? ` <span class="mono small">${e(tool.model)}</span>` : ''
    } <span class="tag">${e(humanize(tool.role))}</span> <span class="tag">${e(humanize(tool.status))}</span></div>
    <dl class="kv small">
      ${tool.workArea ? `<div><dt>Work area</dt><dd>${e(tool.workArea)}</dd></div>` : ''}
      ${tool.power ? `<div><dt>Power</dt><dd>${e(tool.power)}</dd></div>` : ''}
      ${tool.inputFormats.length ? `<div><dt>Input formats</dt><dd>${e(tool.inputFormats.join(', '))}</dd></div>` : ''}
      ${tool.software.length ? `<div><dt>Software</dt><dd>${e(tool.software.join(', '))}</dd></div>` : ''}
      ${tool.materials.length ? `<div><dt>Materials</dt><dd>${e(tool.materials.join(', '))}</dd></div>` : ''}
    </dl>
    ${tool.hardLimits.length ? `<p class="small"><strong>Hard limits:</strong> ${e(tool.hardLimits.join(' '))}</p>` : ''}
  </div>`;
}

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font: 13px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; background: #f3f4f6; }
  .sheet { max-width: 900px; margin: 0 auto; background: #fff; padding: 32px 36px; border: 1px solid #ddd; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.06em; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #111; }
  h3 { font-size: 13px; margin: 14px 0 6px; }
  p { margin: 6px 0; }
  a { color: #0b4ea2; }
  .muted { color: #555; }
  .small { font-size: 12px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
  .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 14px; }
  .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #555; margin-bottom: 6px; }
  .status { display: inline-block; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
  .status.ready { background: #dcfce7; color: #14532d; border: 1px solid #86efac; }
  .status.review { background: #fee2e2; color: #7f1d1d; border: 1px solid #fca5a5; }
  .meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px 20px; margin-top: 14px; }
  .meta div dt, dl.fields dt, dl.kv dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
  .meta div dd, dl.fields dd, dl.kv dd { margin: 2px 0 0; font-weight: 600; }
  dl { margin: 0; }
  dl.fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 20px; }
  dl.fields .field.wide { grid-column: 1 / -1; }
  dl.kv div { display: grid; grid-template-columns: 110px 1fr; gap: 8px; margin: 2px 0; }
  dl.kv dd { font-weight: 500; }
  .box-warn, .box-note, .box-info { border-radius: 6px; padding: 10px 14px; margin: 10px 0; }
  .box-warn { background: #fef2f2; border: 1px solid #fca5a5; }
  .box-note { background: #fffbeb; border: 1px solid #fcd34d; }
  .box-info { background: #eff6ff; border: 1px solid #bfdbfe; }
  .box-warn h3, .box-note h3, .box-info h3 { margin-top: 0; }
  ul, ol { margin: 6px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
  tr.default td { background: #f8fafc; }
  .text-block { border: 1px solid #ccc; border-radius: 6px; padding: 10px 12px; background: #fafafa; }
  .text-block .line { display: grid; grid-template-columns: 28px 1fr 60px; gap: 10px; align-items: baseline; padding: 3px 0; border-bottom: 1px dashed #e5e7eb; }
  .text-block .line:last-child { border-bottom: 0; }
  .text-block .n { color: #888; font-size: 11px; }
  .text-block .t { font: 600 16px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; word-break: break-word; }
  .text-block .c { color: #888; font-size: 11px; text-align: right; }
  .swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid #999; vertical-align: -2px; margin-right: 6px; }
  .files { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
  .file { margin: 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; break-inside: avoid; }
  .file.prod { border-color: #111; border-width: 2px; }
  .file.missing { opacity: 0.6; }
  .thumb { aspect-ratio: 1; background: #e5e7eb; display: grid; place-items: center; overflow: hidden; }
  .thumb.svg { background: #fff; }
  .thumb img { width: 100%; height: 100%; object-fit: contain; }
  .nofile { color: #888; font-size: 11px; }
  figcaption { padding: 8px 10px; }
  .file-head { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .tag { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 999px; border: 1px solid #bbb; color: #444; background: #fff; }
  .tag-prod { border-color: #111; color: #111; }
  .tag-ref { border-color: #bbb; color: #666; }
  .tag-missing { border-color: #dc2626; color: #dc2626; }
  .convention { white-space: pre-wrap; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #fafafa; border: 1px solid #ddd; border-radius: 6px; padding: 12px; }
  .step { break-inside: avoid; margin: 10px 0; }
  .checklist { list-style: none; padding: 0; counter-reset: step; }
  .checklist li { display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start; padding: 4px 0; border-bottom: 1px dotted #e5e7eb; }
  .box { width: 14px; height: 14px; border: 1.5px solid #333; border-radius: 3px; margin-top: 2px; }
  .tools { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .tool { border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; break-inside: avoid; }
  .tool-head { margin-bottom: 6px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
  .signoff { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 12px; }
  .signoff div { border-top: 1px solid #111; padding-top: 6px; font-size: 11px; color: #555; height: 48px; }
  .toolbar { max-width: 900px; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: flex-end; }
  .toolbar button, .toolbar a { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid #333; background: #fff; cursor: pointer; text-decoration: none; color: #111; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #666; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; padding: 0; font-size: 11.5px; }
    .sheet { border: 0; padding: 0; max-width: none; }
    .toolbar { display: none; }
    h2 { break-after: avoid; }
    a { color: inherit; text-decoration: none; }
  }
`;

export function renderTechSheetHtml(sheet: TechSheet, options: RenderTechSheetHtmlOptions) {
  const { product, order, specification, process, reference } = sheet;
  const title = product.displayTitle;
  const statusLabel = sheet.status === 'ready' ? 'Ready for production' : 'Review required';
  const productionFiles = sheet.files.filter((file) => !file.reference);
  const referenceFiles = sheet.files.filter((file) => file.reference);

  const textBlock = order.textLines.length
    ? `<div class="text-block">${order.textLines
        .map(
          (line, index) =>
            `<div class="line"><span class="n">${index + 1}</span><span class="t">${
              e(line) || '<span class="muted">(empty line)</span>'
            }</span><span class="c">${line.length} ch</span></div>`,
        )
        .join('')}</div>
      <p class="small muted">Reproduce exactly as written, including capitalisation and punctuation. Line breaks are the customer's; total ${order.customerText?.length ?? 0} characters.</p>`
    : '<p class="muted">No customer text on this item.</p>';

  const ledValue = order.multiColor
    ? 'Multi-colour module'
    : order.ledColor
      ? `${order.ledColor.hex ? `<span class="swatch" style="background:${e(order.ledColor.hex)}"></span>` : ''}${e(
          order.ledColor.label,
        )}${order.ledColor.hex ? ` <span class="mono">${e(order.ledColor.hex)}</span>` : ''}`
      : '';

  const sizesTable = specification.sizes.length
    ? `<table><thead><tr><th>Size</th><th>Width</th><th>Height</th><th>Depth</th><th>W × H × D</th></tr></thead><tbody>${specification.sizes
        .map(
          (size, index) =>
            `<tr${index === 0 && specification.sizes.length > 1 ? ' class="default"' : ''}><td><strong>${e(size.label)}</strong>${
              index === 0 && specification.sizes.length > 1
                ? ' <span class="tag">default</span>'
                : ''
            }</td><td>${formatMm(size.widthMm)}</td><td>${formatMm(size.heightMm)}</td><td>${formatMm(
              size.depthMm,
            )}</td><td class="mono">${e(sizeLabel(size))}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';

  const bannerBlock = order.bannerSize
    ? `<dl class="fields">
        ${field('Banner preset', e(order.bannerSize.name))}
        ${field('Trim size', `${order.bannerSize.widthMm} × ${order.bannerSize.heightMm} mm`)}
        ${field('Media', e(`${order.bannerSize.material}, ${order.bannerSize.finish}`))}
      </dl>`
    : '';

  const traceBlock = specification.trace
    ? `<dl class="fields">
        ${field('SVG units', specification.trace.units ? e(specification.trace.units === 'mm' ? 'millimetres (true scale)' : 'pixels (no physical size)') : '—')}
        ${field('Traced paths', specification.trace.pathCount === null ? '—' : String(specification.trace.pathCount))}
        ${field(
          'Ink coverage',
          specification.trace.inkCoverage === null
            ? '—'
            : `${(specification.trace.inkCoverage * 100).toFixed(1)} % of the canvas`,
        )}
      </dl>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tech sheet · ${e(title)} · ${e(reference.label)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="toolbar">
  ${options.adminUrl ? `<a href="${e(options.adminUrl)}">Open in admin</a>` : ''}
  <button type="button" onclick="window.print()">Print / save as PDF</button>
</div>
<article class="sheet">
  <header class="header">
    <div>
      <div class="brand">Uniqraft · Production tech sheet</div>
      <h1>${e(title)}</h1>
      <p class="muted">${e(reference.label)}${
        product.catalogTitle && !title.includes(product.catalogTitle)
          ? ` · catalog item “${e(product.catalogTitle)}”`
          : ''
      }</p>
    </div>
    <span class="status ${sheet.status === 'ready' ? 'ready' : 'review'}">${statusLabel}</span>
  </header>

  <dl class="meta">
    <div><dt>Quantity</dt><dd>${order.quantity}</dd></div>
    <div><dt>Process</dt><dd>${e(process.name)}</dd></div>
    ${product.styleName ? `<div><dt>Style</dt><dd>${e(product.styleName)}</dd></div>` : ''}
    ${product.category ? `<div><dt>Family</dt><dd>${e(product.category)}${product.subcategory ? ` / ${e(product.subcategory)}` : ''}</dd></div>` : ''}
    ${order.orderStatus ? `<div><dt>Order status</dt><dd>${e(humanize(order.orderStatus))}</dd></div>` : ''}
    ${order.paymentStatus ? `<div><dt>Payment</dt><dd>${e(humanize(order.paymentStatus))}</dd></div>` : ''}
    ${order.destinationCountry ? `<div><dt>Ships to</dt><dd>${e(order.destinationCountry)}</dd></div>` : ''}
    ${order.createdAt ? `<div><dt>Ordered</dt><dd>${e(formatDate(order.createdAt))}</dd></div>` : ''}
    <div><dt>Sheet generated</dt><dd>${e(formatDate(sheet.generatedAt))}</dd></div>
  </dl>

  ${
    sheet.warnings.length
      ? `<div class="box-warn"><h3>Do not start until resolved</h3>${list(sheet.warnings)}</div>`
      : ''
  }
  ${
    sheet.confirmations.length
      ? `<div class="box-note"><h3>Confirm before starting</h3>${checklist(sheet.confirmations)}</div>`
      : ''
  }

  <h2>1. Customer order</h2>
  <div class="cols">
    <div>
      <h3>Personalized text</h3>
      ${textBlock}
    </div>
    <div>
      <dl class="fields">
        ${order.ledColor || order.multiColor ? field('LED colour', ledValue) : ''}
        ${field('Quantity', String(order.quantity))}
        ${product.tags.length ? field('Personalization', e(product.tags.map((tag) => humanize(tag.replace(/^personal_/, ''))).join(', '))) : ''}
        ${field('Product type', e(humanize(product.itemType ?? product.productType)))}
      </dl>
      ${bannerBlock}
    </div>
  </div>

  <h2>2. Specification</h2>
  <div class="cols">
    <div>
      <h3>Sizes</h3>
      ${sizesTable || '<p class="muted">No sizes recorded on the catalog item.</p>'}
      ${specification.sizeNote ? `<p class="small muted">${e(specification.sizeNote)}</p>` : ''}
    </div>
    <div>
      <h3>Materials</h3>
      ${list(specification.materials) || '<p class="muted">Not recorded; confirm with the production manager.</p>'}
      ${specification.finishes.length ? `<h3>Finish</h3>${list(specification.finishes)}` : ''}
    </div>
  </div>
  <dl class="fields" style="margin-top:12px">
    ${specification.processDescription ? field('Process (as recorded on the style)', e(specification.processDescription), { wide: true }) : ''}
    ${specification.artworkWidthMm ? field('Artwork canvas width', `${specification.artworkWidthMm} mm`) : ''}
  </dl>
  ${traceBlock}

  <h2>3. Production files</h2>
  <p class="small muted">Files are in the <span class="mono">files/</span> folder of this pack. Only files marked “production input” go to a machine.</p>
  ${
    productionFiles.length
      ? `<div class="files">${productionFiles.map((file) => fileCard(file, options.fileHref(file))).join('')}</div>`
      : '<div class="box-warn"><strong>No production file.</strong> This item cannot be produced from this pack yet.</div>'
  }
  ${
    referenceFiles.length
      ? `<h3>Reference material</h3><div class="files">${referenceFiles
          .map((file) => fileCard(file, options.fileHref(file)))
          .join('')}</div>`
      : ''
  }
  ${
    specification.fileConvention
      ? `<h3>File convention</h3>
      <p class="small muted">The specification the production file was generated against: layout, proportions and colour meaning. The customer's text was inserted where the placeholders stand.</p>
      <pre class="convention">${e(specification.fileConvention)}</pre>`
      : ''
  }

  <h2>4. Manufacturing instructions · ${e(process.name)}</h2>
  <div class="box-info">${e(process.summary)}</div>
  ${process.steps
    .map(
      (step, index) =>
        `<div class="step"><h3>${index + 1}. ${e(step.title)}</h3>${checklist(step.checklist)}</div>`,
    )
    .join('')}

  ${
    sheet.workshopNotes.length
      ? `<h2>5. Workshop notes</h2>${sheet.workshopNotes
          .map((note) => `<p>${e(note).replace(/\n/g, '<br>')}</p>`)
          .join('')}`
      : ''
  }

  <h2>${sheet.workshopNotes.length ? 6 : 5}. Equipment</h2>
  ${
    process.tools.length
      ? `<div class="tools">${process.tools.map(toolCard).join('')}</div>`
      : '<p class="muted">No shop tool is mapped to this process yet.</p>'
  }
  <div class="cols" style="margin-top:12px">
    ${process.designRules.length ? `<div><h3>Design rules</h3>${list(process.designRules, 'small')}</div>` : ''}
    ${process.setup.length ? `<div><h3>Setup requirements</h3>${list(process.setup, 'small')}</div>` : ''}
    ${process.safety.length ? `<div><h3>Safety</h3>${list(process.safety, 'small')}</div>` : ''}
  </div>

  <h2>${sheet.workshopNotes.length ? 7 : 6}. Quality check and sign-off</h2>
  ${checklist(sheet.qualityChecklist)}
  <div class="signoff">
    <div>Operator · date</div>
    <div>Quality check · date</div>
    <div>Packed · date</div>
  </div>

  <footer>
    <span class="mono">${[
      reference.orderId ? `order ${reference.orderId}` : null,
      reference.orderItemId ? `item ${reference.orderItemId}` : null,
      reference.generatedItemId ? `generation ${reference.generatedItemId}` : null,
      reference.previewOptionId ? `option ${reference.previewOptionId}` : null,
    ]
      .filter(Boolean)
      .map((part) => e(part as string))
      .join(' · ')}</span>
    <span>Tech sheet v${sheet.version} · generated ${e(formatDate(sheet.generatedAt))}</span>
  </footer>
</article>
</body>
</html>`;
}
