// Probe the /api/generate endpoint to inspect the streaming format.
// Re-uses session cookies prepared by smoke-login-and-fetch.mjs.
import fs from 'node:fs';

const cookies = fs.readFileSync('/tmp/uq-app-cookies.txt', 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const cols = l.split('\t');
    return `${cols[5]}=${cols[6]}`;
  })
  .join('; ');

// First, ensure a session row exists for this user.
const startResp = await fetch('http://localhost:3000/api/probe-start', {
  method: 'POST',
  headers: { Cookie: cookies, 'Content-Type': 'application/json' },
}).catch(() => null);

// Instead of using server actions (need Next-Action header), directly insert
// a session row via PostgREST with the user's cookie session token.
console.log('Cookies:', cookies.split(';').map(c => c.split('=')[0]).join(', '));

// We need a sessionId from a real startSession. Let's call /api/generate with
// a dummy sessionId and see how it fails — that tells us the auth check works.
const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const resp = await fetch('http://localhost:3000/api/generate', {
  method: 'POST',
  headers: { Cookie: cookies, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'e6b17629-0966-493e-a95b-f865cede9ba8',
    message: 'just a tiny 1x1 png — say hi',
    imageBase64: tinyPng,
    mimeType: 'image/png',
  }),
});

console.log('status', resp.status);
console.log('content-type', resp.headers.get('content-type'));
console.log('---first 600 bytes of body---');
const reader = resp.body.getReader();
const dec = new TextDecoder();
let total = '';
while (total.length < 600) {
  const { value, done } = await reader.read();
  if (done) break;
  total += dec.decode(value, { stream: true });
}
console.log(total);
