import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGeneratedAsset,
  expectShop,
  requestProductWrite,
  ShopifyClientError,
  shopifyJson,
} from '../lib/shopify/client';
import { createTemplateKit } from '../lib/engine';
import { DEFAULT_PRODUCT } from '../lib/types';

const token = (shop: string, counter = 0) =>
  `header.${Buffer.from(JSON.stringify({ dest: `https://${shop}`, counter })).toString('base64url')}.signature`;

function browser(
  t: { after: (fn: () => void) => void },
  idToken: () => Promise<string>,
  fetcher: typeof fetch,
) {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const priorFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      shopify: { idToken },
      get localStorage() {
        throw new Error('Browser storage is restricted.');
      },
      get sessionStorage() {
        throw new Error('Browser storage is restricted.');
      },
    },
  });
  globalThis.fetch = fetcher;
  t.after(() => {
    expectShop(null);
    globalThis.fetch = priorFetch;
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
}

test('Shopify client requests fresh identity without cookies or browser storage', async (t) => {
  let issued = 0;
  const authorizations: string[] = [];
  browser(
    t,
    async () => token('first.myshopify.com', ++issued),
    async (input, init) => {
      assert.equal(input, '/api/shopify/store');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.cache, 'no-store');
      authorizations.push(new Headers(init?.headers).get('Authorization')!);
      return Response.json({ ok: true });
    },
  );
  expectShop('first.myshopify.com');
  assert.deepEqual(await shopifyJson('store'), { ok: true });
  await shopifyJson('store');
  assert.equal(issued, 2);
  assert.notEqual(authorizations[0], authorizations[1]);
});

test('Shopify client blocks submitting existing state after the store identity changes', async (t) => {
  let fetched = false;
  browser(
    t,
    async () => token('second.myshopify.com'),
    async () => {
      fetched = true;
      return Response.json({});
    },
  );
  expectShop('first.myshopify.com');
  await assert.rejects(
    shopifyJson('kits', { method: 'POST', body: '{}' }),
    (error) => error instanceof ShopifyClientError && error.code === 'STORE_CHANGED',
  );
  assert.equal(fetched, false);
});

test('Shopify client retries an invalid session only once and fetches a new ID token', async (t) => {
  let issued = 0;
  let requests = 0;
  browser(
    t,
    async () => token('first.myshopify.com', ++issued),
    async () => {
      requests++;
      return requests === 1
        ? Response.json(
            { error: 'Expired' },
            { status: 401, headers: { 'X-Shopify-Retry-Invalid-Session-Request': '1' } },
          )
        : Response.json({ ok: true });
    },
  );
  assert.deepEqual(await shopifyJson('store'), { ok: true });
  assert.equal(issued, 2);
  assert.equal(requests, 2);
});

test('Shopify client does not retry a revoked-access response without a retry signal', async (t) => {
  let requests = 0;
  browser(
    t,
    async () => token('first.myshopify.com'),
    async () => {
      requests++;
      return Response.json({ error: 'Access revoked', code: 'RECONNECT' }, { status: 401 });
    },
  );
  await assert.rejects(
    shopifyJson('store'),
    (error) =>
      error instanceof ShopifyClientError &&
      error.status === 401 &&
      error.message === 'Access revoked',
  );
  assert.equal(requests, 1);
});

test('Declining optional write scope preserves the read-only product workflow', async (t) => {
  browser(
    t,
    async () => token('first.myshopify.com'),
    async () => Response.json({}),
  );
  window.shopify!.scopes = {
    request: async (scopes) => {
      assert.deepEqual(scopes, ['write_products']);
      return { result: 'declined-all' };
    },
  };
  await assert.rejects(requestProductWrite(), /still save and download kits/);
});

test('Asset regeneration preserves edits made to other assets while a request is pending', () => {
  const submitted = createTemplateKit(DEFAULT_PRODUCT);
  const serverResponse = { ...submitted, description: 'Fresh generated listing' };
  const latest = { ...submitted, instagram: 'A caption edited while Gemini was running.' };
  const merged = applyGeneratedAsset(latest, serverResponse, 'listing');
  assert.equal(merged.description, serverResponse.description);
  assert.equal(merged.instagram, latest.instagram);
  assert.equal(latest.description, submitted.description);
});

test('Regenerating one slide preserves concurrent edits to every other slide', () => {
  const submitted = createTemplateKit(DEFAULT_PRODUCT);
  const latest = structuredClone(submitted);
  latest.slides[4].headline = 'My newly edited invitation';
  const generated = structuredClone(submitted);
  generated.slides[1].headline = 'Fresh details';
  const merged = applyGeneratedAsset(latest, generated, 'slide:1');
  assert.equal(merged.slides[1].headline, 'Fresh details');
  assert.equal(merged.slides[4].headline, 'My newly edited invitation');
});
