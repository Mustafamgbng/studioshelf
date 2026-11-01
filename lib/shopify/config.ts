import { ShopifyError } from './security';

export type ShopifyConfig = {
  apiKey: string;
  apiSecret: string;
  appUrl: string;
  apiVersion: string;
};

export function getShopifyConfig(): ShopifyConfig {
  const apiKey = process.env.SHOPIFY_API_KEY?.trim();
  const apiSecret = process.env.SHOPIFY_API_SECRET?.trim();
  const rawUrl = process.env.SHOPIFY_APP_URL?.trim();
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || '2026-10';
  if (!apiKey || !apiSecret || !rawUrl)
    throw new ShopifyError(
      503,
      'Shopify is not configured on this deployment. Ask the app owner to finish setup.',
      'NOT_CONFIGURED',
    );
  try {
    const url = new URL(rawUrl);
    const local =
      process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (
      (!local && url.protocol !== 'https:') ||
      (local && !['http:', 'https:'].includes(url.protocol)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['', '/'].includes(url.pathname) ||
      !/^20\d{2}-(01|04|07|10)$/.test(apiVersion)
    )
      throw new Error();
    return { apiKey, apiSecret, appUrl: url.origin, apiVersion };
  } catch {
    throw new ShopifyError(
      503,
      'Shopify app configuration is invalid. Ask the app owner to check the app URL and API version.',
      'NOT_CONFIGURED',
    );
  }
}

export function publicShopifyConfig(): { apiKey: string | null; configured: boolean } {
  try {
    const config = getShopifyConfig();
    return { apiKey: config.apiKey, configured: true };
  } catch {
    return { apiKey: null, configured: false };
  }
}
