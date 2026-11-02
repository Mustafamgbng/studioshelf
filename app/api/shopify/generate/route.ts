import { authenticateShopify } from '@/lib/shopify/auth';
import { ensureStore, getStoreSettings, reserveHostedUsage } from '@/lib/shopify/db';
import { assertVariant, getProduct } from '@/lib/shopify/products';
import {
  attachProductLink,
  generateGeminiKit,
  mergeAsset,
  productLink,
  templateGeneration,
  validateGenerationInput,
} from '@/lib/shopify/generation';
import { errorResponse, readJson, ShopifyError } from '@/lib/shopify/security';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await authenticateShopify(request);
    await ensureStore(auth);
    const input = validateGenerationInput(await readJson(request, 60000));
    const imported = await getProduct(auth, input.productId);
    if (imported.fingerprint !== input.fingerprint || input.product.currency !== auth.currency)
      throw new ShopifyError(
        409,
        'This product or store currency changed in Shopify. Review the latest product details before generating.',
        'PRODUCT_CHANGED',
      );
    const variant = await assertVariant(auth, imported, input.variantId);
    const store = await getStoreSettings(auth);
    const url = productLink(imported, variant);
    const product = { ...input.product, currency: auth.currency, price: variant.price, url };
    let usage = store.hostedAI;
    let candidate;
    if (input.mode === 'template') candidate = templateGeneration(product);
    else {
      let key = input.apiKey || '';
      if (input.mode === 'hosted') {
        if (!store.hostedAI.enabled)
          throw new ShopifyError(
            503,
            'Hosted Gemini is not enabled for this deployment. Use your key or templates.',
          );
        usage = await reserveHostedUsage(auth);
        key = process.env.GEMINI_API_KEY || '';
      }
      candidate = await generateGeminiKit(product, key);
    }
    const linked = attachProductLink(candidate, url);
    return Response.json(
      {
        kit: mergeAsset(input.currentKit, linked, input.target),
        source: input.mode === 'template' ? 'template' : 'gemini',
        usage,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
