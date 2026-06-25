import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'docs', 'manufacturing', 'product-opportunities.md');
const outputRoot = path.join(root, 'products');

const categoryConfig = {
  'Laser-Cut And Engraved Wood/Acrylic Products': {
    slug: 'laser-cut-engraved-wood-acrylic',
    appCategory: 'decorations',
    subcategory: 'personalized',
    itemType: 'decoration',
    tools: ['CO2 laser cutter', 'UV printer', 'CNC router', 'FFF 3D printer'],
    materials: ['acrylic', 'plywood', 'MDF', 'LED base components'],
    priceRange: [1800, 8900],
  },
  'CNC-Routed Wood Furniture, Decor, And Fixtures': {
    slug: 'cnc-routed-wood-furniture-decor-fixtures',
    appCategory: 'decorations',
    subcategory: 'wood-fixtures',
    itemType: 'standard',
    tools: ['KD2030 CNC router', 'XC-7500 dust collector', 'CO2 laser cutter'],
    materials: ['plywood', 'MDF', 'hardwood', 'finish coating'],
    priceRange: [3500, 68000],
  },
  'Printed Signage, Decals, Stickers, And Branded Surfaces': {
    slug: 'printed-signage-decals-stickers-branded-surfaces',
    appCategory: 'banners',
    subcategory: 'signage',
    itemType: 'banner',
    tools: ['eco-solvent printer', 'plotter cutter', 'UV flatbed printer'],
    materials: ['vinyl', 'PVC', 'acrylic', 'banner media', 'adhesive film'],
    priceRange: [1200, 42000],
  },
  '3D-Printed Products, Parts, Fixtures, And Custom Devices': {
    slug: '3d-printed-products-parts-fixtures-custom-devices',
    appCategory: 'constructors',
    subcategory: '3d-printed',
    itemType: 'standard',
    tools: ['Bambu Lab H2C', 'L1S80 FFF printer', 'T1-100 FFF printer'],
    materials: ['PLA', 'PETG', 'TPU', 'ABS/ASA when verified'],
    priceRange: [900, 56000],
  },
  'Flat Sheet-Metal Products And Bent Assemblies': {
    slug: 'flat-sheet-metal-products-bent-assemblies',
    appCategory: 'decorations',
    subcategory: 'metal',
    itemType: 'standard',
    tools: ['fiber metal laser cutter', 'hydraulic press brake', 'handheld laser welder'],
    materials: ['mild steel', 'stainless steel', 'aluminum', 'powder coat or paint'],
    priceRange: [2500, 76000],
  },
  'Tube, Profile, Welded Frame, And Hybrid Metal/Wood Products': {
    slug: 'tube-profile-welded-frame-hybrid-metal-wood',
    appCategory: 'decorations',
    subcategory: 'metal-furniture',
    itemType: 'standard',
    tools: ['tube/profile bender', 'metal band saw', 'handheld laser welder', 'CNC router'],
    materials: ['steel tube', 'aluminum tube', 'stainless tube', 'wood top or shelf where applicable'],
    priceRange: [7500, 125000],
  },
};

const reviewKeywords = [
  'children',
  'child',
  'medical',
  'therapy',
  'adaptive',
  'load-bearing',
  'chair',
  'tower',
  'gym',
  'bike rack',
  'scooter',
  'electrical',
  'led',
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/3d/g, '3d')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseProducts(markdown) {
  const products = [];
  let currentCategory = null;

  for (const line of markdown.split(/\r?\n/)) {
    const categoryMatch = line.match(/^## Category \d+: (.+)$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    if (!currentCategory || !line.startsWith('| ')) continue;
    if (line.includes('|---') || line.includes('| # |')) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== 4 || !/^\d+$/.test(cells[0])) continue;
    products.push({
      category: currentCategory,
      index: Number(cells[0]),
      title: cells[1],
      productLink: cells[2],
      description: cells[3],
    });
  }

  return products;
}

function estimatePriceCents(item, config) {
  const [min, max] = config.priceRange;
  const text = `${item.title} ${item.description}`.toLowerCase();
  let ratio = 0.35;

  if (/(large|furniture|frame|panel|shelving|screen|divider|rack|table|cabinet|pedestal)/.test(text)) {
    ratio = 0.72;
  }
  if (/(small|sticker|label|ornament|cake|token|clip|knob|desk)/.test(text)) {
    ratio = 0.18;
  }
  if (/(custom|personalized|branded|business|architectural|trade show)/.test(text)) {
    ratio += 0.12;
  }
  if (/(kit|set|modular|batch|panels)/.test(text)) {
    ratio += 0.1;
  }

  const cents = Math.round((min + (max - min) * Math.min(ratio, 0.95)) / 100) * 100;
  return Math.max(min, cents);
}

function personalizationFields(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const fields = [];
  if (/custom|personalized|name|monogram|family|pet|portrait|logo|branded|business/.test(text)) {
    fields.push('custom text or name', 'logo/photo/reference upload');
  }
  if (/size|sizing|panel|shelf|bracket|rack|frame|sign|banner|decal/.test(text)) {
    fields.push('dimensions');
  }
  if (/color|paint|finish|powder|stain|printed|vinyl|acrylic/.test(text)) {
    fields.push('color/finish');
  }
  return [...new Set(fields)];
}

function sizesFor(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (/banner|mural|decal|wall|screen|panel/.test(text)) {
    return [
      { label: 'Small', widthMm: 300, heightMm: 200 },
      { label: 'Medium', widthMm: 600, heightMm: 400 },
      { label: 'Large', widthMm: 1200, heightMm: 800 },
    ];
  }
  if (/furniture|shelf|rack|table|pedestal|cabinet|divider/.test(text)) {
    return [
      { label: 'Compact', widthMm: 450, heightMm: 300, depthMm: 250 },
      { label: 'Standard', widthMm: 900, heightMm: 450, depthMm: 350 },
    ];
  }
  return [
    { label: 'Standard', widthMm: 200, heightMm: 150 },
    { label: 'Large', widthMm: 300, heightMm: 220 },
  ];
}

function requiresReview(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return reviewKeywords.some((keyword) => text.includes(keyword));
}

function yamlList(values) {
  if (!values.length) return '[]';
  return `\n${values.map((value) => `  - ${JSON.stringify(value)}`).join('\n')}`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapTitle(title) {
  const words = title.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 24 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function seedSvg(item, categorySlug) {
  const lines = wrapTitle(item.title);
  const category = titleCase(categorySlug.replace(/-/g, ' '));
  const yStart = 365 - lines.length * 32;
  const titleLines = lines
    .map((line, index) => `<text x="600" y="${yStart + index * 72}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700" fill="#1f2937">${escapeXml(line)}</text>`)
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="${escapeXml(item.title)} seed product image">
  <rect width="1200" height="900" fill="#f5f1e8"/>
  <rect x="64" y="64" width="1072" height="772" rx="28" fill="#ffffff" stroke="#d7c9b2" stroke-width="4"/>
  <path d="M128 760 C280 650 410 808 560 694 C720 574 868 664 1072 548 L1072 836 L128 836 Z" fill="#e8dcc7"/>
  <circle cx="198" cy="182" r="54" fill="#c9a227"/>
  <circle cx="1004" cy="188" r="76" fill="#819171"/>
  <circle cx="998" cy="188" r="45" fill="#ffffff" opacity="0.28"/>
  <text x="600" y="225" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#6b5f4a" letter-spacing="3">${escapeXml(category.toUpperCase())}</text>
  ${titleLines}
  <text x="600" y="675" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" fill="#475569">Seed catalog image - replace before publishing</text>
</svg>
`;
}

function itemMarkdown(item, config, slug, categorySlug, mediaPath, mediaSourceUrl) {
  const priceCents = estimatePriceCents(item, config);
  const reviewRequired = requiresReview(item);
  const fields = personalizationFields(item);
  const sizes = sizesFor(item);
  const keywords = [
    item.title.toLowerCase(),
    config.appCategory,
    config.subcategory,
    ...config.materials.slice(0, 3),
  ];

  return `---
title: ${JSON.stringify(item.title)}
slug: ${JSON.stringify(slug)}
status: "draft"
category: ${JSON.stringify(config.appCategory)}
subcategory: ${JSON.stringify(config.subcategory)}
source_category: ${JSON.stringify(item.category)}
item_type: ${JSON.stringify(config.itemType)}
currency: "USD"
price_cents: ${priceCents}
is_popular: false
is_customizable: ${fields.length > 0}
thumbnail_path: ${JSON.stringify(mediaPath)}
media:
  - type: "image"
    path: ${JSON.stringify(mediaPath)}
    alt: ${JSON.stringify(`${item.title} product seed image`)}
    source_url: ${JSON.stringify(mediaSourceUrl)}
    source_note: "Local seed SVG created because external media downloads require explicit source approval; replace with approved original product photography before publishing."
product_research_link: ${JSON.stringify(item.productLink)}
production_review_status: ${JSON.stringify(reviewRequired ? 'review_required' : 'draft_ready')}
manufacturing_tools:${yamlList(config.tools)}
materials:${yamlList(config.materials)}
personalization_fields:${yamlList(fields)}
sizes: ${JSON.stringify(sizes)}
seo:
  title: ${JSON.stringify(`${item.title} | Custom made product`)}
  description: ${JSON.stringify(item.description.slice(0, 155))}
  keywords: ${JSON.stringify(keywords)}
---

# ${item.title}

${item.description}

## Product Details

- Starting price: $${(priceCents / 100).toFixed(2)}
- Category: ${config.appCategory}
- Subcategory: ${config.subcategory}
- Item type: ${config.itemType}
- Customizable: ${fields.length > 0 ? 'yes' : 'no'}
- Review status: ${reviewRequired ? 'review required before production/sale' : 'draft ready for admin review'}

## Manufacturing Notes

Recommended tool chain: ${config.tools.join(', ')}.

Candidate materials: ${config.materials.join(', ')}.

Production assumptions: dimensions, final material thickness, finish, quantity, and customer artwork must be confirmed before quoting. If the product is load-bearing, child-facing, electrical, medical/adaptive, or safety-critical, keep it in manual review.

## Media

- Hero image: \`${mediaPath}\`
- Intended media source: ${mediaSourceUrl}
- Source note: local seed SVG created because external media downloads require explicit source approval. Replace with approved original product photography or generated brand-owned imagery before publishing.

## Research Reference

${item.productLink}
`;
}

const markdown = await readFile(sourcePath, 'utf8');
const products = parseProducts(markdown);
const manifest = [];

await mkdir(outputRoot, { recursive: true });

for (const item of products) {
  const config = categoryConfig[item.category];
  if (!config) throw new Error(`Missing category config for ${item.category}`);

  const categoryDir = path.join(outputRoot, config.slug);
  const slug = `${String(item.index).padStart(2, '0')}-${slugify(item.title)}`;
  const itemDir = path.join(categoryDir, slug);
  const assetsDir = path.join(itemDir, 'assets');
  const mediaPath = `products/${config.slug}/${slug}/assets/hero.svg`;
  const imageUrl = item.productLink;

  await mkdir(assetsDir, { recursive: true });

  const imagePath = path.join(assetsDir, 'hero.svg');
  if (!existsSync(imagePath)) await writeFile(imagePath, seedSvg(item, config.slug), 'utf8');

  await writeFile(
    path.join(itemDir, 'item.md'),
    itemMarkdown(item, config, slug, config.slug, mediaPath, imageUrl),
    'utf8',
  );

  manifest.push({
    title: item.title,
    slug,
    category: config.slug,
    itemPath: `products/${config.slug}/${slug}/item.md`,
    mediaPath,
    mediaDownloaded: false,
    mediaGeneratedLocally: true,
    mediaSourceUrl: imageUrl,
    error: 'External media download was not attempted; local seed SVG was generated instead.',
  });
}

await writeFile(
  path.join(outputRoot, 'manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, items: manifest }, null, 2)}\n`,
  'utf8',
);

console.log(`Generated ${manifest.length} product seed items in ${outputRoot}`);
