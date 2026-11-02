import test from 'node:test';
import assert from 'node:assert/strict';
import { initialHistory, projectHistory } from '../lib/history';
import { createTemplateKit } from '../lib/engine';
import { DEFAULT_PRODUCT, type Project } from '../lib/types';
const project: Project = {
  id: 'sample',
  updatedAt: '2026-11-01T00:00:00Z',
  product: DEFAULT_PRODUCT,
  kit: createTemplateKit(DEFAULT_PRODUCT),
  image: null,
  theme: 'clay',
  source: 'template',
};
test('undo groups a typing burst, preserves saved identity and supports redo', () => {
  let h = initialHistory(project);
  for (const [index, name] of ['New', 'New p', 'New product'].entries())
    h = projectHistory(h, {
      type: 'change',
      update: (p) => ({ ...p, product: { ...p.product, name } }),
      group: 'name',
      at: 1000 + index * 100,
    });
  assert.equal(h.past.length, 1);
  h = projectHistory(h, {
    type: 'sync',
    project: { ...h.present, id: 'saved-id', updatedAt: '2026-11-02T00:00:00Z' },
  });
  h = projectHistory(h, { type: 'undo' });
  assert.equal(h.present.product.name, DEFAULT_PRODUCT.name);
  assert.equal(h.present.id, 'saved-id');
  h = projectHistory(h, { type: 'redo' });
  assert.equal(h.present.product.name, 'New product');
  assert.equal(h.present.updatedAt, '2026-11-02T00:00:00Z');
});
test('a new edit after undo discards redo, while opening another project clears history', () => {
  let h = projectHistory(initialHistory(project), {
    type: 'change',
    update: (p) => ({ ...p, theme: 'forest' }),
    at: 100,
  });
  h = projectHistory(h, { type: 'undo' });
  assert.equal(h.future.length, 1);
  h = projectHistory(h, { type: 'change', update: (p) => ({ ...p, theme: 'graphite' }), at: 200 });
  assert.equal(h.future.length, 0);
  h = projectHistory(h, { type: 'reset', project: { ...project, id: 'other-kit' } });
  assert.equal(h.past.length, 0);
  assert.equal(h.future.length, 0);
  assert.equal(h.present.id, 'other-kit');
});
test('history is bounded and metadata-only saves do not create editing steps', () => {
  let h = initialHistory(project);
  for (let i = 0; i < 60; i++)
    h = projectHistory(h, {
      type: 'change',
      update: (p) => ({ ...p, product: { ...p.product, name: String(i) } }),
      at: i * 1000,
    });
  assert.equal(h.past.length, 40);
  h = projectHistory(h, {
    type: 'change',
    update: (p) => ({ ...p, updatedAt: '2026-11-03T00:00:00Z' }),
    at: 100000,
  });
  assert.equal(h.past.length, 40);
});

test('gallery additions and per-slide photo choices can be undone independently', () => {
  const gallery = [{ id: 'detail-photo', src: 'data:image/png;base64,aW1hZ2U=', name: 'Detail' }];
  let h = projectHistory(initialHistory(project), {
    type: 'change',
    update: (p) => ({ ...p, gallery }),
    at: 100,
  });
  h = projectHistory(h, {
    type: 'change',
    update: (p) => ({ ...p, slidePhotos: [null, null, 'detail-photo', null, null] }),
    at: 1000,
  });
  assert.equal(h.past.length, 2);
  h = projectHistory(h, { type: 'undo' });
  assert.equal(h.present.slidePhotos, undefined);
  assert.equal(h.present.gallery, gallery);
  h = projectHistory(h, { type: 'undo' });
  assert.equal(h.present.gallery, undefined);
  h = projectHistory(h, { type: 'redo' });
  h = projectHistory(h, { type: 'redo' });
  assert.equal(h.present.slidePhotos?.[2], 'detail-photo');
  assert.equal(h.present.gallery?.[0].name, 'Detail');
});

test('history restores the generation brief so freshness can follow undo and redo', () => {
  const staleBrief = { ...DEFAULT_PRODUCT, price: '19' };
  const ready = { ...project, generationBrief: staleBrief };
  let h = projectHistory(initialHistory(ready), {
    type: 'change',
    update: (p) => ({ ...p, generationBrief: p.product }),
    at: 100,
  });
  h = projectHistory(h, {
    type: 'sync',
    project: { ...h.present, id: 'saved-with-photos', updatedAt: '2026-11-02T00:00:00Z' },
  });
  h = projectHistory(h, { type: 'undo' });
  assert.equal(h.present.generationBrief, staleBrief);
  assert.notEqual(h.present.generationBrief?.price, h.present.product.price);
  assert.equal(h.present.id, 'saved-with-photos');
  h = projectHistory(h, { type: 'redo' });
  assert.equal(h.present.generationBrief, DEFAULT_PRODUCT);
  assert.equal(h.present.generationBrief?.price, h.present.product.price);
});
