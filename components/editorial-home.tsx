'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  PencilLine,
  Sparkles,
} from 'lucide-react';
import BrandLogo from '@/components/brand-logo';
import ThemeToggle from '@/components/theme-toggle';
import { getSample, SAMPLE_PRODUCTS } from '@/lib/samples';
import { createTemplateKit, factLines } from '@/lib/engine';

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
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const sample = getSample(selected);
  const kit = createTemplateKit(sample.product);
  const facts = factLines(sample.product);
  const studioHref = `/studio?sample=${sample.id}`;

  async function copyListing() {
    try {
      await navigator.clipboard.writeText(`${kit.title}\n\n${kit.description}`);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Open the editor to select and copy the text.');
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
              Made by you.
              <br />
              <em>Ready to be seen.</em>
            </h1>
            <p>
              From the product you made to the launch you imagined. Shape your listing, your story,
              and your next first impression — all in one place.
            </p>
            <div className="ed-hero-actions">
              <Link href={studioHref} className="ed-button ed-button-primary">
                Create a launch <ArrowRight size={16} />
              </Link>
              <a href="#workflow" className="ed-button ed-button-outline">
                See how it works
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
            <strong>3</strong> channel drafts
          </span>
          <span>
            <Check size={13} /> Ready-to-use downloads
          </span>
          <span>
            <Check size={13} /> Your photos. Your final say.
          </span>
        </div>

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
              <span className="ed-kicker">03 / A LOOK INSIDE</span>
              <h2 id="preview-title">
                One product.
                <br />
                <em>A whole introduction.</em>
              </h2>
            </div>
            <p>
              Try a different brief. See the copy take shape. Every draft can be edited before you
              share it.
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
                  setCopied(false);
                  setCopyError('');
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="ed-preview-shell">
            <div className="ed-preview-photo">
              <Image
                src={sample.image}
                alt={`Concept product: ${sample.product.name}`}
                fill
                sizes="(max-width: 600px) calc(100vw - 44px), 540px"
                loading="lazy"
              />
              <span>
                <i /> {sample.product.brand} / PRODUCT BRIEF
              </span>
            </div>
            <div className="ed-preview-copy">
              <div className="ed-preview-label">
                <FileText size={15} />
                <span>YOUR PRODUCT LISTING</span>
                <span className="ed-template-badge">Template draft</span>
              </div>
              <h3>{sample.product.name}</h3>
              <p className="ed-preview-brand">By {sample.product.brand}</p>
              <ul>
                {facts.slice(0, 4).map((fact) => (
                  <li key={fact}>
                    <Check size={13} />
                    {fact}
                  </li>
                ))}
              </ul>
              <div className="ed-preview-description">
                <p>{kit.description}</p>
              </div>
              <div className="ed-preview-actions">
                <button onClick={copyListing} className="ed-button ed-button-outline">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy listing'}
                </button>
                <Link href={studioHref} className="ed-text-link">
                  Edit the complete kit <ArrowRight size={14} />
                </Link>
              </div>
              <span className="ed-copy-status" role="status">
                {copyError || (copied ? 'Listing copied to clipboard.' : '')}
              </span>
            </div>
          </div>
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
        <a href="#workflow">
          <FileText size={18} />
          Workflow
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

function PlusMark() {
  return (
    <span className="ed-plus" aria-hidden="true">
      +
    </span>
  );
}
