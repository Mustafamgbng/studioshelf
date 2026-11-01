import { authenticateShopify } from '@/lib/shopify/auth';
import { fetchProductImage } from '@/lib/shopify/media';
import { errorResponse, ShopifyError } from '@/lib/shopify/security';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const auth = await authenticateShopify(request);
    const params = new URL(request.url).searchParams;
    const productId = params.get('productId') || '',
      imageId = params.get('imageId') || '';
    if (!/^gid:\/\/shopify\/Product\/\d+$/.test(productId) || imageId.length > 160 || !imageId)
      throw new ShopifyError(400, 'Select a product image.');
    const { bytes, type } = await fetchProductImage(
      auth,
      productId,
      imageId,
      params.get('variantId') || undefined,
    );
    return new Response(bytes, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
