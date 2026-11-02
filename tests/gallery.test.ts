import test from 'node:test';
import assert from 'node:assert/strict';
import {
  imageBudget,
  MAX_GALLERY_PHOTOS,
  MAX_GALLERY_PHOTO_CHARS,
  validateGallery,
} from '../lib/gallery';
import { getProjectImage, getSample, getSampleGallery } from '../lib/samples';
import { validateProject } from '../lib/storage';
import { createTemplateKit } from '../lib/engine';
import { drawSlide } from '../lib/export';
import { THEMES, type Project } from '../lib/types';

const jpeg = (bytes = 6) => {
  const buffer = Buffer.alloc(bytes);
  buffer[0] = 255;
  buffer[1] = 216;
  buffer[2] = 255;
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
};
const project = (): Project => {
  const sample = getSample('fragrance');
  return {
    id: 'gallery-verification',
    updatedAt: '2026-11-02T00:00:00.000Z',
    product: { ...sample.product, name: 'My fragrance' },
    generationBrief: sample.product,
    kit: createTemplateKit(sample.product),
    image: null,
    sampleId: sample.id,
    theme: sample.theme,
    source: 'template',
    gallery: getSampleGallery(sample.id),
    slidePhotos: [null, 'fragrance-detail', 'fragrance-scene', null, 'fragrance-detail'],
  };
};

test('each slide resolves its assigned photo independently while the product cover stays stable', () => {
  const original = project();
  const cover = '/samples/fragrance-photo.png';
  assert.equal(getProjectImage(original), cover);
  assert.equal(getProjectImage(original, 0), cover);
  assert.equal(getProjectImage(original, 1), '/samples/fragrance-detail.png');
  assert.equal(getProjectImage(original, 2), '/samples/fragrance-scene.png');
  assert.equal(getProjectImage(original, 4), '/samples/fragrance-detail.png');
  const uploaded = { ...original, image: jpeg() };
  assert.equal(getProjectImage(uploaded), uploaded.image);
  assert.equal(getProjectImage(uploaded, 1), '/samples/fragrance-detail.png');
  const removed = { ...original, gallery: [] };
  assert.equal(
    getProjectImage(removed, 1),
    cover,
    'stale selections safely fall back to the cover',
  );
  const noCover = { ...original, sampleId: undefined };
  assert.equal(getProjectImage(noCover), '/samples/fragrance-detail.png');
  assert.equal(getProjectImage({ ...noCover, gallery: [] }), null);
});

test('gallery backups preserve assignments and generation facts, stripping unrelated properties', () => {
  const original = project();
  const restored = validateProject(
    JSON.parse(
      JSON.stringify({
        ...original,
        gallery: original.gallery?.map((photo) => ({ ...photo, apiKey: 'do-not-store' })),
        generationBrief: { ...original.generationBrief, apiKey: 'do-not-store' },
      }),
    ),
  );
  assert.deepEqual(restored, original);
  assert.equal(getProjectImage(restored, 2), getProjectImage(original, 2));
  assert.notEqual(restored.gallery, original.gallery);
  assert.notEqual(restored.slidePhotos, original.slidePhotos);
  const second = getSampleGallery('fragrance');
  second[0].name = 'Changed by caller';
  assert.equal(getSampleGallery('fragrance')[0].name, 'Bottle detail');
  assert.deepEqual(getSampleGallery('headphones'), []);
});

test('gallery imports reject remote URLs, path tricks, disguised images and broken slide references', () => {
  const original = project();
  const photo = { id: 'uploaded-1', name: 'Front view', src: jpeg() };
  assert.deepEqual(validateGallery([photo]), [photo]);
  for (const src of [
    'https://example.com/photo.png',
    '/samples/fragrance-photo.png',
    '/samples/../fragrance-detail.png',
    '/samples/fragrance-detail.png?token=secret',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/jpeg;base64,PHN2Zy8+',
    'data:image/png;base64,/9j/AA==',
    jpeg(270000),
  ])
    assert.throws(() => validateGallery([{ ...photo, src }]));
  assert.ok(jpeg(270000).length > MAX_GALLERY_PHOTO_CHARS);
  for (const gallery of [
    [...Array(MAX_GALLERY_PHOTOS + 1)].map((_, index) => ({ ...photo, id: `image-${index}` })),
    [photo, photo],
    [{ ...photo, id: '../image' }],
    [{ ...photo, name: '' }],
  ])
    assert.throws(() => validateGallery(gallery));
  for (const slidePhotos of [
    [],
    [null, null, null, null],
    ['missing', null, null, null, null],
    [1, null, null, null, null],
  ])
    assert.throws(() => validateProject({ ...original, slidePhotos }));
  assert.throws(() => validateProject({ ...original, generationBrief: { facts: '' } }));
});

test('all embedded photos share the existing portable kit budget without charging bundled concept paths', () => {
  const original = project();
  assert.equal(imageBudget(original).used, 0);
  const legacyCover = `data:image/jpeg;base64,${'A'.repeat(1700000)}`;
  const gallery = [{ id: 'detail', name: 'My detail', src: jpeg(120000) }];
  assert.ok(imageBudget({ image: legacyCover, gallery }).used > 1800000);
  assert.throws(
    () =>
      validateProject({
        ...original,
        image: legacyCover,
        gallery,
        slidePhotos: [null, null, null, null, null],
      }),
    /storage budget/,
  );
  const compact = {
    ...original,
    image: jpeg(100000),
    gallery,
    slidePhotos: [null, 'detail', null, null, null],
  };
  const restored = validateProject(compact);
  assert.equal(imageBudget(restored).used, compact.image.length + gallery[0].src.length);
  assert.equal(imageBudget(restored).remaining, 1800000 - imageBudget(restored).used);
  assert.equal(validateProject({ ...original, image: legacyCover }).image, legacyCover);
});

test('the renderer uses the selected slide photo and blends contain framing into the campaign colour', async () => {
  const originalImage = globalThis.Image;
  class LoadedImage {
    width = 600;
    height = 900;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    currentSrc = '';
    set src(value: string) {
      this.currentSrc = value;
      queueMicrotask(() => this.onload?.());
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image;
  try {
    const pictures: string[] = [];
    const fills: string[] = [];
    const context = {
      fillStyle: '',
      font: '',
      textAlign: 'left',
      measureText: (value: string) => ({ width: value.length * 12 }),
      fillRect() {
        fills.push(String(this.fillStyle));
      },
      drawImage(image: LoadedImage) {
        pictures.push(image.currentSrc);
      },
      fillText() {},
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      clip() {},
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    await drawSlide(canvas, project(), 1);
    assert.deepEqual(pictures, ['/samples/fragrance-detail.png']);
    assert.equal(fills.length, 2);
    assert.ok(fills.every((fill) => fill === THEMES.clay.bg));
    assert.equal(
      fills.some((fill) => String(fill) === THEMES.clay.light),
      false,
    );
    assert.deepEqual([canvas.width, canvas.height], [1080, 1350]);
  } finally {
    globalThis.Image = originalImage;
  }
});
