import type { Branding } from './types';

export function validateBranding(value: unknown): Branding {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Check your store branding.');
  const brand = value as Record<string, unknown>;
  for (const color of ['primary', 'background', 'ink']) {
    if (typeof brand[color] !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(brand[color] as string))
      throw new Error('Choose valid six-digit brand colours.');
  }
  if (
    typeof brand.voice !== 'string' ||
    brand.voice.length > 50 ||
    typeof brand.cta !== 'string' ||
    brand.cta.length > 80
  )
    throw new Error('Keep brand voice under 50 characters and calls to action under 80.');
  if (
    brand.logo !== null &&
    (typeof brand.logo !== 'string' ||
      brand.logo.length > 350000 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(brand.logo))
  )
    throw new Error('Use a PNG, JPEG or WebP brand logo smaller than 256 KB.');
  return {
    logo: brand.logo as string | null,
    primary: brand.primary as string,
    background: brand.background as string,
    ink: brand.ink as string,
    voice: brand.voice.trim(),
    cta: brand.cta.trim(),
  };
}
