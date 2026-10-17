import type { TechSheet } from '@/lib/production-pack/types';

function humanize(value: string | null | undefined) {
  if (!value) return '';
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function mm(value: number | null) {
  return value === null ? '—' : `${value} mm`;
}

function bullets(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n');
}

function boxes(items: string[]) {
  return items.map((item) => `- [ ] ${item}`).join('\n');
}

/**
 * Plain-text twin of the HTML sheet, for pasting into a chat with the
 * workshop or printing from a terminal. Same sections, same order.
 */
export function renderTechSheetMarkdown(sheet: TechSheet) {
  const { product, order, specification, process, reference } = sheet;
  const lines: string[] = [];
  const title = product.displayTitle;

  lines.push(`# Production tech sheet: ${title}`);
  lines.push('');
  lines.push(
    `**${sheet.status === 'ready' ? 'READY FOR PRODUCTION' : 'REVIEW REQUIRED'}** · ${reference.label} · quantity ${order.quantity} · ${process.name}`,
  );
  if (product.category)
    lines.push(
      `Family: ${product.category}${product.subcategory ? ` / ${product.subcategory}` : ''}`,
    );
  if (order.orderStatus || order.paymentStatus) {
    lines.push(
      `Order: ${humanize(order.orderStatus)}${order.paymentStatus ? `, payment ${order.paymentStatus}` : ''}${
        order.destinationCountry ? `, ships to ${order.destinationCountry}` : ''
      }`,
    );
  }
  lines.push(`Generated: ${sheet.generatedAt}`);
  lines.push('');

  if (sheet.warnings.length) {
    lines.push('## Do not start until resolved');
    lines.push(bullets(sheet.warnings));
    lines.push('');
  }
  if (sheet.confirmations.length) {
    lines.push('## Confirm before starting');
    lines.push(boxes(sheet.confirmations));
    lines.push('');
  }

  lines.push('## 1. Customer order');
  if (order.textLines.length) {
    lines.push('Personalized text (exactly as written, one line each):');
    lines.push('');
    lines.push('```text');
    lines.push(...order.textLines);
    lines.push('```');
  } else {
    lines.push('No customer text on this item.');
  }
  if (order.multiColor) lines.push('LED colour: multi-colour module');
  else if (order.ledColor)
    lines.push(
      `LED colour: ${order.ledColor.label}${order.ledColor.hex ? ` (${order.ledColor.hex})` : ''}`,
    );
  if (order.bannerSize) {
    lines.push(
      `Banner: ${order.bannerSize.name}, ${order.bannerSize.widthMm} × ${order.bannerSize.heightMm} mm, ${order.bannerSize.material} ${order.bannerSize.finish}`,
    );
  }
  lines.push('');

  lines.push('## 2. Specification');
  if (specification.sizes.length) {
    lines.push('| Size | Width | Height | Depth |');
    lines.push('| --- | --- | --- | --- |');
    for (const size of specification.sizes) {
      lines.push(
        `| ${size.label} | ${mm(size.widthMm)} | ${mm(size.heightMm)} | ${mm(size.depthMm)} |`,
      );
    }
    if (specification.sizeNote) lines.push(`\n${specification.sizeNote}`);
  } else {
    lines.push('Sizes: not recorded on the catalog item.');
  }
  lines.push('');
  lines.push(
    specification.materials.length
      ? `Materials:\n${bullets(specification.materials)}`
      : 'Materials: not recorded; confirm with the production manager.',
  );
  if (specification.finishes.length) lines.push(`Finish:\n${bullets(specification.finishes)}`);
  if (specification.processDescription)
    lines.push(`Process (as recorded on the style): ${specification.processDescription}`);
  if (specification.artworkWidthMm)
    lines.push(`Artwork canvas width: ${specification.artworkWidthMm} mm`);
  if (specification.trace) {
    lines.push(
      `Trace: units ${specification.trace.units ?? '—'}, paths ${specification.trace.pathCount ?? '—'}, ink coverage ${
        specification.trace.inkCoverage === null
          ? '—'
          : `${(specification.trace.inkCoverage * 100).toFixed(1)} %`
      }`,
    );
  }
  lines.push('');

  lines.push('## 3. Production files');
  lines.push('| File | Role | Purpose |');
  lines.push('| --- | --- | --- |');
  for (const file of sheet.files) {
    lines.push(
      `| \`files/${file.fileName}\`${file.missing ? ' (missing)' : ''} | ${
        file.reference ? 'reference only' : 'PRODUCTION INPUT'
      } | ${file.label}: ${file.purpose} |`,
    );
  }
  if (specification.fileConvention) {
    lines.push('');
    lines.push('### File convention');
    lines.push('');
    lines.push('```text');
    lines.push(specification.fileConvention);
    lines.push('```');
  }
  lines.push('');

  lines.push(`## 4. Manufacturing instructions: ${process.name}`);
  lines.push(process.summary);
  lines.push('');
  process.steps.forEach((step, index) => {
    lines.push(`### ${index + 1}. ${step.title}`);
    lines.push(boxes(step.checklist));
    lines.push('');
  });

  let section = 5;
  if (sheet.workshopNotes.length) {
    lines.push(`## ${section}. Workshop notes`);
    lines.push(sheet.workshopNotes.join('\n\n'));
    lines.push('');
    section += 1;
  }

  lines.push(`## ${section}. Equipment`);
  if (process.tools.length) {
    for (const tool of process.tools) {
      lines.push(
        `- **${tool.name}**${tool.model ? ` (${tool.model})` : ''}: ${humanize(tool.role)}, ${humanize(tool.status)}${
          tool.workArea ? `, work area ${tool.workArea}` : ''
        }${tool.power ? `, ${tool.power}` : ''}${
          tool.inputFormats.length ? `; input ${tool.inputFormats.join(', ')}` : ''
        }`,
      );
    }
  } else {
    lines.push('No shop tool is mapped to this process yet.');
  }
  if (process.designRules.length) lines.push(`\nDesign rules:\n${bullets(process.designRules)}`);
  if (process.setup.length) lines.push(`\nSetup:\n${bullets(process.setup)}`);
  if (process.safety.length) lines.push(`\nSafety:\n${bullets(process.safety)}`);
  lines.push('');
  section += 1;

  lines.push(`## ${section}. Quality check`);
  lines.push(boxes(sheet.qualityChecklist));
  lines.push('');
  lines.push('Operator ________  QC ________  Packed ________');
  lines.push('');
  lines.push(
    `_${[
      reference.orderId ? `order ${reference.orderId}` : null,
      reference.orderItemId ? `item ${reference.orderItemId}` : null,
      reference.generatedItemId ? `generation ${reference.generatedItemId}` : null,
      reference.previewOptionId ? `option ${reference.previewOptionId}` : null,
    ]
      .filter(Boolean)
      .join(' · ')}_`,
  );

  return `${lines.join('\n')}\n`;
}
