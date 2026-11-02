'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  MAX_BRAND_LOGO_BYTES,
  readSavedBrand,
  saveSavedBrand,
  validateBrandPreset,
} from '@/lib/local-brand';
import { THEMES, type Branding, type Project, type Theme } from '@/lib/types';

type Props = {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};
type ColorKey = 'primary' | 'background' | 'ink';
const colorFields: { key: ColorKey; label: string; description: string }[] = [
  { key: 'primary', label: 'Accent', description: 'The details that stand out' },
  { key: 'background', label: 'Background', description: 'Your canvas colour' },
  { key: 'ink', label: 'Text', description: 'A clear, readable story' },
];

function currentBrand(project: Project): Branding {
  const palette = THEMES[project.theme];
  return {
    logo: project.branding?.logo || null,
    primary: project.branding?.primary || palette.accent,
    background: project.branding?.background || palette.bg,
    ink: project.branding?.ink || palette.ink,
    voice: project.product.voice,
    cta: project.product.cta,
  };
}

function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('This logo could not be read. Choose another image.'));
    reader.onload = () => {
      const data = String(reader.result || '');
      const image = new window.Image();
      image.onerror = () => reject(new Error('This logo could not be read. Choose another image.'));
      image.onload = () => {
        if (
          !image.naturalWidth ||
          !image.naturalHeight ||
          image.naturalWidth * image.naturalHeight > 20000000
        ) {
          reject(new Error('Resize this logo before uploading it. Keep it below 20 megapixels.'));
          return;
        }
        resolve(data);
      };
      image.src = data;
    };
    reader.readAsDataURL(file);
  });
}

export default function LocalBrandKit({ project, onChange, onNotice, onError }: Props) {
  const brand = currentBrand(project);
  const [draftColors, setDraftColors] = useState({
    primary: brand.primary,
    background: brand.background,
    ink: brand.ink,
  });
  const [hasSavedBrand, setHasSavedBrand] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(project);
  const uploadVersion = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    latest.current = project;
  }, [project]);
  useEffect(() => {
    setDraftColors({ primary: brand.primary, background: brand.background, ink: brand.ink });
  }, [brand.primary, brand.background, brand.ink]);
  useEffect(() => {
    setHasSavedBrand(!!readSavedBrand());
    return () => {
      uploadVersion.current += 1;
    };
  }, []);

  const patchBrand = (patch: Partial<Branding>) => {
    const value = latest.current;
    onChange({ branding: { ...currentBrand(value), ...patch } });
  };
  const updateColor = (key: ColorKey, value: string) => {
    setDraftColors((colors) => ({ ...colors, [key]: value }));
    if (/^#[0-9a-f]{6}$/i.test(value)) patchBrand({ [key]: value.toLowerCase() });
  };
  const finishColor = (key: ColorKey) => {
    if (!/^#[0-9a-f]{6}$/i.test(draftColors[key])) {
      setDraftColors((colors) => ({ ...colors, [key]: currentBrand(latest.current)[key] }));
      onError('Use a six-digit colour such as #3D5BD6. Your previous colour is still applied.');
    }
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    const version = ++uploadVersion.current;
    setUploading(true);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Choose a PNG, JPEG or WebP logo.');
      if (file.size > MAX_BRAND_LOGO_BYTES) throw new Error('Choose a logo smaller than 220 KB.');
      const logo = await readLogo(file);
      if (version !== uploadVersion.current) return;
      const value = latest.current;
      const branding = { ...currentBrand(value), logo };
      // Check file contents before applying it, even when its extension/type looks valid.
      validateBrandPreset({ name: value.product.brand || 'Brand preview', branding });
      onChange({ branding });
      onNotice('Logo added to this kit. Your slide previews and downloads use it.');
    } catch (error) {
      if (version === uploadVersion.current)
        onError(error instanceof Error ? error.message : 'This logo could not be uploaded.');
    } finally {
      if (version === uploadVersion.current) setUploading(false);
      if (input.current) input.current.value = '';
    }
  };
  const saveDefault = () => {
    try {
      const value = latest.current;
      saveSavedBrand({ name: value.product.brand, branding: currentBrand(value) });
      setHasSavedBrand(true);
      onNotice('Default brand saved in this browser. New blank kits will use it.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Your default brand could not be saved.');
    }
  };
  const applySaved = () => {
    const preset = readSavedBrand();
    setHasSavedBrand(!!preset);
    if (!preset) {
      onError(
        'No valid default brand is available in this browser. Save your current brand first.',
      );
      return;
    }
    onChange({
      branding: preset.branding,
      product: {
        ...latest.current.product,
        brand: preset.name,
        voice: preset.branding.voice,
        cta: preset.branding.cta,
      },
    });
    onNotice('Saved brand applied to this kit. Review existing copy after changing the brand.');
  };
  const initials =
    project.product.brand
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('') || 'Aa';

  return (
    <section className="ws-b-kit" aria-labelledby={`${id}-title`}>
      <div className="ws-b-header">
        <span className="ws-b-eyebrow">YOUR BRAND, ON REPEAT</span>
        <span className="ws-b-scope">Current kit</span>
      </div>
      <h2 id={`${id}-title`}>A look that feels like you.</h2>
      <p className="ws-b-intro">
        Your logo, colours and voice. Change them here and watch your current kit take shape.
      </p>

      <div className="ws-b-identity">
        <div
          className={`ws-b-logo-area ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void uploadLogo(event.dataTransfer.files[0]);
          }}
        >
          {brand.logo ? (
            <img src={brand.logo} alt={`${project.product.brand || 'Your brand'} logo`} />
          ) : (
            <span className="ws-b-initials">{initials}</span>
          )}
          <button
            className="ws-b-upload-logo"
            onClick={() => input.current?.click()}
            disabled={uploading}
            aria-label={brand.logo ? 'Replace brand logo' : 'Upload brand logo'}
          >
            {uploading ? <LoaderCircle size={16} className="ws-b-spin" /> : <ImagePlus size={16} />}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="ws-b-hidden"
            aria-label="Brand logo file"
            onChange={(event) => void uploadLogo(event.target.files?.[0])}
          />
        </div>
        <div className="ws-b-logo-copy">
          <strong>Your signature.</strong>
          <p>Drop a logo here, or choose a file. PNG, JPEG or WebP · up to 220 KB.</p>
          {brand.logo ? (
            <button
              className="ws-b-link"
              onClick={() => {
                patchBrand({ logo: null });
                onNotice('Logo removed from this kit.');
              }}
            >
              <X size={12} /> Remove logo
            </button>
          ) : (
            <button
              className="ws-b-link"
              onClick={() => input.current?.click()}
              disabled={uploading}
            >
              Choose a logo <ImagePlus size={12} />
            </button>
          )}
        </div>
      </div>

      <label className="ws-b-field">
        <span>Brand name</span>
        <input
          value={project.product.brand}
          maxLength={80}
          placeholder="Your brand or studio name"
          onChange={(event) =>
            onChange({ product: { ...latest.current.product, brand: event.target.value } })
          }
        />
      </label>

      <div className="ws-b-section-heading">
        <h3>Your colour story</h3>
        <span>Live across every slide</span>
      </div>
      <div className="ws-b-colors">
        {colorFields.map(({ key, label, description }) => (
          <div className="ws-b-color-row" key={key}>
            <label className="ws-b-color-picker">
              <input
                type="color"
                value={brand[key]}
                aria-label={`Choose ${label.toLowerCase()} colour`}
                onChange={(event) => updateColor(key, event.target.value)}
              />
              <span style={{ background: brand[key] }} aria-hidden="true" />
            </label>
            <div className="ws-b-color-label">
              <label htmlFor={`${id}-${key}`}>{label}</label>
              <small>{description}</small>
            </div>
            <input
              id={`${id}-${key}`}
              className="ws-b-hex"
              value={draftColors[key]}
              maxLength={7}
              spellCheck={false}
              aria-label={`${label} hex colour`}
              aria-invalid={!/^#[0-9a-f]{6}$/i.test(draftColors[key])}
              onChange={(event) => updateColor(key, event.target.value)}
              onBlur={() => finishColor(key)}
            />
          </div>
        ))}
      </div>

      <div
        className="ws-b-preview"
        style={{ background: brand.background, color: brand.ink }}
        aria-label="Brand colour preview"
      >
        <span className="ws-b-preview-kicker" style={{ color: brand.primary }}>
          A CONSIDERED INTRODUCTION
        </span>
        <strong>{project.product.brand || 'Your brand, here.'}</strong>
        <p>Your story. A familiar first impression.</p>
        <span
          className="ws-b-preview-cta"
          style={{ background: brand.primary, color: brand.background }}
        >
          {brand.cta || 'Explore the collection'}
        </span>
      </div>

      <div className="ws-b-section-heading">
        <h3>Or begin with a palette</h3>
        {project.branding && (
          <button
            className="ws-b-link"
            onClick={() => {
              onChange({ branding: undefined });
              onNotice(
                'Custom colours and logo cleared. The current palette is applied; your name, voice and call to action are preserved.',
              );
            }}
          >
            <RotateCcw size={12} /> Reset to palette
          </button>
        )}
      </div>
      <div className="ws-b-palette-grid">
        {(Object.keys(THEMES) as Theme[]).map((key) => (
          <button
            key={key}
            className={`ws-b-palette ${project.theme === key && !project.branding ? 'is-active' : ''}`}
            aria-pressed={project.theme === key && !project.branding}
            onClick={() => {
              onChange({ theme: key, branding: undefined });
              onNotice(`${THEMES[key].name} applied to this kit. Your saved default is unchanged.`);
            }}
          >
            <span
              className="ws-b-palette-art"
              style={{ background: THEMES[key].bg, color: THEMES[key].ink }}
            >
              Aa
              <span style={{ background: THEMES[key].accent }} />
              {project.theme === key && !project.branding && <Check size={12} />}
            </span>
            <span>{THEMES[key].name}</span>
          </button>
        ))}
      </div>

      <div className="ws-b-section-heading ws-b-voice-heading">
        <h3>Sound like yourself.</h3>
        <span>Used for your next generation</span>
      </div>
      <label className="ws-b-field">
        <span>Brand voice</span>
        <input
          list={`${id}-voices`}
          value={project.product.voice}
          maxLength={50}
          onChange={(event) => {
            const value = event.target.value;
            onChange({
              branding: { ...currentBrand(latest.current), voice: value },
              product: { ...latest.current.product, voice: value },
            });
          }}
          placeholder="Warm & thoughtful"
        />
        <datalist id={`${id}-voices`}>
          {['Warm & thoughtful', 'Bold & playful', 'Clean & minimal', 'Elegant & editorial'].map(
            (voice) => (
              <option key={voice} value={voice} />
            ),
          )}
        </datalist>
      </label>
      <label className="ws-b-field">
        <span>Default call to action</span>
        <input
          value={project.product.cta}
          maxLength={80}
          onChange={(event) => {
            const value = event.target.value;
            onChange({
              branding: { ...currentBrand(latest.current), cta: value },
              product: { ...latest.current.product, cta: value },
            });
          }}
          placeholder="Discover the collection"
        />
        <small>
          Your edited copy stays yours. Regenerate an asset to use a new voice or call to action.
        </small>
      </label>

      <div className="ws-b-defaults">
        <div>
          <span className="ws-b-default-icon">
            <FolderOpen size={18} />
          </span>
          <div>
            <h3>Keep your next launch familiar.</h3>
            <p>
              Save a default for new blank kits on this browser. Existing kits and examples keep
              their own look.
            </p>
          </div>
        </div>
        <div className="ws-b-default-actions">
          <button className="ws-b-save" onClick={saveDefault}>
            <ArrowDownToLine size={14} /> Save as my default
          </button>
          <button className="ws-b-apply" onClick={applySaved} disabled={!hasSavedBrand}>
            Apply saved brand
          </button>
        </div>
        <small>
          {hasSavedBrand
            ? 'A default brand is saved in this browser.'
            : 'No browser default saved yet.'}{' '}
          Your kit’s branding also travels with its project backup.
        </small>
      </div>
    </section>
  );
}
