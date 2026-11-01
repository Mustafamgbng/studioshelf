import test from 'node:test';
import assert from 'node:assert/strict';
import { studioOptions } from '../lib/studio-route';
test('homepage preview selection transfers to the editor with its real palette, asset and slide', () => {
  assert.deepEqual(studioOptions({ sample: 'tote', theme: 'forest', slide: '3', tab: 'social' }), {
    sample: 'tote',
    theme: 'forest',
    slide: 3,
    tab: 'social',
  });
});
test('unknown, duplicate and out-of-range preview query values fall back to a valid workspace', () => {
  assert.deepEqual(
    studioOptions({ sample: 'missing', theme: ['forest', 'clay'], slide: '999', tab: '<script>' }),
    { sample: undefined, theme: undefined, slide: 0, tab: 'carousel' },
  );
});
