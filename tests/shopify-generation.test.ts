import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  attachProductLink,
  generateGeminiKit,
  mergeAsset,
  validateGenerationInput,
} from '../lib/shopify/generation';
import { createTemplateKit, validateProduct } from '../lib/engine';
import { validateProject } from '../lib/storage';
import { DEFAULT_PRODUCT } from '../lib/types';
import { DEFAULT_STORE_BRAND } from '../lib/shopify/types';
import { POST } from '../app/api/shopify/generate/route';
import { productFingerprint } from '../lib/shopify/products';

test('individual regeneration preserves every other edited asset and never mutates inputs', () => {
  const current = createTemplateKit({ ...DEFAULT_PRODUCT, name: 'My edited product' });
  const snapshot = structuredClone(current);
  const generated = createTemplateKit({
    ...DEFAULT_PRODUCT,
    name: 'A new draft',
    facts: 'Fresh fact one\nFresh fact two',
  });
  for (const target of [
    'listing',
    'instagram',
    'whatsapp',
    'email',
    'slide:0',
    'slide:4',
  ] as const) {
    const next = mergeAsset(current, generated, target);
    assert.deepEqual(current, snapshot);
    const changed = Object.keys(current).filter(
      (k) =>
        JSON.stringify(next[k as keyof typeof next]) !==
        JSON.stringify(current[k as keyof typeof current]),
    );
    const allowed =
      target === 'listing'
        ? ['title', 'description', 'bullets', 'tags']
        : target === 'email'
          ? ['emailSubject', 'emailBody']
          : target.startsWith('slide:')
            ? ['slides']
            : [target];
    assert.ok(changed.length > 0);
    assert.ok(changed.every((field) => allowed.includes(field)));
    if (target.startsWith('slide:'))
      next.slides.forEach((slide, index) => {
        if (index !== Number(target.split(':')[1])) assert.deepEqual(slide, current.slides[index]);
      });
  }
});

test('Shopify briefs require confirmation, valid targets, supported currency precision and safe URLs', () => {
  const input = {
    product: DEFAULT_PRODUCT,
    productId: 'gid://shopify/Product/1',
    variantId: 'gid://shopify/ProductVariant/2',
    fingerprint: 'a'.repeat(64),
    mode: 'template',
    target: 'all',
    factsConfirmed: true,
  };
  assert.equal(validateGenerationInput(input).target, 'all');
  for (const bad of [
    { factsConfirmed: false },
    { target: 'slide:9' },
    { mode: 'unknown' },
    { productId: 'otherstore' },
    { target: 'email', currentKit: {} },
  ])
    assert.throws(() => validateGenerationInput({ ...input, ...bad }));
  assert.equal(
    validateProduct({ ...DEFAULT_PRODUCT, currency: 'BHD', price: '1.234' }).price,
    '1.234',
  );
  assert.equal(
    validateProduct({ ...DEFAULT_PRODUCT, currency: 'JPY', price: '100.00' }).currency,
    'JPY',
  );
  assert.throws(() => validateProduct({ ...DEFAULT_PRODUCT, currency: 'JPY', price: '100.01' }));
  for (const url of [
    'javascript:alert(1)',
    'http://example.com',
    'https://user:password@example.com',
  ])
    assert.throws(() => validateProduct({ ...DEFAULT_PRODUCT, url }));
  const project = validateProject({
    id: 'kit',
    updatedAt: new Date().toISOString(),
    product: DEFAULT_PRODUCT,
    kit: createTemplateKit(DEFAULT_PRODUCT),
    image: null,
    theme: 'clay',
    source: 'template',
    branding: { ...DEFAULT_STORE_BRAND, apiKey: 'discard' },
  });
  assert.ok(!('apiKey' in project.branding!));
  assert.throws(() =>
    validateProject({
      ...project,
      branding: { ...DEFAULT_STORE_BRAND, logo: 'data:image/svg+xml;base64,PHN2Zz4=' },
    }),
  );
});

test('generated calls to action use the actual selected Shopify URL', () => {
  const url = 'https://seller.example/products/actual?variant=2';
  const candidate = createTemplateKit({
    ...DEFAULT_PRODUCT,
    url: 'https://invented.example/wrong',
  });
  const kit = attachProductLink(candidate, url);
  for (const field of ['description', 'instagram', 'whatsapp', 'emailBody'] as const) {
    assert.ok(kit[field].endsWith(url));
    assert.ok(!kit[field].includes('invented.example'));
  }
});

test('Gemini provider errors and malformed output preserve the caller’s existing content', async () => {
  await assert.rejects(
    generateGeminiKit(DEFAULT_PRODUCT, 'testkeynotreal1234567890', async () =>
      Response.json({}, { status: 429 }),
    ),
    /quota reached/,
  );
  await assert.rejects(
    generateGeminiKit(DEFAULT_PRODUCT, 'testkeynotreal1234567890', async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
    ),
    /incomplete content/,
  );
});

test('protected generation checks staff identity, confirmation and hosted allowance before provider use', async () => {
  const names = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SHOPIFY_HOSTED_AI_ENABLED',
    'SHOPIFY_AI_MONTHLY_LIMIT',
    'SHOPIFY_AI_GLOBAL_MONTHLY_LIMIT',
    'GEMINI_API_KEY',
  ];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    SHOPIFY_API_KEY: 'generation-test-app',
    SHOPIFY_API_SECRET: 'generation-test-secret-not-real',
    SHOPIFY_APP_URL: 'https://app.example.test',
    SUPABASE_URL: 'https://database.example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-not-real',
    SHOPIFY_HOSTED_AI_ENABLED: 'true',
    SHOPIFY_AI_MONTHLY_LIMIT: '2',
    SHOPIFY_AI_GLOBAL_MONTHLY_LIMIT: '10',
    GEMINI_API_KEY: 'testkeynotreal1234567890',
  });
  const now = Math.floor(Date.now() / 1000);
  const parts = [
    { alg: 'HS256', typ: 'JWT' },
    {
      iss: 'https://store-a.myshopify.com/admin',
      dest: 'https://store-a.myshopify.com',
      aud: 'generation-test-app',
      sub: '123',
      sid: 'test-session',
      iat: now,
      nbf: now - 1,
      exp: now + 60,
    },
  ].map((p) => Buffer.from(JSON.stringify(p)).toString('base64url'));
  const token = [
    ...parts,
    createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
      .update(parts.join('.'))
      .digest('base64url'),
  ].join('.');
  let providerCalls = 0,
    reservations = 0;
  const raw = {
    id: 'gid://shopify/Product/1',
    title: 'Real product',
    description: 'Fact',
    descriptionHtml: '<p>Fact</p>',
    handle: 'real',
    vendor: 'Seller',
    productType: 'Home',
    updatedAt: '2026-11-01T00:00:00Z',
    onlineStoreUrl: 'https://seller.example/products/real',
    images: { nodes: [] },
    variants: {
      nodes: [
        {
          id: 'gid://shopify/ProductVariant/2',
          title: 'Default',
          price: '19.00',
          image: null,
          selectedOptions: [],
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  };
  globalThis.fetch = async (input, init) => {
    const url = String(input),
      body = init?.body ? String(init.body) : '';
    if (url.endsWith('/admin/oauth/access_token'))
      return Response.json({
        access_token: 'online-test-token',
        scope: 'read_products',
        associated_user_scope: 'read_products',
        associated_user: { id: 123 },
        expires_in: 3600,
      });
    if (url.includes('/graphql.json')) {
      const query = JSON.parse(body).query as string;
      return query.includes('StudioShelfIdentity')
        ? Response.json({
            data: {
              shop: {
                id: 'gid://shopify/Shop/1',
                name: 'Store A',
                currencyCode: 'USD',
                myshopifyDomain: 'store-a.myshopify.com',
              },
              currentAppInstallation: { accessScopes: [{ handle: 'read_products' }] },
            },
          })
        : Response.json({ data: { product: raw } });
    }
    if (url.includes('/rest/v1/shopify_stores'))
      return init?.method === 'POST' ? Response.json(null) : Response.json([{ brand: {} }]);
    if (url.includes('/rest/v1/shopify_ai_usage')) return Response.json([]);
    if (url.includes('/rpc/studioshelf_reserve_shopify_ai')) {
      reservations++;
      return Response.json({ allowed: false, limit: 2, used: 2, remaining: 0 });
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      providerCalls++;
      throw new Error('Provider must not run');
    }
    throw new Error('Unexpected test request: ' + url);
  };
  const body = {
    product: DEFAULT_PRODUCT,
    productId: raw.id,
    variantId: raw.variants.nodes[0].id,
    fingerprint: productFingerprint(raw),
    factsConfirmed: true,
    target: 'all',
    mode: 'template',
  };
  const request = (data: unknown, authorized = true) =>
    new Request('https://app.example.test/api/shopify/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://app.example.test',
        ...(authorized ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
  try {
    assert.equal((await POST(request(body, false))).status, 401);
    assert.equal((await POST(request({ ...body, factsConfirmed: false }))).status, 400);
    assert.equal((await POST(request({ ...body, fingerprint: 'b'.repeat(64) }))).status, 409);
    const result = await POST(request(body));
    assert.equal(result.status, 200, await result.clone().text());
    const output = await result.json();
    assert.ok(output.kit.description.includes('USD 19.00'));
    assert.ok(output.kit.whatsapp.endsWith('https://seller.example/products/real?variant=2'));
    assert.equal((await POST(request({ ...body, mode: 'hosted' }))).status, 429);
    assert.equal(reservations, 1);
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
