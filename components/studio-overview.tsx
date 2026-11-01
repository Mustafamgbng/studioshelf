'use client';

import type { ComponentType } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  FileText,
  FolderOpen,
  Images,
  Mail,
  MessageCircle,
  Palette,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import { factLines } from '@/lib/engine';
import { getProjectImage, SAMPLE_PRODUCTS } from '@/lib/samples';
import { THEMES, type Project } from '@/lib/types';

type AssetTab = 'carousel' | 'listing' | 'social' | 'review';
type OverviewProps = {
  project: Project;
  saved: Project[];
  onOpenEditor: () => void;
  onSample: (id: string) => void;
  onOpenSaved: (project: Project) => void;
  onViewSaved: () => void;
  onBrand: () => void;
  onTour: () => void;
  onAsset: (tab: AssetTab) => void;
  Preview: ComponentType<{ project: Project; index: number; small?: boolean }>;
};

function ProductPhoto({ project, sizes }: { project: Project; sizes: string }) {
  const src = getProjectImage(project);
  return src ? (
    <Image
      src={src}
      alt=""
      width={136}
      height={168}
      sizes={sizes}
      unoptimized={src.startsWith('data:')}
    />
  ) : (
    <span className="wx-photo-initial" aria-hidden="true">
      {project.product.brand.slice(0, 2)}
    </span>
  );
}

const savedDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
    : 'Saved kit';
};

export default function StudioOverview({
  project,
  saved,
  onOpenEditor,
  onSample,
  onOpenSaved,
  onViewSaved,
  onBrand,
  onTour,
  onAsset,
  Preview,
}: OverviewProps) {
  const channels = [project.kit.instagram, project.kit.whatsapp, project.kit.emailBody].filter(
    Boolean,
  ).length;
  const assetCount = project.kit.slides.length + channels + (project.kit.description ? 1 : 0);
  const facts = factLines(project.product);
  const palette = project.branding
    ? [project.branding.background, project.branding.ink, project.branding.primary]
    : [THEMES[project.theme].bg, THEMES[project.theme].ink, THEMES[project.theme].accent];
  const paletteName = project.branding ? 'Custom brand' : THEMES[project.theme].name;
  const recent = saved.slice(0, 3);

  return (
    <div className="wx-overview">
      <section className="wx-hero" aria-labelledby="wx-hero-title">
        <div className="wx-hero-copy">
          <span className="wx-kicker">
            <span /> YOUR CREATIVE DESK
          </span>
          <h1 id="wx-hero-title">
            A good launch
            <br />
            <em>starts here.</em>
          </h1>
          <p>
            One product. A whole introduction. Shape the words, find your look, and take a launch
            you’re proud of into the world.
          </p>
          <div className="wx-hero-actions">
            <button className="wx-button wx-button-primary" onClick={onOpenEditor}>
              Open the creative editor <ArrowRight size={16} />
            </button>
            <button className="wx-text-button" onClick={onTour}>
              <span className="wx-play-icon">
                <Play size={10} fill="currentColor" />
              </span>
              Take a quick tour
            </button>
          </div>
          <div className="wx-hero-footnote">
            <Check size={13} /> Yours to edit, from the first slide to the final caption.
          </div>
        </div>
        <div className="wx-hero-visual">
          <div className="wx-visual-heading">
            <span>ON YOUR DESK</span>
            <span>
              <i /> {project.source === 'gemini' ? 'Gemini draft' : 'Template draft'}
            </span>
          </div>
          <button
            className="wx-fan"
            onClick={onOpenEditor}
            aria-label={`Open the editable ${project.product.name} launch kit`}
          >
            <div className="wx-fan-card wx-fan-card-back">
              <Preview project={project} index={Math.min(4, project.kit.slides.length - 1)} small />
            </div>
            <div className="wx-fan-card wx-fan-card-middle">
              <Preview project={project} index={Math.min(1, project.kit.slides.length - 1)} small />
            </div>
            <div className="wx-fan-card wx-fan-card-front">
              <Preview project={project} index={0} small />
            </div>
            <span className="wx-fan-note">
              <Sparkles size={13} /> Every piece, yours to edit.
            </span>
          </button>
          <div className="wx-active-kit">
            <div>
              <small>{project.product.brand}</small>
              <strong>{project.product.name}</strong>
            </div>
            <button onClick={onOpenEditor} aria-label={`Continue editing ${project.product.name}`}>
              <ArrowUpRight size={20} />
            </button>
          </div>
        </div>
      </section>

      <div className="wx-status-strip" aria-label="Current workspace details">
        <div>
          <span className="wx-status-icon">
            <Images size={17} />
          </span>
          <strong>{assetCount}</strong>
          <span>editable assets in this kit</span>
        </div>
        <button onClick={onViewSaved}>
          <FolderOpen size={17} />
          <strong>{saved.length}</strong>
          <span>saved in this browser</span>
          <ChevronRight size={13} />
        </button>
        <button onClick={onBrand}>
          <span className="wx-palette-dots" aria-hidden="true">
            {palette.map((color, index) => (
              <i key={index} style={{ background: color }} />
            ))}
          </span>
          <span>{paletteName}</span>
          <ChevronRight size={13} />
        </button>
      </div>

      <section className="wx-section" aria-labelledby="wx-examples-title">
        <div className="wx-section-heading">
          <div>
            <span className="wx-kicker">01 / FIND YOUR STARTING POINT</span>
            <h2 id="wx-examples-title">A little inspiration. A working example.</h2>
          </div>
          <span className="wx-section-aside">Pick one. Change everything.</span>
        </div>
        <div className="wx-sample-grid">
          {SAMPLE_PRODUCTS.map((sample, index) => (
            <button
              className={`wx-sample-card wx-sample-${sample.id}`}
              key={sample.id}
              onClick={() => onSample(sample.id)}
              aria-label={`Explore the ${sample.label.toLowerCase()} launch example`}
            >
              <div className="wx-sample-photo">
                <Image
                  src={sample.image}
                  alt={`AI-generated concept photograph of ${sample.product.name}`}
                  width={640}
                  height={420}
                  sizes="(max-width: 600px) 118px, (max-width: 1000px) 40vw, 320px"
                />
                <span className="wx-sample-number">0{index + 1}</span>
                <span className="wx-sample-open" aria-hidden="true">
                  <ArrowUpRight size={19} />
                </span>
              </div>
              <div className="wx-sample-info">
                <span>{sample.product.category}</span>
                <h3>{sample.product.name}</h3>
                <p>5 story slides · listing · channel copy</p>
              </div>
            </button>
          ))}
        </div>
        <p className="wx-caption">
          Fictional products and AI concept photos. Use an example to explore, or add your own
          product in the editor.
        </p>
      </section>

      <section className="wx-section" aria-labelledby="wx-assets-title">
        <div className="wx-section-heading">
          <div>
            <span className="wx-kicker">02 / THE PIECES OF YOUR LAUNCH</span>
            <h2 id="wx-assets-title">Your launch, in one view.</h2>
          </div>
          <button className="wx-text-button" onClick={onOpenEditor}>
            Open editor <ArrowRight size={15} />
          </button>
        </div>
        <div className="wx-asset-grid">
          <button className="wx-asset-card" onClick={() => onAsset('carousel')}>
            <div className="wx-asset-visual wx-carousel-visual">
              <div className="wx-mini-slide">
                <Preview project={project} index={0} small />
              </div>
              <span className="wx-asset-count">{project.kit.slides.length} slides</span>
            </div>
            <span className="wx-asset-label">
              <Images size={17} /> Story carousel <ArrowUpRight size={15} />
            </span>
            <small>Design, edit and export your story.</small>
          </button>
          <button className="wx-asset-card" onClick={() => onAsset('listing')}>
            <div className="wx-asset-visual wx-listing-visual">
              <FileText size={16} />
              <strong>{project.kit.title}</strong>
              <p>{project.kit.description.slice(0, 155)}</p>
              <span className="wx-tiny-chips">
                {project.kit.tags.slice(0, 2).map((tag) => (
                  <i key={tag}>{tag}</i>
                ))}
              </span>
            </div>
            <span className="wx-asset-label">
              <FileText size={17} /> Product listing <ArrowUpRight size={15} />
            </span>
            <small>Give your product the right words.</small>
          </button>
          <button className="wx-asset-card" onClick={() => onAsset('social')}>
            <div className="wx-asset-visual wx-social-visual">
              <div className="wx-social-head">
                <span>{project.product.brand.slice(0, 1)}</span>
                <strong>{project.product.brand}</strong>
                <MessageCircle size={14} />
              </div>
              <p>{project.kit.instagram.slice(0, 130)}</p>
              <span className="wx-channel-labels">
                <span>Instagram</span>
                <span>WhatsApp</span>
                <span>
                  <Mail size={10} /> Email
                </span>
              </span>
            </div>
            <span className="wx-asset-label">
              <MessageCircle size={17} /> Channel copy <ArrowUpRight size={15} />
            </span>
            <small>A consistent introduction, everywhere.</small>
          </button>
          <button className="wx-asset-card wx-review-card" onClick={() => onAsset('review')}>
            <div className="wx-asset-visual wx-review-visual">
              <span className="wx-review-icon">
                <CheckCheck size={25} />
              </span>
              <strong>Your facts. Your final say.</strong>
              <p>
                {facts.length} supplied product facts.
                <br />
                {project.kit.questions.length} checks to review before sharing.
              </p>
            </div>
            <span className="wx-asset-label">
              <CheckCheck size={17} /> Final review <ArrowUpRight size={15} />
            </span>
            <small>Review the details before you publish.</small>
          </button>
        </div>
      </section>

      <div className="wx-bottom-grid">
        <section className="wx-recent-section" aria-labelledby="wx-recent-title">
          <div className="wx-recent-heading">
            <h2 id="wx-recent-title">Pick up where you left off.</h2>
            <button className="wx-text-button" onClick={onViewSaved}>
              All kits <ArrowRight size={14} />
            </button>
          </div>
          {recent.length ? (
            <div className="wx-recent-list">
              {recent.map((item) => (
                <button key={item.id} onClick={() => onOpenSaved(item)} className="wx-recent-kit">
                  <span className="wx-recent-photo">
                    <ProductPhoto project={item} sizes="68px" />
                  </span>
                  <span className="wx-recent-copy">
                    <small>{item.product.brand}</small>
                    <strong>{item.product.name}</strong>
                    <span>{savedDate(item.updatedAt)} · Saved in this browser</span>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="wx-empty-shelf">
              <span>
                <FolderOpen size={24} />
              </span>
              <div>
                <h3>Your shelf is ready for its first launch.</h3>
                <p>Explore a brief, make it yours, then save your kit in the editor.</p>
                <button className="wx-text-button" onClick={onOpenEditor}>
                  Start your first kit <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="wx-brand-callout" aria-labelledby="wx-brand-title">
          <span className="wx-kicker">A LOOK THAT FEELS LIKE YOU</span>
          <div className="wx-brand-swatches" aria-hidden="true">
            {palette.map((color, index) => (
              <span key={index} style={{ background: color }} />
            ))}
            <span>
              <Palette size={22} />
            </span>
          </div>
          <h2 id="wx-brand-title">Make a first impression. Keep it consistent.</h2>
          <p>Find a palette for your current kit and see it across every slide.</p>
          <button className="wx-text-button" onClick={onBrand}>
            Explore your visual style <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
}
