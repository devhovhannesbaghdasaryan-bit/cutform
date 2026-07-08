import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const CONTENT_TYPE_BY_EXT = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    let text;
    try {
      text = readFileSync(resolve(file), 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !(match[1] in env)) env[match[1]] = match[2];
    }
  }
  return env;
}

function findAssetFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return findAssetFiles(path);
    return entry.name === 'item.md' || entry.name === 'manifest.json' ? [] : [path];
  });
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) must be set in .env/.env.local');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const root = resolve('products');
  const files = findAssetFiles(root).sort();

  let uploaded = 0;
  let failed = 0;
  for (const absolutePath of files) {
    const repoPath = relative(resolve('.'), absolutePath).split(sep).join('/');
    const bucketPath = repoPath.replace(/^products\//, '');
    const ext = bucketPath.split('.').pop()?.toLowerCase() ?? '';
    const contentType = CONTENT_TYPE_BY_EXT[ext];
    if (!contentType) {
      console.warn(`Skipping unsupported file type: ${repoPath}`);
      continue;
    }

    const body = readFileSync(absolutePath);
    const { error } = await supabase.storage
      .from('catalog-assets')
      .upload(bucketPath, body, { contentType, upsert: true });

    if (error) {
      console.error(`FAILED ${bucketPath}: ${error.message}`);
      failed += 1;
    } else {
      uploaded += 1;
    }
  }

  console.log(`Uploaded ${uploaded}/${files.length} files to catalog-assets${failed ? ` (${failed} failed)` : ''}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
