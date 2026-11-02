'use client';
import { publicPath } from '@/lib/public-path';
import { Check, ClipboardCheck, ArrowRight, ExternalLink } from 'lucide-react';
import type { Project } from '@/lib/types';
import { getReviewProgress } from '@/lib/review';
import { getProjectImage } from '@/lib/samples';

export default function KitReview({
  project,
  onChange,
  onSlide,
  stale,
}: {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
  onSlide: (index: number) => void;
  stale: boolean;
}) {
  const progress = getReviewProgress(project);
  function toggle(id: string) {
    const confirmed = new Set(progress.confirmed);
    if (confirmed.has(id)) confirmed.delete(id);
    else confirmed.add(id);
    onChange({ review: { signature: progress.signature, confirmed: [...confirmed] } });
  }
  return (
    <section className="kr-review">
      <div className="kr-heading">
        <ClipboardCheck size={24} />
        <div>
          <span className="eyebrow">YOUR FINAL PASS</span>
          <h3>A launch you can stand behind.</h3>
          <p>
            Check the details yourself. Your review is saved with this kit and resets when its
            content or design changes.
          </p>
        </div>
      </div>
      <div className="kr-progress">
        <strong>
          {progress.done} of {progress.total} checked
        </strong>
        <span>{progress.complete ? 'Your review is complete' : 'Awaiting your review'}</span>
        <progress max={progress.total} value={progress.done} aria-label="Seller review progress" />
      </div>
      {stale && (
        <p className="alert" role="status">
          Your product brief has changed. Refresh or update the affected copy before finishing your
          review.
        </p>
      )}
      <div className="kr-photos" aria-label="Review each slide">
        {project.kit.slides.map((item, index) => (
          <button
            key={index}
            onClick={() => onSlide(index)}
            aria-label={`Review slide ${index + 1}: ${item.headline}`}
          >
            <span>
              {getProjectImage(project, index) ? (
                <img src={publicPath(getProjectImage(project, index)!)} alt="" />
              ) : (
                <span>No photo</span>
              )}
            </span>
            <small>{String(index + 1).padStart(2, '0')}</small>
            <ArrowRight size={12} />
          </button>
        ))}
      </div>
      {(['fact', 'question', 'final'] as const).map((kind) => (
        <fieldset key={kind}>
          <legend>
            {kind === 'fact'
              ? 'Confirm your product facts'
              : kind === 'question'
                ? 'Resolve these questions'
                : 'Review the final assets'}
          </legend>
          {progress.items
            .filter((item) => item.kind === kind)
            .map((item) => (
              <label key={item.id} className={progress.confirmed.has(item.id) ? 'is-checked' : ''}>
                <input
                  type="checkbox"
                  checked={progress.confirmed.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span className="kr-check" aria-hidden="true">
                  {progress.confirmed.has(item.id) && <Check size={13} />}
                </span>
                <span>{item.label}</span>
              </label>
            ))}
        </fieldset>
      ))}
      {project.product.url && (
        <a href={project.product.url} target="_blank" rel="noreferrer">
          Open product destination <ExternalLink size={13} />
        </a>
      )}
      <p className="kr-note">
        These are your confirmations, not independent verification. Downloading a kit does not
        publish it to any account.
      </p>
    </section>
  );
}
