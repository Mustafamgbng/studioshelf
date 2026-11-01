import { authenticateShopify } from './auth';
import {
  deleteKit,
  ensureStore,
  getBrand,
  getHostedUsage,
  getKit,
  getStoreSettings,
  listKits,
  saveBrand,
  saveKit,
} from './db';
import {
  applyDescription,
  listDescriptions,
  previewDescription,
  previewRestore,
} from './descriptions';
import { assertVariant, getProduct, searchProducts } from './products';
import { errorResponse, readJson, ShopifyError } from './security';
import type { SaveKitInput } from './types';

function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store, private', vary: 'Authorization' },
  });
}

async function objectBody(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const body = await readJson(request, maxBytes);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ShopifyError(400, 'Send a JSON object for this operation.');
  return body as Record<string, unknown>;
}

export async function handleShopifyApi(request: Request, path: string[]): Promise<Response> {
  try {
    const auth = await authenticateShopify(request, ['read_products']);
    await ensureStore(auth);
    const url = new URL(request.url);
    const [resource, id, extra] = path;
    if (extra || !resource) throw new ShopifyError(404, 'This Shopify operation was not found.');
    const method = request.method;
    if (resource === 'store' && !id && method === 'GET')
      return reply({ store: await getStoreSettings(auth) });
    if (resource === 'products' && method === 'GET') {
      if (id) {
        const product = await getProduct(auth, id, url.searchParams.get('variantsAfter'));
        const selected = url.searchParams.get('variantId');
        if (selected && !product.variants.some((variant) => variant.id === selected))
          product.variants.unshift(await assertVariant(auth, product, selected));
        return reply({ product });
      }
      return reply(
        await searchProducts(auth, url.searchParams.get('q') || '', url.searchParams.get('after')),
      );
    }
    if (resource === 'kits') {
      if (method === 'GET') {
        if (!id) return reply({ kits: await listKits(auth) });
        const kit = await getKit(auth, id);
        try {
          const currentProduct = await getProduct(auth, kit.link.productId);
          const stale =
            currentProduct.fingerprint !== kit.link.fingerprint ||
            kit.project.product.currency !== auth.currency;
          return reply({ kit: { ...kit, stale }, currentProduct, stale });
        } catch (error) {
          if (error instanceof ShopifyError && error.code === 'PRODUCT_UNAVAILABLE')
            return reply({
              kit: { ...kit, stale: true },
              currentProduct: null,
              stale: true,
              productUnavailable: true,
            });
          throw error;
        }
      }
      if (method === 'POST' && !id)
        return reply({
          kit: await saveKit(auth, (await readJson(request, 2600000)) as SaveKitInput),
        });
      if (method === 'DELETE' && id) {
        await deleteKit(auth, id);
        return reply({ deleted: true });
      }
    }
    if (resource === 'brand' && !id) {
      if (method === 'GET') return reply({ brand: await getBrand(auth) });
      if (method === 'PUT') {
        const body = await objectBody(request, 400000);
        return reply({ brand: await saveBrand(auth, body.brand || body) });
      }
    }
    if (resource === 'usage' && !id && method === 'GET')
      return reply({ hostedAI: await getHostedUsage(auth) });
    if (resource === 'descriptions') {
      if (method === 'GET' && !id)
        return reply({
          history: await listDescriptions(auth, url.searchParams.get('productId') || ''),
        });
      if (method === 'POST') {
        const body = await objectBody(request, 30000);
        if (id === 'preview')
          return reply({
            preview: await previewDescription(auth, body.productId as string, body.description),
          });
        if (id === 'restore-preview')
          return reply({ preview: await previewRestore(auth, body.historyId as string) });
        if (id === 'apply')
          return reply(await applyDescription(auth, body.previewId as string, body.approved));
      }
    }
    throw new ShopifyError(405, 'This Shopify operation is not supported.');
  } catch (error) {
    return errorResponse(error);
  }
}
