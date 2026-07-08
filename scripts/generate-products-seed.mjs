import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve('products');
const output = resolve('supabase/seed-products.sql');

function findItems(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findItems(path);
    return entry.name === 'item.md' ? [path] : [];
  });
}

function scalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  const value = match[1].trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value.replace(/^"|"$/g, '').replace(/\\"/g, '"');
}

function inlineJson(frontmatter, key, fallback) {
  const value = scalar(frontmatter, key);
  if (value === null) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error(`Invalid inline JSON for ${key}: ${value}`);
  }
}

function indentedList(frontmatter, key) {
  const block = frontmatter.match(new RegExp(`^${key}:\\s*\\r?\\n((?:  .*(?:\\r?\\n|$))*)`, 'm'))?.[1] ?? '';
  return [...block.matchAll(/^\s+-\s+"([^"]*)"/gm)].map((match) => match[1]);
}

function nestedScalar(frontmatter, blockKey, key) {
  const block = frontmatter.match(new RegExp(`^${blockKey}:\\s*\\r?\\n((?:  .*(?:\\r?\\n|$))*)`, 'm'))?.[1] ?? '';
  const match = block.match(new RegExp(`^\\s{2}${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^"|"$/g, '').replace(/\\"/g, '"') : null;
}

/** Local repo path -> catalog-assets bucket key (must match scripts/upload-products-media.mjs). */
function toBucketPath(path) {
  return path?.replace(/^products\//, '') ?? null;
}

function media(frontmatter) {
  const block = frontmatter.match(/^media:\s*\r?\n((?:  .*?(?:\r?\n|$))*)/m)?.[1] ?? '';
  return block
    .split(/^\s{2}-\s+/m)
    .slice(1)
    .map((entry) => ({
      type: entry.match(/^type:\s*"([^"]+)"/m)?.[1] ?? 'image',
      path: toBucketPath(entry.match(/^\s+path:\s*"([^"]+)"/m)?.[1]),
      alt: entry.match(/^\s+alt:\s*"([^"]*)"/m)?.[1] ?? null,
      sourceUrl: entry.match(/^\s+source_url:\s*"([^"]*)"/m)?.[1] ?? null,
      sourceNote: entry.match(/^\s+source_note:\s*"([^"]*)"/m)?.[1] ?? null,
    }))
    .filter((entry) => entry.path);
}

function section(body, heading) {
  return body.match(new RegExp(`^## ${heading}\\s*\\r?\\n([\\s\\S]*?)(?=^## |\\z)`, 'm'))?.[1].trim() ?? null;
}

function cleanTranslation(value) {
  if (!value) return null;
  // Most legacy product files contain visibly double-encoded RU/AM text. Do not
  // seed corrupt copy; the storefront will fall back to the English source.
  return /(?:Ð.|Ñ.|Õ.|Ö.|â€)/.test(value) ? null : value;
}

function parseItem(path) {
  const source = readFileSync(path, 'utf8');
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing frontmatter: ${path}`);
  const [, frontmatter, body] = match;
  const itemMedia = media(frontmatter);
  const title = scalar(frontmatter, 'title');
  const description = nestedScalar(frontmatter, 'seo', 'description') ?? body.match(/^#[^\n]*\n+([^#\n][^\n]*)/m)?.[1] ?? null;
  const materials = indentedList(frontmatter, 'materials');
  const fields = indentedList(frontmatter, 'personalization_fields');
  const tools = indentedList(frontmatter, 'manufacturing_tools');
  const keywords = (() => {
    const value = nestedScalar(frontmatter, 'seo', 'keywords');
    if (!value) return [];
    try { return JSON.parse(value); } catch { return []; }
  })();
  return {
    sourceFile: relative(resolve('.'), path).split(sep).join('/'),
    title,
    titleRu: cleanTranslation(scalar(frontmatter, 'title_ru')),
    titleAm: cleanTranslation(scalar(frontmatter, 'title_am')),
    slug: scalar(frontmatter, 'slug'),
    status: scalar(frontmatter, 'status') ?? 'draft',
    category: scalar(frontmatter, 'category'),
    subcategory: scalar(frontmatter, 'subcategory'),
    itemType: scalar(frontmatter, 'item_type') ?? 'standard',
    currency: scalar(frontmatter, 'currency') ?? 'USD',
    priceCents: scalar(frontmatter, 'price_cents') ?? 0,
    isPopular: scalar(frontmatter, 'is_popular') ?? false,
    isCustomizable: scalar(frontmatter, 'is_customizable') ?? false,
    thumbnailPath: toBucketPath(scalar(frontmatter, 'thumbnail_path')),
    media: itemMedia,
    galleryPaths: itemMedia.map((entry) => entry.path),
    sizes: inlineJson(frontmatter, 'sizes', []),
    description,
    descriptionRu: cleanTranslation(nestedScalar(frontmatter, 'seo', 'description_ru')),
    descriptionAm: cleanTranslation(nestedScalar(frontmatter, 'seo', 'description_am')),
    manufacturingNotes: section(body, 'Manufacturing Notes'),
    characteristics: [...materials.map((x) => `Material: ${x}`), ...fields.map((x) => `Personalization: ${x}`), ...tools.map((x) => `Tool: ${x}`)].join('\n') || null,
    seo: {
      title: nestedScalar(frontmatter, 'seo', 'title'),
      description,
      descriptionRu: cleanTranslation(nestedScalar(frontmatter, 'seo', 'description_ru')),
      descriptionAm: cleanTranslation(nestedScalar(frontmatter, 'seo', 'description_am')),
      keywords,
    },
  };
}

const products = findItems(root).sort().map(parseItem);
const required = ['title', 'slug', 'category', 'priceCents'];
for (const product of products) {
  for (const field of required) {
    if (product[field] === null || product[field] === '') {
      throw new Error(`${product.sourceFile} is missing ${field}`);
    }
  }
  if (!['draft', 'published', 'archived'].includes(product.status)) {
    throw new Error(`${product.sourceFile} has invalid status: ${product.status}`);
  }
  if (!['standard', 'toy', 'decoration', 'night_light', 'personalized_night_light', 'banner'].includes(product.itemType)) {
    throw new Error(`${product.sourceFile} has invalid item_type: ${product.itemType}`);
  }
}
const duplicateSlugs = products.map((product) => product.slug).filter((slug, index, all) => all.indexOf(slug) !== index);
if (duplicateSlugs.length) throw new Error(`Duplicate product slugs: ${[...new Set(duplicateSlugs)].join(', ')}`);
const json = JSON.stringify(products).replaceAll("'", "''");
const sql = `-- GENERATED FILE. Run: pnpm seed:products:generate
-- Source: products/**/item.md (${products.length} products)
-- Idempotently upserts catalog data and replaces media for these product slugs.

begin;

truncate table public.catalog_items cascade;

create temporary table seed_products (data jsonb) on commit drop;
insert into seed_products (data)
select value from jsonb_array_elements('${json}'::jsonb);

insert into public.categories (slug, name, description, sort_order, is_active)
select distinct data->>'category', initcap(replace(data->>'category', '-', ' ')),
  'Catalog category seeded from products directory.', 100, true
from seed_products
where coalesce(data->>'category', '') <> ''
on conflict (slug) do nothing;

insert into public.subcategories (category_id, slug, name, description, sort_order, is_active)
select distinct c.id, p.data->>'subcategory', initcap(replace(p.data->>'subcategory', '-', ' ')),
  'Catalog subcategory seeded from products directory.', 100, true
from seed_products p
join public.categories c on c.slug = p.data->>'category'
where coalesce(p.data->>'subcategory', '') <> ''
on conflict (category_id, slug) do nothing;

insert into public.catalog_items (
  category_id, subcategory_id, title, slug, description, price_cents, currency,
  status, is_popular, is_customizable, product_source, thumbnail_path,
  gallery_paths, manufacturing_notes, item_type, sizes, characteristics
)
select c.id, s.id, p.data->>'title', p.data->>'slug', p.data->>'description',
  (p.data->>'priceCents')::integer, p.data->>'currency', p.data->>'status',
  (p.data->>'isPopular')::boolean, (p.data->>'isCustomizable')::boolean,
  'catalog', p.data->>'thumbnailPath',
  coalesce(array(select jsonb_array_elements_text(p.data->'galleryPaths')), '{}'),
  p.data->>'manufacturingNotes', p.data->>'itemType',
  coalesce(p.data->'sizes', '[]'::jsonb), p.data->>'characteristics'
from seed_products p
join public.categories c on c.slug = p.data->>'category'
left join public.subcategories s on s.category_id = c.id and s.slug = p.data->>'subcategory'
on conflict (slug) do update set
  category_id = excluded.category_id, subcategory_id = excluded.subcategory_id,
  title = excluded.title, description = excluded.description,
  price_cents = excluded.price_cents, currency = excluded.currency,
  status = excluded.status, is_popular = excluded.is_popular,
  is_customizable = excluded.is_customizable, thumbnail_path = excluded.thumbnail_path,
  gallery_paths = excluded.gallery_paths, manufacturing_notes = excluded.manufacturing_notes,
  item_type = excluded.item_type, sizes = excluded.sizes,
  characteristics = excluded.characteristics, updated_at = now();

insert into public.catalog_item_translations (catalog_item_id, locale, title, description)
select i.id, translation.locale, translation.title, translation.description
from seed_products p
join public.catalog_items i on i.slug = p.data->>'slug'
cross join lateral (values
  ('en', p.data->>'title', p.data->>'description'),
  ('ru', p.data->>'titleRu', p.data->>'descriptionRu'),
  ('am', p.data->>'titleAm', p.data->>'descriptionAm')
) translation(locale, title, description)
where coalesce(translation.title, '') <> ''
on conflict (catalog_item_id, locale) do update set
  title = excluded.title, description = excluded.description, updated_at = now();

insert into public.catalog_item_seo_metadata (
  catalog_item_id, locale, seo_title, seo_description, seo_slug, keywords,
  og_title, og_description, social_image_path, generated_by_ai, reviewed_by_admin
)
select i.id, translation.locale, translation.title, translation.description,
  p.data->>'slug', coalesce(array(select jsonb_array_elements_text(p.data->'seo'->'keywords')), '{}'),
  translation.title, translation.description, p.data->>'thumbnailPath',
  true, false
from seed_products p
join public.catalog_items i on i.slug = p.data->>'slug'
cross join lateral (values
  ('en', p.data->'seo'->>'title', p.data->'seo'->>'description'),
  ('ru', p.data->>'titleRu', p.data->'seo'->>'descriptionRu'),
  ('am', p.data->>'titleAm', p.data->'seo'->>'descriptionAm')
) translation(locale, title, description)
where coalesce(translation.title, '') <> ''
on conflict (catalog_item_id, locale) do update set
  seo_title = excluded.seo_title, seo_description = excluded.seo_description,
  seo_slug = excluded.seo_slug, keywords = excluded.keywords,
  og_title = excluded.og_title, og_description = excluded.og_description,
  social_image_path = excluded.social_image_path, updated_at = now();

delete from public.catalog_item_media m
using public.catalog_items i, seed_products p
where m.catalog_item_id = i.id and i.slug = p.data->>'slug';

insert into public.catalog_item_media (
  catalog_item_id, media_type, storage_path, alt_text, sort_order, is_primary, metadata
)
select i.id, coalesce(asset.value->>'type', 'image'), asset.value->>'path',
  asset.value->>'alt', asset.ordinality::integer - 1, asset.ordinality = 1,
  jsonb_strip_nulls(jsonb_build_object(
    'source_url', asset.value->>'sourceUrl',
    'source_note', asset.value->>'sourceNote',
    'source_file', p.data->>'sourceFile'
  ))
from seed_products p
join public.catalog_items i on i.slug = p.data->>'slug'
cross join lateral jsonb_array_elements(p.data->'media') with ordinality asset(value, ordinality);

commit;
`;

writeFileSync(output, sql, 'utf8');
console.log(`Generated ${relative(resolve('.'), output)} with ${products.length} products.`);
