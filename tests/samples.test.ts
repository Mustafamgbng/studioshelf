import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_PRODUCTS, getProjectImage } from '../lib/samples';
import { createTemplateKit } from '../lib/engine';
import { validateProject } from '../lib/storage';
import { initialHistory, projectHistory } from '../lib/history';
import type { Project } from '../lib/types';

const sampleProject = (index = 0): Project => {
  const sample = SAMPLE_PRODUCTS[index];
  return {
    id: 'sample',
    updatedAt: '2026-11-01T00:00:00.000Z',
    product: sample.product,
    kit: createTemplateKit(sample.product),
    image: null,
    sampleId: sample.id,
    theme: sample.theme,
    source: 'template',
  };
};

test('concept photos remain pinned when a seller renames an example; uploads take priority', () => {
  for (const [index, sample] of SAMPLE_PRODUCTS.entries()) {
    const original = sampleProject(index);
    const renamed = { ...original, product: { ...original.product, name: 'My renamed product' } };
    assert.equal(getProjectImage(renamed), sample.image);
    const image = 'data:image/jpeg;base64,/9j/';
    assert.equal(getProjectImage({ ...renamed, image }), image);
    assert.equal(getProjectImage({ ...renamed, sampleId: undefined }), null);
    assert.equal(getProjectImage({ ...original, sampleId: undefined }), sample.image);
  }
});

test('project backups retain only a supported concept identifier across a JSON round trip', () => {
  const original = sampleProject(1);
  const renamed = { ...original, product: { ...original.product, name: 'My fragrance' } };
  const restored = validateProject(JSON.parse(JSON.stringify(renamed)));
  assert.equal(restored.sampleId, 'fragrance');
  assert.equal(getProjectImage(restored), SAMPLE_PRODUCTS[1].image);
  for (const sampleId of ['unknown', '/arbitrary.png', null, {}, ['fragrance']])
    assert.throws(() => validateProject({ ...original, sampleId }), /unsupported concept/);
  assert.equal('sampleId' in validateProject({ ...original, sampleId: undefined }), false);
});

test('changing only the pinned concept remains an undoable project change', () => {
  const original = sampleProject();
  const changed = projectHistory(initialHistory(original), {
    type: 'change',
    update: { ...original, sampleId: 'tote' },
    at: 1,
  });
  assert.equal(getProjectImage(changed.present), SAMPLE_PRODUCTS[2].image);
  const undone = projectHistory(changed, { type: 'undo' });
  assert.equal(undone.present.sampleId, original.sampleId);
  assert.equal(getProjectImage(undone.present), SAMPLE_PRODUCTS[0].image);
});
