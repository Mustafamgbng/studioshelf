import type { Product, Project, SampleId, Theme } from './types';

export type SampleProduct = {
  id: SampleId;
  label: string;
  product: Product;
  image: string;
  theme: Theme;
};

// Original, fictional product briefs for demonstrating the complete workflow.
export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: 'headphones',
    label: 'Headphones',
    image: '/samples/headphones-photo.png',
    theme: 'graphite',
    product: {
      name: 'Studio Headphones',
      brand: 'FORM',
      category: 'Electronics',
      audience: 'Listeners who want a focused everyday setup',
      facts:
        'Over-ear headphones\nGraphite finish\nAdjustable headband\nPadded ear cushions\nIncludes a detachable audio cable',
      price: '129',
      currency: 'USD',
      voice: 'Clean & minimal',
      cta: 'Find your focus',
    },
  },
  {
    id: 'fragrance',
    label: 'Fragrance',
    image: '/samples/fragrance-photo.png',
    theme: 'clay',
    product: {
      name: 'No. 04 Eau de Parfum',
      brand: 'AUREL',
      category: 'Beauty & care',
      audience: 'People building an intentional daily fragrance ritual',
      facts:
        'Eau de parfum\n50 ml glass bottle\nNotes of bergamot, iris and cedar\nSpray applicator\nPresented in a paper box',
      price: '68',
      currency: 'USD',
      voice: 'Elegant & editorial',
      cta: 'Discover No. 04',
    },
  },
  {
    id: 'tote',
    label: 'Everyday tote',
    image: '/samples/tote-photo.png',
    theme: 'forest',
    product: {
      name: 'The Everyday Tote',
      brand: 'COMMON GOODS',
      category: 'Fashion & accessories',
      audience: 'People who carry their daily essentials in one place',
      facts:
        'Cotton canvas tote bag\nNatural ecru colour\nContrasting olive handles\nInternal slip pocket\n38 × 42 cm',
      price: '32',
      currency: 'USD',
      voice: 'Warm & thoughtful',
      cta: 'Carry what matters',
    },
  },
];

export function getSample(id?: string | null): SampleProduct {
  return SAMPLE_PRODUCTS.find((sample) => sample.id === id) || SAMPLE_PRODUCTS[0];
}

export function getSampleImage(product: Product): string | null {
  if (product.name === 'The Sunday Mug') return '/sample-mug.svg';
  return SAMPLE_PRODUCTS.find((sample) => sample.product.name === product.name)?.image || null;
}

// A selected concept belongs to the project, so editing the brief must not
// remove its photograph. Name lookup remains for older project backups.
export function getProjectImage(
  project: Pick<Project, 'image' | 'sampleId' | 'product'>,
): string | null {
  if (project.image) return project.image;
  const sample = SAMPLE_PRODUCTS.find((item) => item.id === project.sampleId);
  return sample?.image || getSampleImage(project.product);
}
