import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject } from '../lib/storage';
import { getSample } from '../lib/samples';
import { createTemplateKit } from '../lib/engine';
import type { Project } from '../lib/types';

const sample = getSample('fragrance');
const project: Project = {
  id: 'backup-validation',
  updatedAt: '2026-11-02T00:00:00.000Z',
  product: sample.product,
  kit: createTemplateKit(sample.product),
  image: null,
  sampleId: sample.id,
  theme: sample.theme,
  source: 'template',
};

test('backup metadata requires a real string identifier before a kit can reach browser storage', () => {
  for (const id of [undefined, null, 123, true, false, ['valid-looking-id'], {}]) {
    const backup = JSON.parse(JSON.stringify({ ...project, id }));
    assert.throws(() => validateProject(backup), /invalid project metadata/);
  }
  assert.equal(validateProject(JSON.parse(JSON.stringify(project))).id, project.id);
});
