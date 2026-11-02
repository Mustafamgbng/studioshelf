import { assertVariant, getProduct } from './products';
import { ShopifyError } from './security';
import type { StoreAuth } from './types';

export async function fetchProductImage(
  auth: StoreAuth,
  productId: string,
  imageId: string,
  variantId?: string,
) {
  const product = await getProduct(auth, productId);
  let image =
    product.images.find((item) => item.id === imageId) ||
    product.variants.map((v) => v.image).find((item) => item?.id === imageId);
  if (!image && variantId) {
    const variant = await assertVariant(auth, product, variantId);
    if (variant.image?.id === imageId) image = variant.image;
  }
  if (!image)
    throw new ShopifyError(
      404,
      'This image does not belong to the selected product. Refresh the product and retry.',
    );
  const url = new URL(image.url);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !(
      url.hostname === 'cdn.shopify.com' ||
      (url.hostname === auth.shop && url.pathname.startsWith('/cdn/shop/'))
    )
  )
    throw new ShopifyError(400, 'This Shopify image host is not supported. Choose another image.');
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ShopifyError(
      502,
      'The product image could not be loaded. Retry or select another image.',
    );
  }
  const type = response.headers.get('content-type')?.split(';')[0].toLowerCase();
  // Stay below Vercel's function response limit, including platform overhead.
  const max = 3000000;
  if (!response.ok || !type || !['image/jpeg', 'image/png', 'image/webp'].includes(type))
    throw new ShopifyError(502, 'Choose a JPEG, PNG or WebP product image.');
  if (Number(response.headers.get('content-length') || 0) > max)
    throw new ShopifyError(413, 'This product image is too large. Choose a smaller one.');
  const reader = response.body?.getReader();
  if (!reader) throw new ShopifyError(502, 'The product image was empty.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new ShopifyError(413, 'This product image is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes, type };
}
