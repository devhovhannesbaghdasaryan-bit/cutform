import 'server-only';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

// IPv4 ranges that must never be fetched server-side: loopback, private,
// link-local (includes the 169.254.169.254 cloud metadata endpoint), and
// this-network/broadcast.
const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([base, prefix]) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

const IPV4_MAPPED_IPV6_PREFIX = '::ffff:';

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) must be checked against the
  // same IPv4 blocklist, not string-matched — otherwise ::ffff:192.168.1.1
  // and similar slip past into internal RFC1918 space.
  if (normalized.startsWith(IPV4_MAPPED_IPV6_PREFIX)) {
    const embeddedIpv4 = normalized.slice(IPV4_MAPPED_IPV6_PREFIX.length);
    if (isIP(embeddedIpv4) === 4) return isBlockedIpv4(embeddedIpv4);
  }

  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  const directIpVersion = isIP(hostname);
  const addresses =
    directIpVersion > 0
      ? [{ address: hostname, family: directIpVersion }]
      : await lookup(hostname, { all: true });

  for (const { address, family } of addresses) {
    const blocked = family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
    if (blocked) {
      throw new Error(`Refusing to fetch ${hostname}: resolves to a private/loopback address.`);
    }
  }
}

interface GuardedFetchResult {
  response: Response;
  releaseTimeout: () => void;
}

/**
 * Fetches through the redirect chain with https/private-IP guards on every
 * hop. For the final (non-redirect) response, the per-hop timeout is left
 * armed and returned as `releaseTimeout` rather than cleared here — the
 * caller must call it after finishing (or failing) the body read, so the
 * timeout bounds the whole request including the body download, not just
 * the headers.
 */
async function fetchImageWithGuards(imageUrl: string): Promise<GuardedFetchResult> {
  let currentUrl = imageUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error('imageUrl must use https.');
    }
    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(currentUrl, { redirect: 'manual', signal: controller.signal });
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }

    if (response.status >= 300 && response.status < 400) {
      clearTimeout(timeout);
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect from ${currentUrl} had no Location header.`);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) {
      clearTimeout(timeout);
      throw new Error(`Failed to fetch image (HTTP ${response.status}).`);
    }
    return { response, releaseTimeout: () => clearTimeout(timeout) };
  }
  throw new Error('Too many redirects while fetching imageUrl.');
}

/**
 * Reads the response body through a running byte counter so a hostile
 * server can't evade the size cap by omitting or lying about
 * Content-Length — the check fires mid-stream, before the full body is
 * ever buffered.
 */
async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new Error('Catalog media must be 50 MB or smaller.');
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Catalog media must be 50 MB or smaller.');
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

/** Fetches an https image URL with SSRF guards and stores it in the catalog-assets bucket. Returns the storage path. */
export async function fetchAndStoreCatalogImage(
  supabase: TypedSupabaseClient,
  userId: string,
  imageUrl: string,
): Promise<string> {
  const { response, releaseTimeout } = await fetchImageWithGuards(imageUrl);
  try {
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    const extension = IMAGE_EXTENSION_BY_MIME[contentType];
    if (!extension) {
      throw new Error(`imageUrl must point to a PNG, JPEG, or WEBP image (got "${contentType}").`);
    }

    const body = await readBodyWithLimit(response, MAX_IMAGE_BYTES);

    return await uploadToBucket(supabase, {
      bucket: 'catalog-assets',
      path: `${userId}/mcp-images/${crypto.randomUUID()}.${extension}`,
      body,
      contentType,
    });
  } finally {
    releaseTimeout();
  }
}
