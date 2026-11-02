'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Images,
  LoaderCircle,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react';
import { readGalleryPhoto } from '@/lib/export';
import { publicPath } from '@/lib/public-path';
import { imageBudget, MAX_GALLERY_PHOTOS, validateGallery } from '@/lib/gallery';
import { getProjectImage } from '@/lib/samples';
import type { ProductPhoto, Project } from '@/lib/types';

type Props = {
  project: Project;
  slide: number;
  onChange: (patch: Partial<Project>) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

const assignments = (project: Project) =>
  Array.from({ length: 5 }, (_, index) => project.slidePhotos?.[index] ?? null);
const projectKey = (project: Project) =>
  `${project.id}\u0000${project.sampleId || ''}\u0000${project.product.name}`;
const photoName = (file: File) =>
  file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 80) || 'Product photo';

export default function ProductMedia({ project, slide, onChange, onError, onNotice }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(project);
  const request = useRef(0);
  const mounted = useRef(false);
  const owner = useRef(projectKey(project));
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  latest.current = project;
  const key = projectKey(project);
  if (owner.current !== key) {
    owner.current = key;
    request.current += 1;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, []);
  useEffect(() => {
    setBusy(false);
    setDragging(false);
    setError('');
    setUploadProgress('');
  }, [key]);

  const gallery = project.gallery || [];
  const selectedId = project.slidePhotos?.[slide] ?? null;
  const selectedPhoto = gallery.find((photo) => photo.id === selectedId);
  const cover = getProjectImage(project);
  const independentCover = getProjectImage({
    ...project,
    gallery: undefined,
    slidePhotos: undefined,
  });
  const actualCount = gallery.length + (independentCover ? 1 : 0);
  const budget = imageBudget(project);

  const fail = (message: string) => {
    setError(message);
    onError(message);
  };
  const selectPhoto = (photoId: string | null) => {
    if (busy || selectedId === photoId) return;
    const values = assignments(latest.current);
    values[slide] = photoId;
    setError('');
    onChange({ slidePhotos: values });
    onNotice(
      `${photoId ? gallery.find((photo) => photo.id === photoId)?.name || 'Photo' : 'Cover photo'} applied to slide ${slide + 1}.`,
    );
  };
  const useEverywhere = () => {
    const value = latest.current;
    const photoId = value.slidePhotos?.[slide] ?? null;
    onChange({ slidePhotos: Array(5).fill(photoId) });
    onNotice('The selected photo is now used on all five slides.');
  };
  const mixPhotos = () => {
    const value = latest.current;
    const hasCover = getProjectImage({ ...value, gallery: undefined, slidePhotos: undefined });
    const photos: (string | null)[] = [
      ...(hasCover ? [null] : []),
      ...(value.gallery || []).map((photo) => photo.id),
    ];
    if (photos.length < 2) return;
    onChange({
      slidePhotos: Array.from({ length: 5 }, (_, index) => photos[index % photos.length]),
    });
    onNotice(
      'Your photos are mixed across the five slides. Each thumbnail shows its assigned photo.',
    );
  };
  const removePhoto = () => {
    const value = latest.current;
    const photoId = value.slidePhotos?.[slide];
    if (!photoId) return;
    onChange({
      gallery: (value.gallery || []).filter((photo) => photo.id !== photoId),
      slidePhotos: assignments(value).map((assigned) => (assigned === photoId ? null : assigned)),
    });
    setError('');
    onNotice(
      'Photo removed. Slides that used it now use the cover photo. You can undo this change.',
    );
  };
  const movePhoto = (direction: -1 | 1) => {
    const value = latest.current;
    const photos = [...(value.gallery || [])];
    const index = photos.findIndex((photo) => photo.id === value.slidePhotos?.[slide]);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= photos.length) return;
    [photos[index], photos[target]] = [photos[target], photos[index]];
    onChange({ gallery: photos });
    onNotice('Photo order updated. Existing slide assignments are preserved.');
  };
  const addPhotos = async (files: File[]) => {
    if (!files.length || busy) return;
    const available = MAX_GALLERY_PHOTOS - (latest.current.gallery?.length || 0);
    if (files.length > available) {
      fail(
        available > 0
          ? `Choose up to ${available} more ${available === 1 ? 'photo' : 'photos'}. Each kit holds a cover and four additional photos.`
          : 'Your photo library is full. Remove an additional photo before adding another.',
      );
      if (input.current) input.current.value = '';
      return;
    }
    const version = ++request.current;
    const origin = owner.current;
    const targetSlide = slide;
    const active = () => mounted.current && version === request.current && origin === owner.current;
    setBusy(true);
    setError('');
    try {
      const additions: ProductPhoto[] = [];
      for (const [index, file] of files.entries()) {
        if (!active()) return;
        setUploadProgress(`Preparing photo ${index + 1} of ${files.length}…`);
        const src = await readGalleryPhoto(file);
        if (!active()) return;
        additions.push({ id: crypto.randomUUID(), src, name: photoName(file) });
      }
      const current = latest.current;
      const photos = validateGallery([...(current.gallery || []), ...additions]);
      if (imageBudget({ image: current.image, gallery: photos }).used > budget.limit)
        throw new Error(
          'These photos exceed this kit’s image limit. Remove another photo or use a smaller cover photo, then try again.',
        );
      if (!active()) return;
      const values = assignments(current);
      values[targetSlide] = additions[0].id;
      onChange({ gallery: photos, slidePhotos: values });
      onNotice(
        `${additions.length === 1 ? 'Photo added' : `${additions.length} photos added`}. ${additions[0].name} is applied to slide ${targetSlide + 1}.`,
      );
    } catch (cause) {
      if (active())
        fail(
          cause instanceof Error ? cause.message : 'These photos could not be added. Try again.',
        );
    } finally {
      if (active()) {
        setBusy(false);
        setUploadProgress('');
        if (input.current) input.current.value = '';
      }
    }
  };

  const selectedIndex = gallery.findIndex((photo) => photo.id === selectedId);
  return (
    <section className="pm-library" aria-labelledby={`${id}-title`} aria-busy={busy}>
      <header className="pm-heading">
        <span>
          <Images size={16} />
        </span>
        <div>
          <h3 id={`${id}-title`}>Your photo library</h3>
          <p>A different detail. A stronger story.</p>
        </div>
      </header>
      <div className="pm-current">
        <span>PHOTO FOR SLIDE {String(slide + 1).padStart(2, '0')}</span>
        <strong>{selectedPhoto?.name || 'Cover photo'}</strong>
      </div>
      <div className="pm-photo-grid" aria-label={`Choose a photo for slide ${slide + 1}`}>
        <button
          type="button"
          className="pm-photo"
          aria-pressed={selectedId === null}
          disabled={busy}
          onClick={() => selectPhoto(null)}
          aria-label={`Use cover photo on slide ${slide + 1}`}
        >
          <span className="pm-photo-image">
            {cover ? <img src={publicPath(cover)} alt="Product cover" /> : <Images size={22} />}
            {selectedId === null && (
              <i>
                <Check size={10} />
              </i>
            )}
            <em>Cover</em>
          </span>
          <span className="pm-photo-name">Default photo</span>
        </button>
        {gallery.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className="pm-photo"
            aria-pressed={selectedId === photo.id}
            disabled={busy}
            onClick={() => selectPhoto(photo.id)}
            aria-label={`Use ${photo.name} on slide ${slide + 1}`}
          >
            <span className="pm-photo-image">
              <img src={publicPath(photo.src)} alt={photo.name} />
              {selectedId === photo.id && (
                <i>
                  <Check size={10} />
                </i>
              )}
            </span>
            <span className="pm-photo-name" title={photo.name}>
              {photo.name}
            </span>
          </button>
        ))}
        {gallery.length < MAX_GALLERY_PHOTOS && (
          <button
            type="button"
            className="pm-add-tile"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={18} />
            <span>Add photos</span>
            <small>
              {MAX_GALLERY_PHOTOS - gallery.length}{' '}
              {MAX_GALLERY_PHOTOS - gallery.length === 1 ? 'space' : 'spaces'} left
            </small>
          </button>
        )}
      </div>
      {selectedPhoto && (
        <div className="pm-selected-tools" aria-label={`Manage ${selectedPhoto.name}`}>
          <button
            type="button"
            disabled={busy || selectedIndex === 0}
            onClick={() => movePhoto(-1)}
            aria-label={`Move ${selectedPhoto.name} earlier`}
            title="Move earlier"
          >
            <ArrowLeft size={13} />
          </button>
          <button
            type="button"
            disabled={busy || selectedIndex === gallery.length - 1}
            onClick={() => movePhoto(1)}
            aria-label={`Move ${selectedPhoto.name} later`}
            title="Move later"
          >
            <ArrowRight size={13} />
          </button>
          <button type="button" className="pm-remove" disabled={busy} onClick={removePhoto}>
            <Trash2 size={12} /> Remove photo
          </button>
        </div>
      )}
      <div className="pm-arrange-actions">
        <button
          type="button"
          disabled={busy || !getProjectImage(project, slide)}
          onClick={useEverywhere}
        >
          <Images size={13} /> Use on every slide
        </button>
        <button type="button" disabled={busy || actualCount < 2} onClick={mixPhotos}>
          <Shuffle size={13} /> Mix across slides
        </button>
      </div>
      <div className="pm-sequence" aria-label="Photo assignments across the five slides">
        {Array.from({ length: 5 }, (_, index) => {
          const src = getProjectImage(project, index);
          return (
            <span
              key={index}
              className={index === slide ? 'is-current' : ''}
              title={`Slide ${index + 1}: ${gallery.find((photo) => photo.id === project.slidePhotos?.[index])?.name || 'Cover photo'}`}
            >
              {src ? (
                <img src={publicPath(src)} alt={`Slide ${index + 1} assigned photo`} />
              ) : (
                <Images size={12} />
              )}
              <b>{index + 1}</b>
            </span>
          );
        })}
      </div>
      <div
        className={`pm-dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addPhotos(Array.from(event.dataTransfer.files));
        }}
      >
        {busy ? (
          <p role="status">
            <LoaderCircle size={13} className="spin" /> {uploadProgress || 'Preparing photos…'}
          </p>
        ) : (
          <>
            <p>Drop product photos here.</p>
            <span>JPG, PNG or WebP · up to 12 MB each</span>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          className="pm-file-input"
          tabIndex={-1}
          aria-label="Upload additional product photos"
          onChange={(event) => {
            void addPhotos(Array.from(event.target.files || []));
          }}
        />
      </div>
      {error && (
        <p className="pm-error" role="alert">
          {error}
        </p>
      )}
      <p className="pm-note">
        The cover is managed in Product brief. Photos are resized for portable saves; your original
        files stay unchanged.
      </p>
    </section>
  );
}
