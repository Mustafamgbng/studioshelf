import type { ProductPhoto, Project } from './types';

export const MAX_GALLERY_PHOTOS = 4;
export const MAX_GALLERY_PHOTO_CHARS = 360000;
export const MAX_PROJECT_IMAGE_CHARS = 1800000;

// These authored concept assets are the only non-embedded gallery sources. No
// imported backup may turn the image renderer into an arbitrary URL loader.
export const SAMPLE_GALLERY_PATHS = [
  '/samples/fragrance-detail.png',
  '/samples/fragrance-scene.png',
] as const;

function validateSource(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Choose a supported product photo.');
  if (SAMPLE_GALLERY_PATHS.includes(value as (typeof SAMPLE_GALLERY_PATHS)[number])) return value;
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || value.length > MAX_GALLERY_PHOTO_CHARS || match[2].length % 4 !== 0)
    throw new Error(
      'This gallery photo is unsupported or too large. Upload it again to resize it.',
    );
  let bytes: string;
  try {
    bytes = atob(match[2]);
  } catch {
    throw new Error('This gallery photo could not be read. Choose another photo.');
  }
  const valid =
    (match[1] === 'jpeg' &&
      bytes.charCodeAt(0) === 255 &&
      bytes.charCodeAt(1) === 216 &&
      bytes.charCodeAt(2) === 255) ||
    (match[1] === 'png' &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes.charCodeAt(index) === byte)) ||
    (match[1] === 'webp' && bytes.slice(0, 4) === 'RIFF' && bytes.slice(8, 12) === 'WEBP');
  if (!valid) throw new Error('This gallery file does not contain a supported raster photo.');
  return value;
}

export function validateGallery(value: unknown): ProductPhoto[] {
  if (!Array.isArray(value) || value.length > MAX_GALLERY_PHOTOS)
    throw new Error(`A kit supports up to ${MAX_GALLERY_PHOTOS} additional product photos.`);
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('Choose a valid product gallery.');
    const photo = entry as Record<string, unknown>;
    if (
      typeof photo.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,60}$/.test(photo.id) ||
      ids.has(photo.id)
    )
      throw new Error('Each gallery photo needs its own valid identifier.');
    if (typeof photo.name !== 'string' || !photo.name.trim() || photo.name.length > 80)
      throw new Error('Give each gallery photo a name of up to 80 characters.');
    ids.add(photo.id);
    return { id: photo.id, src: validateSource(photo.src), name: photo.name.trim() };
  });
}

export function validateSlidePhotos(value: unknown, gallery: ProductPhoto[]): (string | null)[] {
  const ids = new Set(gallery.map((photo) => photo.id));
  if (
    !Array.isArray(value) ||
    value.length !== 5 ||
    value.some((id) => id !== null && (typeof id !== 'string' || !ids.has(id)))
  )
    throw new Error('Choose an available photo for each of the five slides.');
  return value.slice();
}

export function imageBudget(project: Pick<Project, 'image' | 'gallery'>) {
  const used =
    (project.image?.length || 0) +
    (project.gallery || []).reduce(
      (sum, photo) => sum + (photo.src.startsWith('data:') ? photo.src.length : 0),
      0,
    );
  return {
    used,
    remaining: Math.max(0, MAX_PROJECT_IMAGE_CHARS - used),
    limit: MAX_PROJECT_IMAGE_CHARS,
  };
}
