import { createBrowserClient } from '@supabase/ssr';

const URL_ = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

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
fs.writeFileSync('/tmp/snip-app-cookies.txt', lines.join('\n') + '\n');
console.log('cookies written: ', [...cookies.keys()].join(', '));
