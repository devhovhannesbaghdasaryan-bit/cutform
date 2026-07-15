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

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:169.254.')
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  const directIpVersion = isIP(hostname);
  const addresses =
    directIpVersion > 0 ? [{ address: hostname, family: directIpVersion }] : await lookup(hostname, { all: true });

  for (const { address, family } of addresses) {
    const blocked = family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
    if (blocked) {
      throw new Error(`Refusing to fetch ${hostname}: resolves to a private/loopback address.`);
    }
  }
}

async function fetchImageWithGuards(imageUrl: string): Promise<Response> {
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
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect from ${currentUrl} had no Location header.`);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch image (HTTP ${response.status}).`);
    }
    return response;
  }
  throw new Error('Too many redirects while fetching imageUrl.');
}

/** Fetches an https image URL with SSRF guards and stores it in the catalog-assets bucket. Returns the storage path. */
export async function fetchAndStoreCatalogImage(
  supabase: TypedSupabaseClient,
  userId: string,
  imageUrl: string,
): Promise<string> {
  const response = await fetchImageWithGuards(imageUrl);

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const extension = IMAGE_EXTENSION_BY_MIME[contentType];
  if (!extension) {
    throw new Error(`imageUrl must point to a PNG, JPEG, or WEBP image (got "${contentType}").`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error('Catalog media must be 50 MB or smaller.');
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Catalog media must be 50 MB or smaller.');
  }

  return uploadToBucket(supabase, {
    bucket: 'catalog-assets',
    path: `${userId}/mcp-images/${crypto.randomUUID()}.${extension}`,
    body,
    contentType,
  });
}
