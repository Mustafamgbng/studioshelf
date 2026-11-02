import test from 'node:test';
import assert from 'node:assert/strict';
import {
  launchChecks,
  publishFiles,
  shopDescriptionHtml,
  launchEmailHtml,
  productDestination,
} from '../lib/publish';
import { getSample, getSampleGallery } from '../lib/samples';
import { createTemplateKit } from '../lib/engine';
import { studioOptions } from '../lib/studio-route';
import type { Project } from '../lib/types';
const sample = getSample('fragrance');
const base: Project = {
  id: 'publish-test',
  updatedAt: '2026-11-02T00:00:00.000Z',
  product: sample.product,
  generationBrief: sample.product,
  kit: createTemplateKit(sample.product),
  image: null,
  sampleId: 'fragrance',
  gallery: getSampleGallery('fragrance'),
  slidePhotos: [null, 'fragrance-detail', 'fragrance-scene', null, null],
  theme: 'clay',
  source: 'template',
};
test('the handoff contains five useful files from the current edited assets', () => {
  const project = {
    ...base,
    kit: { ...base.kit, instagram: 'My edited caption', emailSubject: 'My edited subject' },
  };
  const files = publishFiles(project);
  assert.equal(new Set(files.map((file) => file.filename)).size, 5);
  assert.equal(files.find((file) => file.id === 'instagram')?.content, 'My edited caption');
  assert.equal(files.find((file) => file.id === 'whatsapp')?.content, base.kit.whatsapp);
  assert.equal(files.find((file) => file.id === 'subject')?.content, 'My edited subject');
  assert.ok(files.find((file) => file.id === 'email')?.content.includes('My edited subject'));
});
test('HTML exports escape seller content and only link safe HTTPS destinations', () => {
  const product = { ...sample.product, url: 'https://example.com/products/no04?a=1&b=2' };
  const project = {
    ...base,
    product,
    kit: {
      ...createTemplateKit(product),
      title: '<script>alert(1)</script>',
      bullets: ['<img src=x onerror=alert(1)>'],
    },
  };
  const html = shopDescriptionHtml(project);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('href="https://example.com/products/no04?a=1&amp;b=2"'));
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.ok(launchEmailHtml(project).includes('<!doctype html>'));
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'http://example.com',
    'https://user:secret@example.com',
  ]) {
    assert.equal(productDestination(url), null);
    assert.ok(!shopDescriptionHtml({ ...base, product: { ...base.product, url } }).includes('<a '));
  }
});
test('launch checks point to specific missing inputs and retain freshness warnings', () => {
  const checks = launchChecks(base);
  assert.equal(checks.find((item) => item.id === 'destination')?.ready, false);
  assert.equal(checks.find((item) => item.id === 'destination')?.target, 'link');
  assert.equal(
    checks.find((item) => item.id === 'photos')?.detail,
    '3 distinct photos are used across your five slides.',
  );
  assert.equal(checks.find((item) => item.id === 'freshness')?.ready, true);
  assert.equal(checks.find((item) => item.id === 'review')?.ready, false);
  assert.equal(
    launchChecks({ ...base, product: { ...base.product, price: '99' } }).find(
      (item) => item.id === 'freshness',
    )?.ready,
    false,
  );
  assert.equal(
    launchChecks({ ...base, generationBrief: undefined }).find((item) => item.id === 'freshness')
      ?.ready,
    false,
  );
  assert.equal(studioOptions({ sample: 'fragrance', tab: 'publish' }).tab, 'publish');
});
test('destination checks inspect the actual exported copy and do not rewrite seller edits', () => {
  const product = { ...base.product, url: 'https://example.com/products/no04' };
  const kit = createTemplateKit(product);
  const project = { ...base, product, generationBrief: product, kit };
  assert.equal(launchChecks(project).find((item) => item.id === 'destination')?.ready, true);
  const edited = { ...project, kit: { ...kit, instagram: 'My edited caption without a link' } };
  const check = launchChecks(edited).find((item) => item.id === 'destination');
  assert.equal(check?.ready, false);
  assert.equal(check?.target, 'social');
  assert.ok(check?.detail.includes('3 of 4'));
  assert.equal(
    publishFiles(edited).find((file) => file.id === 'instagram')?.content,
    edited.kit.instagram,
  );
});

test('a similar product slug or query prefix never satisfies the current destination check', () => {
  for (const [destination, other] of [
    ['https://store.example/products/tote', 'https://store.example/products/tote-bag'],
    ['https://store.example/products/tote', 'https://store.example/products/tote?variant=red'],
    [
      'https://store.example/products/tote?variant=red',
      'https://store.example/products/tote?variant=red-extra',
    ],
    [
      'https://store.example/products/tote?variant=red',
      'https://store.example/products/tote?variant=red&campaign=old',
    ],
  ]) {
    const product = { ...base.product, url: destination };
    const kit = createTemplateKit(product);
    const instagram = `The seller's own caption.\n${other}`;
    const project = { ...base, product, generationBrief: product, kit: { ...kit, instagram } };
    const check = launchChecks(project).find((item) => item.id === 'destination');
    assert.equal(check?.ready, false, other);
    assert.ok(check?.detail.includes('3 of 4'), other);
    assert.equal(publishFiles(project).find((file) => file.id === 'instagram')?.content, instagram);
  }
});

test('HTML links preserve other URLs intact and add an explicit current-product call to action', () => {
  const product = { ...base.product, url: 'https://store.example/products/tote' };
  const oldLink = 'https://store.example/products/tote-bag?variant=red';
  const project = {
    ...base,
    product,
    kit: {
      ...base.kit,
      description: `Seller copy\n\n${oldLink}`,
      emailBody: `Seller email\n\n${oldLink}`,
    },
  };
  for (const html of [shopDescriptionHtml(project), launchEmailHtml(project)]) {
    assert.ok(html.includes(`<p>${oldLink}</p>`));
    assert.equal((html.match(/<a /g) || []).length, 1);
    assert.ok(html.includes(`href="${product.url}"`));
    assert.ok(!html.includes('</a>-bag'));
  }
});

test('equivalent HTTPS host and default-port forms count as the same complete URL', () => {
  const product = { ...base.product, url: 'https://store.example/products/tote' };
  const kit = createTemplateKit(product);
  const instagram = 'My edited caption\nHTTPS://STORE.EXAMPLE:443/products/tote';
  const project = { ...base, product, generationBrief: product, kit: { ...kit, instagram } };
  assert.equal(launchChecks(project).find((item) => item.id === 'destination')?.ready, true);
  assert.equal(publishFiles(project).find((file) => file.id === 'instagram')?.content, instagram);
});
