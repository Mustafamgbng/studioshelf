import type { CreativeDesign, Project, Theme } from './types';

export const CREATIVE_LAYOUTS = [
  { id: 'editorial', name: 'Editorial', detail: 'A considered story' },
  { id: 'spotlight', name: 'Spotlight', detail: 'Product takes the stage' },
  { id: 'minimal', name: 'Gallery', detail: 'Room to breathe' },
] as const;

export function defaultDesign(theme: Theme = 'clay'): CreativeDesign {
  return {
    layout: 'editorial',
    typography: theme === 'graphite' ? 'sans' : 'serif',
    imageFit: 'contain',
    imageScale: 100,
    textAlign: 'left',
    showBrand: true,
  };
}

export function validateDesign(value: unknown): CreativeDesign {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Choose a supported creative direction.');
  const design = value as Record<string, unknown>;
  if (
    !['editorial', 'spotlight', 'minimal'].includes(design.layout as string) ||
    !['serif', 'sans'].includes(design.typography as string) ||
    !['contain', 'cover'].includes(design.imageFit as string) ||
    !['left', 'center'].includes(design.textAlign as string) ||
    typeof design.showBrand !== 'boolean' ||
    typeof design.imageScale !== 'number' ||
    !Number.isFinite(design.imageScale) ||
    design.imageScale < 80 ||
    design.imageScale > 120
  )
    throw new Error('Check the design options. Image scale must be between 80% and 120%.');
  return {
    layout: design.layout as CreativeDesign['layout'],
    typography: design.typography as CreativeDesign['typography'],
    imageFit: design.imageFit as CreativeDesign['imageFit'],
    imageScale: design.imageScale,
    textAlign: design.textAlign as CreativeDesign['textAlign'],
    showBrand: design.showBrand,
  };
}

export function getDesign(project: Pick<Project, 'design' | 'theme'>): CreativeDesign {
  if (project.design) {
    try {
      return validateDesign(project.design);
    } catch {
      // Imported projects are strictly validated at the boundary. This fallback also
      // keeps older or incomplete server records renderable without a broken canvas.
    }
  }
  return defaultDesign(project.theme);
}

export function mergeDesign(
  project: Pick<Project, 'design' | 'theme'>,
  patch: Partial<CreativeDesign>,
): CreativeDesign {
  return validateDesign({ ...getDesign(project), ...patch });
}

export function imagePlacement(
  image: { width: number; height: number },
  frame: { x: number; y: number; width: number; height: number },
  design: Pick<CreativeDesign, 'imageFit' | 'imageScale'>,
) {
  if (
    !Number.isFinite(image.width) ||
    !Number.isFinite(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  )
    throw new Error('This image has invalid dimensions.');
  const fit = design.imageFit === 'cover' ? Math.max : Math.min;
  const scale =
    fit(frame.width / image.width, frame.height / image.height) * (design.imageScale / 100);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  };
}
