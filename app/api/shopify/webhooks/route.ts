import { getShopifyConfig } from '@/lib/shopify/config';
import { handleShopifyWebhook } from '@/lib/shopify/db';
import {
  canonicalShop,
  errorResponse,
  readRawBody,
  ShopifyError,
  verifyWebhookHmac,
} from '@/lib/shopify/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const topics = new Set([
  'customers/data_request',
  'customers/redact',
  'shop/redact',
  'app/uninstalled',
  'app/scopes_update',
  'products/update',
]);
const numericId = (value: unknown) =>
  typeof value === 'number'
    ? Number.isSafeInteger(value) && value > 0
    : typeof value === 'string' && /^[1-9]\d{0,29}$/.test(value);

export async function POST(request: Request): Promise<Response> {
  try {
    const config = getShopifyConfig();
    const body = await readRawBody(request, 2 * 1024 * 1024);
    if (!verifyWebhookHmac(body, request.headers.get('x-shopify-hmac-sha256'), config.apiSecret))
      throw new ShopifyError(
        401,
        'Invalid Shopify webhook signature.',
        'WEBHOOK_SIGNATURE_INVALID',
      );
    if (
      request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    )
      throw new ShopifyError(415, 'A JSON webhook is required.', 'INVALID_CONTENT_TYPE');
    const shop = canonicalShop(request.headers.get('x-shopify-shop-domain'));
    const topic = request.headers.get('x-shopify-topic') || '';
    const eventId =
      request.headers.get('x-shopify-event-id') ||
      request.headers.get('x-shopify-webhook-id') ||
      '';
    if (!shop || !topics.has(topic) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(eventId))
      throw new ShopifyError(400, 'Invalid Shopify webhook headers.', 'WEBHOOK_INVALID');
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      throw new ShopifyError(400, 'Invalid webhook JSON.', 'WEBHOOK_INVALID');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new ShopifyError(400, 'Invalid webhook data.', 'WEBHOOK_INVALID');
    if (topic.startsWith('customers/') || topic === 'shop/redact') {
      if (payload.shop_domain !== shop || !numericId(payload.shop_id))
        throw new ShopifyError(400, 'Webhook store identity does not match.', 'WEBHOOK_INVALID');
    } else if (topic === 'app/uninstalled') {
      if (payload.myshopify_domain !== shop || !numericId(payload.id))
        throw new ShopifyError(400, 'Webhook store identity does not match.', 'WEBHOOK_INVALID');
    } else if (topic === 'products/update') {
      if (
        !numericId(payload.id) ||
        (payload.admin_graphql_api_id !== undefined &&
          payload.admin_graphql_api_id !== `gid://shopify/Product/${payload.id}`)
      )
        throw new ShopifyError(400, 'Invalid webhook product identity.', 'WEBHOOK_INVALID');
    } else if (topic === 'app/scopes_update') {
      if (
        !numericId(payload.id) ||
        typeof payload.shop_id !== 'string' ||
        !/^gid:\/\/shopify\/Shop\/\d+$/.test(payload.shop_id) ||
        !Array.isArray(payload.current) ||
        !payload.current.every((scope) => typeof scope === 'string' && /^[a-z_]+$/.test(scope))
      )
        throw new ShopifyError(400, 'Invalid scope update.', 'WEBHOOK_INVALID');
    }
    try {
      await handleShopifyWebhook(topic, shop, payload, eventId);
    } catch {
      throw new ShopifyError(
        503,
        'Webhook could not be persisted. Retry this delivery.',
        'WEBHOOK_RETRY',
      );
    }
    return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
