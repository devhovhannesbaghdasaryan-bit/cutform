// Watch chunks arrive from /api/generate to see if streamObject is actually
// streaming partial JSON (which useObject can parse) or just dumping the
// complete object at the end (which useObject cannot show progressively).
import fs from 'node:fs';

const cookies = fs.readFileSync('/tmp/snip-app-cookies.txt', 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => { const c = l.split('\t'); return `${c[5]}=${c[6]}`; })
  .join('; ');

// Reset session usage counters so the probe doesn't compound previous runs.
const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const t0 = Date.now();
const resp = await fetch('http://localhost:3000/api/generate', {
  method: 'POST',
  headers: { Cookie: cookies, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'e6b17629-0966-493e-a95b-f865cede9ba8',
    message: 'describe a star',
    imageBase64: tinyPng,
    mimeType: 'image/png',
  }),
});

console.log(`status ${resp.status} content-type ${resp.headers.get('content-type')}`);
const reader = resp.body.getReader();
const dec = new TextDecoder();
let i = 0;
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  const text = dec.decode(value, { stream: true });
  const t = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[${t}s] chunk #${++i} (${text.length}b): ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(2)}s, ${i} chunks total`);
