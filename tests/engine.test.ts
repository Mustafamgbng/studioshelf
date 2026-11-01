import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateKit, factLines, validateKit, validateProduct } from '../lib/engine';
import { DEFAULT_PRODUCT } from '../lib/types';
import { validateProject } from '../lib/storage';
import { csvCell, listingCsv, wrapText } from '../lib/export';
import { SAMPLE_PRODUCTS, getSample, getSampleImage } from '../lib/samples';

test('template output keeps seller facts and never invents shipping or product guarantees', () => {
  const p = {
    ...DEFAULT_PRODUCT,
    name: 'Linen pouch',
    facts: 'Blue colour\n22 cm wide\nZip closure',
    price: '',
  };
  const kit = validateKit(createTemplateKit(p));
  assert.equal(kit.slides.length, 5);
  for (const fact of factLines(p)) assert.ok(kit.description.includes(fact));
  assert.ok(!/free shipping|dishwasher|certified|organic|guaranteed/i.test(kit.description));
  assert.ok(!kit.description.includes('USD'));
});
test('validation rejects missing facts, oversized fields and malformed prices', () => {
  for (const p of [
    { ...DEFAULT_PRODUCT, facts: '' },
    { ...DEFAULT_PRODUCT, price: '-5' },
    { ...DEFAULT_PRODUCT, price: '1.234' },
    { ...DEFAULT_PRODUCT, name: 'x'.repeat(101) },
    { ...DEFAULT_PRODUCT, currency: 'XYZ' },
  ])
    assert.throws(() => validateProduct(p));
  assert.throws(() => validateProduct(null));
  assert.equal(validateProduct({ ...DEFAULT_PRODUCT, price: '0' }).price, '0');
});
test('AI result validation rejects incomplete assets and unbounded output', () => {
  const kit = createTemplateKit(DEFAULT_PRODUCT);
  assert.throws(() => validateKit({ ...kit, slides: kit.slides.slice(0, 4) }));
  assert.throws(() => validateKit({ ...kit, title: 'x'.repeat(251) }));
  assert.throws(() => validateKit({ ...kit, tags: [''] }));
});
test('project import rejects SVG payloads and strips unknown properties', () => {
  const p = {
    id: 'sample',
    updatedAt: new Date().toISOString(),
    product: DEFAULT_PRODUCT,
    kit: createTemplateKit(DEFAULT_PRODUCT),
    image: null,
    theme: 'clay',
    source: 'template',
    apiKey: 'never-store-this',
  };
  assert.ok(!('apiKey' in validateProject(p)));
  assert.ok(
    !('apiKey' in validateProject({ ...p, kit: { ...p.kit, apiKey: 'not-a-project-field' } }).kit),
  );
  assert.throws(() => validateProject({ ...p, image: 'data:image/svg+xml;base64,PHN2Zy8+' }));
  assert.throws(() => validateProject({ ...p, theme: 'unsupported' }));
});
test('CSV export neutralizes formulas even after whitespace and escapes quoted text', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell('  +SUM(1,1)'), '"\'  +SUM(1,1)"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  const p = validateProject({
    id: 'sample',
    updatedAt: new Date().toISOString(),
    product: DEFAULT_PRODUCT,
    kit: createTemplateKit(DEFAULT_PRODUCT),
    image: null,
    theme: 'clay',
    source: 'template',
  });
  assert.ok(listingCsv(p).startsWith('title,description,price,currency,keywords\r\n'));
});
test('artwork wrapping handles long words and bounds the number of lines', () => {
  const ctx = {
    measureText: (s: string) => ({ width: s.length * 10 }),
  } as CanvasRenderingContext2D;
  const lines = wrapText(ctx, 'Superlongunspacedproductname and some more words', 100, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((s) => ctx.measureText(s).width <= 100));
  assert.ok(lines[1].endsWith('…'));
});

test('every product sample creates a valid kit and survives project backup import with its theme', () => {
  assert.equal(getSample('headphones').theme, 'graphite');
  for (const sample of SAMPLE_PRODUCTS) {
    const product = validateProduct(sample.product);
    const kit = validateKit(createTemplateKit(product));
    const project = {
      id: `sample-${sample.id}`,
      updatedAt: '2026-11-01T00:00:00.000Z',
      product,
      kit,
      image: null,
      theme: sample.theme,
      source: 'template',
    };
    const imported = validateProject(JSON.parse(JSON.stringify(project)));
    assert.deepEqual(imported, project, `${sample.id} should remain editable after import`);
    assert.equal(imported.kit.slides.length, 5);
    for (const fact of factLines(product)) assert.ok(imported.kit.description.includes(fact));
  }
});

test('sample routing resolves each example, falls back safely and preserves legacy mug images', () => {
  for (const sample of SAMPLE_PRODUCTS) {
    assert.equal(getSample(sample.id), sample);
    assert.equal(getSampleImage(sample.product), sample.image);
  }
  assert.equal(getSample('missing-example'), SAMPLE_PRODUCTS[0]);
  assert.equal(getSample(null), SAMPLE_PRODUCTS[0]);
  assert.equal(getSample(), SAMPLE_PRODUCTS[0]);
  assert.equal(getSampleImage(DEFAULT_PRODUCT), '/sample-mug.svg');
  assert.equal(getSampleImage({ ...DEFAULT_PRODUCT, name: 'A different seller product' }), null);
});
