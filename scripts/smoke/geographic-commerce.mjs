import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const path of ['.env', '.env.local']) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  throw new Error('Supabase URL, service-role key, and anon key are required.');
}

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [{ data: regions, error: regionError }, { data: countries, error: countryError }] = await Promise.all([
  anon.from('market_regions').select('id, slug, is_active'),
  anon.from('countries').select('code, region_id, is_active'),
]);
if (regionError) throw new Error(regionError.message);
if (countryError) throw new Error(countryError.message);
assert(regions.length >= 5, 'Expected five seeded market regions.');
assert(countries.length === 249, `Expected 249 ISO countries, found ${countries.length}.`);
assert(countries.every((country) => country.region_id), 'Every country must belong to a region.');

const { error: anonWriteError } = await anon.from('market_regions').insert({ slug: 'blocked-smoke', name: 'Blocked smoke' });
assert(anonWriteError, 'Anonymous region writes must be rejected by RLS.');

const { data: item, error: itemError } = await service
  .from('catalog_items')
  .select('id')
  .eq('status', 'published')
  .limit(1)
  .single();
if (itemError) throw new Error(itemError.message);
const country = countries.find((entry) => entry.code === 'AM') ?? countries[0];
const region = regions.find((entry) => entry.id === country.region_id);
assert(region, 'Country region was not found.');

try {
  const { error } = await service.from('catalog_item_market_rules').insert([
    { catalog_item_id: item.id, region_id: region.id, visibility_override: false, shipping_rate_cents: 500 },
    { catalog_item_id: item.id, country_code: country.code, visibility_override: true, shipping_rate_cents: 0 },
  ]);
  if (error) throw new Error(error.message);

  const { data: rules, error: rulesError } = await anon
    .from('catalog_item_market_rules')
    .select('region_id, country_code, visibility_override, shipping_rate_cents')
    .eq('catalog_item_id', item.id);
  if (rulesError) throw new Error(rulesError.message);
  assert(rules.length === 2, 'Expected region and country rules.');
  const countryRule = rules.find((rule) => rule.country_code === country.code);
  assert(countryRule?.visibility_override === true, 'Country visibility override was not preserved.');
  assert(countryRule?.shipping_rate_cents === 0, 'Zero must remain an explicit free-shipping rate.');

  const { error: invalidTargetError } = await service.from('catalog_item_market_rules').insert({
    catalog_item_id: item.id,
    region_id: region.id,
    country_code: country.code,
    visibility_override: true,
  });
  assert(invalidTargetError, 'A rule with both region and country targets must fail.');
} finally {
  await service.from('catalog_item_market_rules').delete().eq('catalog_item_id', item.id);
}

console.log('Geographic commerce smoke passed.');
