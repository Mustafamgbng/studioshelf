import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_STORAGE_KEY,
  MAX_BRAND_LOGO_BYTES,
  readSavedBrand,
  saveSavedBrand,
  validateBrandPreset,
} from '../lib/local-brand';
import { createTemplateKit } from '../lib/engine';
import { DEFAULT_PRODUCT } from '../lib/types';

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const preset = {
  name: 'Aurel',
  branding: {
    logo: png,
    primary: '#3D5BD6',
    background: '#F8F5EE',
    ink: '#14233B',
    voice: 'Elegant & editorial',
    cta: 'Discover the collection',
  },
};

test('saved brand round trips only the permitted brand fields and normalizes colours', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const saved = saveSavedBrand(
    {
      ...preset,
      apiKey: 'never-store',
      storeId: 'not-a-brand',
      branding: { ...preset.branding, apiKey: 'also-never-store' },
    },
    storage,
  );
  assert.equal(saved.branding.primary, '#3d5bd6');
  assert.deepEqual(readSavedBrand(storage), saved);
  assert.deepEqual(Object.keys(saved).sort(), ['branding', 'name']);
  assert.ok(!data.get(BRAND_STORAGE_KEY)?.includes('never-store'));
  assert.ok(!('apiKey' in saved.branding));
});

test('missing, corrupt and restricted browser storage do not prevent opening a kit', () => {
  for (const raw of [
    null,
    '{bad json',
    '[]',
    'null',
    JSON.stringify({ name: 'x', branding: {} }),
    'x'.repeat(310001),
  ]) {
    assert.equal(readSavedBrand({ getItem: () => raw }), null);
  }
  assert.equal(readSavedBrand(null), null);
  assert.equal(
    readSavedBrand({
      getItem() {
        throw new Error('Blocked storage');
      },
    }),
    null,
  );
  const kit = createTemplateKit(DEFAULT_PRODUCT),
    snapshot = structuredClone(kit);
  assert.throws(
    () =>
      saveSavedBrand(preset, {
        setItem() {
          throw new Error('Quota exceeded');
        },
      }),
    /current kit is still open/,
  );
  assert.deepEqual(kit, snapshot);
  assert.throws(() => saveSavedBrand(preset, null), /current kit is still open/);
});

test('brand defaults reject malformed colours, names and disguised or oversized logos', () => {
  for (const invalid of [
    { ...preset, name: '' },
    { ...preset, name: 'x'.repeat(81) },
    { ...preset, branding: { ...preset.branding, primary: 'red' } },
    { ...preset, branding: { ...preset.branding, background: '#123' } },
    { ...preset, branding: { ...preset.branding, logo: 'data:image/svg+xml;base64,PHN2Zz4=' } },
    { ...preset, branding: { ...preset.branding, logo: 'https://example.com/logo.png' } },
    { ...preset, branding: { ...preset.branding, logo: 'data:image/png;base64,PHN2Zz4=' } },
    { ...preset, branding: { ...preset.branding, logo: 'data:image/png;base64,a' } },
    { ...preset, branding: { ...preset.branding, voice: 'x'.repeat(51) } },
    { ...preset, branding: { ...preset.branding, cta: 'x'.repeat(81) } },
  ])
    assert.throws(() => validateBrandPreset(invalid));
  const oversized = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.alloc(MAX_BRAND_LOGO_BYTES),
  ]).toString('base64');
  assert.throws(
    () =>
      validateBrandPreset({
        ...preset,
        branding: { ...preset.branding, logo: 'data:image/png;base64,' + oversized },
      }),
    /smaller than 220 KB/,
  );
  const noLogo = validateBrandPreset({ ...preset, branding: { ...preset.branding, logo: null } });
  assert.equal(noLogo.branding.logo, null);
});

test('invalid defaults never replace a previously saved valid brand', () => {
  let raw = '';
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const first = saveSavedBrand(preset, storage);
  assert.throws(() => saveSavedBrand({ ...preset, name: '' }, storage));
  assert.deepEqual(readSavedBrand(storage), first);
});
