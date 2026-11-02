import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchProductImage } from '../lib/shopify/media';
import type { StoreAuth } from '../lib/shopify/types';

test('Shopify images must belong to the selected store product and use an approved CDN without redirects', async () => {
  const saved = {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
  };
  Object.assign(process.env, {
    SHOPIFY_API_KEY: 'media-test-key',
    SHOPIFY_API_SECRET: 'media-test-secret',
    SHOPIFY_APP_URL: 'https://app.example.test',
  });
  const fetcher = globalThis.fetch;
  const auth: StoreAuth = {
    shop: 'alpha.myshopify.com',
    storeId: 'gid://shopify/Shop/1',
    storeName: 'Alpha',
    currency: 'USD',
    staffId: '1',
    accessToken: 'online-test-token',
    expiresAt: Date.now() + 60000,
    scopes: ['read_products'],
  };
  const image = {
    id: 'gid://shopify/ProductImage/3',
    url: 'https://cdn.shopify.com/s/files/product.jpg',
    altText: null,
  };
  let cdnCalls = 0;
  let oversized = false;
  let outsidePage = false;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/graphql.json') && String(init?.body).includes('StudioShelfVariant'))
      return Response.json({
        data: {
          productVariant: {
            id: 'gid://shopify/ProductVariant/201',
            title: 'Later page variant',
            price: '12.00',
            image,
            selectedOptions: [],
            product: { id: 'gid://shopify/Product/1' },
          },
        },
      });
    if (String(url).includes('/graphql.json'))
      return Response.json({
        data: {
          product: {
            id: 'gid://shopify/Product/1',
            title: 'Product',
            description: 'Fact',
            descriptionHtml: '<p>Fact</p>',
            handle: 'product',
            vendor: 'Alpha',
            productType: 'Home',
            updatedAt: '2026-11-01',
            onlineStoreUrl: null,
            images: { nodes: outsidePage ? [] : [image] },
            variants: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
          },
        },
      });
    cdnCalls++;
    assert.equal(init?.redirect, 'error');
    return new Response(new Uint8Array([255, 216, 255]), {
      headers: { 'content-type': 'image/jpeg', 'content-length': oversized ? '4000000' : '3' },
    });
  };
  try {
    await assert.rejects(
      fetchProductImage(auth, 'gid://shopify/Product/1', 'gid://shopify/ProductImage/99'),
      /does not belong/,
    );
    assert.equal(cdnCalls, 0);
    const good = await fetchProductImage(auth, 'gid://shopify/Product/1', image.id);
    assert.equal(good.type, 'image/jpeg');
    assert.equal(good.bytes.length, 3);
    outsidePage = true;
    assert.equal(
      (
        await fetchProductImage(
          auth,
          'gid://shopify/Product/1',
          image.id,
          'gid://shopify/ProductVariant/201',
        )
      ).bytes.length,
      3,
    );
    outsidePage = false;
    image.url = 'https://internal.example/private';
    await assert.rejects(
      fetchProductImage(auth, 'gid://shopify/Product/1', image.id),
      /host is not supported/,
    );
    assert.equal(cdnCalls, 2);
    image.url = 'https://cdn.shopify.com/s/files/product.jpg';
    oversized = true;
    await assert.rejects(fetchProductImage(auth, 'gid://shopify/Product/1', image.id), /too large/);
  } finally {
    globalThis.fetch = fetcher;
    for (const key of Object.keys(saved) as (keyof typeof saved)[]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
