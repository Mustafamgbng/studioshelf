import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateKit, factLines, validateKit, validateProduct } from '../lib/engine';
import { validateProject } from '../lib/storage';
import { DEFAULT_PRODUCT } from '../lib/types';

const maxUrl =
  'https://example.com/products/' + 'a'.repeat(2048 - 'https://example.com/products/'.length);
const maxProduct = {
  ...DEFAULT_PRODUCT,
  name: 'N'.repeat(100),
  brand: 'B'.repeat(80),
  category: 'C'.repeat(60),
  audience: 'A'.repeat(200),
  voice: 'V'.repeat(50),
  cta: 'T'.repeat(80),
  price: '10000000.00',
  url: maxUrl,
};

test('a valid long fact generates a kit that can be saved and restored', () => {
  const product = validateProduct({ ...maxProduct, facts: 'A'.repeat(120) });
  const kit = validateKit(createTemplateKit(product));
  const project = validateProject({
    id: 'bounded-template',
    updatedAt: '2026-11-02T00:00:00.000Z',
    product,
    generationBrief: product,
    kit,
    image: null,
    theme: 'clay',
    source: 'template',
  });
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(restored, project);
  assert.ok(kit.title.endsWith(product.brand));
  assert.ok(kit.slides[1].headline.endsWith('…'));
  assert.ok(kit.description.includes(product.facts));
  assert.equal(restored.product.facts.length, 120);
});

test('maximum supported briefs retain their complete facts and URL while every generated asset validates', () => {
  const factsCases = [
    'x'.repeat(2000),
    'fact '.repeat(400).trim(),
    'A\n'.repeat(1000).trim(),
    Array.from({ length: 16 }, (_, index) => `Detail ${index + 1}: ${'x'.repeat(100)}`).join('\n'),
    '🌿'.repeat(1000),
  ];
  for (const facts of factsCases) {
    const product = validateProduct({ ...maxProduct, facts });
    const before = JSON.stringify(product);
    const kit = validateKit(createTemplateKit(product));
    assert.equal(JSON.stringify(product), before, 'generation must not mutate seller facts');
    assert.ok(kit.description.includes(product.url!));
    assert.ok(kit.instagram.includes(product.url!));
    assert.ok(kit.whatsapp.includes(product.url!));
    assert.ok(kit.emailBody.includes(product.url!));
    for (const line of facts.split('\n')) assert.ok(kit.description.includes(line));
    assert.ok(kit.bullets.every((line) => line.length <= 500));
    assert.ok(kit.tags.every((tag) => tag.length <= 80));
    for (const slide of kit.slides) {
      assert.ok(slide.headline.length <= 100 && slide.body.length <= 240);
      assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(slide.headline + slide.body));
    }
  }
});

test('negative values and non-Latin product facts remain accurate and generate valid keyword lists', () => {
  const product = validateProduct({
    ...DEFAULT_PRODUCT,
    name: '保冷バッグ',
    category: '旅行',
    facts: '-10 °C minimum\n- Padded handle\n• 22 cm wide',
  });
  assert.deepEqual(factLines(product), ['-10 °C minimum', 'Padded handle', '22 cm wide']);
  const kit = validateKit(createTemplateKit(product));
  assert.ok(kit.description.includes('-10 °C minimum'));
  assert.ok(kit.tags.includes('保冷バッグ'));
  const symbols = validateProduct({ ...DEFAULT_PRODUCT, name: '🌿', category: '', facts: '🎈' });
  assert.ok(validateKit(createTemplateKit(symbols)).tags.length > 0);
});

test('URL normalization cannot expand an accepted product link beyond its supported limit', () => {
  assert.equal(validateProduct({ ...DEFAULT_PRODUCT, url: maxUrl }).url?.length, 2048);
  assert.throws(
    () => validateProduct({ ...DEFAULT_PRODUCT, url: 'https://example.com/' + '界'.repeat(500) }),
    /2048/,
  );
});
