import { validateKit, validateProduct } from './engine';
import type { Project } from './types';
import { validateBranding } from './branding';
import { validateDesign } from './creative';
import { validateReview } from './review';
import { imageBudget, validateGallery, validateSlidePhotos } from './gallery';

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('studioshelf', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('projects', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error('Browser storage is unavailable. Export a backup instead.'));
  });
}
async function operation<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', mode);
    const req = action(tx.objectStore('projects'));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(new Error('Could not save in this browser. Export a backup to keep your work.'));
    };
    tx.onabort = tx.onerror;
  });
}
export const listProjects = async () =>
  (await operation<Project[]>('readonly', (s) => s.getAll())).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
export const saveProject = (project: Project) => operation('readwrite', (s) => s.put(project));
export const deleteProject = (id: string) => operation('readwrite', (s) => s.delete(id));

export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('Choose a StudioShelf project backup.');
  const p = value as Project;
  if (
    !/^[a-zA-Z0-9-]{1,60}$/.test(p.id) ||
    typeof p.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(p.updatedAt))
  )
    throw new Error('This backup has invalid project metadata.');
  if (
    !['clay', 'lilac', 'forest', 'graphite'].includes(p.theme) ||
    !['template', 'gemini'].includes(p.source)
  )
    throw new Error('This backup has an unsupported format.');
  if (
    p.image !== null &&
    (typeof p.image !== 'string' ||
      p.image.length > 1800000 ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image))
  )
    throw new Error('This backup contains an unsupported image.');
  if (p.sampleId !== undefined && !['headphones', 'fragrance', 'tote'].includes(p.sampleId))
    throw new Error('This backup contains an unsupported concept photograph.');
  const gallery = p.gallery !== undefined ? validateGallery(p.gallery) : undefined;
  const slidePhotos =
    p.slidePhotos !== undefined ? validateSlidePhotos(p.slidePhotos, gallery || []) : undefined;
  const budget = imageBudget({ image: p.image, gallery });
  if (budget.used > budget.limit)
    throw new Error(
      'These photos exceed this kit’s storage budget. Remove a photo or upload a smaller cover.',
    );
  return {
    id: p.id,
    updatedAt: p.updatedAt,
    product: validateProduct(p.product),
    kit: validateKit(p.kit),
    image: p.image,
    ...(p.sampleId ? { sampleId: p.sampleId } : {}),
    ...(gallery ? { gallery } : {}),
    ...(slidePhotos ? { slidePhotos } : {}),
    ...(p.generationBrief !== undefined
      ? { generationBrief: validateProduct(p.generationBrief) }
      : {}),
    theme: p.theme,
    source: p.source,
    ...(p.branding ? { branding: validateBranding(p.branding) } : {}),
    ...(p.design ? { design: validateDesign(p.design) } : {}),
    ...(p.review ? { review: validateReview(p.review) } : {}),
  };
}
