const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

export function isUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val);
}

export function isDateString(val: unknown): val is string {
  return typeof val === 'string' && DATE_RE.test(val);
}

export function isNonEmptyString(val: unknown, maxLen = 500): val is string {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

export function isOneOf<T extends string>(val: unknown, options: readonly T[]): val is T {
  return typeof val === 'string' && (options as readonly string[]).includes(val);
}

export function isArrayOf(val: unknown, predicate: (item: unknown) => boolean): val is unknown[] {
  return Array.isArray(val) && val.every(predicate);
}

export function isSafeFilename(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0 && val.length <= 200 && SAFE_FILENAME_RE.test(val);
}

// JPEG: FF D8 FF, PNG: 89 50 4E 47
export function isImageBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  return isJpeg || isPng;
}

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
export const MIN_PASSWORD_LENGTH = 8;

/**
 * SSRF egress guard for server-side fetches of client-supplied URLs (e.g. defect photos
 * embedded into an export). Rejects non-http(s) schemes and hosts that resolve to
 * loopback / link-local / private / cloud-metadata address space. Public photo URLs
 * (Vercel Blob is *.public.blob.vercel-storage.com) pass unchanged.
 */
export function isPubliclyFetchableHttpUrl(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  let u: URL;
  try {
    u = new URL(val);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 10 || a === 127) return false;      // "this" / private / loopback
    if (a === 169 && b === 254) return false;                // link-local + cloud metadata (169.254.169.254)
    if (a === 192 && b === 168) return false;                // private
    if (a === 172 && b >= 16 && b <= 31) return false;       // private
    if (a >= 224) return false;                              // multicast / reserved
  }
  if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return false; // IPv6 loopback / link-local / unique-local
  }
  return true;
}
