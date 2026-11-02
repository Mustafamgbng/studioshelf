'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  LoaderCircle,
  Mail,
  MessageCircle,
  PencilLine,
  Sparkles,
} from 'lucide-react';
import BrandLogo from '@/components/brand-logo';
import ThemeToggle from '@/components/theme-toggle';
import { getSample, getSampleGallery, SAMPLE_PRODUCTS } from '@/lib/samples';
import { createTemplateKit, factLines } from '@/lib/engine';
import { drawSlide, exportSlide } from '@/lib/export';
import { THEMES, type Project, type Theme } from '@/lib/types';

type PreviewTab = 'carousel' | 'listing' | 'social';
type Channel = 'instagram' | 'whatsapp' | 'email';
const previewTabs = [
  { id: 'carousel' as const, label: 'Carousel', icon: ImageIcon },
  { id: 'listing' as const, label: 'Listing', icon: FileText },
  { id: 'social' as const, label: 'Captions', icon: MessageCircle },
];
const slideLabels = [
  'The introduction',
  'The details',
  'A closer look',
  'Your story',
  'The invitation',
];

function LiveSlide({ project, index }: { project: Project; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError(false);
    const offscreen = document.createElement('canvas');
    drawSlide(offscreen, project, index)
      .then(() => {
        if (!active || !ref.current) return;
        ref.current.width = offscreen.width;
        ref.current.height = offscreen.height;
        ref.current.getContext('2d')?.drawImage(offscreen, 0, 0);
        setReady(true);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [project, index]);
  return (
    <div className="ed-play-artboard" aria-busy={!ready && !error}>
      <canvas
        ref={ref}
        width={1080}
        height={1350}
        data-ready={ready}
        role="img"
        aria-label={`Sample slide ${index + 1}: ${project.kit.slides[index].headline}`}
      />
      {!ready && (
        <div className="ed-play-render-state">
          {error ? (
            <span>This image could not load. Open the studio to try another photo.</span>
          ) : (
            <>
              <LoaderCircle size={19} />
              <span>Rendering your slide…</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const workflow = [
  {
    title: 'Start with your product.',
    text: 'Add a photo and the facts you know. Materials, features, dimensions — the details that make it yours.',
    icon: ImageIcon,
  },
  {
    title: 'Find the right words and look.',
    text: 'Create your draft, choose a visual direction, and edit every word. Use templates or connect your own Gemini key.',
    icon: PencilLine,
  },
  {
    title: 'Take your launch with you.',
    text: 'Download five story slides, your listing, channel copy, and an editable project. Ready for your final review.',
    icon: ArrowDownToLine,
  },
];

export default function EditorialHome() {
  const [selected, setSelected] = useState('fragrance');
  const [previewTab, setPreviewTab] = useState<PreviewTab>('carousel');
  const [previewTheme, setPreviewTheme] = useState<Theme>('clay');
  const [previewSlide, setPreviewSlide] = useState(0);
  const [channel, setChannel] = useState<Channel>('instagram');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sample = getSample(selected);
  const kit = useMemo(() => createTemplateKit(sample.product), [sample]);
  const facts = factLines(sample.product);
  const project = useMemo<Project>(
    () => ({
      id: `preview-${sample.id}`,
      updatedAt: '2026-01-01T00:00:00.000Z',
      product: sample.product,
      kit,
      image: null,
      sampleId: sample.id,
      gallery: getSampleGallery(sample.id),
      slidePhotos:
        sample.id === 'fragrance'
          ? [null, 'fragrance-detail', 'fragrance-scene', 'fragrance-detail', 'fragrance-scene']
          : undefined,
      theme: previewTheme,
      source: 'template',
    }),
    [sample, kit, previewTheme],
  );
  const studioHref = `/studio?sample=${sample.id}&theme=${previewTheme}&slide=${previewSlide}&tab=${previewTab}`;
  const feedbackKey = `${sample.id}:${previewTheme}:${previewSlide}:${previewTab}:${channel}`;
  const activeFeedback = useRef(feedbackKey);
  activeFeedback.current = feedbackKey;
  const channelText =
    channel === 'email' ? `Subject: ${kit.emailSubject}\n\n${kit.emailBody}` : kit[channel];
  const copyLabel =
    previewTab === 'carousel'
      ? 'slide copy'
      : previewTab === 'listing'
        ? 'listing'
        : channel === 'email'
          ? 'email'
          : 'caption';

  function clearFeedback() {
    setCopied(false);
    setCopyError('');
    setDownloaded(false);
  }

  function selectTab(tab: PreviewTab) {
    setPreviewTab(tab);
    clearFeedback();
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    const current = previewTabs.findIndex((tab) => tab.id === previewTab);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % previewTabs.length;
    else if (event.key === 'ArrowLeft')
      next = (current + previewTabs.length - 1) % previewTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = previewTabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(previewTabs[next].id);
    tabRefs.current[next]?.focus();
  }

  async function copyPreview() {
    const requestKey = feedbackKey;
    try {
      const slide = kit.slides[previewSlide];
      const value =
        previewTab === 'carousel'
          ? `${slide.eyebrow}\n${slide.headline}\n\n${slide.body}`
          : previewTab === 'listing'
            ? `${kit.title}\n\n${kit.description}`
            : channelText;
      await navigator.clipboard.writeText(value);
      if (activeFeedback.current === requestKey) {
        setCopied(true);
        setCopyError('');
      }
    } catch {
      if (activeFeedback.current === requestKey)
        setCopyError('Open the editor to select and copy the text.');
    }
  }

  async function downloadPreview() {
    const requestKey = feedbackKey;
    setDownloading(true);
    setDownloaded(false);
    setCopyError('');
    try {
      await exportSlide(project, previewSlide);
      if (activeFeedback.current === requestKey) setDownloaded(true);
    } catch {
      if (activeFeedback.current === requestKey)
        setCopyError('The download could not finish. Try again or open the full studio.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="ed-site" id="home">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="ed-header">
        <Link href="/" className="ed-brand" aria-label="StudioShelf home">
          <BrandLogo size={35} />
          <span>
            Studio<span>Shelf</span>
          </span>
        </Link>
        <span className="ed-header-note">Good products deserve a good introduction.</span>
        <div className="ed-header-actions">
          <ThemeToggle />
          <Link href="/shopify">Shopify app</Link>
          <Link href="/studio" className="ed-standalone-link">
            Open studio <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <main id="main" className="ed-main">
        <section className="ed-hero" aria-labelledby="hero-title">
          <div className="ed-hero-copy">
            <span className="ed-kicker">
              <i /> YOUR INDEPENDENT LAUNCH STUDIO
            </span>
            <h1 id="hero-title">
              One product.
              <br />
              <em>A whole launch.</em>
            </h1>
            <p>
              Start with your product facts and photos. Leave with coordinated artwork, shop HTML,
              Instagram and WhatsApp copy, and a launch email—all from the same brief.
            </p>
            <div className="ed-hero-actions">
              <Link href={studioHref} className="ed-button ed-button-primary">
                Build my launch pack <ArrowRight size={16} />
              </Link>
              <a href="#preview" className="ed-button ed-button-outline">
                Try a live preview
              </a>
            </div>
            <span className="ed-free-note">
              <span /> Free to try. No account or API key needed.
            </span>
          </div>
          <div className="ed-hero-art" aria-label="Product launch composition">
            <span className="ed-art-caption">FROM YOUR CREATIVE DESK</span>
            <div className="ed-paper">
              <div className="ed-paper-head">
                <BrandLogo size={20} />
                <span>A PRODUCT NOTE</span>
                <i>01</i>
              </div>
              <div className="ed-hero-photo">
                <Image
                  src={sample.image}
                  alt={`AI-generated concept photograph: ${sample.product.name}`}
                  fill
                  sizes="(max-width: 600px) 260px, 345px"
                  fetchPriority="high"
                  loading="eager"
                />
              </div>
              <div className="ed-paper-copy">
                <span>{sample.product.brand}</span>
                <h2>{sample.product.name}</h2>
                <p>{facts[0]}</p>
              </div>
            </div>
            <div className="ed-floating-tag">
              <Sparkles size={17} /> Your voice, every channel.
            </div>
            <div className="ed-note-card">
              <PencilLine size={20} />
              <strong>
                A launch,
                <br />
                ready to share.
              </strong>
              <span>Copy. Design. Make it yours.</span>
            </div>
            <span className="ed-art-footer">A CLEARER FIRST IMPRESSION.</span>
          </div>
        </section>

        <div className="ed-facts-strip">
          <span>
            <strong>5</strong> editable story slides
          </span>
          <span>
            <strong>4</strong> channels from one brief
          </span>
          <span>
            <Check size={13} /> Ready-to-use downloads
          </span>
          <span>
            <Check size={13} /> Your photos. Your final say.
          </span>
        </div>

        <section className="ed-outcomes" aria-label="Why use StudioShelf">
          <div>
            <span>01 / LESS STARTING OVER</span>
            <h3>One brief, every piece.</h3>
            <p>
              Your product details stay together across the listing, captions, email and five
              slides. Edit each asset without rebuilding the rest.
            </p>
          </div>
          <div>
            <span>02 / A USEFUL FINAL PASS</span>
            <h3>Catch the missing details.</h3>
            <p>
              Find a missing product link, outdated copy or unfinished review before handing off
              your launch.
            </p>
          </div>
          <div>
            <span>03 / YOUR WORK LEAVES WITH YOU</span>
            <h3>Take the actual files.</h3>
            <p>
              Download PNGs, shop and email HTML, channel text and your editable backup. Templates
              work without an account or API key.
            </p>
            <Link href="/studio?sample=fragrance&tab=publish">
              Explore a real publish pack <ArrowRight size={13} />
            </Link>
          </div>
        </section>
        <section className="ed-examples" id="examples" aria-labelledby="examples-title">
          <div className="ed-section-heading">
            <div>
              <span className="ed-kicker">01 / THE POSSIBILITIES</span>
              <h2 id="examples-title">
                For whatever
                <br />
                <em>you’re making.</em>
              </h2>
            </div>
            <p>
              A new collection. Your side project. The thing you finally finished. Start with an
              example, then make it your own.
            </p>
          </div>
          <div className="ed-product-grid">
            {SAMPLE_PRODUCTS.map((item, index) => (
              <Link href={`/studio?sample=${item.id}`} className="ed-product-card" key={item.id}>
                <div className="ed-product-image">
                  <Image
                    src={item.image}
                    alt={`AI-generated concept photograph: ${item.product.name}`}
                    fill
                    sizes="(max-width: 600px) calc(100vw - 44px), (max-width: 1240px) 30vw, 360px"
                    loading="lazy"
                  />
                  <span className="ed-product-index">0{index + 1}</span>
                  <span className="ed-product-link">
                    <ArrowUpRight size={19} />
                  </span>
                </div>
                <div className="ed-product-meta">
                  <span>{item.product.category}</span>
                  <h3>{item.product.name}</h3>
                  <p>
                    Explore this launch <ArrowRight size={13} />
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <p className="ed-concept-note">
            Fictional products, photographed with AI for demonstration. Your own product photos work
            here too.
          </p>
        </section>

        <section id="workflow" className="ed-workflow" aria-labelledby="workflow-title">
          <div className="ed-workflow-intro">
            <span className="ed-kicker">02 / THE WORKFLOW</span>
            <h2 id="workflow-title">
              Less blank canvas.
              <br />
              <em>More ready to go.</em>
            </h2>
            <p>
              The pieces of a good launch belong together. Keep your product details, your copy, and
              your creative direction on the same shelf.
            </p>
            <Link href="/studio" className="ed-text-link">
              Step inside the studio <ArrowRight size={15} />
            </Link>
          </div>
          <ol className="ed-steps">
            {workflow.map((step, i) => (
              <li key={step.title}>
                <span className="ed-step-number">0{i + 1}</span>
                <div>
                  <step.icon size={22} strokeWidth={1.5} />
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ed-workbench" id="preview" aria-labelledby="preview-title">
          <div className="ed-section-heading">
            <div>
              <span className="ed-kicker">03 / YOUR FIRST LOOK, HANDS ON</span>
              <h2 id="preview-title">
                One product.
                <br />
                <em>A whole introduction.</em>
              </h2>
            </div>
            <p>
              Pick a product. Try a palette. Browse the copy and download a real slide. Then take
              your choices into the studio.
            </p>
          </div>
          <div className="ed-example-picker" role="group" aria-label="Choose a product preview">
            {SAMPLE_PRODUCTS.map((item) => (
              <button
                key={item.id}
                aria-pressed={selected === item.id}
                className={selected === item.id ? 'active' : ''}
                onClick={() => {
                  setSelected(item.id);
                  setPreviewTheme(item.theme);
                  setPreviewSlide(0);
                  clearFeedback();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="ed-playground">
            <div className="ed-play-window">
              <span className="ed-play-window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>YOUR LAUNCH / LIVE PREVIEW</span>
              <span className="ed-play-template">
                <span />
                Template example
              </span>
            </div>
            <div className="ed-play-layout">
              <aside className="ed-play-brief" aria-label="Example product brief">
                <span className="ed-play-overline">THE PRODUCT</span>
                <div className="ed-play-product-image">
                  <Image
                    src={sample.image}
                    alt={`Concept product: ${sample.product.name}`}
                    fill
                    sizes="(max-width: 600px) 110px, 265px"
                    loading="lazy"
                  />
                </div>
                <div className="ed-play-product-info">
                  <span>{sample.product.brand}</span>
                  <h3>{sample.product.name}</h3>
                  <p>
                    {sample.product.currency} {sample.product.price}
                    <span> / example price</span>
                  </p>
                </div>
                <div className="ed-play-brief-facts">
                  <span className="ed-play-overline">WHAT WE KNOW</span>
                  <ul>
                    {facts.map((fact) => (
                      <li key={fact}>
                        <Check size={12} />
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="ed-play-input-note">
                  <ShieldNote />
                  The draft uses these facts. Your own product details are editable in the studio.
                </p>
              </aside>
              <div className="ed-play-output">
                <div
                  className="ed-play-tabs"
                  role="tablist"
                  aria-label="Sample launch assets"
                  onKeyDown={navigateTabs}
                >
                  {previewTabs.map((tab, index) => (
                    <button
                      key={tab.id}
                      id={`home-preview-tab-${tab.id}`}
                      ref={(element) => {
                        tabRefs.current[index] = element;
                      }}
                      role="tab"
                      aria-selected={previewTab === tab.id}
                      aria-controls="home-preview-panel"
                      tabIndex={previewTab === tab.id ? 0 : -1}
                      onClick={() => selectTab(tab.id)}
                    >
                      <tab.icon size={15} />
                      {tab.label}
                      <span>
                        {tab.id === 'carousel' ? '05' : tab.id === 'social' ? '03' : '01'}
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  className={`ed-play-panel ed-play-panel-${previewTab}`}
                  id="home-preview-panel"
                  role="tabpanel"
                  aria-labelledby={`home-preview-tab-${previewTab}`}
                  tabIndex={0}
                >
                  {previewTab === 'carousel' && (
                    <>
                      <div className="ed-play-design-bar">
                        <div
                          className="ed-play-swatches"
                          role="group"
                          aria-label="Preview colour palette"
                        >
                          {(Object.keys(THEMES) as Theme[]).map((theme) => (
                            <button
                              key={theme}
                              aria-label={`${THEMES[theme].name} preview palette`}
                              aria-pressed={previewTheme === theme}
                              style={{ background: THEMES[theme].bg, color: THEMES[theme].ink }}
                              onClick={() => {
                                setPreviewTheme(theme);
                                clearFeedback();
                              }}
                            >
                              {previewTheme === theme && <Check size={13} />}
                            </button>
                          ))}
                        </div>
                        <span>{THEMES[previewTheme].name}</span>
                        <span>1080 × 1350</span>
                      </div>
                      <div className="ed-play-canvas-stage">
                        <LiveSlide
                          key={`${sample.id}:${previewTheme}:${previewSlide}`}
                          project={project}
                          index={previewSlide}
                        />
                      </div>
                      <div className="ed-play-slide-nav">
                        <button
                          aria-label="Previous sample slide"
                          disabled={previewSlide === 0}
                          onClick={() => {
                            setPreviewSlide((value) => value - 1);
                            clearFeedback();
                          }}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <div>
                          <strong>{slideLabels[previewSlide]}</strong>
                          <span>Slide {previewSlide + 1} of 5</span>
                        </div>
                        <button
                          aria-label="Next sample slide"
                          disabled={previewSlide === 4}
                          onClick={() => {
                            setPreviewSlide((value) => value + 1);
                            clearFeedback();
                          }}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                      <div
                        className="ed-play-slide-dots"
                        role="group"
                        aria-label="Choose a sample slide"
                      >
                        {kit.slides.map((slide, index) => (
                          <button
                            key={index}
                            aria-label={`Preview slide ${index + 1}: ${slideLabels[index]}`}
                            aria-pressed={previewSlide === index}
                            onClick={() => {
                              setPreviewSlide(index);
                              clearFeedback();
                            }}
                          >
                            <span />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {previewTab === 'listing' && (
                    <div className="ed-play-listing">
                      <div className="ed-play-document-head">
                        <FileText size={19} />
                        <span>PRODUCT LISTING</span>
                        <span>Editable draft</span>
                      </div>
                      <h3>{sample.product.name}</h3>
                      <p className="ed-play-listing-brand">By {sample.product.brand}</p>
                      <div className="ed-play-listing-body">{kit.description}</div>
                      <div className="ed-play-keywords">
                        <span>KEYWORD IDEAS</span>
                        <div>
                          {kit.tags.slice(0, 5).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      <p className="ed-play-review-note">
                        Your wording, your final review. Keyword ideas are not search-volume data.
                      </p>
                    </div>
                  )}
                  {previewTab === 'social' && (
                    <div className="ed-play-social">
                      <div
                        className="ed-play-channel-picker"
                        role="group"
                        aria-label="Preview a channel draft"
                      >
                        {(['instagram', 'whatsapp', 'email'] as Channel[]).map((item) => (
                          <button
                            key={item}
                            aria-pressed={channel === item}
                            onClick={() => {
                              setChannel(item);
                              clearFeedback();
                            }}
                          >
                            {item === 'email'
                              ? 'Launch email'
                              : item === 'whatsapp'
                                ? 'WhatsApp'
                                : 'Instagram'}
                          </button>
                        ))}
                      </div>
                      <div className={`ed-play-message ed-play-message-${channel}`}>
                        <div className="ed-play-message-head">
                          <span className="ed-play-message-avatar">
                            {sample.product.brand.slice(0, 1)}
                          </span>
                          <div>
                            <strong>{sample.product.brand}</strong>
                            <span>
                              {channel === 'email'
                                ? 'A launch note to your subscribers'
                                : channel === 'whatsapp'
                                  ? 'A message for your customers'
                                  : 'A caption for your next introduction'}
                            </span>
                          </div>
                          {channel === 'email' ? <Mail size={18} /> : <MessageCircle size={18} />}
                        </div>
                        {channel === 'instagram' && (
                          <div className="ed-play-social-image">
                            <Image
                              src={sample.image}
                              alt={`Example post photograph: ${sample.product.name}`}
                              fill
                              sizes="(max-width: 600px) 280px, 400px"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="ed-play-message-body">
                          {channel === 'email' && (
                            <strong className="ed-play-email-subject">{kit.emailSubject}</strong>
                          )}
                          {channel === 'email' ? kit.emailBody : channelText}
                        </div>
                        <div className="ed-play-message-footer">
                          <span>{channelText.length} characters</span>
                          <span>Draft · not published</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="ed-play-actions">
                  <Link href={studioHref} className="ed-button ed-button-primary">
                    Edit this kit <ArrowRight size={14} />
                  </Link>
                  {previewTab === 'carousel' ? (
                    <button
                      className="ed-play-secondary"
                      onClick={downloadPreview}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <LoaderCircle size={15} className="ed-play-spin" />
                      ) : downloaded ? (
                        <Check size={15} />
                      ) : (
                        <ArrowDownToLine size={15} />
                      )}{' '}
                      {downloading
                        ? 'Preparing PNG…'
                        : downloaded
                          ? 'Downloaded'
                          : 'Download this slide'}
                    </button>
                  ) : (
                    <button className="ed-play-secondary" onClick={copyPreview}>
                      {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
                      {copied ? 'Copied' : `Copy ${copyLabel}`}
                    </button>
                  )}
                </div>
                <p className={`ed-play-status ${copyError ? 'has-error' : ''}`} role="status">
                  {copyError ||
                    (downloaded
                      ? 'Your 1080 × 1350 PNG is ready to use.'
                      : copied
                        ? `${copyLabel[0].toUpperCase() + copyLabel.slice(1)} copied to clipboard.`
                        : 'Your product, palette and selected asset carry into the editor.')}
                </p>
              </div>
            </div>
          </div>
          <p className="ed-playground-note">
            This is a working template example. No account, API key, or AI call is needed to explore
            it.
          </p>
        </section>

        <section className="ed-faq" aria-labelledby="faq-title">
          <div>
            <span className="ed-kicker">A FEW USEFUL DETAILS</span>
            <h2 id="faq-title">
              Before you
              <br />
              <em>get started.</em>
            </h2>
          </div>
          <div className="ed-faq-list">
            <details>
              <summary>
                Do I need an API key?
                <PlusMark />
              </summary>
              <p>
                No. Template mode creates a complete editable kit from your facts. Connect your own
                Gemini key when you want AI-written copy.
              </p>
            </details>
            <details>
              <summary>
                Can I use my own product photos?
                <PlusMark />
              </summary>
              <p>
                Yes. Upload a JPG, PNG, or WebP and replace the example. StudioShelf uses your photo
                as supplied, resized for the canvas.
              </p>
            </details>
            <details>
              <summary>
                What can I download?
                <PlusMark />
              </summary>
              <p>
                A ZIP containing five 1080 × 1350 carousel PNGs, listing and channel copy, a CSV
                worksheet, and an editable project backup.
              </p>
            </details>
            <details>
              <summary>
                Does this publish to my accounts?
                <PlusMark />
              </summary>
              <p>
                You choose what to publish and where. StudioShelf prepares the assets; you review
                them and share them through your own channels.
              </p>
            </details>
          </div>
        </section>

        <section className="ed-final">
          <BrandLogo size={42} />
          <span className="ed-kicker">MAKE A GOOD FIRST IMPRESSION</span>
          <h2>
            Your next launch
            <br />
            <em>starts on this shelf.</em>
          </h2>
          <Link href="/studio" className="ed-button ed-button-primary">
            Open your studio <ArrowRight size={16} />
          </Link>
          <p>Bring what you made. We’ll help with the introduction.</p>
        </section>
      </main>

      <footer className="ed-footer">
        <Link href="/" className="ed-brand">
          <BrandLogo size={27} />
          <span>
            Studio<span>Shelf</span>
          </span>
        </Link>
        <span>A considered introduction to what you make.</span>
        <div>
          <Link href="/shopify">Shopify</Link>
          <Link href="/help">Help</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/support">Support</Link>
          <Link href="/studio">
            Open studio <ArrowUpRight size={12} />
          </Link>
        </div>
      </footer>

      <nav className="ed-dock" aria-label="Primary">
        <a href="#home" className="active">
          <Home size={18} />
          Home
        </a>
        <a href="#preview">
          <Sparkles size={18} />
          Try it
        </a>
        <a href="#examples">
          <LayoutGrid size={18} />
          Examples
        </a>
        <Link href="/studio">
          <PencilLine size={18} />
          Studio
        </Link>
      </nav>
    </div>
  );
}

function ShieldNote() {
  return <Check size={13} aria-hidden="true" />;
}

function PlusMark() {
  return (
    <span className="ed-plus" aria-hidden="true">
      +
    </span>
  );
}
