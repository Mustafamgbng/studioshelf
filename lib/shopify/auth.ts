import { createHmac } from 'node:crypto';
import { getShopifyConfig } from './config';
import { shopifyGraphql } from './graphql';
import { canonicalShop, safeEqual, ShopifyError } from './security';
import type { StoreAuth } from './types';

export type ShopifyIdentity = { shop: string; staffId: string; sid: string; exp: number };

export function verifyIdToken(
  token: string,
  apiKey: string,
  apiSecret: string,
  now = Math.floor(Date.now() / 1000),
): ShopifyIdentity {
  const invalid = () =>
    new ShopifyError(
      401,
      'Your Shopify session could not be verified. Reopen StudioShelf from Shopify Admin.',
      'SESSION_INVALID',
    );
  try {
    if (!token || token.length > 16384) throw invalid();
    const parts = token.split('.');
    if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part)))
      throw invalid();
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || (header.typ && header.typ !== 'JWT') || header.crit)
      throw invalid();
    const expected = createHmac('sha256', apiSecret).update(`${parts[0]}.${parts[1]}`).digest();
    if (!safeEqual(Buffer.from(parts[2], 'base64url'), expected)) throw invalid();
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (
      claims.aud !== apiKey ||
      !Number.isSafeInteger(claims.exp) ||
      !Number.isSafeInteger(claims.nbf) ||
      !Number.isSafeInteger(claims.iat) ||
      claims.exp <= now ||
      claims.nbf > now + 5 ||
      claims.iat > now + 5 ||
      claims.iat > claims.exp ||
      claims.exp - claims.iat > 90 ||
      now - claims.iat > 90
    )
      throw invalid();
    if (typeof claims.dest !== 'string' || typeof claims.iss !== 'string') throw invalid();
    const dest = new URL(claims.dest);
    const shop = canonicalShop(dest.hostname);
    if (!shop || claims.dest !== `https://${shop}` || claims.iss !== `https://${shop}/admin`)
      throw invalid();
    if (
      typeof claims.sub !== 'string' ||
      !/^\d{1,30}$/.test(claims.sub) ||
      typeof claims.sid !== 'string' ||
      !claims.sid ||
      claims.sid.length > 255
    )
      throw invalid();
    return { shop, staffId: claims.sub, sid: claims.sid, exp: claims.exp };
  } catch {
    throw invalid();
  }
}

export function scopeAllows(scopes: string[], required: string): boolean {
  // Shopify's write scope includes its paired read scope.
  return (
    scopes.includes(required) ||
    (required.startsWith('read_') && scopes.includes(`write_${required.slice(5)}`))
  );
}

export async function authenticateShopify(
  request: Request,
  requiredScopes: string[] = ['read_products'],
): Promise<StoreAuth> {
  const config = getShopifyConfig();
  const origin = request.headers.get('origin');
  if (origin && origin !== config.appUrl)
    throw new ShopifyError(
      403,
      'This request must come from the StudioShelf app.',
      'ORIGIN_REJECTED',
    );
  const header = request.headers.get('authorization');
  if (!header || !/^Bearer [A-Za-z0-9_.-]+$/.test(header))
    throw new ShopifyError(
      401,
      'Open StudioShelf from Shopify Admin to connect your store.',
      'SESSION_INVALID',
    );
  const idToken = header.slice(7);
  const identity = verifyIdToken(idToken, config.apiKey, config.apiSecret);
  let response: Response;
  try {
    response = await fetch(`https://${identity.shop}/admin/oauth/access_token`, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.apiKey,
        client_secret: config.apiSecret,
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: idToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token',
      }),
    });
  } catch {
    throw new ShopifyError(
      502,
      'Shopify sign-in could not be reached. Please retry.',
      'SHOPIFY_UNAVAILABLE',
    );
  }
  if ([400, 401, 403].includes(response.status))
    throw new ShopifyError(
      401,
      'Your Shopify session expired or app access was revoked. Reopen the app from Shopify Admin.',
      'SESSION_INVALID',
    );
  if (response.status === 429)
    throw new ShopifyError(
      429,
      'Shopify sign-in is busy. Wait a moment and retry.',
      'SHOPIFY_THROTTLED',
    );
  if (!response.ok)
    throw new ShopifyError(
      502,
      'Shopify sign-in is temporarily unavailable. Please retry.',
      'SHOPIFY_UNAVAILABLE',
    );
  let data: {
    access_token?: string;
    scope?: string;
    associated_user_scope?: string;
    expires_in?: number;
    associated_user?: { id?: number | string };
  };
  try {
    data = await response.json();
  } catch {
    throw new ShopifyError(
      502,
      'Shopify sign-in returned an invalid response. Please retry.',
      'SHOPIFY_RESPONSE_INVALID',
    );
  }
  if (
    typeof data.access_token !== 'string' ||
    !data.access_token ||
    typeof data.scope !== 'string' ||
    typeof data.associated_user_scope !== 'string' ||
    String(data.associated_user?.id) !== identity.staffId ||
    typeof data.expires_in !== 'number' ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    data.expires_in > 86400
  )
    throw new ShopifyError(
      401,
      'Shopify did not confirm an active staff session. Reopen the app from Shopify Admin.',
      'SESSION_INVALID',
    );
  const granted = data.scope
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const staffScopes = data.associated_user_scope
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const scopes = staffScopes.filter((scope) => scopeAllows(granted, scope));
  if (!requiredScopes.every((scope) => scopeAllows(scopes, scope)))
    throw new ShopifyError(
      403,
      'Your Shopify staff account or this app is missing the required product permission.',
      'SCOPE_REQUIRED',
    );
  const auth: StoreAuth = {
    shop: identity.shop,
    staffId: identity.staffId,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes,
    storeId: '',
    storeName: '',
    currency: '',
  };
  const current = await shopifyGraphql<{
    shop: { id: string; name: string; currencyCode: string; myshopifyDomain: string };
    currentAppInstallation: { accessScopes: { handle: string }[] };
  }>(
    auth,
    'query StudioShelfIdentity { shop { id name currencyCode myshopifyDomain } currentAppInstallation { accessScopes { handle } } }',
  );
  if (
    !current.shop ||
    current.shop.myshopifyDomain !== identity.shop ||
    !/^gid:\/\/shopify\/Shop\/\d+$/.test(current.shop.id) ||
    !current.currentAppInstallation?.accessScopes
  )
    throw new ShopifyError(
      401,
      'Shopify store identity could not be confirmed. Reopen the app from Shopify Admin.',
      'SESSION_INVALID',
    );
  const installed = current.currentAppInstallation.accessScopes.map((scope) => scope.handle);
  auth.scopes = scopes.filter((scope) => scopeAllows(installed, scope));
  if (!requiredScopes.every((scope) => scopeAllows(auth.scopes, scope)))
    throw new ShopifyError(
      403,
      'This operation needs an additional Shopify permission.',
      'SCOPE_REQUIRED',
    );
  auth.storeId = current.shop.id;
  auth.storeName = current.shop.name;
  auth.currency = current.shop.currencyCode;
  return auth;
}
