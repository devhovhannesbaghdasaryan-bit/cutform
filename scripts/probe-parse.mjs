// Simulate what useObject does: accumulate chunks, attempt to parse as
// partial JSON, log the progression of object.svg over time.
import fs from 'node:fs';
const cookies = fs.readFileSync('/tmp/snip-app-cookies.txt', 'utf8')
  .split('\n').filter((l) => l && !l.startsWith('#'))
  .map((l) => { const c = l.split('\t'); return `${c[5]}=${c[6]}`; }).join('; ');

const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const t0 = Date.now();
const resp = await fetch('http://localhost:3000/api/generate', {
  method: 'POST',
  headers: { Cookie: cookies, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: '744ee785-f757-4fdb-a1f3-7852ac3306bf',
    message: 'describe a star',
    imageBase64: tinyPng,
    mimeType: 'image/png',
  }),
});

const reader = resp.body.getReader();
const dec = new TextDecoder();
let buf = '';
let lastSvgLen = -1;
let lastTitle = '';

// Best-effort partial JSON parser — adds closing chars as needed.
function tryParse(s) {
  // try as-is, then with common partial-suffix fixups
  const tries = [s];
  // close open string
  if ((s.match(/"/g) || []).length % 2 === 1) tries.push(s + '"');
  // close braces
  const opens = (s.match(/\{/g) || []).length;
  const closes = (s.match(/\}/g) || []).length;
  if (opens > closes) tries.push((tries.at(-1) || s) + '}'.repeat(opens - closes));
  for (const t of tries) {
    try { return JSON.parse(t); } catch {}
  }
  return null;
}

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const parsed = tryParse(buf);
  if (parsed) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    if (parsed.title && parsed.title !== lastTitle) {
      lastTitle = parsed.title;
      console.log(`[${elapsed}s] title now: "${parsed.title}"`);
    }
    if (parsed.svg && parsed.svg.length !== lastSvgLen) {
      lastSvgLen = parsed.svg.length;
      console.log(`[${elapsed}s] svg ${parsed.svg.length}b: ${parsed.svg.slice(0, 80)}…`);
    }
  }
}
console.log('\nFinal parsed object:', tryParse(buf));
