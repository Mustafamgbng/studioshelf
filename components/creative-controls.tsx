'use client';

import { AlignCenter, AlignLeft, Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { CREATIVE_LAYOUTS, defaultDesign, getDesign, mergeDesign } from '@/lib/creative';
import type { CreativeDesign, Project } from '@/lib/types';

export default function CreativeControls({
  project,
  onChange,
}: {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}) {
  const design = getDesign(project);
  const update = (patch: Partial<CreativeDesign>) =>
    onChange({ design: mergeDesign(project, patch) });
  return (
    <section className="cr-controls" aria-label="Creative direction">
      <header className="cr-heading">
        <span className="cr-heading-icon">
          <SlidersHorizontal size={15} />
        </span>
        <div>
          <h3>Creative direction</h3>
          <p>Make the whole kit feel like you.</p>
        </div>
        <button
          type="button"
          className="cr-reset"
          onClick={() => onChange({ design: defaultDesign(project.theme) })}
          aria-label="Reset creative direction"
          title="Reset creative direction"
        >
          <RotateCcw size={14} />
        </button>
      </header>

      <fieldset className="cr-fieldset">
        <legend>Layout</legend>
        <div className="cr-layouts">
          {CREATIVE_LAYOUTS.map((layout) => (
            <button
              type="button"
              key={layout.id}
              className={`cr-layout ${design.layout === layout.id ? 'is-selected' : ''}`}
              aria-pressed={design.layout === layout.id}
              aria-label={`${layout.name} layout`}
              onClick={() => update({ layout: layout.id })}
            >
              <span className={`cr-layout-art cr-layout-art-${layout.id}`} aria-hidden="true">
                <i className="cr-art-brand" />
                <i className="cr-art-title" />
                <i className="cr-art-photo" />
                <i className="cr-art-copy" />
                {design.layout === layout.id && (
                  <span className="cr-layout-check">
                    <Check size={9} />
                  </span>
                )}
              </span>
              <strong>{layout.name}</strong>
              <small>{layout.detail}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="cr-fieldset">
        <legend>Typography</legend>
        <div className="cr-segmented">
          <button
            type="button"
            className={design.typography === 'serif' ? 'is-selected cr-serif' : 'cr-serif'}
            aria-pressed={design.typography === 'serif'}
            onClick={() => update({ typography: 'serif' })}
          >
            <span>Aa</span> Editorial serif
          </button>
          <button
            type="button"
            className={design.typography === 'sans' ? 'is-selected' : ''}
            aria-pressed={design.typography === 'sans'}
            onClick={() => update({ typography: 'sans' })}
          >
            <span>Aa</span> Modern sans
          </button>
        </div>
      </fieldset>

      <div className="cr-two-up">
        <fieldset className="cr-fieldset">
          <legend>Photo framing</legend>
          <div className="cr-segmented cr-compact">
            <button
              type="button"
              className={design.imageFit === 'contain' ? 'is-selected' : ''}
              aria-pressed={design.imageFit === 'contain'}
              onClick={() => update({ imageFit: 'contain' })}
            >
              Whole photo
            </button>
            <button
              type="button"
              className={design.imageFit === 'cover' ? 'is-selected' : ''}
              aria-pressed={design.imageFit === 'cover'}
              onClick={() => update({ imageFit: 'cover' })}
            >
              Fill frame
            </button>
          </div>
        </fieldset>
        <fieldset className="cr-fieldset">
          <legend>Text alignment</legend>
          <div className="cr-segmented cr-compact">
            <button
              type="button"
              className={design.textAlign === 'left' ? 'is-selected' : ''}
              aria-pressed={design.textAlign === 'left'}
              aria-label="Align text left"
              onClick={() => update({ textAlign: 'left' })}
            >
              <AlignLeft size={15} /> Left
            </button>
            <button
              type="button"
              className={design.textAlign === 'center' ? 'is-selected' : ''}
              aria-pressed={design.textAlign === 'center'}
              aria-label="Align text center"
              onClick={() => update({ textAlign: 'center' })}
            >
              <AlignCenter size={15} /> Centre
            </button>
          </div>
        </fieldset>
      </div>

      <label className="cr-scale">
        <span>
          Photo scale <output>{design.imageScale}%</output>
        </span>
        <input
          type="range"
          min="80"
          max="120"
          step="1"
          value={design.imageScale}
          aria-label="Photo scale"
          onChange={(event) => update({ imageScale: Number(event.target.value) })}
        />
        <span className="cr-range-labels">
          <small>More space</small>
          <small>A closer look</small>
        </span>
      </label>
      <label className="cr-brand-toggle">
        <input
          type="checkbox"
          checked={design.showBrand}
          onChange={(event) => update({ showBrand: event.target.checked })}
        />
        <span>
          <strong>Show brand on artwork</strong>
          <small>Include your name and saved logo.</small>
        </span>
      </label>
      <p className="cr-footnote">
        <span /> Your changes appear in all five exported slides.
      </p>
    </section>
  );
}
