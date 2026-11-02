import { factLines } from './engine';
import type { Project } from './types';

export type ReviewRecord = { signature: string; confirmed: string[] };
export function reviewSignature(project: Project) {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, v]) => v !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, v]) => [key, canonical(v)]),
          )
        : value;
  const data = JSON.stringify(
    canonical({
      product: project.product,
      kit: project.kit,
      image: project.image,
      sampleId: project.sampleId,
      gallery: project.gallery,
      slidePhotos: project.slidePhotos,
      branding: project.branding,
      design: project.design,
      theme: project.theme,
    }),
  );
  // A change detector for the seller's checklist, not a security credential.
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619);
  return `review-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export function reviewItems(project: Project) {
  return [
    ...factLines(project.product).map((label, index) => ({
      id: `fact-${index + 1}`,
      label,
      kind: 'fact' as const,
    })),
    ...project.kit.questions.map((label, index) => ({
      id: `question-${index + 1}`,
      label,
      kind: 'question' as const,
    })),
    {
      id: 'final-copy',
      label: 'I checked the listing and channel copy for accuracy.',
      kind: 'final' as const,
    },
    {
      id: 'final-images',
      label: 'I previewed all five slides and checked image crops and text fit.',
      kind: 'final' as const,
    },
    ...(project.product.url
      ? [
          {
            id: 'final-link',
            label: 'I opened the product link and checked the destination.',
            kind: 'final' as const,
          },
        ]
      : []),
  ];
}
export function validateReview(value: unknown): ReviewRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('This backup contains an invalid review checklist.');
  const record = value as Record<string, unknown>;
  if (
    typeof record.signature !== 'string' ||
    !/^review-v1:[a-f0-9]{8}$/.test(record.signature) ||
    !Array.isArray(record.confirmed) ||
    record.confirmed.length > 100 ||
    record.confirmed.some(
      (id) =>
        typeof id !== 'string' ||
        !/^(fact-[1-9][0-9]?|question-[1-9][0-9]?|final-copy|final-images|final-link)$/.test(id),
    ) ||
    new Set(record.confirmed).size !== record.confirmed.length
  )
    throw new Error('This backup contains an invalid review checklist.');
  return { signature: record.signature, confirmed: [...record.confirmed] as string[] };
}
export function getReviewProgress(project: Project) {
  const items = reviewItems(project);
  const valid = new Set(items.map((item) => item.id));
  const signature = reviewSignature(project);
  const confirmed = new Set(
    project.review?.signature === signature
      ? project.review.confirmed.filter((id) => valid.has(id))
      : [],
  );
  return {
    items,
    signature,
    confirmed,
    done: confirmed.size,
    total: items.length,
    complete: items.length > 0 && confirmed.size === items.length,
  };
}
