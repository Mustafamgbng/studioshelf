import { validateBranding } from './branding';
import type { Branding } from './types';

export const BRAND_STORAGE_KEY = 'studioshelf-brand-v1';
export const MAX_BRAND_LOGO_BYTES = 220000;
export type BrandPreset = { name: string; branding: Branding };
type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function validateRasterLogo(logo: string | null) {
  if (logo === null) return;
  const match = logo.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0)
    throw new Error('Use a PNG, JPEG or WebP logo smaller than 220 KB.');
  let data: string;
  try {
    data = atob(match[2]);
  } catch {
    throw new Error('This logo could not be read. Choose another image.');
  }
  if (!data.length || data.length > MAX_BRAND_LOGO_BYTES)
    throw new Error('Use a logo smaller than 220 KB.');
  const bytes = Array.from(data.slice(0, 12), (char) => char.charCodeAt(0));
  const valid =
    (match[1] === 'png' &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) ||
    (match[1] === 'jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
    (match[1] === 'webp' && data.slice(0, 4) === 'RIFF' && data.slice(8, 12) === 'WEBP');
  if (!valid) throw new Error('This file does not contain a supported raster logo.');
}

export function validateBrandPreset(value: unknown): BrandPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Choose a valid saved brand.');
  const preset = value as Record<string, unknown>;
  if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80)
    throw new Error('Add a brand name of up to 80 characters before saving a default.');
  const branding = validateBranding(preset.branding);
  validateRasterLogo(branding.logo);
  return {
    name: preset.name.trim(),
    branding: {
      ...branding,
      primary: branding.primary.toLowerCase(),
      background: branding.background.toLowerCase(),
      ink: branding.ink.toLowerCase(),
    },
  };
}

export function readSavedBrand(storage: ReadStorage | null = browserStorage()): BrandPreset | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(BRAND_STORAGE_KEY);
    if (!raw || raw.length > 310000) return null;
    return validateBrandPreset(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSavedBrand(
  value: unknown,
  storage: WriteStorage | null = browserStorage(),
): BrandPreset {
  const preset = validateBrandPreset(value);
  try {
    if (!storage) throw new Error('Storage is unavailable.');
    storage.setItem(BRAND_STORAGE_KEY, JSON.stringify(preset));
  } catch {
    throw new Error(
      'Your browser could not save a default brand. Your current kit is still open. Download a backup to keep its branding.',
    );
  }
  return preset;
}
