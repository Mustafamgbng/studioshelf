'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Grid2X2,
  ImagePlus,
  Layers,
  LoaderCircle,
  LogOut,
  Menu,
  Palette,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import ThemeToggle from '@/components/theme-toggle';
import BrandLogo from '@/components/brand-logo';
import { getSample, getSampleImage, SAMPLE_PRODUCTS } from '@/lib/samples';
import {
  DEFAULT_PRODUCT,
  THEMES,
  type Kit,
  type Product,
  type Project,
  type Theme,
} from '@/lib/types';
import { createTemplateKit, factLines, validateProduct } from '@/lib/engine';
import { deleteProject, listProjects, saveProject, validateProject } from '@/lib/storage';
import { cloudDelete, cloudList, cloudSave, getSupabase } from '@/lib/supabase';
import {
  download,
  drawSlide,
  exportKit,
  exportSlide,
  kitMarkdown,
  readPhoto,
  safeName,
} from '@/lib/export';

type View = 'workspace' | 'saved' | 'brand' | 'connections';
type Tab = 'carousel' | 'listing' | 'social' | 'review';
const initialSample = getSample();
const starter: Project = {
  id: 'sample',
  updatedAt: '2026-01-01T00:00:00.000Z',
  product: initialSample.product,
  kit: createTemplateKit(initialSample.product),
  image: null,
  theme: initialSample.theme,
  source: 'template',
};

function Preview({
  project,
  index,
  small = false,
}: {
  project: Project;
  index: number;
  small?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    const offscreen = document.createElement('canvas');
    drawSlide(offscreen, project, index)
      .then(() => {
        if (!active || !ref.current) return;
        ref.current.width = 1080;
        ref.current.height = 1350;
        ref.current.getContext('2d')!.drawImage(offscreen, 0, 0);
        setError(false);
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
    <div className={small ? 'canvas-frame small' : 'canvas-frame'} aria-busy={!ready && !error}>
      {error ? (
        <p>Image preview unavailable. Try replacing the photo.</p>
      ) : (
        <canvas
          ref={ref}
          width={1080}
          height={1350}
          role="img"
          aria-label={`Slide ${index + 1}: ${project.kit.slides[index].headline}`}
          data-ready={ready}
        />
      )}
    </div>
  );
}

function Modal({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function CopyField({
  label,
  value,
  onChange,
  onCopy,
  rows = 5,
  maxLength = 5000,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  onCopy: (s: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <div className="copy-field">
      <div>
        <label>
          {label}
          <textarea
            aria-label={label}
            rows={rows}
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <button
          className="icon-btn"
          onClick={() => onCopy(value)}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Studio({ initialSampleId }: { initialSampleId?: string }) {
  const [view, setView] = useState<View>('workspace');
  const [tab, setTab] = useState<Tab>('carousel');
  const [project, setProject] = useState<Project>(() => {
    const sample = getSample(initialSampleId);
    return {
      ...starter,
      product: sample.product,
      kit: createTemplateKit(sample.product),
      theme: sample.theme,
    };
  });
  const [dirty, setDirty] = useState(false);
  const [briefChanged, setBriefChanged] = useState(false);
  const [slide, setSlide] = useState(0);
  const [engine, setEngine] = useState<'template' | 'gemini'>('template');
  const [apiKey, setApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Project[]>([]);
  const [cloud, setCloud] = useState<Project[]>([]);
  const [cloudView, setCloudView] = useState(false);
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const db = getSupabase();
  const notify = useCallback((s: string) => setToast(s), []);
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');

  useEffect(() => {
    listProjects()
      .then(setSaved)
      .catch(() =>
        setError('Browser storage is unavailable. You can still create and export kits.'),
      );
    if (!db) return;
    db.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = db.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, [db]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);

  function editProduct<K extends keyof Product>(key: K, value: Product[K]) {
    setProject((p) => ({ ...p, product: { ...p.product, [key]: value } }));
    setDirty(true);
    setBriefChanged(true);
  }
  function editKit<K extends keyof Kit>(key: K, value: Kit[K]) {
    setProject((p) => ({ ...p, kit: { ...p.kit, [key]: value } }));
    setDirty(true);
  }
  function editSlide(key: 'eyebrow' | 'headline' | 'body', value: string) {
    setProject((p) => ({
      ...p,
      kit: {
        ...p.kit,
        slides: p.kit.slides.map((s, i) => (i === slide ? { ...s, [key]: value } : s)),
      },
    }));
    setDirty(true);
  }
  function changeView(next: View) {
    setView(next);
    setMenuOpen(false);
    setError('');
  }
  function openProject(p: Project) {
    if (
      dirty &&
      !window.confirm(
        'Open another kit? Save or export your current changes first if you want to keep them.',
      )
    )
      return;
    try {
      setProject(validateProject(p));
      setDirty(false);
      setBriefChanged(false);
      setSlide(0);
      changeView('workspace');
    } catch (e) {
      fail(e);
    }
  }
  function newKit() {
    if (
      dirty &&
      !window.confirm(
        'Start a new kit? Save or export your current changes first if you want to keep them.',
      )
    )
      return;
    const product: Product = {
      ...DEFAULT_PRODUCT,
      name: 'Your next product',
      brand: 'Your brand',
      facts: '',
      audience: '',
      price: '',
      cta: 'Explore the collection',
    };
    setProject({
      ...starter,
      id: crypto.randomUUID(),
      product,
      kit: createTemplateKit(product),
      image: null,
      updatedAt: new Date().toISOString(),
    });
    setDirty(false);
    setBriefChanged(true);
    setSlide(0);
    setTab('carousel');
    changeView('workspace');
    notify('New project created. Add your product facts to get started.');
  }
  function loadSample(id: string) {
    if (
      dirty &&
      !window.confirm('Switch examples? Save your current changes first if you want to keep them.')
    )
      return;
    const sample = getSample(id);
    setProject({
      ...starter,
      product: sample.product,
      kit: createTemplateKit(sample.product),
      theme: sample.theme,
    });
    setDirty(false);
    setBriefChanged(false);
    setSlide(0);
    setError('');
  }
  async function upload(file?: File) {
    if (!file) return;
    try {
      const image = await readPhoto(file);
      setProject((p) => ({ ...p, image }));
      setDirty(true);
      notify('Photo added. It stays in your browser until you choose Gemini or cloud save.');
    } catch (e) {
      fail(e);
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  async function generate() {
    setError('');
    try {
      const product = validateProduct(project.product);
      if (
        dirty &&
        !briefChanged &&
        !window.confirm('Regenerate the copy? This replaces your manual text edits.')
      )
        return;
      setBusy('generate');
      let kit: Kit;
      if (engine === 'template') kit = createTemplateKit(product);
      else {
        const token = db ? (await db.auth.getSession()).data.session?.access_token : null;
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ product, image: project.image, apiKey }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not generate your kit.');
        kit = result.kit;
      }
      setProject((p) => ({ ...p, product, kit, source: engine }));
      setDirty(true);
      setBriefChanged(false);
      setSlide(0);
      notify(
        engine === 'template'
          ? 'Your fact-based template kit is ready to edit.'
          : 'Your Gemini launch kit is ready. Review every claim.',
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }
  async function save(toCloud = false) {
    setError('');
    try {
      const p = validateProject({
        ...project,
        id: project.id === 'sample' ? crypto.randomUUID() : project.id,
        updatedAt: new Date().toISOString(),
      });
      setBusy('save');
      await saveProject(p);
      setProject(p);
      setDirty(false);
      setSaved(await listProjects());
      if (toCloud) {
        await cloudSave(p);
        setCloud(await cloudList());
      }
      notify(
        toCloud
          ? 'Saved in this browser and your cloud account.'
          : 'Saved in this browser. Export a backup to keep another copy.',
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied to clipboard.');
    } catch {
      setError('Clipboard access is unavailable. Select the text and copy it manually.');
    }
  }
  async function exportAll() {
    setError('');
    setBusy('export');
    try {
      await exportKit(validateProject({ ...project, updatedAt: new Date().toISOString() }));
      notify('Your launch kit ZIP has been downloaded.');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2400000) throw new Error('This backup is too large.');
      const p = validateProject(JSON.parse(await file.text()));
      openProject(p);
    } catch (e) {
      fail(e);
    }
    if (restoreRef.current) restoreRef.current.value = '';
  }
  async function remove(p: Project) {
    if (
      !window.confirm(
        `Delete “${p.product.name}” from ${cloudView ? 'your cloud account' : 'this browser'}?`,
      )
    )
      return;
    try {
      if (cloudView) {
        await cloudDelete(p.id);
        setCloud(await cloudList());
      } else {
        await deleteProject(p.id);
        setSaved(await listProjects());
      }
      notify('Kit deleted.');
    } catch (e) {
      fail(e);
    }
  }
  async function loadCloud() {
    if (!db) {
      changeView('connections');
      notify('Enable Supabase to use cloud accounts. Browser saves work now.');
      return;
    }
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setBusy('cloud');
    setError('');
    try {
      setCloud(await cloudList());
      setCloudView(true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }
  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setBusy('auth');
    setAuthMessage('');
    try {
      const result =
        authMode === 'signin'
          ? await db.auth.signInWithPassword({ email, password })
          : await db.auth.signUp({ email, password });
      if (result.error) throw new Error(result.error.message);
      setPassword('');
      if (authMode === 'signup' && !result.data.session)
        setAuthMessage('Check your email to confirm your account, then sign in here.');
      else {
        setAuthOpen(false);
        notify('Signed in. Cloud saves are available.');
      }
    } catch (e) {
      setAuthMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const facts = factLines(project.product);
  const photo = project.image || getSampleImage(project.product);
  const titles = {
    workspace: 'Launch workspace',
    saved: 'Your projects',
    brand: 'Brand direction',
    connections: 'Connections',
  };
  const nav = [
    { id: 'workspace' as View, icon: Grid2X2, label: 'Workspace' },
    { id: 'saved' as View, icon: FolderOpen, label: 'Saved kits' },
    { id: 'brand' as View, icon: Palette, label: 'Brand studio' },
    { id: 'connections' as View, icon: Settings2, label: 'Connections' },
  ];

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to workspace
      </a>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <a className="wordmark" href="/" aria-label="StudioShelf home">
          <span className="logo">
            <BrandLogo size={30} />
          </span>
          <span>StudioShelf</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>Personal workspace</strong>
            <small>Product launch studio</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => changeView(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {item.id === 'saved' && saved.length > 0 && (
                <span className="nav-count">{saved.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Layers size={20} />
          <h3>From brief to launch.</h3>
          <p>One place for every asset your next product needs.</p>
          <button onClick={newKit}>
            Create a project <ArrowRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          <span>{apiKey ? 'Gemini key in this tab' : 'Free template mode'}</span>
          <button
            className="icon-btn"
            aria-label="Open connections"
            onClick={() => changeView('connections')}
          >
            <Settings2 size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-btn mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              My studio <span>/</span> <strong>{nav.find((n) => n.id === view)?.label}</strong>
            </span>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <span className="status-dot" />
              {dirty ? 'Unsaved changes' : 'Local workspace'}
            </span>
            <ThemeToggle />
            <button
              className="avatar"
              aria-label={user ? 'Account settings' : 'Open account options'}
              onClick={() => {
                if (db) setAuthOpen(true);
                else changeView('connections');
              }}
            >
              {user?.email?.[0]?.toUpperCase() || 'S'}
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">STUDIOSHELF / {view.toUpperCase()}</p>
              <h1>{titles[view]}</h1>
              <p>
                {view === 'workspace'
                  ? 'Create, refine, and export a consistent product launch.'
                  : view === 'saved'
                    ? 'Every launch, organized and ready to pick up again.'
                    : view === 'brand'
                      ? 'Set the voice and visual direction for this launch.'
                      : 'Bring your own tools. Keep control of your creative work.'}
              </p>
            </div>
            <button className="btn btn-dark" onClick={newKit}>
              <Plus size={17} /> New launch kit
            </button>
          </div>
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button className="icon-btn" aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}

          {view === 'workspace' && (
            <>
              <div className="sample-rail">
                <span>Explore an example</span>
                <div>
                  {SAMPLE_PRODUCTS.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => loadSample(sample.id)}
                      aria-pressed={project.product.name === sample.product.name}
                      className={
                        project.product.name === sample.product.name
                          ? 'sample-chip active'
                          : 'sample-chip'
                      }
                    >
                      <img src={sample.image} alt="" />
                      {sample.label}
                    </button>
                  ))}
                </div>
                <button className="sample-own" onClick={newKit}>
                  Use your own product <ArrowRight size={14} />
                </button>
              </div>
              <div className="workspace-grid">
                <section className="brief-panel" aria-label="Product brief">
                  <div className="section-label">
                    <span className="step-number">01</span>
                    <h2>Product brief</h2>
                    <span className="muted">INPUT</span>
                  </div>
                  <div
                    className="photo-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      upload(e.dataTransfer.files[0]);
                    }}
                  >
                    <button
                      className="photo-button"
                      onClick={() => fileRef.current?.click()}
                      aria-label="Upload product photo"
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={
                            project.image
                              ? `${project.product.name} product photo`
                              : `AI-generated concept photograph: ${project.product.name}`
                          }
                        />
                      ) : (
                        <div className="upload-empty">
                          <ImagePlus size={36} />
                          <strong>Drop your product photo</strong>
                          <span>or click to browse</span>
                        </div>
                      )}
                      <span className="photo-overlay">
                        <ImagePlus size={15} /> {photo ? 'Change photo' : 'Upload photo'}
                      </span>
                    </button>
                    <span className="photo-note">
                      {project.image
                        ? 'Your original photo · resized for export'
                        : photo
                          ? 'Concept photograph · fictional product'
                          : 'JPG, PNG or WebP · up to 12 MB'}
                    </span>
                    {project.image && (
                      <button
                        className="remove-photo"
                        onClick={() => {
                          setProject((p) => ({ ...p, image: null }));
                          setDirty(true);
                        }}
                        aria-label="Remove photo"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    aria-label="Product photo file"
                    onChange={(e) => upload(e.target.files?.[0])}
                  />
                  <div className="brief-fields">
                    <Field label="Product name">
                      <input
                        value={project.product.name}
                        maxLength={100}
                        onChange={(e) => editProduct('name', e.target.value)}
                        placeholder="The thing you’ve been making"
                      />
                    </Field>
                    <div className="field-row">
                      <Field label="Brand name">
                        <input
                          value={project.product.brand}
                          maxLength={80}
                          onChange={(e) => editProduct('brand', e.target.value)}
                          placeholder="Your brand"
                        />
                      </Field>
                      <Field label="Category">
                        <select
                          value={project.product.category}
                          onChange={(e) => editProduct('category', e.target.value)}
                        >
                          {[
                            'Home & living',
                            'Electronics',
                            'Fashion & accessories',
                            'Beauty & care',
                            'Art & stationery',
                            'Food & drink',
                            'Digital products',
                            'Other',
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field
                      label="The facts that make it special"
                      hint="One fact per line. We use what you know, so your copy stays grounded."
                    >
                      <textarea
                        rows={5}
                        value={project.product.facts}
                        maxLength={2000}
                        onChange={(e) => editProduct('facts', e.target.value)}
                        placeholder={
                          'Materials, dimensions, colours, features…\nOnly include facts you can confirm.'
                        }
                      />
                    </Field>
                    <div className="field-row price-row">
                      <Field label="Price (optional)">
                        <div className="price-input">
                          <select
                            aria-label="Currency"
                            value={project.product.currency}
                            onChange={(e) => editProduct('currency', e.target.value)}
                          >
                            {['USD', 'INR', 'EUR', 'GBP'].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label="Product price"
                            value={project.product.price}
                            maxLength={20}
                            placeholder="28.00"
                            onChange={(e) => editProduct('price', e.target.value)}
                          />
                        </div>
                      </Field>
                      <Field label="Brand voice">
                        <select
                          value={project.product.voice}
                          onChange={(e) => editProduct('voice', e.target.value)}
                        >
                          {[
                            'Warm & thoughtful',
                            'Bold & playful',
                            'Clean & minimal',
                            'Elegant & editorial',
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <details className="more-details">
                      <summary>
                        Audience & call to action <ChevronDown size={13} />
                      </summary>
                      <Field label="Who is it for?">
                        <input
                          value={project.product.audience}
                          maxLength={200}
                          onChange={(e) => editProduct('audience', e.target.value)}
                        />
                      </Field>
                      <Field label="Call to action">
                        <input
                          value={project.product.cta}
                          maxLength={80}
                          onChange={(e) => editProduct('cta', e.target.value)}
                        />
                      </Field>
                    </details>
                    <div className="generate-controls">
                      <label className="engine-select">
                        <Sparkles size={14} />
                        <select
                          aria-label="Generation engine"
                          value={engine}
                          onChange={(e) => setEngine(e.target.value as 'template' | 'gemini')}
                        >
                          <option value="template">Template · no API needed</option>
                          <option value="gemini">Gemini · your connected key</option>
                        </select>
                      </label>
                      <button
                        className="btn btn-purple generate-btn"
                        disabled={!!busy}
                        onClick={generate}
                      >
                        {busy === 'generate' ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <WandSparkles size={17} />
                        )}
                        {busy === 'generate' ? 'Making your kit…' : 'Create my launch kit'}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                    <p className="privacy-note">
                      <ShieldCheck size={13} />
                      {engine === 'template'
                        ? 'Template mode runs entirely in your browser.'
                        : 'Gemini sends your brief and photo to Google. Review its data terms in Connections.'}
                    </p>
                  </div>
                </section>

                <section className="output-panel" aria-label="Launch kit output">
                  <div className="output-head">
                    <div>
                      <span className="eyebrow">LIVE PREVIEW</span>
                      <h2>Your launch, assembled.</h2>
                    </div>
                    <span className="engine-badge">
                      <span className="status-dot" />
                      {project.source === 'gemini' ? 'Gemini draft' : 'Template draft'}
                    </span>
                  </div>
                  <div className="output-tabs" role="tablist" aria-label="Launch kit assets">
                    {(
                      [
                        { id: 'carousel', label: 'Social carousel', count: '05' },
                        { id: 'listing', label: 'Product listing', count: '' },
                        { id: 'social', label: 'Captions & email', count: '' },
                        { id: 'review', label: 'Review', count: '' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        role="tab"
                        id={`tab-${t.id}`}
                        aria-selected={tab === t.id}
                        aria-controls={`panel-${t.id}`}
                        className={tab === t.id ? 'tab active' : 'tab'}
                        onClick={() => setTab(t.id)}
                      >
                        {t.label}
                        {t.count && <span>{t.count}</span>}
                      </button>
                    ))}
                  </div>
                  {briefChanged && (
                    <div className="draft-notice">
                      Your brief has changed. Create a kit to refresh the draft copy.
                    </div>
                  )}
                  <div
                    role="tabpanel"
                    id={`panel-${tab}`}
                    aria-labelledby={`tab-${tab}`}
                    className="tab-content"
                  >
                    {tab === 'carousel' && (
                      <>
                        <div className="artboard">
                          <div className="artboard-tools">
                            <span>
                              INSTAGRAM PORTRAIT <i>1080 × 1350</i>
                            </span>
                            <div className="theme-dots" aria-label="Colour themes">
                              {(Object.keys(THEMES) as Theme[]).map((key) => (
                                <button
                                  key={key}
                                  aria-label={THEMES[key].name}
                                  aria-pressed={project.theme === key}
                                  title={THEMES[key].name}
                                  className={project.theme === key ? 'selected' : ''}
                                  style={{ background: THEMES[key].bg }}
                                  onClick={() => {
                                    setProject((p) => ({ ...p, theme: key }));
                                    setDirty(true);
                                  }}
                                >
                                  {project.theme === key && <Check size={11} />}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="main-preview">
                            <Preview project={project} index={slide} />
                          </div>
                          <div className="slide-navigation">
                            <button
                              className="icon-btn"
                              aria-label="Previous slide"
                              disabled={slide === 0}
                              onClick={() => setSlide(slide - 1)}
                            >
                              <ArrowLeft size={17} />
                            </button>
                            <span>
                              Slide <strong>{String(slide + 1).padStart(2, '0')}</strong> of 05
                            </span>
                            <button
                              className="icon-btn"
                              aria-label="Next slide"
                              disabled={slide === 4}
                              onClick={() => setSlide(slide + 1)}
                            >
                              <ArrowRight size={17} />
                            </button>
                          </div>
                        </div>
                        <div className="slide-thumbnails">
                          {project.kit.slides.map((s, i) => (
                            <button
                              key={i}
                              className={slide === i ? 'thumbnail active' : 'thumbnail'}
                              onClick={() => setSlide(i)}
                              aria-label={`Edit slide ${i + 1}: ${s.headline}`}
                              aria-pressed={slide === i}
                            >
                              <Preview project={project} index={i} small />
                              <span>
                                {
                                  [
                                    'The introduction',
                                    'The details',
                                    'A closer look',
                                    'Your story',
                                    'The invitation',
                                  ][i]
                                }
                              </span>
                            </button>
                          ))}
                        </div>
                        <details className="slide-editor">
                          <summary>
                            <span>
                              <Palette size={15} /> Make this slide yours
                            </span>
                            <ChevronDown size={15} />
                          </summary>
                          <div className="editor-fields">
                            <Field label="Eyebrow">
                              <input
                                value={project.kit.slides[slide].eyebrow}
                                maxLength={80}
                                onChange={(e) => editSlide('eyebrow', e.target.value)}
                              />
                            </Field>
                            <Field label="Headline">
                              <textarea
                                rows={2}
                                maxLength={100}
                                value={project.kit.slides[slide].headline}
                                onChange={(e) => editSlide('headline', e.target.value)}
                              />
                            </Field>
                            <Field label="Body copy">
                              <textarea
                                rows={3}
                                maxLength={240}
                                value={project.kit.slides[slide].body}
                                onChange={(e) => editSlide('body', e.target.value)}
                              />
                            </Field>
                            <small>
                              Long text is shortened to fit the artwork. Preview every slide before
                              exporting.
                            </small>
                            <button
                              className="btn btn-light"
                              disabled={!!busy}
                              onClick={async () => {
                                try {
                                  await exportSlide(project, slide);
                                  notify('Slide PNG downloaded.');
                                } catch (e) {
                                  fail(e);
                                }
                              }}
                            >
                              <Download size={15} /> Download this slide
                            </button>
                          </div>
                        </details>
                      </>
                    )}
                    {tab === 'listing' && (
                      <div className="text-panel">
                        <div className="text-intro">
                          <h3>Ready for your shop window.</h3>
                          <p>Refine the details. Make every word sound like your brand.</p>
                        </div>
                        <CopyField
                          label="Listing title"
                          value={project.kit.title}
                          maxLength={250}
                          onChange={(s) => editKit('title', s)}
                          onCopy={copy}
                          rows={2}
                        />
                        <CopyField
                          label="Product description"
                          value={project.kit.description}
                          onChange={(s) => editKit('description', s)}
                          onCopy={copy}
                          rows={9}
                        />
                        <CopyField
                          label="Product highlights (one per line)"
                          value={project.kit.bullets.join('\n')}
                          onChange={(s) => editKit('bullets', s.split('\n'))}
                          onCopy={copy}
                        />
                        <Field label="Keyword ideas (comma separated)">
                          <textarea
                            rows={3}
                            value={project.kit.tags.join(', ')}
                            onChange={(e) =>
                              editKit(
                                'tags',
                                e.target.value.split(',').map((s) => s.trim()),
                              )
                            }
                          />
                        </Field>
                        <p className="muted">
                          Keyword ideas come from your product details. Search volume and ranking
                          are not measured.
                        </p>
                      </div>
                    )}
                    {tab === 'social' && (
                      <div className="text-panel">
                        <div className="text-intro">
                          <h3>One voice. Every channel.</h3>
                          <p>Your launch, with a consistent voice from post to inbox.</p>
                        </div>
                        <CopyField
                          label="Instagram caption"
                          value={project.kit.instagram}
                          onChange={(s) => editKit('instagram', s)}
                          onCopy={copy}
                          rows={9}
                        />
                        <CopyField
                          label="WhatsApp product message"
                          value={project.kit.whatsapp}
                          onChange={(s) => editKit('whatsapp', s)}
                          onCopy={copy}
                          rows={7}
                        />
                        <CopyField
                          label="Email subject"
                          value={project.kit.emailSubject}
                          maxLength={250}
                          onChange={(s) => editKit('emailSubject', s)}
                          onCopy={copy}
                          rows={2}
                        />
                        <CopyField
                          label="Launch email"
                          value={project.kit.emailBody}
                          onChange={(s) => editKit('emailBody', s)}
                          onCopy={copy}
                          rows={8}
                        />
                      </div>
                    )}
                    {tab === 'review' && (
                      <div className="text-panel review-panel">
                        <ShieldCheck size={35} />
                        <h3>Good copy starts with true details.</h3>
                        <p>
                          These are seller-provided facts, not independently verified claims. Check
                          the draft against them before sharing.
                        </p>
                        <div className="fact-list">
                          {facts.map((f, i) => (
                            <div key={i}>
                              <Check size={15} />
                              {f}
                            </div>
                          ))}
                        </div>
                        <h4>A few things to confirm</h4>
                        {project.kit.questions.map((q, i) => (
                          <p className="review-question" key={i}>
                            <span>{i + 1}</span>
                            {q}
                          </p>
                        ))}
                        <div className="review-note">
                          The photo is used as supplied. StudioShelf does not change the product’s
                          appearance, post to your accounts, or promise sales.
                        </div>
                        <a
                          href="https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Read Etsy’s image guidelines <ExternalLink size={13} />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="output-footer">
                    <button className="btn btn-light" onClick={() => save()} disabled={!!busy}>
                      {busy === 'save' ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <FolderOpen size={15} />
                      )}{' '}
                      Save kit
                    </button>
                    <button className="btn btn-dark" disabled={!!busy} onClick={exportAll}>
                      {busy === 'export' ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <ArrowDownToLine size={16} />
                      )}
                      {busy === 'export' ? 'Packing your kit…' : 'Export launch kit'}
                      <span className="file-tag">ZIP</span>
                    </button>
                  </div>
                </section>
              </div>
              <div className="under-workspace">
                <span>
                  <ShieldCheck size={15} /> Your facts. Your photos. Your final say.
                </span>
                <span>
                  Made for the makers, the midnight thinkers & the small-but-mighty brands.
                </span>
              </div>
            </>
          )}

          {view === 'saved' && (
            <section className="saved-section">
              <div className="saved-toolbar">
                <div className="segmented">
                  <button
                    className={!cloudView ? 'selected' : ''}
                    onClick={() => setCloudView(false)}
                  >
                    This browser <span>{saved.length}</span>
                  </button>
                  <button
                    className={cloudView ? 'selected' : ''}
                    disabled={!!busy}
                    onClick={loadCloud}
                  >
                    <Cloud size={15} />
                    {busy === 'cloud' ? 'Loading…' : 'Cloud'}
                  </button>
                </div>
                <div>
                  <input
                    type="search"
                    aria-label="Search saved kits"
                    placeholder="Search projects…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button className="btn btn-light" onClick={() => restoreRef.current?.click()}>
                    <Upload size={15} /> Import backup
                  </button>
                </div>
              </div>
              <div className="saved-grid">
                {(cloudView ? cloud : saved)
                  .filter((p) =>
                    `${p.product.name} ${p.product.brand}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <article className="saved-card" key={p.id}>
                      <button
                        className="saved-preview"
                        onClick={() => openProject(p)}
                        aria-label={`Open ${p.product.name}`}
                      >
                        <Preview project={p} index={0} small />
                      </button>
                      <div>
                        <p>{p.product.brand}</p>
                        <h3>{p.product.name}</h3>
                        <div className="saved-card-bottom">
                          <small>
                            {new Date(p.updatedAt).toLocaleDateString()} · {p.source}
                          </small>
                          <button
                            className="icon-btn"
                            onClick={() => remove(p)}
                            aria-label={`Delete ${p.product.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
              {(cloudView ? cloud : saved).filter((p) =>
                `${p.product.name} ${p.product.brand}`.toLowerCase().includes(query.toLowerCase()),
              ).length === 0 && (
                <div className="empty-state">
                  <FolderOpen size={40} />
                  <h2>
                    {query ? 'No matching kits, just yet.' : 'Your next good idea belongs here.'}
                  </h2>
                  <p>
                    {query
                      ? 'Try another name or brand.'
                      : 'Create a launch kit and save it. We’ll keep a place for it on your shelf.'}
                  </p>
                  <button className="btn btn-purple" onClick={newKit}>
                    <Plus size={16} /> Create a launch kit
                  </button>
                </div>
              )}
              <input
                ref={restoreRef}
                type="file"
                accept=".json"
                aria-label="Project backup file"
                className="hidden"
                onChange={(e) => restore(e.target.files?.[0])}
              />
            </section>
          )}

          {view === 'brand' && (
            <div className="settings-grid">
              <section className="settings-card">
                <p className="eyebrow">YOUR BRAND, YOUR WAY</p>
                <h2>A look that feels familiar.</h2>
                <p>
                  Set the direction for this kit. Save a kit to reuse its brand and colours later.
                </p>
                <Field label="Brand name">
                  <input
                    value={project.product.brand}
                    maxLength={80}
                    onChange={(e) => editProduct('brand', e.target.value)}
                  />
                </Field>
                <Field label="Voice">
                  <select
                    value={project.product.voice}
                    onChange={(e) => editProduct('voice', e.target.value)}
                  >
                    {[
                      'Warm & thoughtful',
                      'Bold & playful',
                      'Clean & minimal',
                      'Elegant & editorial',
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Call to action">
                  <input
                    maxLength={80}
                    value={project.product.cta}
                    onChange={(e) => editProduct('cta', e.target.value)}
                  />
                </Field>
                <h3>Choose your palette</h3>
                <div className="theme-cards">
                  {(Object.keys(THEMES) as Theme[]).map((key) => (
                    <button
                      key={key}
                      className={project.theme === key ? 'theme-card selected' : 'theme-card'}
                      onClick={() => {
                        setProject((p) => ({ ...p, theme: key }));
                        setDirty(true);
                      }}
                      aria-pressed={project.theme === key}
                    >
                      <span style={{ background: THEMES[key].bg, color: THEMES[key].ink }}>
                        Aa
                        <span style={{ background: THEMES[key].accent }} />
                      </span>
                      {THEMES[key].name}
                      {project.theme === key && <Check size={15} />}
                    </button>
                  ))}
                </div>
                <button className="btn btn-purple" onClick={() => changeView('workspace')}>
                  Back to your canvas <ArrowRight size={16} />
                </button>
              </section>
              <section className="brand-preview">
                <Preview project={project} index={slide} />
                <p>Your current kit · live preview</p>
              </section>
            </div>
          )}

          {view === 'connections' && (
            <div className="connections-grid">
              <section className="settings-card">
                <div className="connection-icon">
                  <Sparkles size={24} />
                </div>
                <h2>Connect Gemini.</h2>
                <p>
                  Connect your own API key to write richer launch copy from your brief and product
                  photo.
                </p>
                <div className="connection-status">
                  <span className="status-dot" />
                  {apiKey ? 'Key added for this tab' : 'Not connected · template mode is available'}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!/^[a-zA-Z0-9_-]{20,200}$/.test(keyInput.trim())) {
                      setError('Check your Gemini API key.');
                      return;
                    }
                    setApiKey(keyInput.trim());
                    setKeyInput('');
                    setEngine('gemini');
                    setError('');
                    notify('Key added to this tab. Generate a kit to verify access.');
                  }}
                >
                  <Field
                    label="Gemini API key"
                    hint="Kept in this tab’s memory only. Refreshing the page clears it."
                  >
                    <input
                      type="password"
                      autoComplete="off"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Paste your key here, not in chat"
                      maxLength={200}
                    />
                  </Field>
                  <div className="button-row">
                    <button className="btn btn-purple" type="submit">
                      Use this key <ArrowRight size={15} />
                    </button>
                    {apiKey && (
                      <button
                        className="btn btn-light"
                        type="button"
                        onClick={() => {
                          setApiKey('');
                          setEngine('template');
                          notify('Key cleared from this tab.');
                        }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </form>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  Get a key in Google AI Studio <ExternalLink size={13} />
                </a>
                <div className="connection-note">
                  When you generate with Gemini, your brief and photo pass through this app’s server
                  to Google. Google’s free tier may use submitted content to improve its products.
                  Use photos and facts you have permission to share.{' '}
                  <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">
                    Read Google’s terms
                  </a>
                  . Your key is not saved in project backups or cloud records.
                </div>
              </section>
              <div className="connection-stack">
                <section className="settings-card">
                  <div className="connection-icon green">
                    <Cloud size={24} />
                  </div>
                  <h2>A home for your kits.</h2>
                  <p>
                    {db
                      ? user
                        ? `Signed in as ${user.email}. Choose when to save a kit to your account.`
                        : 'Sign in to save kits across devices. Your browser copies stay on this device.'
                      : 'Browser saves work now. A deployment owner can enable cloud accounts by adding Supabase settings and running the included migration.'}
                  </p>
                  {db ? (
                    user ? (
                      <div className="button-row">
                        <button
                          className="btn btn-purple"
                          disabled={!!busy}
                          onClick={() => save(true)}
                        >
                          <Cloud size={15} /> Save current kit to cloud
                        </button>
                        <button
                          className="btn btn-light"
                          onClick={async () => {
                            await db.auth.signOut();
                            setCloud([]);
                            setCloudView(false);
                            notify('Signed out.');
                          }}
                        >
                          <LogOut size={15} /> Sign out
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-dark"
                        onClick={() => {
                          setAuthMessage('');
                          setAuthOpen(true);
                        }}
                      >
                        Sign in / create account <ArrowRight size={15} />
                      </button>
                    )
                  ) : (
                    <span className="setup-badge">Optional Supabase integration included</span>
                  )}
                </section>
                <section className="settings-card backup-card">
                  <h2>Keep your work portable.</h2>
                  <p>
                    Export the current project as an editable file, or download the copy on its own.
                    Photos are included in project backups.
                  </p>
                  <div className="button-row">
                    <button
                      className="btn btn-light"
                      onClick={() =>
                        download(
                          new Blob([JSON.stringify(project, null, 2)], {
                            type: 'application/json',
                          }),
                          safeName(project.product.name) + '.studioshelf.json',
                        )
                      }
                    >
                      <Download size={15} /> Project backup
                    </button>
                    <button
                      className="btn btn-light"
                      onClick={() =>
                        download(
                          new Blob([kitMarkdown(project)], { type: 'text/markdown' }),
                          safeName(project.product.name) + '-copy.md',
                        )
                      }
                    >
                      <Download size={15} /> Copy only
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}

          <footer className="site-footer">
            <a href="/" className="footer-wordmark">
              StudioShelf
            </a>
            <span>From product to launch.</span>
            <button onClick={() => changeView('connections')}>
              Your data & connections <ArrowRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {authOpen && db && (
        <Modal
          title={
            user
              ? 'Your studio account'
              : authMode === 'signin'
                ? 'Welcome back to your studio.'
                : 'Create your workspace.'
          }
          onClose={() => setAuthOpen(false)}
        >
          {user ? (
            <div className="account-summary">
              <p>Signed in as {user.email}</p>
              <button
                className="btn btn-dark"
                onClick={async () => {
                  await db.auth.signOut();
                  setCloud([]);
                  setCloudView(false);
                  setAuthOpen(false);
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={authenticate}>
              <p>Keep your launch kits together, wherever you create.</p>
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {authMessage && (
                <p className="auth-message" role="status">
                  {authMessage}
                </p>
              )}
              <button className="btn btn-purple" disabled={!!busy}>
                {busy === 'auth'
                  ? 'One moment…'
                  : authMode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                  setAuthMessage('');
                }}
              >
                {authMode === 'signin'
                  ? 'New here? Create an account'
                  : 'Already have an account? Sign in'}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
