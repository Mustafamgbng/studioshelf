import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPath } from '../lib/public-path';

test('project assets gain a deployment prefix only when requested, without double prefixes', () => {
  const path = '/samples/fragrance-detail.png';
  assert.equal(
    publicPath(path, '/studioshelf-demo'),
    '/studioshelf-demo/samples/fragrance-detail.png',
  );
  assert.equal(publicPath(path, ''), path);
  assert.equal(
    publicPath(publicPath(path, '/studioshelf-demo'), '/studioshelf-demo'),
    '/studioshelf-demo/samples/fragrance-detail.png',
  );
  assert.equal(publicPath('/', '/studioshelf-demo/'), '/studioshelf-demo/');
  assert.equal(
    publicPath('/studio?sample=fragrance#editor', '/studioshelf-demo'),
    '/studioshelf-demo/studio?sample=fragrance#editor',
  );
  assert.equal(
    publicPath('/studioshelf-demo-other/image.png', '/studioshelf-demo'),
    '/studioshelf-demo/studioshelf-demo-other/image.png',
  );
});

test('uploaded photos, external resources and fragment links keep their original locations', () => {
  for (const source of [
    'data:image/png;base64,iVBORw0KGgo=',
    'blob:https://example.com/photo',
    'https://cdn.example.com/photo.png',
    'http://cdn.example.com/photo.png',
    '//cdn.example.com/photo.png',
    '#main',
    'relative/photo.png',
    '',
  ])
    assert.equal(publicPath(source, '/studioshelf-demo'), source);
  assert.equal(publicPath('/sample-mug.svg', '/nested/demo'), '/nested/demo/sample-mug.svg');
  assert.equal(publicPath('/samples/a.png', '//external.example'), '/samples/a.png');
  assert.equal(publicPath('/samples/a.png', '/..'), '/samples/a.png');
});
