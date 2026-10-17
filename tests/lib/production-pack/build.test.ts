import { describe, expect, it } from 'vitest';
import {
  buildDisplayTitle,
  buildTechSheet,
  materialsFromProcessDescription,
  parseCharacteristics,
  parseSizes,
  type TechSheetInput,
} from '@/lib/production-pack/build';
import { classifyProcess } from '@/lib/production-pack/process';
import { renderTechSheetHtml } from '@/lib/production-pack/render-html';
import { renderTechSheetMarkdown } from '@/lib/production-pack/render-markdown';

const reference: TechSheetInput['reference'] = {
  kind: 'order',
  label: 'Order 1a2b3c4d · item 1 of 1',
  orderId: '1a2b3c4d-0000-4000-8000-000000000000',
  orderItemId: '2b3c4d5e-0000-4000-8000-000000000000',
  generatedItemId: '3c4d5e6f-0000-4000-8000-000000000000',
  previewOptionId: '4d5e6f70-0000-4000-8000-000000000000',
  catalogItemId: '5e6f7081-0000-4000-8000-000000000000',
  reviewStatus: 'approved',
};

function keepsakeBoxInput(overrides: Partial<TechSheetInput> = {}): TechSheetInput {
  return {
    reference,
    generatedAt: '2026-10-16T10:00:00.000Z',
    title: 'Botanical wreath lid',
    quantity: 2,
    order: {
      status: 'approved_for_production',
      paymentStatus: 'paid',
      createdAt: '2026-10-15T09:30:00.000Z',
      destinationCountry: 'AM',
    },
    customText: 'Liam & Sophia\n20 October 2023',
    ledColor: null,
    multiColor: false,
    bannerSizeKey: null,
    productType: 'standard',
    catalog: {
      id: reference.catalogItemId as string,
      title: 'Personalized wedding keepsake box',
      itemType: 'standard',
      sizes: [
        { label: 'Standard', widthMm: 300, heightMm: 200, depthMm: 100 },
        { label: 'Large', widthMm: 350, heightMm: 250, depthMm: 120 },
      ],
      characteristics:
        'Material: oak-veneered plywood 8 mm\nFinish: satin oil\nHardware: bronze hinges',
      manufacturingNotes:
        'Engrave both panels flat before assembly.\n\nFit hinges and clasp after finishing.',
      tags: ['personal_text'],
      category: 'Keepsake boxes',
      subcategory: 'Wedding',
    },
    style: {
      id: 'style-1',
      name: 'Botanical wreath lid',
      manufacturingProcess: 'CO2-laser raster engraving, oak-toned wood (inside of the lid)',
      manufacturingPrompt:
        'Production file for the inside of the lid. {{#text}}Text: {{text}}{{/text}}',
      artworkWidthMm: 280,
      requiresSvg: true,
    },
    trace: { units: 'mm', pathCount: 212, inkCoverage: 0.061 },
    files: {
      manufacturingPng: 'u1/personalized-items/manufacturing/a.png',
      engraveSvg: 'u1/personalized-items/manufacturing/a-fill.svg',
      cutSvg: 'u1/personalized-items/manufacturing/a-stroke.svg',
      legacySvgContent: null,
      bannerDrawings: [],
      preview: 'u1/personalized-items/previews/a.png',
      customerPhotos: [],
    },
    bannerInstruction: null,
    ...overrides,
  };
}

describe('parseSizes', () => {
  it('reads the catalog size objects and tolerates strings and odd keys', () => {
    expect(
      parseSizes([
        { label: 'Standard', widthMm: 200, heightMm: 150 },
        { name: 'Deep', width_mm: '300', height_mm: 220, depthMm: 90 },
        'One size',
        null,
        42,
      ]),
    ).toEqual([
      { label: 'Standard', widthMm: 200, heightMm: 150, depthMm: null },
      { label: 'Deep', widthMm: 300, heightMm: 220, depthMm: 90 },
      { label: 'One size', widthMm: null, heightMm: null, depthMm: null },
    ]);
    expect(parseSizes('nope')).toEqual([]);
  });
});

describe('parseCharacteristics', () => {
  it('splits material, finish and tool lines from the rest', () => {
    const parsed = parseCharacteristics(
      'Material: PLA\nMaterial: PETG\nFinish: matte\nTool: Bambu Lab H2C\nPersonalization: custom text\n- Weight: 120 g',
    );
    expect(parsed.materials).toEqual(['PLA', 'PETG']);
    expect(parsed.finishes).toEqual(['matte']);
    expect(parsed.tools).toEqual(['Bambu Lab H2C']);
    expect(parsed.other).toEqual(['Personalization: custom text', 'Weight: 120 g']);
  });
});

describe('materialsFromProcessDescription', () => {
  it('keeps the material hint after the process phrase', () => {
    expect(
      materialsFromProcessDescription(
        'CO2-laser raster engraving, oak-toned wood (inside of the lid)',
      ),
    ).toEqual(['oak-toned wood (inside of the lid)']);
    expect(materialsFromProcessDescription('UV print on clear acrylic, 3 mm')).toEqual([
      'clear acrylic',
      '3 mm',
    ]);
    expect(materialsFromProcessDescription('Laser engraving')).toEqual([]);
  });
});

describe('classifyProcess', () => {
  const base = {
    processDescription: null,
    styleName: null,
    productType: null,
    itemType: null,
    bannerSizeKey: null,
    hasEngraveSvg: false,
    hasCutSvg: false,
    characteristics: [],
  };

  it('reads the style process text first', () => {
    expect(
      classifyProcess({ ...base, processDescription: 'CO2-laser raster engraving, oak wood' }),
    ).toBe('laser_raster_engraving');
    expect(
      classifyProcess({ ...base, processDescription: 'CO2 laser, vector score (stroke)' }),
    ).toBe('laser_vector_cutting');
    expect(classifyProcess({ ...base, processDescription: 'UV print on clear acrylic' })).toBe(
      'uv_printing',
    );
    expect(classifyProcess({ ...base, styleName: 'Rectangular UV print' })).toBe('uv_printing');
  });

  it('falls back to the product family, the traced files and the catalog tools', () => {
    expect(classifyProcess({ ...base, bannerSizeKey: 'promo-wide' })).toBe('eco_solvent_printing');
    expect(classifyProcess({ ...base, productType: 'personalized_night_light' })).toBe(
      'laser_raster_engraving',
    );
    expect(classifyProcess({ ...base, productType: 'laser_cut_2d_toy' })).toBe(
      'laser_vector_cutting',
    );
    expect(classifyProcess({ ...base, hasEngraveSvg: true })).toBe('laser_raster_engraving');
    expect(classifyProcess({ ...base, characteristics: ['Bambu Lab H2C', 'PLA'] })).toBe(
      'fff_printing',
    );
    expect(classifyProcess(base)).toBe('unknown');
  });
});

describe('buildDisplayTitle', () => {
  it('names the sheet after the catalog item and the style without repeating either', () => {
    expect(
      buildDisplayTitle('Botanical wreath lid', 'Wedding keepsake box', 'Botanical wreath lid'),
    ).toBe('Wedding keepsake box · Botanical wreath lid');
    expect(buildDisplayTitle('Custom banner', null, 'Promo wide')).toBe(
      'Custom banner · Promo wide',
    );
    expect(buildDisplayTitle('Night light', 'Night light', 'Night light')).toBe('Night light');
    expect(buildDisplayTitle('Desk organizer', 'Desk organizer', null)).toBe('Desk organizer');
  });
});

describe('buildTechSheet', () => {
  it('documents a laser-engraved keepsake box end to end', () => {
    const sheet = buildTechSheet(keepsakeBoxInput());

    expect(sheet.status).toBe('ready');
    expect(sheet.product.displayTitle).toBe(
      'Personalized wedding keepsake box · Botanical wreath lid',
    );
    expect(sheet.warnings).toEqual([]);
    expect(sheet.process.key).toBe('laser_raster_engraving');
    expect(sheet.process.tools.map((tool) => tool.id)).toEqual(['co2_laser_100w_1300_900']);
    expect(sheet.process.tools[0].workArea).toBe('1300 × 900 mm');
    expect(sheet.specification.materials).toEqual([
      'oak-toned wood (inside of the lid)',
      'oak-veneered plywood 8 mm',
    ]);
    expect(sheet.specification.finishes).toEqual(['satin oil']);
    expect(sheet.specification.sizes).toHaveLength(2);
    expect(sheet.specification.artworkWidthMm).toBe(280);
    expect(sheet.specification.fileConvention).toContain('Production file for the inside');
    expect(sheet.order.textLines).toEqual(['Liam & Sophia', '20 October 2023']);
    expect(sheet.workshopNotes).toEqual([
      'Engrave both panels flat before assembly.',
      'Fit hinges and clasp after finishing.',
      'Hardware: bronze hinges',
    ]);

    const production = sheet.files.filter((file) => !file.reference);
    expect(production.map((file) => [file.role, file.fileName])).toEqual([
      ['manufacturing_png', '01-manufacturing.png'],
      ['engrave_svg', '02-engrave-fill.svg'],
      ['cut_svg', '03-cut-stroke.svg'],
    ]);
    expect(sheet.files.find((file) => file.role === 'engrave_svg')?.purpose).toContain(
      '280 mm wide, true scale',
    );
    expect(sheet.files.find((file) => file.role === 'customer_preview')?.reference).toBe(true);

    // Two catalog sizes and no size on the order: the operator confirms, production is not blocked.
    expect(sheet.confirmations.some((line) => line.startsWith('Size: confirm'))).toBe(true);
    expect(sheet.confirmations.some((line) => line.startsWith('Customer text'))).toBe(true);

    const preflight = sheet.process.steps[0];
    expect(preflight.title).toBe('Preflight');
    expect(preflight.checklist[0]).toContain('280 mm wide');
    expect(preflight.checklist.some((line) => line.includes('Compare every character'))).toBe(true);
    expect(sheet.process.steps.at(-1)?.checklist.at(-1)).toContain('quality checklist');
    expect(sheet.qualityChecklist[0]).toContain('Text matches the order');
    expect(sheet.qualityChecklist.at(-1)).toContain('All 2 pieces checked');
  });

  it('blocks production when the files, the review or the payment are missing', () => {
    const sheet = buildTechSheet(
      keepsakeBoxInput({
        reference: { ...reference, reviewStatus: 'preview_ready' },
        order: {
          status: 'paid',
          paymentStatus: 'unpaid',
          createdAt: null,
          destinationCountry: null,
        },
        files: {
          manufacturingPng: null,
          engraveSvg: null,
          cutSvg: null,
          legacySvgContent: null,
          bannerDrawings: [],
          preview: 'u1/previews/a.png',
          customerPhotos: [],
        },
        trace: null,
      }),
    );

    expect(sheet.status).toBe('review_required');
    expect(sheet.warnings).toEqual([
      expect.stringContaining('No production file exists'),
      expect.stringContaining('needs a vector file'),
      expect.stringContaining('has not passed admin review (status: preview ready)'),
      expect.stringContaining('not marked paid'),
    ]);
    expect(sheet.files.every((file) => file.reference)).toBe(true);
    expect(sheet.process.steps[0].checklist[0]).toContain('No production file exists yet');
  });

  it('flags pixel-unit SVGs and material gaps, and reads LED colours', () => {
    const sheet = buildTechSheet(
      keepsakeBoxInput({
        title: 'Contour laser engraved',
        productType: 'personalized_night_light',
        catalog: null,
        style: {
          id: 'style-2',
          name: 'Contour laser engraved',
          manufacturingProcess: 'Laser engraving',
          manufacturingPrompt: null,
          artworkWidthMm: null,
          requiresSvg: true,
        },
        trace: { units: 'px', pathCount: 90, inkCoverage: 0.04 },
        customText: null,
        ledColor: 'warm_white',
        files: {
          manufacturingPng: 'u1/m.png',
          engraveSvg: 'u1/m-fill.svg',
          cutSvg: null,
          legacySvgContent: null,
          bannerDrawings: [],
          preview: null,
          customerPhotos: ['u1/photo.jpg'],
        },
      }),
    );

    expect(sheet.status).toBe('review_required');
    expect(sheet.warnings).toEqual([expect.stringContaining('no physical units')]);
    expect(sheet.confirmations).toEqual([
      expect.stringContaining('Size: not recorded'),
      expect.stringContaining('Material: not recorded'),
      'LED colour: Warm white (#f7d7a1).',
    ]);
    expect(sheet.order.ledColor).toEqual({
      value: 'warm_white',
      label: 'Warm white',
      hex: '#f7d7a1',
    });
    expect(sheet.order.textLines).toEqual([]);
    expect(sheet.files.find((file) => file.role === 'customer_photo')?.fileName).toBe(
      '03-customer-photo.jpg',
    );
    expect(sheet.process.steps[0].checklist[0]).toContain('no physical units');
  });

  it('documents a UV-printed plaque with the print convention and the panel cut tool', () => {
    const sheet = buildTechSheet(
      keepsakeBoxInput({
        title: 'Music plaque UV print',
        productType: 'personalized_night_light',
        customText: 'Perfect\nEd Sheeran',
        ledColor: 'sky_blue',
        style: {
          id: 'style-3',
          name: 'Music plaque UV print',
          manufacturingProcess: 'UV print on clear acrylic',
          manufacturingPrompt: 'Solid pure black (#000000) means clear, unprinted acrylic.',
          artworkWidthMm: null,
          requiresSvg: false,
        },
        trace: null,
        files: {
          manufacturingPng: 'u1/plaque.png',
          engraveSvg: null,
          cutSvg: null,
          legacySvgContent: null,
          bannerDrawings: [],
          preview: 'u1/preview.png',
          customerPhotos: ['u1/photo.jpg'],
        },
      }),
    );

    expect(sheet.status).toBe('ready');
    expect(sheet.process.key).toBe('uv_printing');
    expect(sheet.process.tools.map((tool) => tool.id)).toEqual([
      'co2_laser_100w_1300_900',
      'uv_printer_2500_1300',
    ]);
    expect(sheet.specification.materials[0]).toBe('clear acrylic');
    expect(sheet.files[0].label).toBe('Print file (PNG)');
    expect(
      sheet.process.steps[0].checklist.some((line) => line.includes('Inspect the photo')),
    ).toBe(true);
    expect(sheet.process.steps.at(-1)?.checklist.some((line) => line.includes('Sky blue'))).toBe(
      true,
    );
    expect(sheet.qualityChecklist.some((line) => line.includes('LED module lights'))).toBe(true);
  });

  it('describes banners from the preset and the banner instruction artifact', () => {
    const sheet = buildTechSheet(
      keepsakeBoxInput({
        title: 'Promo banner',
        productType: 'banner',
        bannerSizeKey: 'promo-wide',
        customText: null,
        catalog: null,
        style: null,
        trace: null,
        files: {
          manufacturingPng: null,
          engraveSvg: null,
          cutSvg: null,
          legacySvgContent: null,
          bannerDrawings: ['u1/banner-manufacturing/draw.svg'],
          preview: 'u1/preview.png',
          customerPhotos: [],
        },
        bannerInstruction: {
          status: 'review_required',
          warnings: ['Operator must verify final material roll.'],
        },
      }),
    );

    expect(sheet.process.key).toBe('eco_solvent_printing');
    expect(sheet.order.bannerSize).toMatchObject({ widthMm: 2000, heightMm: 800 });
    expect(sheet.specification.materials).toEqual(['vinyl banner media, matte']);
    expect(sheet.warnings).toEqual([
      expect.stringContaining('No production artwork is attached'),
      'Operator must verify final material roll.',
    ]);
    expect(sheet.files.map((file) => file.role)).toEqual(['banner_drawing', 'customer_preview']);
  });
});

describe('renderers', () => {
  it('render a self-contained HTML sheet with escaped text and linked files', () => {
    const sheet = buildTechSheet(keepsakeBoxInput({ customText: 'Tom & <Jerry>\n"quoted"' }));
    const html = renderTechSheetHtml(sheet, {
      fileHref: (file) => `files/${file.fileName}`,
      adminUrl: 'https://uniqraft.org/admin/orders/1a2b3c4d-0000-4000-8000-000000000000',
    });

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('Tom &amp; &lt;Jerry&gt;');
    expect(html).toContain('&quot;quoted&quot;');
    expect(html).not.toContain('<Jerry>');
    expect(html).toContain('href="files/02-engrave-fill.svg"');
    expect(html).toContain('<img src="files/01-manufacturing.png"');
    expect(html).toContain('Ready for production');
    expect(html).toContain('CO2 laser raster engraving');
    expect(html).toContain('Open in admin');
    expect(html).not.toContain('<script');
  });

  it('render a Markdown twin with the same sections', () => {
    const markdown = renderTechSheetMarkdown(buildTechSheet(keepsakeBoxInput()));
    expect(markdown).toContain(
      '# Production tech sheet: Personalized wedding keepsake box · Botanical wreath lid',
    );
    expect(markdown).toContain('## 1. Customer order');
    expect(markdown).toContain('Liam & Sophia');
    expect(markdown).toContain('| `files/02-engrave-fill.svg` | PRODUCTION INPUT |');
    expect(markdown).toContain('## 4. Manufacturing instructions: CO2 laser raster engraving');
    expect(markdown).toContain('## 5. Workshop notes');
    expect(markdown).toContain('- [ ] Text matches the order');
  });
});
