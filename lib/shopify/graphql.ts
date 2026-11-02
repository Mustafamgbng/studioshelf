import { getShopifyConfig } from './config';
import { canonicalShop, ShopifyError } from './security';
import type { StoreAuth } from './types';

export async function shopifyGraphql<T>(
  auth: StoreAuth,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const { apiVersion } = getShopifyConfig();
  if (!canonicalShop(auth.shop) || !auth.accessToken || auth.expiresAt <= Date.now())
    throw new ShopifyError(
      401,
      'Your Shopify session has expired. Reopen StudioShelf from Shopify Admin.',
      'SESSION_INVALID',
    );
  let response: Response;
  try {
    response = await fetch(`https://${auth.shop}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': auth.accessToken },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ShopifyError(
      502,
      'Shopify could not be reached. Please retry.',
      'SHOPIFY_UNAVAILABLE',
    );
  }
  if (response.status === 401)
    throw new ShopifyError(
      401,
      'Shopify access expired or was revoked. Reopen the app from Shopify Admin.',
      'SESSION_INVALID',
    );
  if (response.status === 403)
    throw new ShopifyError(
      403,
      'Your Shopify staff account does not have permission for this operation.',
      'SCOPE_REQUIRED',
    );
  if (response.status === 429)
    throw new ShopifyError(
      429,
      'Shopify is receiving too many requests. Wait a moment and retry.',
      'SHOPIFY_THROTTLED',
    );
  if (!response.ok)
    throw new ShopifyError(
      502,
      'Shopify could not complete the operation. Please retry.',
      'SHOPIFY_UNAVAILABLE',
    );
  let result: { data?: T; errors?: { message?: string; extensions?: { code?: string } }[] };
  try {
    result = await response.json();
  } catch {
    throw new ShopifyError(
      502,
      'Shopify returned an unreadable response. Please retry.',
      'SHOPIFY_RESPONSE_INVALID',
    );
  }
  if (result.errors?.length) {
    const codes = result.errors.map((error) => error.extensions?.code);
    if (codes.includes('ACCESS_DENIED') || codes.includes('FORBIDDEN'))
      throw new ShopifyError(
        403,
        'Your Shopify staff account does not have permission for this operation.',
        'SCOPE_REQUIRED',
      );
    if (codes.includes('THROTTLED'))
      throw new ShopifyError(
        429,
        'Shopify is receiving too many requests. Wait a moment and retry.',
        'SHOPIFY_THROTTLED',
      );
    throw new ShopifyError(
      502,
      'Shopify could not complete this request. Please retry or contact support.',
      'SHOPIFY_RESPONSE_INVALID',
    );
  }
  if (!result.data)
    throw new ShopifyError(
      502,
      'Shopify returned no data. Please retry.',
      'SHOPIFY_RESPONSE_INVALID',
    );
  return result.data;
}
