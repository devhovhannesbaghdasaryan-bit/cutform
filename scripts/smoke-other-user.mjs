import { createBrowserClient } from '@supabase/ssr';
import fs from 'node:fs';
const cookies = new Map();
const supabase = createBrowserClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  {
    cookies: {
      getAll() { return [...cookies.entries()].map(([name, value]) => ({ name, value })); },
      setAll(list) { for (const c of list) { if (c.value === '') cookies.delete(c.name); else cookies.set(c.name, c.value); } },
    },
  },
);
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'other@example.com', password: 'correct-horse-battery-staple',
});
if (error) { console.error(error.message); process.exit(1); }
const lines = ['# Netscape HTTP Cookie File'];
for (const [name, value] of cookies) lines.push(`localhost\tFALSE\t/\tFALSE\t0\t${name}\t${value}`);
fs.writeFileSync('/tmp/uq-other-cookies.txt', lines.join('\n') + '\n');
console.log('signed in as', data.user.email);
