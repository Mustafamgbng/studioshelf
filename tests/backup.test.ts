import test from 'node:test';
import assert from 'node:assert/strict';
import { projectBackupJson, validateProject } from '../lib/storage';
import { createTemplateKit } from '../lib/engine';
import { getSample, getSampleGallery } from '../lib/samples';
import type { Project } from '../lib/types';

const sample = getSample('fragrance');
const project: Project = {
  id: 'backup-round-trip',
  updatedAt: '2026-11-02T00:00:00.000Z',
  product: sample.product,
  generationBrief: sample.product,
  kit: createTemplateKit(sample.product),
  image: null,
  sampleId: sample.id,
  gallery: getSampleGallery(sample.id),
  slidePhotos: [null, 'fragrance-detail', 'fragrance-scene', null, null],
  theme: sample.theme,
  source: 'template',
};

test('backup serialization produces restorable content and strips unrelated fields', () => {
  const json = projectBackupJson({ ...project, apiKey: 'must-not-export' });
  const restored = validateProject(JSON.parse(json));
  assert.deepEqual(restored, validateProject(project));
  assert.ok(!json.includes('must-not-export'));
  assert.equal(restored.slidePhotos?.[2], 'fragrance-scene');
});

test('backup serialization refuses incomplete drafts instead of producing unrestorable files', () => {
  assert.throws(
    () => projectBackupJson({ ...project, product: { ...project.product, facts: '' } }),
    /confirmed fact/,
  );
  assert.throws(() => projectBackupJson({ ...project, kit: { ...project.kit, emailBody: '' } }));
});
