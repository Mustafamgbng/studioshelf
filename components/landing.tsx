'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  FileText,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  Layers,
  MoreHorizontal,
  Palette,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import ThemeToggle from '@/components/theme-toggle';
import { SAMPLE_PRODUCTS } from '@/lib/samples';
import { createTemplateKit, factLines } from '@/lib/engine';
import { THEMES } from '@/lib/types';

const steps = [
  {
    number: '01',
    icon: ImageIcon,
    title: 'Start with what you made.',
    description:
      'Bring your product photo and the details that matter. Materials, dimensions, features. The facts are yours.',
    detail: 'A product brief, not a blank prompt',
  },
  {
    number: '02',
    icon: SlidersHorizontal,
    title: 'Make every asset feel connected.',
    description:
      'Shape the copy, choose a palette, and edit every slide. Your listing and campaign share one creative direction.',
    detail: 'One workspace for the whole launch',
  },
  {
    number: '03',
    icon: ArrowDownToLine,
    title: 'Leave with something you can use.',
    description:
      'Export five carousel PNGs, listing copy, channel messages, and an editable project. Ready for your final review.',
    detail: 'Actual files. Yours to publish.',
  },
];

export default function Landing() {
  const [selectedId, setSelectedId] = useState(SAMPLE_PRODUCTS[0].id);
  const [copyMessage, setCopyMessage] = useState('');
  const sample = SAMPLE_PRODUCTS.find((item) => item.id === selectedId) || SAMPLE_PRODUCTS[0];
  const kit = createTemplateKit(sample.product);
  const facts = factLines(sample.product);
  const palette = THEMES[sample.theme];
  const studioHref = `/studio?sample=${encodeURIComponent(sample.id)}`;
  const artworkStyle = {
    '--campaign-bg': palette.bg,
    '--campaign-ink': palette.ink,
    '--campaign-accent': palette.accent,
  } as CSSProperties;

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(kit.instagram);
      setCopyMessage('Caption copied');
    } catch {
      setCopyMessage('Open the studio to select and copy this caption.');
    }
  }

  return (
    <div className="lp-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav className="lp-nav" aria-label="Main navigation">
        <Link href="/" className="lp-brand" aria-label="StudioShelf home">
          <span className="lp-logo">
            <Layers size={19} strokeWidth={1.7} />
          </span>
          StudioShelf
        </Link>
        <div className="lp-nav-links">
          <a href="#workflow">Workflow</a>
          <a href="#examples">Examples</a>
          <a href="#your-work">Your work, your way</a>
        </div>
        <div className="lp-nav-actions">
          <ThemeToggle />
          <Link href="/studio" className="lp-nav-cta">
            Open studio <ArrowUpRight size={14} />
          </Link>
        </div>
      </nav>

      <main className="lp-main" id="main">
        <section className="lp-hero">
          <a href="#workflow" className="lp-announcement">
            <span className="lp-announcement-dot" />
            A more focused way to launch
            <ChevronRight size={13} />
          </a>
          <h1 className="lp-hero-title">
            Your product.
            <br />A complete launch.
          </h1>
          <p className="lp-hero-description">
            Turn what you make into a launch worth sharing. Product listings, social stories, and
            campaign copy. One connected workspace.
          </p>
          <div className="lp-hero-actions">
            <Link href={studioHref} className="lp-primary-action">
              Start creating <ArrowRight size={16} />
            </Link>
            <a href="#examples" className="lp-secondary-action">
              Explore the possibilities <ChevronRight size={15} />
            </a>
          </div>
          <p className="lp-hero-note">Try the studio free. No account or API key required.</p>
        </section>

        <section className="lp-demo-section" aria-label="Interactive product launch preview">
          <div className="lp-demo-switcher" role="group" aria-label="Choose a sample product">
            <span className="lp-switcher-label">A launch for</span>
            {SAMPLE_PRODUCTS.map((item) => (
              <button
                key={item.id}
                className={sample.id === item.id ? 'active' : ''}
                aria-pressed={sample.id === item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setCopyMessage('');
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="lp-demo-window">
            <div className="lp-demo-topbar">
              <span className="lp-window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="lp-demo-path">
                Studio <ChevronRight size={11} /> {sample.product.name}
              </span>
              <span className="lp-demo-status">
                <span /> Live template preview
              </span>
            </div>

            <div className="lp-demo-body">
              <aside className="lp-demo-sidebar" aria-label="Preview workspace overview">
                <div className="lp-mini-brand">
                  <span className="lp-logo">
                    <Layers size={14} />
                  </span>
                  StudioShelf
                </div>
                <div className="lp-mini-workspace">PERSONAL WORKSPACE</div>
                <span className="lp-demo-side-active">
                  <Grid2X2 size={14} /> Launch studio
                </span>
                <span>
                  <FolderOpen size={14} /> Saved projects
                </span>
                <span>
                  <Palette size={14} /> Brand direction
                </span>
                <div className="lp-mini-divider" />
                <div className="lp-mini-workspace">THIS LAUNCH</div>
                <div className="lp-demo-asset">
                  <ImageIcon size={13} /> Social carousel <span>5</span>
                </div>
                <div className="lp-demo-asset">
                  <FileText size={13} /> Product listing <Check size={11} />
                </div>
                <div className="lp-demo-asset">
                  <Sparkles size={13} /> Channel copy <Check size={11} />
                </div>
                <Link href={studioHref} className="lp-mini-new">
                  <Plus size={13} /> Make it yours
                </Link>
              </aside>

              <div className="lp-demo-main">
                <div className="lp-demo-main-heading">
                  <div>
                    <span className="lp-demo-overline">SOCIAL CAROUSEL</span>
                    <h2>{sample.product.name}</h2>
                  </div>
                  <Link href={studioHref} className="lp-demo-edit">
                    Edit in studio <ArrowUpRight size={12} />
                  </Link>
                </div>

                <div className="lp-demo-artboard">
                  <div className="lp-campaign-canvas" style={artworkStyle}>
                    <div className="lp-campaign-top">
                      <span>{sample.product.brand}</span>
                      <span>01 — 05</span>
                    </div>
                    <img
                      className="lp-product-art"
                      src={sample.image}
                      alt={`Illustrated sample: ${sample.product.name}`}
                    />
                    <div className="lp-campaign-copy">
                      <span>INTRODUCING</span>
                      <h3>{sample.product.name}</h3>
                      <p>{facts[0]}</p>
                    </div>
                    <span className="lp-campaign-arrow" aria-hidden="true">
                      <ArrowUpRight size={23} />
                    </span>
                  </div>
                  <div className="lp-artboard-caption">
                    <span>01 / 05</span>
                    <span>1080 × 1350 · Editable canvas</span>
                  </div>
                </div>

                <div className="lp-demo-thumbs" aria-label="Assets included in the launch kit">
                  <span className="lp-demo-thumb active">
                    <ImageIcon size={13} /> Introduction
                  </span>
                  <span className="lp-demo-thumb">The details</span>
                  <span className="lp-demo-thumb">A closer look</span>
                  <span className="lp-demo-thumb">Your story</span>
                  <span className="lp-demo-thumb">The invitation</span>
                </div>
              </div>

              <aside className="lp-copy-panel" aria-label="Sample campaign copy">
                <div className="lp-copy-heading">
                  <span>
                    <FileText size={14} /> The launch copy
                  </span>
                  <MoreHorizontal size={16} />
                </div>
                <div className="lp-copy-label">PRODUCT LISTING</div>
                <h3>{sample.product.name}</h3>
                <p className="lp-listing-excerpt">
                  {sample.product.name}, by {sample.product.brand}.
                </p>
                <ul>
                  {facts.slice(0, 3).map((fact) => (
                    <li key={fact}>
                      <Check size={11} /> {fact}
                    </li>
                  ))}
                </ul>
                <div className="lp-copy-divider" />
                <div className="lp-copy-label">INSTAGRAM CAPTION</div>
                <div className="lp-caption-excerpt">
                  <p>Meet {sample.product.name}.</p>
                  <p>{facts.slice(0, 2).join('. ')}.</p>
                  <p>{sample.product.cta}.</p>
                </div>
                <button className="lp-copy-button" onClick={copyCaption}>
                  {copyMessage === 'Caption copied' ? <Check size={12} /> : <Copy size={12} />}
                  {copyMessage === 'Caption copied' ? 'Copied' : 'Copy complete caption'}
                </button>
                <span className="lp-copy-feedback" role="status">
                  {copyMessage}
                </span>
                <div className="lp-preview-export">
                  <span>
                    <ShieldCheck size={12} /> Your facts. Your final say.
                  </span>
                  <Link href={studioHref}>
                    Open full launch kit <ArrowRight size={13} />
                  </Link>
                </div>
              </aside>
            </div>
          </div>
          <div className="lp-demo-footnote">
            <span>Illustrated sample products. Real, editable workflows.</span>
            <span>Built for the brands still building their name.</span>
          </div>
        </section>

        <div className="lp-capability-bar" aria-label="Included output formats">
          <span>FROM ONE PRODUCT BRIEF</span>
          <div>
            <ImageIcon size={16} /> Social carousel
          </div>
          <div>
            <FileText size={16} /> Product listing
          </div>
          <div>
            <Sparkles size={16} /> Captions & email
          </div>
          <div>
            <ArrowDownToLine size={16} /> A complete export
          </div>
        </div>

        <section className="lp-workflow" id="workflow">
          <div className="lp-section-heading">
            <div>
              <span className="lp-section-eyebrow">A CONNECTED WORKFLOW</span>
              <h2>
                Less switching tools.
                <br />
                More getting it out there.
              </h2>
            </div>
            <p>
              From your first product photo to the final download, keep the decisions, the copy, and
              the creative in one place.
            </p>
          </div>
          <div className="lp-workflow-grid">
            {steps.map((step) => (
              <article className="lp-workflow-step" key={step.number}>
                <div className="lp-step-top">
                  <step.icon size={22} strokeWidth={1.4} />
                  <span>{step.number}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <span className="lp-step-detail">{step.detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-examples" id="examples">
          <div className="lp-section-heading">
            <div>
              <span className="lp-section-eyebrow">DIFFERENT PRODUCTS. SAME CLARITY.</span>
              <h2>
                Make it yours.
                <br />
                Whatever you make.
              </h2>
            </div>
            <p>
              Physical products, independent labels, and new collections. Start with an example,
              then replace it with your own work.
            </p>
          </div>
          <div className="lp-example-grid">
            {SAMPLE_PRODUCTS.map((item, index) => (
              <Link
                className="lp-example-card"
                href={`/studio?sample=${encodeURIComponent(item.id)}`}
                key={item.id}
                style={{ '--example-bg': THEMES[item.theme].bg } as CSSProperties}
              >
                <div className="lp-example-art">
                  <span className="lp-example-index">0{index + 1}</span>
                  <img src={item.image} alt={`Illustrated ${item.label.toLowerCase()} example`} />
                  <span className="lp-example-open">
                    <ArrowUpRight size={18} />
                  </span>
                </div>
                <div className="lp-example-caption">
                  <div>
                    <span>{item.product.category}</span>
                    <h3>{item.product.name}</h3>
                  </div>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="lp-ownership" id="your-work">
          <div className="lp-ownership-icon">
            <ShieldCheck size={28} strokeWidth={1.3} />
          </div>
          <div>
            <span className="lp-section-eyebrow">YOUR WORK, YOUR WAY</span>
            <h2>A creative tool that leaves you in control.</h2>
            <p>
              Edit every word. Use your own product photos. Save projects in your browser, or
              connect your own services. Take the finished files with you.
            </p>
          </div>
          <Link href="/studio" className="lp-secondary-action">
            Explore the studio <ArrowRight size={15} />
          </Link>
        </section>

        <section className="lp-final-cta">
          <span className="lp-logo">
            <Layers size={23} strokeWidth={1.4} />
          </span>
          <h2>
            Make something.
            <br />
            Then make it a launch.
          </h2>
          <p>Your next product deserves a complete introduction.</p>
          <Link href="/studio" className="lp-primary-action">
            Open your studio <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <footer className="lp-footer">
        <Link className="lp-brand" href="/">
          <span className="lp-logo">
            <Layers size={16} />
          </span>
          StudioShelf
        </Link>
        <span>From the product you made to the launch you imagined.</span>
        <div>
          <a href="#workflow">Workflow</a>
          <Link href="/studio">
            Open studio <ArrowUpRight size={12} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
