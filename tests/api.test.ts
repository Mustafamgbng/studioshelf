import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/generate/route';
import { DEFAULT_PRODUCT } from '../lib/types';
import { createTemplateKit } from '../lib/engine';

const request = (body: unknown, origin?: string) =>
  new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
const key = 'test-key-not-a-real-secret-1234567890';

test('generation route rejects cross-origin calls and oversized JSON', async () => {
  assert.equal(
    (await POST(request({ product: DEFAULT_PRODUCT }, 'https://other.example'))).status,
    403,
  );
  assert.equal(
    (await POST(request({ product: DEFAULT_PRODUCT, extra: 'x'.repeat(2200001) }))).status,
    400,
  );
  assert.equal((await POST(request({ product: { name: 'bad' }, apiKey: key }))).status, 400);
  assert.equal((await POST(request(null))).status, 400);
});
test('generation route requires a key and protects server keys from anonymous requests', async () => {
  const before = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.equal((await POST(request({ product: DEFAULT_PRODUCT }))).status, 400);
    process.env.GEMINI_API_KEY = key;
    assert.equal((await POST(request({ product: DEFAULT_PRODUCT }))).status, 401);
  } finally {
    if (before === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = before;
  }
});
test('Gemini request uses header authentication and validates returned copy', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.ok(String(url).includes(':generateContent'));
    assert.ok(!String(url).includes(key));
    assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], key);
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.generationConfig.responseMimeType, 'application/json');
    assert.ok(!payload.contents[0].parts[0].text.includes('data:image'));
    return Response.json({
      candidates: [
        { content: { parts: [{ text: JSON.stringify(createTemplateKit(DEFAULT_PRODUCT)) }] } },
      ],
    });
  };
  try {
    const response = await POST(request({ product: DEFAULT_PRODUCT, apiKey: key }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).kit.slides.length, 5);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
test('provider quota and malformed responses return actionable errors without exposing credentials', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('secret provider body', { status: 429 });
    const limited = await POST(request({ product: DEFAULT_PRODUCT, apiKey: key }));
    assert.equal(limited.status, 429);
    assert.ok(!(await limited.text()).includes('secret provider body'));
    globalThis.fetch = async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: '{"wrong":true}' }] } }] });
    assert.equal((await POST(request({ product: DEFAULT_PRODUCT, apiKey: key }))).status, 502);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
