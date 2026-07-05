import { createBrowserClient } from '@supabase/ssr';

const URL_ = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SMOKE_DEMO_JWT ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!ANON) {
  console.error('Set SMOKE_DEMO_JWT (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to the local Supabase anon key.');
  process.exit(1);
}

// Minimal in-memory cookie store
const cookies = new Map();
const supabase = createBrowserClient(URL_, ANON, {
  cookies: {
    getAll() { return [...cookies.entries()].map(([name, value]) => ({ name, value })); },
    setAll(list) { for (const c of list) { if (c.value === '') cookies.delete(c.name); else cookies.set(c.name, c.value); } },
  },
});

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'verified@example.com', password: 'correct-horse-battery-staple',
});
if (error) { console.error('signin error', error.message); process.exit(1); }
console.log('signed in as', data.user.email, 'confirmed:', !!data.user.email_confirmed_at);

// Convert in-memory cookies → curl cookie jar format
import fs from 'node:fs';
const lines = ['# Netscape HTTP Cookie File'];
for (const [name, value] of cookies) {
  // domain, flag, path, secure, expiration, name, value
  lines.push(`localhost\tFALSE\t/\tFALSE\t0\t${name}\t${value}`);
}
fs.writeFileSync('/tmp/uq-app-cookies.txt', lines.join('\n') + '\n');
console.log('cookies written: ', [...cookies.keys()].join(', '));
