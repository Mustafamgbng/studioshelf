import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultDesign,
  getDesign,
  imagePlacement,
  mergeDesign,
  validateDesign,
} from '../lib/creative';
import { drawSlide } from '../lib/export';
import { createTemplateKit } from '../lib/engine';
import { DEFAULT_PRODUCT, type CreativeDesign, type Project } from '../lib/types';

test('older projects keep the original palette-specific typography and framing', () => {
  assert.deepEqual(getDesign({ theme: 'clay' }), {
    layout: 'editorial',
    typography: 'serif',
    imageFit: 'contain',
    imageScale: 100,
    textAlign: 'left',
    showBrand: true,
  });
  assert.equal(getDesign({ theme: 'graphite' }).typography, 'sans');
  const first = defaultDesign();
  first.layout = 'minimal';
  assert.equal(defaultDesign().layout, 'editorial');
  assert.equal(
    getDesign({ theme: 'clay', design: { layout: 'unsupported' } as unknown as CreativeDesign })
      .layout,
    'editorial',
  );
});

test('design import rejects invalid scale, arbitrary CSS and unsupported options; unknown fields are stripped', () => {
  const good = defaultDesign();
  for (const bad of [
    null,
    [],
    { ...good, layout: 'custom' },
    { ...good, typography: 'url(unsafe)' },
    { ...good, imageFit: 'stretch' },
    { ...good, textAlign: 'right' },
    { ...good, imageScale: 79 },
    { ...good, imageScale: 121 },
    { ...good, imageScale: NaN },
    { ...good, imageScale: Infinity },
    { ...good, showBrand: 'true' },
  ])
    assert.throws(() => validateDesign(bad));
  assert.deepEqual(validateDesign({ ...good, apiKey: 'do-not-retain', css: 'arbitrary' }), good);
  assert.equal(validateDesign({ ...good, imageScale: 87.5 }).imageScale, 87.5);
});

test('changing one design setting preserves the others without mutating the current project', () => {
  const project = {
    theme: 'forest' as const,
    design: { ...defaultDesign(), layout: 'spotlight' as const, imageScale: 112 },
  };
  const snapshot = structuredClone(project);
  assert.deepEqual(mergeDesign(project, { textAlign: 'center' }), {
    ...project.design,
    textAlign: 'center',
  });
  assert.deepEqual(project, snapshot);
});

test('whole-photo and fill-frame placement preserve aspect ratio, centre the crop and respect scale', () => {
  const image = { width: 800, height: 1200 };
  const frame = { x: 100, y: 200, width: 600, height: 600 };
  assert.deepEqual(imagePlacement(image, frame, { imageFit: 'contain', imageScale: 100 }), {
    x: 200,
    y: 200,
    width: 400,
    height: 600,
  });
  assert.deepEqual(imagePlacement(image, frame, { imageFit: 'cover', imageScale: 100 }), {
    x: 100,
    y: 50,
    width: 600,
    height: 900,
  });
  const enlarged = imagePlacement(image, frame, { imageFit: 'contain', imageScale: 120 });
  assert.equal(enlarged.width / enlarged.height, 800 / 1200);
  assert.equal(enlarged.x + enlarged.width / 2, 400);
  assert.equal(enlarged.y + enlarged.height / 2, 500);
  for (const dimensions of [
    { width: 0, height: 100 },
    { width: 100, height: NaN },
  ])
    assert.throws(() =>
      imagePlacement(dimensions, frame, { imageFit: 'contain', imageScale: 100 }),
    );
});

type Rect = { x: number; y: number; width: number; height: number };
function measuredCanvas() {
  const pictures: Rect[] = [];
  const text: { value: string; box: Rect }[] = [];
  const context: Record<string, unknown> = {
    font: '10px Arial',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
  };
  const stack: Record<string, unknown>[] = [];
  const size = () => Number(String(context.font).match(/(\d+(?:\.\d+)?)px/)?.[1] || 10);
  Object.assign(context, {
    save: () =>
      stack.push({
        font: context.font,
        textAlign: context.textAlign,
        textBaseline: context.textBaseline,
        globalAlpha: context.globalAlpha,
      }),
    restore: () => Object.assign(context, stack.pop()),
    measureText: (value: string) => ({ width: value.length * size() * 0.55 }),
    fillText: (value: string, x: number, y: number) => {
      const width = value.length * size() * 0.55;
      text.push({
        value,
        box: {
          x:
            context.textAlign === 'center'
              ? x - width / 2
              : context.textAlign === 'right'
                ? x - width
                : x,
          y: context.textBaseline === 'top' ? y : y - size() * 0.8,
          width,
          height: size(),
        },
      });
    },
    roundRect: (x: number, y: number, width: number, height: number) =>
      pictures.push({ x, y, width, height }),
    fillRect: () => {},
    beginPath: () => {},
    clip: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
  });
  return {
    canvas: { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement,
    pictures,
    text,
  };
}

test('all five layouts keep maximum-length copy inside the artboard and outside product frames', async () => {
  const product = { ...DEFAULT_PRODUCT, name: 'Maximum copy verification', brand: 'A'.repeat(80) };
  const kit = createTemplateKit(product);
  kit.slides = Array.from({ length: 5 }, () => ({
    eyebrow: 'E'.repeat(80),
    headline: 'W'.repeat(100),
    body: 'B'.repeat(240),
  }));
  for (const layout of ['editorial', 'spotlight', 'minimal'] as const)
    for (const textAlign of ['left', 'center'] as const)
      for (let index = 0; index < 5; index++) {
        const project: Project = {
          id: 'bounds-check',
          updatedAt: '2026-11-01T00:00:00Z',
          product,
          kit,
          image: null,
          theme: 'clay',
          source: 'template',
          design: { ...defaultDesign(), layout, textAlign },
        };
        const { canvas, pictures, text } = measuredCanvas();
        await drawSlide(canvas, project, index);
        assert.equal(canvas.width, 1080);
        assert.equal(canvas.height, 1350);
        for (const item of text) {
          assert.ok(
            item.box.x >= 0 &&
              item.box.y >= 0 &&
              item.box.x + item.box.width <= 1080 &&
              item.box.y + item.box.height <= 1350,
            `${layout} ${index} text outside artboard: ${JSON.stringify(item)}`,
          );
          if (!/^[EWB]/.test(item.value)) continue;
          for (const photo of pictures) {
            const overlaps =
              item.box.x < photo.x + photo.width &&
              item.box.x + item.box.width > photo.x &&
              item.box.y < photo.y + photo.height &&
              item.box.y + item.box.height > photo.y;
            assert.ok(!overlaps, `${layout} ${index} copy overlaps photo: ${JSON.stringify(item)}`);
          }
        }
      }
});
