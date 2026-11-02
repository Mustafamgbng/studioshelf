import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { authenticateShopify, scopeAllows, verifyIdToken } from '../lib/shopify/auth';
import { getShopifyConfig } from '../lib/shopify/config';
import {
  errorResponse,
  framePolicy,
  readJson,
  ShopifyError,
  signFrameContext,
  signedQueryShop,
  verifyFrameContext,
  verifyWebhookHmac,
} from '../lib/shopify/security';
import { proxy } from '../proxy';
import { POST as webhook } from '../app/api/shopify/webhooks/route';

const appKey = 'test-shopify-client-id';
const appSecret = 'test-shopify-secret-not-a-real-credential';
const now = 1793520000;
const claims = {
  iss: 'https://store-a.myshopify.com/admin',
  dest: 'https://store-a.myshopify.com',
  aud: appKey,
  sub: '123',
  sid: 'session-test-a',
  exp: now + 60,
  nbf: now - 1,
  iat: now,
};
function jwt(
  extra: Record<string, unknown> = {},
  header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' },
  secret = appSecret,
) {
  const parts = [header, { ...claims, ...extra }].map((part) =>
    Buffer.from(JSON.stringify(part)).toString('base64url'),
  );
  return [...parts, createHmac('sha256', secret).update(parts.join('.')).digest('base64url')].join(
    '.',
  );
}

test('Shopify ID tokens require a valid HS256 signature, audience, lifetime and exact issuer/destination', () => {
  assert.deepEqual(verifyIdToken(jwt(), appKey, appSecret, now), {
    shop: 'store-a.myshopify.com',
    staffId: '123',
    sid: 'session-test-a',
    exp: now + 60,
  });
  for (const token of [
    jwt({}, { alg: 'none' }),
    jwt({}, undefined, 'different-secret'),
    jwt({ aud: 'another-app' }),
    jwt({ exp: now }),
    jwt({ nbf: now + 30 }),
    jwt({ iat: now + 30 }),
    jwt({ iss: 'https://store-b.myshopify.com/admin' }),
    jwt({ dest: 'https://store-a.myshopify.com.evil.example' }),
    jwt({ dest: 'https://store-a.myshopify.com/' }),
    jwt({ sid: '' }),
    jwt({ sub: 'invalid' }),
  ]) {
    assert.throws(
      () => verifyIdToken(token, appKey, appSecret, now),
      (e) => e instanceof ShopifyError && e.status === 401,
    );
  }
});

test('CSP permits are store-bound and expire; arbitrary shop parameters never allow framing', () => {
  assert.equal(
    framePolicy('store-a.myshopify.com'),
    'frame-ancestors https://store-a.myshopify.com https://admin.shopify.com;',
  );
  assert.equal(framePolicy('store-a.myshopify.com.evil.example'), "frame-ancestors 'none';");
  const permit = signFrameContext('store-a.myshopify.com', appKey, appSecret, now);
  assert.equal(verifyFrameContext(permit, appKey, appSecret, now + 3600), 'store-a.myshopify.com');
  assert.equal(verifyFrameContext(permit, 'other-app', appSecret, now), null);
  assert.equal(verifyFrameContext(permit, appKey, appSecret, now + 43200), null);
  assert.equal(verifyFrameContext(permit + 'x', appKey, appSecret, now), null);
  assert.equal(
    proxy(new NextRequest('https://app.example/shopify?shop=store-a.myshopify.com')).headers.get(
      'content-security-policy',
    ),
    "frame-ancestors 'none';",
  );
  assert.equal(
    proxy(new NextRequest('https://app.example/')).headers.get('content-security-policy'),
    "frame-ancestors 'none';",
  );
});

test('Signed launch queries reject tampered shops, stale timestamps and duplicate parameters', () => {
  const params = new URLSearchParams({
    shop: 'store-a.myshopify.com',
    timestamp: String(now),
    host: 'c3RvcmUtYS5teXNob3BpZnkuY29tL2FkbWlu',
  });
  params.sort();
  params.set(
    'hmac',
    createHmac('sha256', appSecret).update(params.toString().replace(/\+/g, '%20')).digest('hex'),
  );
  assert.equal(signedQueryShop(params, appSecret, now), 'store-a.myshopify.com');
  assert.equal(signedQueryShop(params, appSecret, now + 91), null);
  const changed = new URLSearchParams(params);
  changed.set('shop', 'store-b.myshopify.com');
  assert.equal(signedQueryShop(changed, appSecret, now), null);
  params.append('shop', 'store-b.myshopify.com');
  assert.equal(signedQueryShop(params, appSecret, now), null);
});

test('Webhook signatures authenticate raw bytes and reject missing or modified bodies', () => {
  const body = Buffer.from('{ "shop_id": 123, "shop_domain": "store-a.myshopify.com" }');
  const signature = createHmac('sha256', appSecret).update(body).digest('base64');
  assert.equal(verifyWebhookHmac(body, signature, appSecret), true);
  assert.equal(
    verifyWebhookHmac(
      Buffer.from(JSON.stringify(JSON.parse(body.toString()))),
      signature,
      appSecret,
    ),
    false,
  );
  assert.equal(verifyWebhookHmac(body, null, appSecret), false);
  assert.equal(verifyWebhookHmac(body, signature, 'wrong-secret'), false);
});

test('Admin launch HMAC canonicalization follows Shopify encoding for spaces and reserved characters', () => {
  // Shopify's official ProcessedQuery.stringify uses URLSearchParams, then + -> %20.
  // Keep the independently written canonical message explicit to catch encoding regressions.
  const canonical = `foo=hello%20world%26one%3Dtwo%2Bthree&shop=store-a.myshopify.com&timestamp=${now}`;
  const params = new URLSearchParams({
    timestamp: String(now),
    shop: 'store-a.myshopify.com',
    foo: 'hello world&one=two+three',
  });
  params.set('hmac', createHmac('sha256', appSecret).update(canonical).digest('hex'));
  assert.equal(signedQueryShop(params, appSecret, now), 'store-a.myshopify.com');
  params.set('foo', 'hello+world&one=two+three');
  assert.equal(signedQueryShop(params, appSecret, now), null);
});

test('JSON body limits also apply to streamed requests without content-length', async () => {
  const request = new Request('https://app.example/api/shopify/kits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(200) }),
  });
  await assert.rejects(
    readJson(request, 100),
    (e) => e instanceof ShopifyError && e.status === 413,
  );
  const response = errorResponse(new Error('secret provider detail'));
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('secret provider detail'));
  assert.equal(
    errorResponse(new ShopifyError(401, 'Retry', 'SESSION_INVALID')).headers.get(
      'X-Shopify-Retry-Invalid-Session-Request',
    ),
    '1',
  );
});

test('Each protected call exchanges online tokens and checks current staff scopes and live store identity', async () => {
  const originalFetch = globalThis.fetch;
  const env = {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
  };
  process.env.SHOPIFY_API_KEY = appKey;
  process.env.SHOPIFY_API_SECRET = appSecret;
  process.env.SHOPIFY_APP_URL = 'https://app.example';
  const t = Math.floor(Date.now() / 1000);
  const token = jwt({ exp: t + 60, iat: t, nbf: t - 1 });
  let scope = 'read_products';
  let otherStore = false;
  let staffId = 123;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.ok(String(url).startsWith('https://store-a.myshopify.com/'));
    if (String(url).endsWith('/access_token')) {
      const form = init?.body as URLSearchParams;
      assert.equal(
        form.get('requested_token_type'),
        'urn:shopify:params:oauth:token-type:online-access-token',
      );
      return Response.json({
        access_token: 'opaque-online-token',
        expires_in: 3600,
        scope: 'write_products',
        associated_user_scope: scope,
        associated_user: { id: staffId },
      });
    }
    assert.equal(
      (init?.headers as Record<string, string>)['X-Shopify-Access-Token'],
      'opaque-online-token',
    );
    return Response.json({
      data: {
        shop: {
          id: 'gid://shopify/Shop/1',
          name: 'Store A',
          currencyCode: 'JPY',
          myshopifyDomain: otherStore ? 'store-b.myshopify.com' : 'store-a.myshopify.com',
        },
        currentAppInstallation: { accessScopes: [{ handle: 'write_products' }] },
      },
    });
  };
  const request = () =>
    new Request('https://app.example/api/shopify/session', {
      headers: { authorization: `Bearer ${token}` },
    });
  try {
    const auth = await authenticateShopify(request());
    assert.equal(auth.storeId, 'gid://shopify/Shop/1');
    assert.equal(auth.currency, 'JPY');
    assert.equal(auth.scopes.includes('write_products'), false);
    assert.equal(calls, 2);
    await authenticateShopify(request());
    assert.equal(calls, 4);
    await assert.rejects(
      authenticateShopify(request(), ['write_products']),
      (e) => e instanceof ShopifyError && e.status === 403,
    );
    scope = '';
    await assert.rejects(
      authenticateShopify(request()),
      (e) => e instanceof ShopifyError && e.status === 403,
    );
    scope = 'write_products';
    otherStore = true;
    await assert.rejects(
      authenticateShopify(request()),
      (e) => e instanceof ShopifyError && e.status === 401,
    );
    otherStore = false;
    staffId = 456;
    await assert.rejects(
      authenticateShopify(request()),
      (e) => e instanceof ShopifyError && e.status === 401,
    );
    assert.equal(scopeAllows(['write_products'], 'read_products'), true);
    await assert.rejects(
      authenticateShopify(
        new Request('https://app.example/api/shopify/session', {
          headers: { authorization: `Bearer ${token}`, origin: 'https://other.example' },
        }),
      ),
      (e) => e instanceof ShopifyError && e.status === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});

test('Production Shopify configuration fails closed instead of accepting non-HTTPS or credential URLs', () => {
  const before = process.env.SHOPIFY_APP_URL;
  const key = process.env.SHOPIFY_API_KEY;
  const secret = process.env.SHOPIFY_API_SECRET;
  process.env.SHOPIFY_API_KEY = appKey;
  process.env.SHOPIFY_API_SECRET = appSecret;
  try {
    for (const url of [
      'http://app.example',
      'https://user:password@app.example',
      'https://app.example/private?key=anything',
    ]) {
      process.env.SHOPIFY_APP_URL = url;
      assert.throws(getShopifyConfig, (e) => e instanceof ShopifyError && e.status === 503);
    }
  } finally {
    for (const [name, value] of Object.entries({
      SHOPIFY_APP_URL: before,
      SHOPIFY_API_KEY: key,
      SHOPIFY_API_SECRET: secret,
    }))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});

test('Mandatory privacy webhook endpoints verify signatures, discard customer PII and fail retries safely', async () => {
  const beforeFetch = globalThis.fetch;
  const changes = {
    SHOPIFY_API_KEY: appKey,
    SHOPIFY_API_SECRET: appSecret,
    SHOPIFY_APP_URL: 'https://app.example',
    SUPABASE_URL: 'https://database.example',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-not-a-real-secret',
  };
  const before = Object.fromEntries(Object.keys(changes).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(changes)) process.env[key] = value;
  const requests: Record<string, unknown>[] = [];
  let unavailable = false;
  globalThis.fetch = async (_url, options) => {
    if (unavailable) return Response.json({ message: 'database detail' }, { status: 503 });
    requests.push(JSON.parse(String(options?.body)));
    return Response.json(null);
  };
  function delivery(topic: string, invalidSignature = false) {
    const body = JSON.stringify({
      shop_id: 123,
      shop_domain: 'store-a.myshopify.com',
      customer: { id: 123, email: 'private-customer@example.test' },
      orders_requested: [1, 2],
    });
    const signature = createHmac('sha256', appSecret).update(body).digest('base64');
    return new Request('https://app.example/api/shopify/webhooks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-shopify-hmac-sha256': invalidSignature ? 'invalid' : signature,
        'x-shopify-shop-domain': 'store-a.myshopify.com',
        'x-shopify-topic': topic,
        'x-shopify-event-id': 'test-event-privacy',
      },
      body,
    });
  }
  try {
    for (const topic of ['customers/data_request', 'customers/redact', 'shop/redact']) {
      assert.equal((await webhook(delivery(topic, true))).status, 401);
      assert.equal((await webhook(delivery(topic))).status, 200);
    }
    assert.equal(requests.length, 3);
    assert.ok(!JSON.stringify(requests).includes('private-customer'));
    assert.ok(requests.every((request) => request.p_shop === 'store-a.myshopify.com'));
    unavailable = true;
    const retry = await webhook(delivery('customers/redact'));
    assert.equal(retry.status, 503);
    assert.ok(!(await retry.text()).includes('database detail'));
  } finally {
    globalThis.fetch = beforeFetch;
    for (const [key, value] of Object.entries(before))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});

test('A signed frame context supports iframe reload but never authenticates protected API access', async () => {
  const before = {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
  };
  process.env.SHOPIFY_API_KEY = appKey;
  process.env.SHOPIFY_API_SECRET = appSecret;
  process.env.SHOPIFY_APP_URL = 'https://app.example';
  const t = Math.floor(Date.now() / 1000);
  const token = jwt({ iat: t, nbf: t - 1, exp: t + 60 });
  try {
    const launch = proxy(
      new NextRequest(
        `https://app.example/shopify?shop=store-a.myshopify.com&host=host-value&id_token=${token}`,
      ),
    );
    assert.equal(launch.status, 307);
    const target = new URL(launch.headers.get('location')!);
    assert.equal(target.searchParams.get('host'), 'host-value');
    assert.equal(target.searchParams.get('id_token'), null);
    assert.ok(target.searchParams.get('frame_context'));
    assert.equal(
      proxy(new NextRequest(target)).headers.get('content-security-policy'),
      framePolicy('store-a.myshopify.com'),
    );
    assert.equal(proxy(new NextRequest(target)).headers.get('x-frame-options'), null);
    target.searchParams.set('shop', 'store-b.myshopify.com');
    assert.equal(
      proxy(new NextRequest(target)).headers.get('content-security-policy'),
      framePolicy(null),
    );
    await assert.rejects(
      authenticateShopify(
        new Request(
          `https://app.example/api/shopify/session?frame_context=${target.searchParams.get('frame_context')}`,
        ),
      ),
      (e) => e instanceof ShopifyError && e.status === 401,
    );
  } finally {
    for (const [key, value] of Object.entries(before))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});
