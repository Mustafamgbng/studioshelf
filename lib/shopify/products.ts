import { createHash } from 'node:crypto';
import { shopifyGraphql } from './graphql';
import { ShopifyError } from './security';
import type { ShopifyImage, ShopifyProduct, ShopifyVariant, StoreAuth } from './types';

const IMAGE_FIELDS =
  'id url(transform: { maxWidth: 1400, maxHeight: 1400, preferredContentType: JPG }) altText';
const VARIANT_FIELDS = `id title price image { ${IMAGE_FIELDS} } selectedOptions { name value }`;
const PRODUCT_FIELDS = (imageLimit: number) =>
  `id title description descriptionHtml handle vendor productType updatedAt onlineStoreUrl images(first: ${imageLimit}) { nodes { ${IMAGE_FIELDS} } }`;
type Connection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type RawProduct = Omit<
  ShopifyProduct,
  'images' | 'variants' | 'variantsPageInfo' | 'fingerprint'
> & {
  images: { nodes: ShopifyImage[] };
  variants: Connection<ShopifyVariant>;
};

export function productId(value: unknown): string {
  if (typeof value !== 'string' || !/^gid:\/\/shopify\/Product\/[1-9]\d{0,24}$/.test(value))
    throw new ShopifyError(400, 'Choose a valid Shopify product.', 'INVALID_PRODUCT');
  return value;
}

export function variantId(value: unknown): string {
  if (typeof value !== 'string' || !/^gid:\/\/shopify\/ProductVariant\/[1-9]\d{0,24}$/.test(value))
    throw new ShopifyError(400, 'Choose a valid Shopify variant.', 'INVALID_VARIANT');
  return value;
}

function cursor(value?: string | null): string | null {
  if (!value) return null;
  if (value.length > 1024 || /[\x00-\x1f]/.test(value))
    throw new ShopifyError(400, 'That product page could not be loaded. Search again.');
  return value;
}

export function productFingerprint(
  product: Omit<ShopifyProduct, 'fingerprint'> | RawProduct,
): string {
  // updatedAt detects changes outside the currently paginated image/variant page too.
  return createHash('sha256')
    .update(
      JSON.stringify([
        product.id,
        product.updatedAt,
        product.title,
        product.descriptionHtml,
        product.handle,
        product.vendor,
        product.productType,
        product.onlineStoreUrl,
      ]),
    )
    .digest('hex');
}

export function normalizeProduct(raw: RawProduct): ShopifyProduct {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    descriptionHtml: raw.descriptionHtml,
    handle: raw.handle,
    vendor: raw.vendor,
    productType: raw.productType,
    updatedAt: raw.updatedAt,
    onlineStoreUrl:
      raw.onlineStoreUrl && /^https:\/\//.test(raw.onlineStoreUrl) ? raw.onlineStoreUrl : null,
    images: raw.images.nodes,
    variants: raw.variants.nodes,
    variantsPageInfo: raw.variants.pageInfo,
    fingerprint: productFingerprint(raw),
  };
}

export async function searchProducts(auth: StoreAuth, query = '', after?: string | null) {
  if (query.length > 150)
    throw new ShopifyError(400, 'Keep product searches under 150 characters.');
  const data = await shopifyGraphql<{ products: Connection<RawProduct> }>(
    auth,
    `query StudioShelfProducts($query: String, $after: String) { products(first: 12, after: $after, query: $query, sortKey: TITLE) { nodes { ${PRODUCT_FIELDS(1)} variants(first: 1) { nodes { ${VARIANT_FIELDS} } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } }`,
    { query: query.trim() || null, after: cursor(after) },
  );
  return { products: data.products.nodes.map(normalizeProduct), pageInfo: data.products.pageInfo };
}

export async function getProduct(
  auth: StoreAuth,
  id: string,
  variantsAfter?: string | null,
): Promise<ShopifyProduct> {
  const data = await shopifyGraphql<{ product: RawProduct | null }>(
    auth,
    `query StudioShelfProduct($id: ID!, $after: String) { product(id: $id) { ${PRODUCT_FIELDS(20)} variants(first: 100, after: $after) { nodes { ${VARIANT_FIELDS} } pageInfo { hasNextPage endCursor } } } }`,
    { id: productId(id), after: cursor(variantsAfter) },
  );
  if (!data.product)
    throw new ShopifyError(
      404,
      'That product is unavailable in this store.',
      'PRODUCT_UNAVAILABLE',
    );
  return normalizeProduct(data.product);
}

export async function assertVariant(
  auth: StoreAuth,
  product: ShopifyProduct,
  id: string,
): Promise<ShopifyVariant> {
  variantId(id);
  const loaded = product.variants.find((v) => v.id === id);
  if (loaded) return loaded;
  const data = await shopifyGraphql<{
    productVariant: (ShopifyVariant & { product: { id: string } }) | null;
  }>(
    auth,
    `query StudioShelfVariant($id: ID!) { productVariant(id: $id) { ${VARIANT_FIELDS} product { id } } }`,
    { id },
  );
  if (!data.productVariant || data.productVariant.product.id !== product.id)
    throw new ShopifyError(
      400,
      'This variant does not belong to the selected product.',
      'INVALID_VARIANT',
    );
  return {
    id: data.productVariant.id,
    title: data.productVariant.title,
    price: data.productVariant.price,
    image: data.productVariant.image,
    selectedOptions: data.productVariant.selectedOptions,
  };
}

export function storefrontUrl(product: ShopifyProduct, selectedVariantId: string): string | null {
  if (!product.onlineStoreUrl) return null; // Unpublished products have no actual public URL.
  const url = new URL(product.onlineStoreUrl);
  url.searchParams.set('variant', variantId(selectedVariantId).split('/').at(-1)!);
  return url.toString();
}
