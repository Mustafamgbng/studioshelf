'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Home,
  Eye,
  Undo2,
  Redo2,
  Maximize2,
  SlidersHorizontal,
  Play,
  ZoomIn,
  ZoomOut,
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Grid2X2,
  ImagePlus,
  PackageCheck,
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
import DemoNotice from '@/components/demo-notice';
import { STATIC_DEMO } from '@/lib/deployment';
import { publicPath } from '@/lib/public-path';
import StudioOverview from '@/components/studio-overview';
import CreativeControls from '@/components/creative-controls';
import ProductMedia from '@/components/product-media';
import KitReview from '@/components/kit-review';
import PublishPack from '@/components/publish-pack';
import LocalBrandKit from '@/components/local-brand-kit';
import AssetProof from '@/components/asset-proof';
import { readSavedBrand } from '@/lib/local-brand';
import { useProjectHistory } from '@/lib/use-project-history';
import { applyGeneratedAsset } from '@/lib/shopify/client';
import type { AssetTarget } from '@/lib/shopify/types';
import { getSample, getProjectImage, getSampleGallery, SAMPLE_PRODUCTS } from '@/lib/samples';
import { imageBudget } from '@/lib/gallery';
import { getDesign } from '@/lib/creative';
import { getReviewProgress } from '@/lib/review';
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
  readGalleryPhoto,
  safeName,
} from '@/lib/export';

type View = 'overview' | 'workspace' | 'saved' | 'brand' | 'connections';
type Tab = 'carousel' | 'listing' | 'social' | 'review' | 'publish';
const assetTabs = [
  { id: 'carousel', label: 'Social carousel', count: '05' },
  { id: 'listing', label: 'Product listing', count: '' },
  { id: 'social', label: 'Captions & email', count: '' },
  { id: 'review', label: 'Review', count: '' },
  { id: 'publish', label: 'Publish pack', count: '' },
] as const;
const briefSignature = (product: Product) =>
  JSON.stringify(
    [
      'name',
      'brand',
      'category',
      'audience',
      'facts',
      'price',
      'currency',
      'voice',
      'cta',
      'url',
    ].map((key) => (product[key as keyof Product] || '').trim()),
  );
const initialSample = getSample();
const starter: Project = {
  id: 'sample',
  updatedAt: '2026-01-01T00:00:00.000Z',
  product: initialSample.product,
  kit: createTemplateKit(initialSample.product),
  image: null,
  sampleId: initialSample.id,
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
    setError(false);
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
      {!ready && !error && (
        <div className="ws-preview-loader">
          <LoaderCircle size={17} className="spin" />
          <span>Drawing preview…</span>
        </div>
      )}
      {error && <p role="alert">Image preview unavailable. Try replacing the photo.</p>}
      <canvas
        ref={ref}
        width={1080}
        height={1350}
        role="img"
        aria-label={`Slide ${index + 1}: ${project.kit.slides[index].headline}`}
        data-ready={ready}
        hidden={error}
      />
    </div>
  );
}

function Modal({
  children,
  title,
  onClose,
  className,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className={className}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
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

export default function Studio({
  initialSampleId,
  initialTheme,
  initialSlide = 0,
  initialTab = 'carousel',
}: {
  initialSampleId?: string;
  initialTheme?: Theme;
  initialSlide?: number;
  initialTab?: Tab;
}) {
  const [view, setView] = useState<View>(initialSampleId ? 'workspace' : 'overview');
  const [tab, setTab] = useState<Tab>(initialTab);
  const { project, setProject, resetProject, syncProject, undo, redo, canUndo, canRedo } =
    useProjectHistory(() => {
      const sample = getSample(initialSampleId || 'fragrance');
      return {
        ...starter,
        product: sample.product,
        sampleId: sample.id,
        gallery: getSampleGallery(sample.id),
        slidePhotos:
          sample.id === 'fragrance'
            ? [null, 'fragrance-detail', 'fragrance-scene', 'fragrance-detail', 'fragrance-scene']
            : undefined,
        generationBrief: sample.product,
        kit: createTemplateKit(sample.product),
        theme: initialTheme || sample.theme,
      };
    });
  const [dirty, setDirty] = useState(false);
  const [briefChanged, setBriefChanged] = useState(false);
  const [slide, setSlide] = useState(initialSlide);
  const [mobilePane, setMobilePane] = useState<'canvas' | 'brief'>('canvas');
  const [inspector, setInspector] = useState<'design' | 'copy' | 'photos'>('photos');
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  const [proof, setProof] = useState<'shop' | 'instagram' | 'email'>('shop');
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
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const assetTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const selected = assetTabRefs.current[assetTabs.findIndex((item) => item.id === tab)];
    const strip = selected?.parentElement;
    if (selected && strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft =
        selected.offsetLeft - strip.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
    }
  }, [tab, view, mobilePane]);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const latestProject = useRef(project);
  latestProject.current = project;
  const projectEpoch = useRef(0);
  const photoRequest = useRef(0);
  const briefBaselines = useRef(new WeakMap<Kit, string>());
  const previousKit = useRef(project.kit);
  const db = getSupabase();
  const notify = useCallback((s: string) => setToast(s), []);
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');

  useEffect(() => {
    // Keep each history snapshot tied to the brief that produced its copy. Text
    // edits inherit that baseline; full regeneration explicitly replaces it.
    let baseline = briefBaselines.current.get(project.kit);
    if (baseline === undefined) {
      baseline = project.generationBrief
        ? briefSignature(project.generationBrief)
        : (briefBaselines.current.get(previousKit.current) ?? briefSignature(project.product));
      briefBaselines.current.set(project.kit, baseline);
    }
    previousKit.current = project.kit;
    setBriefChanged(!project.product.facts.trim() || baseline !== briefSignature(project.product));
  }, [project.kit, project.product, project.generationBrief]);
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
    setProject((p) => ({ ...p, product: { ...p.product, [key]: value } }), `product:${key}`);
    setDirty(true);
    setBriefChanged(true);
  }
  function editKit<K extends keyof Kit>(key: K, value: Kit[K]) {
    setProject((p) => ({ ...p, kit: { ...p.kit, [key]: value } }), `kit:${key}`);
    setDirty(true);
  }
  function editSlide(key: 'eyebrow' | 'headline' | 'body', value: string) {
    setProject(
      (p) => ({
        ...p,
        kit: {
          ...p.kit,
          slides: p.kit.slides.map((s, i) => (i === slide ? { ...s, [key]: value } : s)),
        },
      }),
      `slide:${slide}:${key}`,
    );
    setDirty(true);
  }
  function changeView(next: View) {
    setView(next);
    setMenuOpen(false);
    setError('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function navigateAssetTabs(event: KeyboardEvent<HTMLDivElement>) {
    const current = assetTabs.findIndex((item) => item.id === tab);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % assetTabs.length;
    else if (event.key === 'ArrowLeft') next = (current + assetTabs.length - 1) % assetTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = assetTabs.length - 1;
    else return;
    event.preventDefault();
    setTab(assetTabs[next].id);
    assetTabRefs.current[next]?.focus();
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
      const validated = validateProject(p);
      const restored = validated;
      projectEpoch.current += 1;
      briefBaselines.current.set(
        restored.kit,
        briefSignature(restored.generationBrief || restored.product),
      );
      resetProject(restored);
      setDirty(false);
      setBriefChanged(
        briefSignature(restored.generationBrief || restored.product) !==
          briefSignature(restored.product),
      );
      setSlide(0);
      setMobilePane('canvas');
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
    projectEpoch.current += 1;
    const product: Product = {
      ...DEFAULT_PRODUCT,
      name: 'Your next product',
      brand: 'Your brand',
      facts: '',
      audience: '',
      price: '',
      cta: 'Explore the collection',
    };
    const preset = readSavedBrand();
    if (preset) {
      product.brand = preset.name;
      product.voice = preset.branding.voice;
      product.cta = preset.branding.cta;
    }
    const kit = createTemplateKit(product);
    briefBaselines.current.set(kit, briefSignature(product));
    resetProject({
      ...starter,
      id: crypto.randomUUID(),
      product,
      kit,
      image: null,
      sampleId: undefined,
      gallery: undefined,
      slidePhotos: undefined,
      generationBrief: undefined,
      review: undefined,
      updatedAt: new Date().toISOString(),
      ...(preset ? { branding: preset.branding } : {}),
    });
    setDirty(false);
    setBriefChanged(true);
    setSlide(0);
    setTab('carousel');
    setMobilePane('brief');
    changeView('workspace');
    notify('New project created. Add your product facts to get started.');
  }
  function loadSample(id: string) {
    if (
      dirty &&
      !window.confirm('Switch examples? Save your current changes first if you want to keep them.')
    )
      return;
    projectEpoch.current += 1;
    const sample = getSample(id);
    const kit = createTemplateKit(sample.product);
    briefBaselines.current.set(kit, briefSignature(sample.product));
    resetProject({
      ...starter,
      product: sample.product,
      sampleId: sample.id,
      gallery: getSampleGallery(sample.id),
      slidePhotos:
        sample.id === 'fragrance'
          ? [null, 'fragrance-detail', 'fragrance-scene', 'fragrance-detail', 'fragrance-scene']
          : undefined,
      generationBrief: sample.product,
      kit,
      theme: sample.theme,
    });
    setDirty(false);
    setBriefChanged(false);
    setSlide(0);
    setError('');
    setMobilePane('canvas');
    changeView('workspace');
  }
  async function upload(file?: File) {
    if (!file) return;
    const epoch = projectEpoch.current;
    const request = ++photoRequest.current;
    try {
      const image = await readGalleryPhoto(file);
      if (epoch !== projectEpoch.current || request !== photoRequest.current) return;
      const current = latestProject.current;
      const gallery = (current.gallery || []).filter((photo) => !photo.src.startsWith('/samples/'));
      if (imageBudget({ image, gallery }).used > imageBudget(current).limit)
        throw new Error(
          'This cover exceeds the kit’s image budget. Remove an additional photo and try again.',
        );
      const ids = new Set(gallery.map((photo) => photo.id));
      setProject((p) => ({
        ...p,
        image,
        sampleId: undefined,
        gallery,
        slidePhotos: p.slidePhotos?.map((id) => (id && ids.has(id) ? id : null)),
      }));
      setDirty(true);
      notify('Photo added. It stays in your browser until you choose Gemini or cloud save.');
    } catch (e) {
      if (epoch === projectEpoch.current && request === photoRequest.current) fail(e);
    } finally {
      if (request === photoRequest.current && fileRef.current) fileRef.current.value = '';
    }
  }
  async function generate(target: AssetTarget = 'all') {
    setError('');
    try {
      const product = validateProduct(project.product);
      if (
        (target !== 'all' || dirty) &&
        !briefChanged &&
        !window.confirm(
          target === 'all'
            ? 'Regenerate the full kit? This replaces the current text. You can undo this change.'
            : 'Regenerate this asset? Other edited assets will be preserved. You can undo this change.',
        )
      )
        return;
      setBusy('generate');
      const epoch = projectEpoch.current;
      const originalProduct = project.product;
      let kit: Kit;
      if (engine === 'template') kit = createTemplateKit(product);
      else {
        if (STATIC_DEMO)
          throw new Error(
            'Gemini is unavailable in this GitHub Pages demo. Choose free templates.',
          );
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
      if (epoch !== projectEpoch.current) {
        notify('The project changed, so the generated result was discarded.');
        return;
      }
      const changedDuringRequest = latestProject.current.product !== originalProduct;
      const current = latestProject.current;
      const mergedKit = applyGeneratedAsset(current.kit, kit, target);
      const baseline =
        target === 'all'
          ? briefSignature(product)
          : (briefBaselines.current.get(current.kit) ?? briefSignature(originalProduct));
      briefBaselines.current.set(mergedKit, baseline);
      setProject({
        ...current,
        product: changedDuringRequest ? current.product : product,
        kit: mergedKit,
        ...(target === 'all' ? { generationBrief: product } : {}),
        source: engine,
      });
      setDirty(true);
      setBriefChanged(
        changedDuringRequest ||
          baseline !== briefSignature(changedDuringRequest ? current.product : product),
      );
      if (target === 'all') setSlide(0);
      setMobilePane('canvas');
      notify(
        engine === 'template'
          ? target === 'all'
            ? 'Your fact-based template kit is ready to edit.'
            : 'This asset is refreshed. Your other edits are preserved.'
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
      const epoch = projectEpoch.current;
      const snapshot = project;
      const p = validateProject({
        ...project,
        id: project.id === 'sample' ? crypto.randomUUID() : project.id,
        updatedAt: new Date().toISOString(),
      });
      setBusy('save');
      await saveProject(p);
      if (epoch === projectEpoch.current) {
        const changed = latestProject.current !== snapshot;
        syncProject(changed ? { ...latestProject.current, id: p.id, updatedAt: p.updatedAt } : p);
        setDirty(changed);
      }
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
      notify(
        STATIC_DEMO
          ? 'This demo saves kits in your browser. Download a backup to use another device.'
          : 'Enable Supabase to use cloud accounts. Browser saves work now.',
      );
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
  const photo = getProjectImage(project);
  const reviewProgress = useMemo(() => getReviewProgress(project), [project]);
  function changePalette(key: Theme) {
    setProject((p) => ({
      ...p,
      theme: key,
      ...(p.branding
        ? {
            branding: {
              ...p.branding,
              background: THEMES[key].bg,
              ink: THEMES[key].ink,
              primary: THEMES[key].accent,
            },
          }
        : {}),
    }));
    setDirty(true);
  }
  function changeCreative(patch: Partial<Project>) {
    const before = getDesign(project);
    const scaleOnly =
      patch.design &&
      Object.keys(before).every(
        (key) =>
          key === 'imageScale' ||
          before[key as keyof typeof before] === patch.design![key as keyof typeof before],
      );
    setProject((p) => ({ ...p, ...patch }), scaleOnly ? 'design:image-scale' : undefined);
    setDirty(true);
    if (patch.product) setBriefChanged(true);
  }
  const titles = {
    overview: 'Your creative desk',
    workspace: 'Launch workspace',
    saved: 'Your projects',
    brand: 'Brand direction',
    connections: 'Connections',
  };
  const nav = [
    { id: 'overview' as View, icon: Home, label: 'Overview' },
    { id: 'workspace' as View, icon: Grid2X2, label: 'Creative studio' },
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
        <a className="wordmark" href={publicPath('/')} aria-label="StudioShelf home">
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
        <div className="ws-sidebar-tools">
          <span>YOUR CURRENT KIT</span>
          <button
            onClick={() => {
              setTab('publish');
              setMobilePane('canvas');
              changeView('workspace');
            }}
          >
            <PackageCheck size={16} /> Publish pack <small>4 channels</small>
          </button>
          <button
            onClick={() => {
              setTab('carousel');
              setInspector('photos');
              setMobilePane('canvas');
              changeView('workspace');
            }}
          >
            <ImagePlus size={16} /> Product photos{' '}
            <small>{(project.gallery?.length || 0) + (photo ? 1 : 0)}</small>
          </button>
          <button
            onClick={() => {
              setTab('review');
              setMobilePane('canvas');
              changeView('workspace');
            }}
          >
            <ShieldCheck size={16} /> Review checklist{' '}
            <small>
              {reviewProgress.done}/{reviewProgress.total}
            </small>
          </button>
          <button onClick={() => setExportOpen(true)} disabled={!!busy}>
            <Download size={16} /> Download kit
          </button>
          <button onClick={newKit}>
            <Plus size={16} /> New project
          </button>
        </div>
        <div className="ws-sidebar-current">
          {photo && <img src={publicPath(photo)} alt="" />}
          <div>
            <small>ON YOUR DESK</small>
            <strong>{project.product.name}</strong>
          </div>
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
      <div className={`main-shell view-${view}`}>
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
          <DemoNotice />
          <div className="page-heading">
            <div>
              <p className="eyebrow">STUDIOSHELF / {view.toUpperCase()}</p>
              <h1>{titles[view]}</h1>
              <p>
                {view === 'overview'
                  ? 'Everything you need to introduce what you make.'
                  : view === 'workspace'
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

          {view === 'overview' && (
            <StudioOverview
              project={project}
              saved={saved}
              onOpenEditor={() => changeView('workspace')}
              onSample={loadSample}
              onOpenSaved={openProject}
              onViewSaved={() => changeView('saved')}
              onBrand={() => changeView('brand')}
              onTour={() => setTour(0)}
              onAsset={(next, selectedSlide, preview) => {
                setTab(next);
                if (selectedSlide !== undefined) setSlide(selectedSlide);
                if (preview === 'email') setProof('email');
                setMobilePane('canvas');
                changeView('workspace');
              }}
              Preview={Preview}
            />
          )}

          {view === 'workspace' && (
            <>
              <div className="ws-commandbar">
                <button className="ws-back" onClick={() => changeView('overview')}>
                  <ArrowLeft size={16} /> My creative desk
                </button>
                <div className="ws-history">
                  <button
                    className="icon-btn"
                    title="Undo"
                    aria-label="Undo last change"
                    disabled={!canUndo || !!busy}
                    onClick={() => {
                      undo();
                      setDirty(true);
                    }}
                  >
                    <Undo2 size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Redo"
                    aria-label="Redo last change"
                    disabled={!canRedo || !!busy}
                    onClick={() => {
                      redo();
                      setDirty(true);
                    }}
                  >
                    <Redo2 size={17} />
                  </button>
                </div>
                <button className="ws-preview-button" onClick={() => setFullscreen(true)}>
                  <Eye size={16} /> Preview
                </button>
                <button className="btn btn-light" onClick={() => save()} disabled={!!busy}>
                  <FolderOpen size={15} /> Save changes
                </button>
                <button
                  className="btn btn-dark"
                  onClick={() => setExportOpen(true)}
                  disabled={!!busy}
                >
                  <Download size={15} /> Download kit
                </button>
              </div>
              <div className="ws-project-title">
                <div>
                  <span className="eyebrow">YOUR CURRENT LAUNCH</span>
                  <h1>{project.product.name}</h1>
                  <p>
                    {project.product.brand} <span>·</span> {facts.length} product facts{' '}
                    <span>·</span> 9 editable assets
                  </p>
                </div>
                <button onClick={() => setTour(0)}>
                  <Play size={14} /> Quick walkthrough
                </button>
              </div>
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
                      <img src={publicPath(sample.image)} alt="" />
                      {sample.label}
                    </button>
                  ))}
                </div>
                <button className="sample-own" onClick={newKit}>
                  Use your own product <ArrowRight size={14} />
                </button>
              </div>
              <div className="ws-mobile-panes" aria-label="Editor panel">
                <button
                  aria-pressed={mobilePane === 'canvas'}
                  onClick={() => setMobilePane('canvas')}
                >
                  <Grid2X2 size={15} /> Canvas & assets
                </button>
                <button
                  aria-pressed={mobilePane === 'brief'}
                  onClick={() => setMobilePane('brief')}
                >
                  <SlidersHorizontal size={15} /> Product brief
                </button>
              </div>
              <div className="workspace-grid" data-pane={mobilePane}>
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
                          src={publicPath(photo)}
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
                          photoRequest.current += 1;
                          setProject((p) => ({ ...p, image: null }));
                          setDirty(true);
                        }}
                        aria-label="Remove photo"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <button
                    className="ws-media-shortcut"
                    onClick={() => {
                      setInspector('photos');
                      setTab('carousel');
                      setMobilePane('canvas');
                    }}
                  >
                    <ImagePlus size={13} /> Manage product photos (
                    {(project.gallery?.length || 0) + (photo ? 1 : 0)})
                  </button>
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
                    <details
                      className="more-details"
                      open={moreDetailsOpen}
                      onToggle={(event) => setMoreDetailsOpen(event.currentTarget.open)}
                    >
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
                      <Field
                        label="Product link (optional)"
                        hint="Use your product’s HTTPS page. Regenerate copy to include it in calls to action."
                      >
                        <input
                          type="url"
                          value={project.product.url || ''}
                          maxLength={2048}
                          placeholder="https://your-store.com/products/your-product"
                          onChange={(e) => editProduct('url', e.target.value)}
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
                          {!STATIC_DEMO && (
                            <option value="gemini">Gemini · your connected key</option>
                          )}
                        </select>
                      </label>
                      <button
                        className="btn btn-purple generate-btn"
                        disabled={!!busy}
                        onClick={() => generate()}
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
                      <h2>Make a good first impression.</h2>
                    </div>
                    <span className="engine-badge">
                      <span className="status-dot" />
                      {project.source === 'gemini' ? 'Gemini draft' : 'Template draft'}
                    </span>
                  </div>
                  <div
                    className="output-tabs"
                    role="tablist"
                    aria-label="Launch kit assets"
                    onKeyDown={navigateAssetTabs}
                  >
                    {assetTabs.map((t, index) => (
                      <button
                        key={t.id}
                        ref={(element) => {
                          assetTabRefs.current[index] = element;
                        }}
                        role="tab"
                        id={`tab-${t.id}`}
                        aria-selected={tab === t.id}
                        aria-controls={`panel-${t.id}`}
                        tabIndex={tab === t.id ? 0 : -1}
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
                    tabIndex={0}
                    className="tab-content"
                  >
                    {tab === 'carousel' && (
                      <div className="ws-stage">
                        <div className="ws-stage-main">
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
                                    onClick={() => changePalette(key)}
                                  >
                                    {project.theme === key && <Check size={11} />}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div
                              className="ws-canvas-scroll"
                              tabIndex={0}
                              aria-label="Slide canvas. Use left and right arrow keys to browse slides."
                              onKeyDown={(event) => {
                                if (event.key === 'ArrowRight') {
                                  event.preventDefault();
                                  setSlide((index) => Math.min(4, index + 1));
                                }
                                if (event.key === 'ArrowLeft') {
                                  event.preventDefault();
                                  setSlide((index) => Math.max(0, index - 1));
                                }
                              }}
                            >
                              <div
                                className="main-preview"
                                style={{ width: `calc(var(--canvas-base, 330px) * ${zoom / 100})` }}
                              >
                                <Preview project={project} index={slide} />
                              </div>
                            </div>
                            <div className="ws-canvas-controls">
                              <button
                                aria-label="Zoom out"
                                disabled={zoom <= 60}
                                onClick={() => setZoom((value) => Math.max(60, value - 20))}
                              >
                                <ZoomOut size={15} />
                              </button>
                              <button onClick={() => setZoom(100)} aria-label="Reset preview zoom">
                                {zoom}%
                              </button>
                              <button
                                aria-label="Zoom in"
                                disabled={zoom >= 160}
                                onClick={() => setZoom((value) => Math.min(160, value + 20))}
                              >
                                <ZoomIn size={15} />
                              </button>
                              <button
                                aria-label="Open large preview"
                                onClick={() => setFullscreen(true)}
                              >
                                <Maximize2 size={15} />
                              </button>
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
                        </div>
                        <aside className="ws-inspector">
                          <div className="ws-inspector-tabs" aria-label="Canvas controls">
                            <button
                              aria-pressed={inspector === 'photos'}
                              onClick={() => setInspector('photos')}
                            >
                              <ImagePlus size={14} /> Photos
                            </button>
                            <button
                              aria-pressed={inspector === 'design'}
                              onClick={() => setInspector('design')}
                            >
                              <SlidersHorizontal size={14} /> Design
                            </button>
                            <button
                              aria-pressed={inspector === 'copy'}
                              onClick={() => setInspector('copy')}
                            >
                              <Copy size={14} /> Text
                            </button>
                          </div>
                          {inspector === 'photos' ? (
                            <ProductMedia
                              key={`${project.id}:${project.sampleId || ''}`}
                              project={project}
                              slide={slide}
                              onChange={changeCreative}
                              onError={setError}
                              onNotice={notify}
                            />
                          ) : inspector === 'design' ? (
                            <CreativeControls project={project} onChange={changeCreative} />
                          ) : (
                            <section className="slide-editor">
                              <h3>Slide {slide + 1} · make it yours</h3>
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
                                  Long text is shortened to fit the artwork. Preview every slide
                                  before exporting.
                                </small>
                                <button
                                  className="btn btn-light"
                                  disabled={!!busy}
                                  onClick={() => generate(`slide:${slide}`)}
                                >
                                  <Sparkles size={14} /> Refresh this slide
                                </button>
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
                            </section>
                          )}
                        </aside>
                      </div>
                    )}
                    {tab === 'listing' && (
                      <div className="text-panel">
                        <AssetProof project={project} mode="shop" Preview={Preview} />
                        <div className="text-intro">
                          <h3>Ready for your shop window.</h3>
                          <p>Refine the details. Make every word sound like your brand.</p>
                          <button
                            className="ws-inline-action"
                            disabled={!!busy}
                            onClick={() => generate('listing')}
                          >
                            <Sparkles size={14} /> Refresh listing only
                          </button>
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
                        <div className="ws-proof-switch" aria-label="Channel preview">
                          <button
                            aria-pressed={proof !== 'email'}
                            onClick={() => setProof('instagram')}
                          >
                            Social post
                          </button>
                          <button
                            aria-pressed={proof === 'email'}
                            onClick={() => setProof('email')}
                          >
                            Launch email
                          </button>
                        </div>
                        <AssetProof
                          project={project}
                          mode={proof === 'email' ? 'email' : 'instagram'}
                          Preview={Preview}
                        />
                        <div className="text-intro">
                          <h3>One voice. Every channel.</h3>
                          <p>Your launch, with a consistent voice from post to inbox.</p>
                        </div>
                        <div className="ws-channel-refresh">
                          <button disabled={!!busy} onClick={() => generate('instagram')}>
                            <Sparkles size={13} /> Refresh Instagram
                          </button>
                          <button disabled={!!busy} onClick={() => generate('whatsapp')}>
                            <Sparkles size={13} /> Refresh WhatsApp
                          </button>
                          <button disabled={!!busy} onClick={() => generate('email')}>
                            <Sparkles size={13} /> Refresh email
                          </button>
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
                      <KitReview
                        project={project}
                        stale={briefChanged}
                        onChange={changeCreative}
                        onSlide={(index) => {
                          setSlide(index);
                          setTab('carousel');
                          setInspector('photos');
                        }}
                      />
                    )}
                    {tab === 'publish' && (
                      <PublishPack
                        project={project}
                        onNavigate={(target) => {
                          setMobilePane(
                            target === 'brief' || target === 'link' ? 'brief' : 'canvas',
                          );
                          if (target === 'photos') {
                            setInspector('photos');
                            setTab('carousel');
                          } else if (target === 'link') {
                            setMoreDetailsOpen(true);
                            requestAnimationFrame(() =>
                              document
                                .querySelector<HTMLElement>('.brief-panel input[type=url]')
                                ?.focus(),
                            );
                          } else if (target === 'brief') {
                            requestAnimationFrame(() =>
                              document.querySelector<HTMLElement>('.brief-panel textarea')?.focus(),
                            );
                          } else setTab(target);
                        }}
                      />
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
            <div className="settings-grid ws-brand-workspace">
              <LocalBrandKit
                project={project}
                onChange={changeCreative}
                onNotice={notify}
                onError={setError}
              />
              <section className="brand-preview ws-brand-preview">
                <div>
                  <span className="eyebrow">LIVE BRAND PREVIEW</span>
                  <h2>A look that travels with you.</h2>
                  <p>Your logo and colours, on the actual exported artwork.</p>
                </div>
                <Preview project={project} index={slide} />
                <div className="ws-brand-preview-nav">
                  <button
                    disabled={slide === 0}
                    onClick={() => setSlide((index) => index - 1)}
                    aria-label="Previous brand preview"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span>Slide {slide + 1} of 5</span>
                  <button
                    disabled={slide === 4}
                    onClick={() => setSlide((index) => index + 1)}
                    aria-label="Next brand preview"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                <button
                  className="btn btn-dark"
                  onClick={() => {
                    setTab('carousel');
                    changeView('workspace');
                  }}
                >
                  Continue in creative studio <ArrowRight size={15} />
                </button>
              </section>
            </div>
          )}

          {view === 'connections' && (
            <div className="connections-grid">
              <section className="settings-card">
                <div className="connection-icon">
                  <Sparkles size={24} />
                </div>
                <h2>{STATIC_DEMO ? 'Explore with free templates.' : 'Connect Gemini.'}</h2>
                <p>
                  {STATIC_DEMO
                    ? 'This interactive showcase runs in your browser. Add facts and photos, edit every asset, and download a complete launch pack. Gemini and Shopify require the full server deployment.'
                    : 'Connect your own API key to write richer launch copy from your brief and product photo.'}
                </p>
                <div className="connection-status">
                  <span className="status-dot" />
                  {STATIC_DEMO
                    ? 'Template mode is ready · no API key needed'
                    : apiKey
                      ? 'Key added for this tab'
                      : 'Not connected · template mode is available'}
                </div>
                {STATIC_DEMO ? (
                  <button className="btn btn-dark" onClick={() => changeView('workspace')}>
                    Open creative studio <ArrowRight size={15} />
                  </button>
                ) : (
                  <>
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
                      When you generate with Gemini, your brief and photo pass through this app’s
                      server to Google. Google’s free tier may use submitted content to improve its
                      products. Use photos and facts you have permission to share.{' '}
                      <a
                        href="https://ai.google.dev/gemini-api/terms"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read Google’s terms
                      </a>
                      . Your key is not saved in project backups or cloud records.
                    </div>
                  </>
                )}
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
                      : STATIC_DEMO
                        ? 'Kits are saved only in this browser. Accounts and cross-device cloud storage are unavailable in the Pages demo. Keep an editable backup before clearing browser data.'
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
                    <span className="setup-badge">
                      {STATIC_DEMO
                        ? 'Browser-local saving enabled'
                        : 'Optional Supabase integration included'}
                    </span>
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
            <a href={publicPath('/')} className="footer-wordmark">
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
      {fullscreen && (
        <Modal
          title={
            tab === 'carousel'
              ? `Slide ${slide + 1} — ${project.product.name}`
              : 'Your content, in context'
          }
          className="ws-preview-modal"
          onClose={() => setFullscreen(false)}
        >
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {tab === 'carousel' ? (
            <div className="ws-large-preview">
              <Preview project={project} index={slide} />
              <div className="ws-large-nav">
                <button
                  className="btn btn-light"
                  disabled={slide === 0}
                  onClick={() => setSlide((index) => index - 1)}
                >
                  <ArrowLeft size={16} /> Previous
                </button>
                <span>{slide + 1} / 5</span>
                <button
                  className="btn btn-light"
                  disabled={slide === 4}
                  onClick={() => setSlide((index) => index + 1)}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
              <button
                className="btn btn-dark"
                disabled={!!busy}
                onClick={async () => {
                  try {
                    await exportSlide(project, slide);
                    notify('Slide PNG downloaded.');
                  } catch (error) {
                    fail(error);
                  }
                }}
              >
                <Download size={15} /> Download this PNG
              </button>
            </div>
          ) : (
            <div className="ws-large-proof">
              <div className="ws-proof-switch">
                {(['shop', 'instagram', 'email'] as const).map((mode) => (
                  <button key={mode} aria-pressed={proof === mode} onClick={() => setProof(mode)}>
                    {mode === 'shop'
                      ? 'Shop listing'
                      : mode === 'instagram'
                        ? 'Social post'
                        : 'Launch email'}
                  </button>
                ))}
              </div>
              <AssetProof project={project} mode={proof} Preview={Preview} />
            </div>
          )}
        </Modal>
      )}
      {exportOpen && (
        <Modal
          title="Take your launch with you."
          className="ws-export-modal"
          onClose={() => setExportOpen(false)}
        >
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {toast && (
            <p className="alert" role="status">
              {toast}
            </p>
          )}
          <div className="ws-export-intro">
            <div>
              <Preview project={project} index={0} small />
            </div>
            <section>
              <span className="eyebrow">YOUR DOWNLOAD</span>
              <h3>{project.product.name}</h3>
              <p>Editable copy. Branded artwork. Ready for your final review.</p>
              <span>
                {project.source === 'gemini' ? 'Gemini draft' : 'Fact-based template'} ·{' '}
                {project.branding ? 'Custom brand' : THEMES[project.theme].name}
              </span>
            </section>
          </div>
          <ul className="ws-export-manifest">
            <li>
              <Check size={16} />
              <span>
                <strong>Five carousel PNGs</strong>
                <small>1080 × 1350 · your current design</small>
              </span>
              <span>PNG</span>
            </li>
            <li>
              <Check size={16} />
              <span>
                <strong>Listing, captions & email</strong>
                <small>Markdown, CSV and five channel text/HTML files</small>
              </span>
              <span>TXT</span>
            </li>
            <li>
              <Check size={16} />
              <span>
                <strong>Editable project backup</strong>
                <small>Includes photos, brand and design settings</small>
              </span>
              <span>JSON</span>
            </li>
          </ul>
          <p className="ws-export-note">
            Review facts and text fit before sharing. Downloads do not publish to any account.
          </p>
          <button
            className="btn btn-dark ws-export-primary"
            disabled={!!busy}
            onClick={async () => {
              await exportAll();
            }}
          >
            {busy === 'export' ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Download size={17} />
            )}{' '}
            {busy === 'export' ? 'Preparing your files…' : 'Download complete ZIP'}
          </button>
          <button
            className="ws-inline-action"
            onClick={() => {
              setExportOpen(false);
              setTab('review');
              setMobilePane('canvas');
            }}
          >
            Review product facts first <ArrowRight size={14} />
          </button>
        </Modal>
      )}
      {tour !== null && (
        <Modal
          title="A launch kit in three small steps."
          className="ws-tour-modal"
          onClose={() => setTour(null)}
        >
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="ws-tour-progress">
            {['Choose a product', 'Find your look', 'Make it yours'].map((label, index) => (
              <button
                key={label}
                aria-current={tour === index ? 'step' : undefined}
                onClick={() => setTour(index)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            ))}
          </div>
          {tour === 0 ? (
            <div className="ws-tour-step">
              <h3>Start with something real.</h3>
              <p>
                Choose a fictional example to explore, or use your own product photo and facts in
                the studio.
              </p>
              <div className="ws-tour-samples">
                {SAMPLE_PRODUCTS.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => {
                      loadSample(sample.id);
                      setTour(1);
                    }}
                  >
                    <img src={publicPath(sample.image)} alt="" />
                    <strong>{sample.label}</strong>
                    <span>
                      Explore this kit <ArrowRight size={13} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : tour === 1 ? (
            <div className="ws-tour-design">
              <div>
                <Preview project={project} index={0} />
              </div>
              <section>
                <h3>See your decisions take shape.</h3>
                <p>These controls change the same artwork that appears in the downloaded PNG.</p>
                <CreativeControls project={project} onChange={changeCreative} />
                <button className="btn btn-dark" onClick={() => setTour(2)}>
                  Next: make it yours <ArrowRight size={15} />
                </button>
              </section>
            </div>
          ) : (
            <div className="ws-tour-step">
              <h3>Your product. Your final say.</h3>
              <p>
                Edit a headline, preview every slide, then download the actual artwork. Templates
                work without an account or API key.
              </p>
              <Field label="Try editing the first headline">
                <input
                  maxLength={100}
                  value={project.kit.slides[0].headline}
                  onChange={(event) => {
                    setProject(
                      (p) => ({
                        ...p,
                        kit: {
                          ...p.kit,
                          slides: p.kit.slides.map((item, index) =>
                            index === 0 ? { ...item, headline: event.target.value } : item,
                          ),
                        },
                      }),
                      'tour-headline',
                    );
                    setDirty(true);
                  }}
                />
              </Field>
              <div className="ws-tour-final">
                <div>
                  <Preview project={project} index={0} />
                </div>
                <section>
                  <button
                    className="btn btn-light"
                    onClick={async () => {
                      try {
                        await exportSlide(project, 0);
                        notify('Your edited PNG is downloaded.');
                      } catch (error) {
                        fail(error);
                      }
                    }}
                  >
                    <Download size={15} /> Download this preview
                  </button>
                  <button
                    className="btn btn-dark"
                    onClick={() => {
                      setTour(null);
                      setTab('carousel');
                      setMobilePane('canvas');
                      setInspector('copy');
                      changeView('workspace');
                    }}
                  >
                    Continue creating <ArrowRight size={15} />
                  </button>
                </section>
              </div>
            </div>
          )}
        </Modal>
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
