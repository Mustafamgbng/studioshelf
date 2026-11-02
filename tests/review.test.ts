import test from 'node:test';
import assert from 'node:assert/strict';
import { getReviewProgress, reviewSignature, validateReview } from '../lib/review';
import { getSample, getSampleGallery } from '../lib/samples';
import { createTemplateKit } from '../lib/engine';
import { validateProject } from '../lib/storage';
import { initialHistory, projectHistory } from '../lib/history';
import type { Project } from '../lib/types';
const sample = getSample('fragrance');
const base: Project = {
  id: 'review-kit',
  updatedAt: '2026-11-02T00:00:00.000Z',
  product: sample.product,
  generationBrief: sample.product,
  kit: createTemplateKit(sample.product),
  image: null,
  sampleId: 'fragrance',
  gallery: getSampleGallery('fragrance'),
  theme: sample.theme,
  source: 'template',
};
test('seller confirmations survive backup validation without claiming unconfirmed items', () => {
  const current = {
    ...base,
    review: { signature: reviewSignature(base), confirmed: ['fact-1', 'final-images'] },
  };
  const restored = validateProject(JSON.parse(JSON.stringify(current)));
  assert.equal(getReviewProgress(restored).done, 2);
  assert.equal(getReviewProgress(restored).complete, false);
  assert.deepEqual(validateReview({ ...current.review, ready: true }), current.review);
  assert.throws(() =>
    validateReview({ signature: 'review-v1:00000000', confirmed: ['fact-1', 'fact-1'] }),
  );
  assert.throws(() => validateReview({ signature: 'invalid', confirmed: [] }));
  assert.throws(() =>
    validateReview({ signature: 'review-v1:00000000', confirmed: ['untrusted-flag'] }),
  );
});
test('content, photo and design changes invalidate review while metadata changes preserve it', () => {
  const checked = { ...base, review: { signature: reviewSignature(base), confirmed: ['fact-1'] } };
  assert.equal(
    getReviewProgress({ ...checked, id: 'saved-id', updatedAt: '2026-12-01T00:00:00.000Z' }).done,
    1,
  );
  for (const changed of [
    { ...checked, product: { ...base.product, price: '99' } },
    { ...checked, kit: { ...base.kit, emailSubject: 'Updated subject' } },
    { ...checked, slidePhotos: ['fragrance-detail', null, null, null, null] },
    { ...checked, theme: 'forest' as const },
  ])
    assert.equal(getReviewProgress(changed).done, 0);
  const history = initialHistory(checked);
  const edited = projectHistory(history, {
    type: 'change',
    update: { ...checked, kit: { ...base.kit, title: 'Changed title' } },
    at: 1,
  });
  assert.equal(getReviewProgress(projectHistory(edited, { type: 'undo' }).present).done, 1);
});
test('generation brief persists separately from changed product facts on save and reopen', () => {
  const changed = validateProject(
    JSON.parse(
      JSON.stringify({ ...base, product: { ...sample.product, name: 'New product name' } }),
    ),
  );
  assert.equal(changed.generationBrief?.name, sample.product.name);
  assert.notEqual(changed.generationBrief?.name, changed.product.name);
  assert.throws(() =>
    validateProject({ ...base, generationBrief: { ...sample.product, facts: '' } }),
  );
});
