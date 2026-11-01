import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStoreDb,
  getKit,
  listKits,
  reserveHostedUsage,
  saveBrand,
  saveKit,
  handleShopifyWebhook,
  validateBrand,
} from '../lib/shopify/db';
import {
  assertVariant,
  normalizeProduct,
  productFingerprint,
  storefrontUrl,
} from '../lib/shopify/products';
import {
  applyDescription,
  assertDescriptionUnchanged,
  textToDescriptionHtml,
} from '../lib/shopify/descriptions';
import { createTemplateKit } from '../lib/engine';
import { DEFAULT_PRODUCT } from '../lib/types';
import type { StoreAuth, ShopifyProduct } from '../lib/shopify/types';

const auth: StoreAuth = {
  shop: 'alpha.myshopify.com',
  storeId: 'gid://shopify/Shop/1',
  storeName: 'Alpha',
  currency: 'USD',
  staffId: '10',
  accessToken: 'online-test-token',
  scopes: ['read_products', 'write_products'],
  expiresAt: Date.now() + 60000,
};
const authB = { ...auth, shop: 'beta.myshopify.com', storeId: 'gid://shopify/Shop/2' };
const id = '11111111-1111-4111-8111-111111111111';
const productId = 'gid://shopify/Product/100';
const variantId = 'gid://shopify/ProductVariant/200';
const raw = {
  id: productId,
  title: 'Test product',
  description: 'Original',
  descriptionHtml: '<p>Original</p>',
  handle: 'test',
  vendor: 'Alpha',
  productType: 'Art',
  updatedAt: '2026-11-01T00:00:00Z',
  onlineStoreUrl: 'https://alpha.example/products/test',
  images: { nodes: [] },
  variants: {
    nodes: [{ id: variantId, title: 'Default', price: '10.00', image: null, selectedOptions: [] }],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
};
const product: ShopifyProduct = normalizeProduct(raw);
const project = {
  id,
  updatedAt: '2026-11-01T00:00:00Z',
  product: DEFAULT_PRODUCT,
  kit: createTemplateKit(DEFAULT_PRODUCT),
  image: null,
  theme: 'clay' as const,
  source: 'template' as const,
};
const row = {
  id,
  store_id: auth.storeId,
  project,
  link: {
    storeId: auth.storeId,
    productId,
    variantId,
    importedAt: '2026-11-01T00:00:00Z',
    fingerprint: product.fingerprint,
    updatedAt: raw.updatedAt,
    url: raw.onlineStoreUrl,
    imageUrl: null,
  },
  revision: 2,
  updated_at: '2026-11-01T00:00:00Z',
  stale: false,
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
async function mocked(
  run: (calls: { url: URL; method: string; body: any }[]) => Promise<void>,
  handler: (url: URL, method: string, body: any) => Response | Promise<Response>,
) {
  const original = global.fetch;
  const previous = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
  };
  process.env.SUPABASE_URL = 'https://db.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  process.env.SHOPIFY_API_VERSION = '2026-10';
  process.env.SHOPIFY_API_KEY = 'test-client-id';
  process.env.SHOPIFY_API_SECRET = 'test-client-secret';
  process.env.SHOPIFY_APP_URL = 'https://app.example';
  const calls: { url: URL; method: string; body: any }[] = [];
  global.fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url || String(input));
    const method = init?.method || request?.method || 'GET';
    const content = init?.body ? String(init.body) : request ? await request.text() : '';
    const body = content ? JSON.parse(content) : null;
    calls.push({ url, method, body });
    return handler(url, method, body);
  };
  try {
    await run(calls);
  } finally {
    global.fetch = original;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('Shopify persistence fails closed without a server-only database credential', () => {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.throws(() => getStoreDb(), /not configured/);
  } finally {
    if (secret !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  }
});

test('saved kits and lookup are scoped to the verified store, across two stores', async () => {
  await mocked(
    async (calls) => {
      assert.equal((await listKits(auth)).length, 1);
      assert.equal((await listKits(authB)).length, 0);
      await assert.rejects(() => getKit(authB, id), /unavailable in the connected store/);
      assert.ok(
        calls.every((c) =>
          c.url.searchParams.get('store_id')?.startsWith('eq.gid://shopify/Shop/'),
        ),
      );
    },
    (url) =>
      url.searchParams.get('store_id') === `eq.${auth.storeId}`
        ? json([
            { ...row, product_name: project.product.name, product_brand: project.product.brand },
          ])
        : json(url.searchParams.has('id') ? null : []),
  );
});

test('a stale kit revision is rejected before any Shopify mutation or save', async () => {
  await mocked(
    async (calls) => {
      await assert.rejects(
        () =>
          saveKit(auth, {
            id,
            revision: 1,
            project,
            productId,
            variantId,
            fingerprint: product.fingerprint,
          }),
        /Another staff member/,
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, 'GET');
    },
    () => json(row),
  );
});

test('store branding strips untrusted ownership and credentials', async () => {
  const brand = {
    logo: null,
    primary: '#123456',
    background: '#ffffff',
    ink: '#112233',
    voice: 'Plain',
    cta: 'Shop now',
    storeId: authB.storeId,
    apiKey: 'must-not-persist',
  };
  await mocked(
    async (calls) => {
      await saveBrand(auth, brand);
      assert.equal(calls[0].url.searchParams.get('id'), `eq.${auth.storeId}`);
      assert.deepEqual(Object.keys(calls[0].body.brand).sort(), [
        'background',
        'cta',
        'ink',
        'logo',
        'primary',
        'voice',
      ]);
      assert.ok(!JSON.stringify(calls[0].body).includes('must-not-persist'));
    },
    () => json({ id: auth.storeId }),
  );
  assert.throws(() => validateBrand({ ...brand, logo: 'data:image/svg+xml;base64,PHN2Zz4=' }));
});

test('kit saves bind server-verified ownership, URL and selected gallery image', async () => {
  const gallery = {
    ...raw,
    images: {
      nodes: [
        { id: 'gid://shopify/Image/1', url: 'https://cdn.shopify.com/first.jpg', altText: null },
        { id: 'gid://shopify/Image/2', url: 'https://cdn.shopify.com/second.jpg', altText: null },
      ],
    },
  };
  const input = {
    project: {
      ...project,
      product: { ...project.product, url: 'https://unrelated.example' },
      apiKey: 'never-persist',
    },
    productId,
    variantId,
    fingerprint: productFingerprint(gallery),
    imageId: 'gid://shopify/Image/2',
    storeId: authB.storeId,
    accessToken: 'never-persist',
  };
  await mocked(
    async (calls) => {
      const saved = await saveKit(auth, input);
      assert.equal(saved.link.storeId, auth.storeId);
      assert.equal(saved.link.imageUrl, 'https://cdn.shopify.com/second.jpg');
      assert.equal(saved.project.product.url, 'https://alpha.example/products/test?variant=200');
      const body = calls.find((call) =>
        call.url.pathname.endsWith('/studioshelf_save_shopify_kit'),
      )!.body;
      assert.equal(body.p_store_id, auth.storeId);
      assert.equal(body.p_product_id, productId);
      assert.ok(!JSON.stringify(body).includes('never-persist'));
      assert.ok(!JSON.stringify(body).includes('unrelated.example'));
    },
    (url, _method, body) =>
      url.hostname === auth.shop
        ? json({ data: { product: gallery } })
        : json({ ...row, project: body.p_project, link: body.p_link, revision: 1 }),
  );
});

test('privacy webhook storage receives no customer identifiers or request payload', async () => {
  await mocked(
    async (calls) => {
      await handleShopifyWebhook(
        'customers/data_request',
        auth.shop,
        { shop_id: 1, customer: { id: 909, email: 'private@example.com' }, orders_requested: [44] },
        'delivery-1',
      );
      assert.equal(calls[0].body.p_store_id, auth.storeId);
      assert.equal(calls[0].body.p_topic, 'customers/data_request');
      assert.ok(!JSON.stringify(calls[0].body).includes('private@example.com'));
      assert.ok(!JSON.stringify(calls[0].body).includes('909'));
    },
    () => json(null),
  );
});

test('hosted generation rejects exhausted atomic reservations and never silently falls through', async () => {
  const prev = { flag: process.env.SHOPIFY_HOSTED_AI_ENABLED, key: process.env.GEMINI_API_KEY };
  process.env.SHOPIFY_HOSTED_AI_ENABLED = 'true';
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    await mocked(
      async (calls) => {
        await assert.rejects(() => reserveHostedUsage(auth), /allowance has been reached/);
        assert.equal(calls[0].body.p_store_id, auth.storeId);
        assert.ok(calls[0].body.p_limit > 0 && calls[0].body.p_global_limit > 0);
      },
      () => json({ allowed: false, limit: 20, used: 20, remaining: 0 }),
    );
  } finally {
    if (prev.flag === undefined) delete process.env.SHOPIFY_HOSTED_AI_ENABLED;
    else process.env.SHOPIFY_HOSTED_AI_ENABLED = prev.flag;
    if (prev.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prev.key;
  }
});

test('product fingerprints detect changes, variant ownership is enforced, and URLs use actual Shopify URLs', async () => {
  assert.notEqual(
    productFingerprint({ ...raw, updatedAt: '2026-11-02T00:00:00Z' }),
    product.fingerprint,
  );
  assert.equal(
    storefrontUrl(product, variantId),
    'https://alpha.example/products/test?variant=200',
  );
  assert.equal(storefrontUrl({ ...product, onlineStoreUrl: null }, variantId), null);
  await mocked(
    async () => {
      await assert.rejects(
        () => assertVariant(auth, product, 'gid://shopify/ProductVariant/999'),
        /does not belong/,
      );
    },
    () =>
      json({
        data: {
          productVariant: {
            ...product.variants[0],
            id: 'gid://shopify/ProductVariant/999',
            product: { id: 'gid://shopify/Product/666' },
          },
        },
      }),
  );
});

test('description publishing requires explicit approval, write permission and exact unchanged source', async () => {
  assert.equal(
    textToDescriptionHtml('<script>bad</script>\nnext'),
    '<p>&lt;script&gt;bad&lt;/script&gt;<br>next</p>',
  );
  assert.throws(
    () => assertDescriptionUnchanged('<p>New</p>', '<p>Old</p>'),
    /changed after this preview/,
  );
  await assert.rejects(() => applyDescription(auth, id, false), /approve/);
  await assert.rejects(
    () => applyDescription({ ...auth, scopes: ['read_products'] }, id, true),
    /Product-write access/,
  );
});

test('an uncertain description save is reconciled without replaying a Shopify write', async () => {
  const history = {
    id,
    store_id: auth.storeId,
    product_id: productId,
    before_html: '<p>Before</p>',
    after_html: raw.descriptionHtml,
    before_text: 'Before',
    after_text: 'Original',
    created_at: new Date().toISOString(),
    status: 'uncertain',
    applied_at: null,
  };
  await mocked(
    async (calls) => {
      const result = await applyDescription(auth, id, true);
      assert.equal(result.applied, true);
      assert.equal(result.reconciled, true);
      assert.equal(calls.filter((c) => c.body?.query?.startsWith('mutation')).length, 0);
      assert.ok(calls.some((c) => c.method === 'PATCH' && c.body.status === 'applied'));
    },
    (url, method) =>
      url.hostname === auth.shop
        ? json({ data: { product: raw } })
        : method === 'PATCH'
          ? json(null)
          : json(history),
  );
});
