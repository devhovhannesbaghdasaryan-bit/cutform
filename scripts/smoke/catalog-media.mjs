import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for catalog media smoke.',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const migrationSql = readFileSync('supabase/migrations/0001_init.sql', 'utf8');

for (const mime of [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
]) {
  assert(migrationSql.includes(mime), `catalog media migration is missing ${mime}`);
}
assert(migrationSql.includes('52428800'), 'catalog media migration should allow files up to 50 MB');

const { data: mediaRows, error: mediaError } = await supabase
  .from('catalog_item_media')
  .select('id, catalog_item_id, media_type, storage_path, sort_order, is_primary')
  .order('sort_order', { ascending: true })
  .limit(10);
if (mediaError) throw new Error(mediaError.message);

assert(Array.isArray(mediaRows), 'catalog_item_media query should return rows');
for (const row of mediaRows) {
  assert(['image', 'video'].includes(row.media_type), `Unexpected media type ${row.media_type}`);
  assert(row.storage_path.length > 0, 'Media storage path is required');
  assert(Number.isInteger(row.sort_order), 'Media sort order should be an integer');
}

console.log('Catalog media smoke passed');
