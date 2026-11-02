import { createHmac, timingSafeEqual } from 'node:crypto';

export class ShopifyError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'SHOPIFY_ERROR',
  ) {
    super(message);
    this.name = 'ShopifyError';
  }
}

export function errorResponse(error: unknown): Response {
  const known = error instanceof ShopifyError;
  const status = known ? error.status : 500;
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (status === 401) headers['X-Shopify-Retry-Invalid-Session-Request'] = '1';
  if (status === 429) headers['Retry-After'] = '2';
  return Response.json(
    {
      error: known
        ? error.message
        : 'The operation could not be completed. Your saved work is safe. Please retry.',
      code: known ? error.code : 'INTERNAL_ERROR',
      reconnect: status === 401,
    },
    { status, headers },
  );
}

export function canonicalShop(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 255) return null;
  // Exactly one DNS label. Never accept URLs, ports, paths, wildcard or lookalike suffixes.
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(value) ? value : null;
}

export function safeEqual(actual: Buffer, expected: Buffer): boolean {
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function readRawBody(request: Request, maxBytes = 1024 * 1024): Promise<Buffer> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new ShopifyError(413, 'The request is too large.', 'REQUEST_TOO_LARGE');
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ShopifyError(413, 'The request is too large.', 'REQUEST_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function readJson<T = unknown>(request: Request, maxBytes = 1024 * 1024): Promise<T> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new ShopifyError(415, 'Send this request as JSON.', 'INVALID_CONTENT_TYPE');
  try {
    return JSON.parse((await readRawBody(request, maxBytes)).toString('utf8')) as T;
  } catch (error) {
    if (error instanceof ShopifyError) throw error;
    throw new ShopifyError(400, 'The request contains invalid JSON.', 'INVALID_JSON');
  }
}

export function verifyWebhookHmac(body: Buffer, header: string | null, secret: string): boolean {
  if (!header || !/^[A-Za-z0-9+/]{43}=$/.test(header)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return safeEqual(Buffer.from(header, 'base64'), expected);
}

/** Mirrors Shopify's Admin query canonicalization; this is not app-proxy signing. */
export function signedQueryShop(
  params: URLSearchParams,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string | null {
  const values = new Map<string, string>();
  for (const [key, value] of params) {
    if (values.has(key)) return null;
    values.set(key, value);
  }
  const shop = canonicalShop(values.get('shop'));
  const signature = values.get('hmac');
  const timestamp = Number(values.get('timestamp'));
  if (
    !shop ||
    !signature ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !Number.isSafeInteger(timestamp) ||
    Math.abs(now - timestamp) > 90
  )
    return null;
  const message = new URLSearchParams();
  [...values.keys()]
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => message.set(key, values.get(key)!));
  const expected = createHmac('sha256', secret)
    .update(message.toString().replace(/\+/g, '%20'))
    .digest();
  return safeEqual(Buffer.from(signature, 'hex'), expected) ? shop : null;
}

/** A frame permit carries no user identity and never authorizes an API request. */
export function signFrameContext(
  shop: string,
  appKey: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string {
  if (!canonicalShop(shop)) throw new ShopifyError(400, 'Invalid Shopify store.', 'INVALID_SHOP');
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'shopify-frame-v1',
      shop,
      aud: appKey,
      iat: now,
      exp: now + 12 * 60 * 60,
    }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret)
    .update(`studioshelf-frame.${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyFrameContext(
  value: string | null,
  appKey: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string | null {
  try {
    if (!value || value.length > 2048) return null;
    const parts = value.split('.');
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
    const expected = createHmac('sha256', secret).update(`studioshelf-frame.${parts[0]}`).digest();
    if (!safeEqual(Buffer.from(parts[1], 'base64url'), expected)) return null;
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (
      p.purpose !== 'shopify-frame-v1' ||
      p.aud !== appKey ||
      !Number.isSafeInteger(p.exp) ||
      !Number.isSafeInteger(p.iat) ||
      p.exp <= now ||
      p.iat > now + 5 ||
      p.exp - p.iat !== 12 * 60 * 60
    )
      return null;
    return canonicalShop(p.shop);
  } catch {
    return null;
  }
}

export function framePolicy(shop: string | null): string {
  return shop && canonicalShop(shop)
    ? `frame-ancestors https://${shop} https://admin.shopify.com;`
    : "frame-ancestors 'none';";
}
