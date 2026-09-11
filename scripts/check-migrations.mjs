import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Confirms every migration file in supabase/migrations/ has actually been
// applied to the local Supabase database. Without this, a query can select
// a column added by a migration nobody ran locally, fail with a Postgres
// error, and an admin page silently 404s instead of explaining why
// (see app/admin/items/[id]/page.tsx's `if (error || !item) notFound()`).
function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Mirrors Next's precedence (process env, then .env.local, then .env) for the
// one key this script needs; predev runs before Next loads env files itself.
function readSupabaseUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  for (const file of ['.env.local', '.env']) {
    let text;
    try {
      text = readFileSync(resolve(file), 'utf8');
    } catch {
      continue;
    }
    const match = text.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
    if (match?.[1].trim()) return match[1].trim();
  }
  return undefined;
}

// Hosted projects get migrations from .github/workflows/supabase-migrations.yml
// when they land on main, so there's no local database to compare against.
const supabaseUrl = readSupabaseUrl();
if (supabaseUrl && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl)) {
  console.log(
    `[check-migrations] Using hosted Supabase (${new URL(supabaseUrl).host}) — skipping local drift check.\n` +
      '  Migrations reach it only when merged to main; unmerged ones on this branch are not applied.',
  );
  process.exit(0);
}

let output;
try {
  output = run('npx supabase migration list --local');
} catch (error) {
  const message = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  if (/dial error|connection refused|actively refused/i.test(message)) {
    console.warn('[check-migrations] Local Supabase is not running — skipping migration drift check.');
    process.exit(0);
  }
  console.error('[check-migrations] Could not check migration status:\n' + message);
  process.exit(0);
}

const pending = output
  .split('\n')
  .filter((line) => line.includes('|') && !line.includes('----'))
  .map((line) => line.split('|').map((cell) => cell.trim()))
  .filter(([local, remote]) => local && !remote && local !== 'Local')
  .map(([local]) => local);

if (pending.length > 0) {
  console.error(
    [
      '',
      '✗ Local Supabase database is missing migrations that exist in supabase/migrations/:',
      ...pending.map((version) => `    - ${version}`),
      '',
      '  Queries against columns/tables from these migrations will fail or silently',
      '  404 instead of showing the real error. Run:',
      '',
      '    npx supabase migration up',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log('[check-migrations] Local Supabase database is up to date.');
