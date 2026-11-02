'use client';

import { useId, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ClipboardList,
  Copy,
  ChevronRight,
  FileText,
  FolderOpen,
  Download,
  Images,
  Mail,
  LoaderCircle,
  MessageCircle,
  Palette,
  Play,
  Plus,
} from 'lucide-react';
import { factLines } from '@/lib/engine';
import { exportSlide } from '@/lib/export';
import { getReviewProgress } from '@/lib/review';
import { getProjectImage, SAMPLE_PRODUCTS } from '@/lib/samples';
import { THEMES, type Project } from '@/lib/types';

type AssetTab = 'carousel' | 'listing' | 'social' | 'review' | 'publish';
type OverviewProps = {
  project: Project;
  saved: Project[];
  onOpenEditor: () => void;
  onSample: (id: string) => void;
  onOpenSaved: (project: Project) => void;
  onViewSaved: () => void;
  onBrand: () => void;
  onTour: () => void;
  onAsset: (tab: AssetTab, slideIndex?: number, preview?: 'email') => void;
  Preview: ComponentType<{ project: Project; index: number; small?: boolean }>;
};

function ProductPhoto({
  project,
  sizes,
  index,
}: {
  project: Project;
  sizes: string;
  index?: number;
}) {
  const src = getProjectImage(project, index);
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
  const [asset, setAsset] = useState<'artwork' | 'listing' | 'email'>('artwork');
  const [activeSlide, setActiveSlide] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const previewId = useId();
  const previewTabs = [
    { id: 'artwork', label: 'Artwork', icon: Images },
    { id: 'listing', label: 'Listing', icon: FileText },
    { id: 'email', label: 'Email', icon: Mail },
  ] as const;
  const slideIndex = Math.min(activeSlide, project.kit.slides.length - 1);
  const currentSlide = project.kit.slides[slideIndex];
  const chooseAsset = (next: typeof asset) => {
    setAsset(next);
    setExpanded(false);
    setFeedback('');
    setActionError('');
  };
  const browseAsset = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = previewTabs.findIndex((item) => item.id === asset);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % previewTabs.length;
    else if (event.key === 'ArrowLeft')
      next = (current + previewTabs.length - 1) % previewTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = previewTabs.length - 1;
    else return;
    event.preventDefault();
    chooseAsset(previewTabs[next].id);
    tabRefs.current[next]?.focus();
  };
  async function usePreview() {
    setWorking(true);
    setFeedback('');
    setActionError('');
    try {
      if (asset === 'artwork') {
        await exportSlide(project, slideIndex);
        setFeedback(`Slide ${slideIndex + 1} downloaded as a PNG.`);
      } else {
        const text =
          asset === 'listing'
            ? `${project.kit.title}\n\n${project.kit.description}`
            : `${project.kit.emailSubject}\n\n${project.kit.emailBody}`;
        await navigator.clipboard.writeText(text);
        setFeedback(
          asset === 'listing' ? 'Listing copied to clipboard.' : 'Email copied to clipboard.',
        );
      }
    } catch (error) {
      setActionError(
        asset === 'artwork'
          ? error instanceof Error
            ? error.message
            : 'The PNG could not be prepared. Try downloading again.'
          : 'Clipboard access is unavailable. Select the preview text and copy it manually.',
      );
    } finally {
      setWorking(false);
    }
  }
  function editPreview() {
    onAsset(
      asset === 'artwork' ? 'carousel' : asset === 'listing' ? 'listing' : 'social',
      slideIndex,
      asset === 'email' ? 'email' : undefined,
    );
  }
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
  const review = getReviewProgress(project);

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
        <div className="wx-hero-visual wx-workbench">
          <div className="wx-visual-heading">
            <span>YOUR KIT, IN ACTION</span>
            <span>
              <i /> {project.source === 'gemini' ? 'Gemini draft' : 'Template draft'}
            </span>
          </div>
          <div
            className="wx-workbench-tabs"
            role="tablist"
            aria-label="Explore your launch kit"
            onKeyDown={browseAsset}
          >
            {previewTabs.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${previewId}-${item.id}`}
                aria-controls={`${previewId}-panel`}
                aria-selected={asset === item.id}
                tabIndex={asset === item.id ? 0 : -1}
                onClick={() => chooseAsset(item.id)}
              >
                <item.icon size={14} /> {item.label}
              </button>
            ))}
          </div>
          <div
            className={`wx-workbench-panel wx-workbench-${asset}`}
            role="tabpanel"
            id={`${previewId}-panel`}
            aria-labelledby={`${previewId}-${asset}`}
            tabIndex={0}
          >
            {asset === 'artwork' ? (
              <>
                <div className="wx-artwork-stage">
                  <Preview project={project} index={slideIndex} />
                </div>
                <div className="wx-artwork-nav">
                  <button
                    type="button"
                    disabled={slideIndex === 0}
                    onClick={() => setActiveSlide((index) => index - 1)}
                    aria-label="Previous desk slide"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <div className="wx-artwork-dots" aria-label="Choose a desk slide">
                    {project.kit.slides.map((item, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActiveSlide(index)}
                        aria-label={`Desk slide ${index + 1}: ${item.headline}`}
                        aria-pressed={slideIndex === index}
                      >
                        <span>{index + 1}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={slideIndex === project.kit.slides.length - 1}
                    onClick={() => setActiveSlide((index) => index + 1)}
                    aria-label="Next desk slide"
                  >
                    <ArrowRight size={15} />
                  </button>
                </div>
                <p className="wx-artwork-caption">
                  <strong>
                    {slideIndex + 1} / {project.kit.slides.length}
                  </strong>{' '}
                  {currentSlide.headline}
                </p>
              </>
            ) : asset === 'listing' ? (
              <article className="wx-live-listing">
                <div className="wx-listing-intro">
                  <div className="wx-listing-photo">
                    <ProductPhoto project={project} sizes="130px" />
                  </div>
                  <div>
                    <span>{project.product.brand}</span>
                    <h3>{project.kit.title}</h3>
                    {project.product.price && (
                      <strong>
                        {project.product.currency} {project.product.price}
                      </strong>
                    )}
                  </div>
                </div>
                <div className="wx-live-copy">
                  <p>
                    {expanded || project.kit.description.length <= 230
                      ? project.kit.description
                      : `${project.kit.description.slice(0, 230).trimEnd()}…`}
                  </p>
                  {project.kit.description.length > 230 && (
                    <button type="button" onClick={() => setExpanded((value) => !value)}>
                      {expanded ? 'Show less' : 'Read full description'} <ChevronRight size={12} />
                    </button>
                  )}
                </div>
                <ul>
                  {project.kit.bullets.slice(0, 3).map((bullet, index) => (
                    <li key={index}>
                      <Check size={12} />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <p className="wx-workbench-disclosure">Listing preview · ready for your review</p>
              </article>
            ) : (
              <article className="wx-live-email">
                <div className="wx-email-heading">
                  <span>
                    <Mail size={15} /> A first introduction
                  </span>
                  <span>EMAIL DRAFT</span>
                </div>
                <div className="wx-email-meta">
                  <span>From</span>
                  <strong>{project.product.brand}</strong>
                </div>
                <div className="wx-email-meta">
                  <span>Subject</span>
                  <strong>{project.kit.emailSubject}</strong>
                </div>
                <p>{project.kit.emailBody}</p>
                <span className="wx-workbench-disclosure">
                  Your words, in context. Nothing has been sent.
                </span>
              </article>
            )}
          </div>
          <div className="wx-workbench-actions">
            <button type="button" className="wx-workbench-edit" onClick={editPreview}>
              Edit {asset === 'artwork' ? 'this slide' : asset === 'listing' ? 'listing' : 'email'}{' '}
              <ArrowUpRight size={15} />
            </button>
            <button type="button" onClick={usePreview} disabled={working}>
              {working ? (
                <LoaderCircle size={14} className="spin" />
              ) : asset === 'artwork' ? (
                <Download size={14} />
              ) : (
                <Copy size={14} />
              )}
              {working
                ? 'Preparing…'
                : asset === 'artwork'
                  ? 'Download PNG'
                  : asset === 'listing'
                    ? 'Copy listing'
                    : 'Copy email'}
            </button>
          </div>
          {feedback && (
            <p className="wx-workbench-feedback" role="status">
              <Check size={12} />
              {feedback}
            </p>
          )}
          {actionError && (
            <p className="wx-workbench-error" role="alert">
              {actionError}
            </p>
          )}
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

      <div className="ws-pack-cta">
        <span>One brief. Your shop, Instagram, WhatsApp and email.</span>
        <button onClick={() => onAsset('publish')}>
          Open your publish pack <ArrowRight size={14} />
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
              <div className="wx-mini-shop-photo">
                <ProductPhoto project={project} index={2} sizes="140px" />
              </div>
              <div className="wx-mini-shop-copy">
                <span>THE SHOP WINDOW</span>
                <strong>{project.kit.title}</strong>
                {project.product.price && (
                  <b>
                    {project.product.currency} {project.product.price}
                  </b>
                )}
                <p>{project.kit.description.slice(0, 115)}</p>
                <i>{project.product.cta}</i>
              </div>
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
              <div className="wx-mini-social-photo">
                <ProductPhoto project={project} index={1} sizes="260px" />
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
              <div className="wx-review-contact-sheet" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <div key={index}>
                    <ProductPhoto project={project} index={index} sizes="100px" />
                  </div>
                ))}
              </div>
              <span className="wx-review-pending">
                <ClipboardList size={12} />{' '}
                {review.complete
                  ? 'Your review is complete'
                  : `${review.done} of ${review.total} reviewed`}
              </span>
              <p>
                {facts.length} supplied product facts.
                <br />
                {project.kit.questions.length} checks to review before sharing.
              </p>
            </div>
            <span className="wx-asset-label">
              <ClipboardList size={17} /> Final review <ArrowUpRight size={15} />
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
