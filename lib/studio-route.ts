import { SAMPLE_PRODUCTS } from './samples';
import type { Theme } from './types';

export function studioOptions(params: Record<string, string | string[] | undefined>) {
  const sample =
    typeof params.sample === 'string' && SAMPLE_PRODUCTS.some((item) => item.id === params.sample)
      ? params.sample
      : undefined;
  const theme =
    typeof params.theme === 'string' &&
    ['clay', 'lilac', 'forest', 'graphite'].includes(params.theme)
      ? (params.theme as Theme)
      : undefined;
  const slide =
    typeof params.slide === 'string' && /^[0-4]$/.test(params.slide) ? Number(params.slide) : 0;
  const tab =
    typeof params.tab === 'string' &&
    ['carousel', 'listing', 'social', 'review'].includes(params.tab)
      ? (params.tab as 'carousel' | 'listing' | 'social' | 'review')
      : 'carousel';
  return { sample, theme, slide, tab };
}
