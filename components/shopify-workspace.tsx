'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  PackageSearch,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import BrandLogo from './brand-logo';
import ThemeToggle from './theme-toggle';
import CreativeControls from './creative-controls';
import AssetProof from './asset-proof';
import { CREATIVE_LAYOUTS, getDesign } from '@/lib/creative';
import { createTemplateKit } from '@/lib/engine';
import { drawSlide, exportKit, readPhoto } from '@/lib/export';
import { THEMES, type Kit, type Product, type Project, type Theme } from '@/lib/types';
import {
  DEFAULT_STORE_BRAND,
  type AssetTarget,
  type DescriptionPreview,
  type ShopifyKit,
  type ShopifyProduct,
  type StoreBrand,
  type StoreSummary,
} from '@/lib/shopify/types';
import {
  expectShop,
  applyGeneratedAsset,
  requestProductWrite,
  ShopifyClientError,
  shopifyFetch,
  shopifyJson,
} from '@/lib/shopify/client';

type View = 'launch' | 'saved' | 'brand' | 'help';
type AssetTab = 'carousel' | 'listing' | 'social';
type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type SavedKitSummary = Pick<ShopifyKit, 'id' | 'revision' | 'updatedAt' | 'link' | 'stale'> & {
  project: { product: Pick<Product, 'name' | 'brand'> };
};
type Busy =
  | ''
  | 'connect'
  | 'search'
  | 'import'
  | 'generate'
  | 'save'
  | 'download'
  | 'brand'
  | 'preview'
  | 'apply'
  | 'history'
  | 'saved'
  | 'permission';

const post = (value: unknown) => ({ method: 'POST', body: JSON.stringify(value) });
const shortDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something interrupted this operation. Try again.';

function Preview({ project, index }: { project: Project; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError('');
    const canvas = document.createElement('canvas');
    drawSlide(canvas, project, index)
      .then(() => {
        if (!active || !ref.current) return;
        ref.current.width = canvas.width;
        ref.current.height = canvas.height;
        ref.current.getContext('2d')?.drawImage(canvas, 0, 0);
        setError('');
        setReady(true);
      })
      .catch(() => {
        if (active)
          setError('This photo could not be rendered. Choose another image and try again.');
      });
    return () => {
      active = false;
    };
  }, [project, index]);
  return (
    <div className="sh-artboard" aria-busy={!ready && !error}>
      {error && <p role="alert">{error}</p>}
      <canvas
        ref={ref}
        width={1080}
        height={1350}
        role="img"
        aria-label={`Slide ${index + 1}: ${project.kit.slides[index].headline}`}
        data-ready={ready}
        hidden={!!error}
      />
    </div>
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
    <label className="sh-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
  className = '',
  id,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className={`sh-modal ${className}`}
      id={id}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sh-modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="sh-icon" aria-label="Close dialog" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function productImages(product: ShopifyProduct) {
  return [
    ...new Map(
      [
        ...product.images,
        ...product.variants.flatMap((variant) => (variant.image ? [variant.image] : [])),
      ].map((image) => [image.id, image]),
    ).values(),
  ];
}

export default function ShopifyWorkspace({ configured }: { configured: boolean }) {
  const [store, setStore] = useState<StoreSummary | null>(null);
  const [view, setView] = useState<View>('launch');
  const [busy, setBusy] = useState<Busy>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState<'waiting' | 'connected' | 'error'>(
    configured ? 'waiting' : 'error',
  );
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>({ hasNextPage: false, endCursor: null });
  const [searched, setSearched] = useState(false);
  const [imported, setImported] = useState<ShopifyProduct | null>(null);
  const [variantId, setVariantId] = useState('');
  const [imageId, setImageId] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [record, setRecord] = useState<ShopifyKit | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [stale, setStale] = useState(false);
  const [mode, setMode] = useState<'template' | 'byok' | 'hosted'>('template');
  const [apiKey, setApiKey] = useState('');
  const [tab, setTab] = useState<AssetTab>('carousel');
  const [slide, setSlide] = useState(0);
  const [designOpen, setDesignOpen] = useState(false);
  const [artworkOpen, setArtworkOpen] = useState(false);
  const [listingProofOpen, setListingProofOpen] = useState(false);
  const [saved, setSaved] = useState<SavedKitSummary[]>([]);
  const [brand, setBrand] = useState<StoreBrand>(DEFAULT_STORE_BRAND);
  const [preview, setPreview] = useState<DescriptionPreview | null>(null);
  const [approved, setApproved] = useState(false);
  const [history, setHistory] = useState<DescriptionPreview[]>([]);
  const retry = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      expectShop(null);
    };
  }, []);

  const operation = useCallback(
    async (name: Busy, action: () => Promise<void>, retryAction?: () => void) => {
      setBusy(name);
      setError('');
      setNotice('');
      retry.current = retryAction || null;
      try {
        await action();
      } catch (cause) {
        setError(message(cause));
        if (cause instanceof ShopifyClientError && cause.code === 'PRODUCT_CHANGED') setStale(true);
        if (name === 'connect') setConnection('error');
        if (
          cause instanceof ShopifyClientError &&
          (cause.status === 401 || cause.code === 'STORE_CHANGED')
        )
          setConnection('error');
      } finally {
        if (mounted.current) setBusy('');
      }
    },
    [],
  );

  const connect = useCallback(() => {
    void operation('connect', async () => {
      const { store: connected } = await shopifyJson<{ store: StoreSummary }>('store');
      if (!mounted.current) return;
      expectShop(connected.domain);
      setStore(connected);
      setBrand(connected.brand);
      setConnection('connected');
    });
  }, [operation]);

  const searchProducts = (after?: string) => {
    void operation(
      'search',
      async () => {
        const params = new URLSearchParams({ q: query });
        if (after) params.set('after', after);
        const data = await shopifyJson<{ products: ShopifyProduct[]; pageInfo: PageInfo }>(
          `products?${params}`,
        );
        setProducts((current) => (after ? [...current, ...data.products] : data.products));
        setPageInfo(data.pageInfo);
        setSearched(true);
      },
      () => searchProducts(after),
    );
  };

  const openPicker = () => {
    setPicker(true);
    setError('');
    if (!searched) searchProducts();
  };

  const photoData = async (
    productId: string,
    selectedImageId: string,
    selectedVariantId?: string,
  ) => {
    if (!selectedImageId) return null;
    const params = new URLSearchParams({ productId, imageId: selectedImageId });
    if (selectedVariantId) params.set('variantId', selectedVariantId);
    const response = await shopifyFetch(`image?${params}`);
    const blob = await response.blob();
    return readPhoto(new File([blob], 'shopify-product', { type: blob.type }));
  };

  const importProduct = async (item: ShopifyProduct, chosenVariant?: string, keepKit = false) => {
    if (!store) return;
    const variant = item.variants.find((value) => value.id === chosenVariant) || item.variants[0];
    if (!variant) throw new Error('This product has no available variants to import.');
    const image = variant.image || item.images[0];
    const brief: Product = {
      name: item.title.slice(0, 100),
      brand: (item.vendor || store.name).slice(0, 80),
      category: item.productType.slice(0, 60) || 'Other',
      facts: [
        item.description.slice(0, 1500),
        ...variant.selectedOptions
          .filter((option) => option.value !== 'Default Title')
          .map((option) => `${option.name}: ${option.value}`),
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 2000),
      price: variant.price,
      currency: store.currency,
      voice: brand.voice,
      cta: brand.cta,
      audience: '',
      ...(item.onlineStoreUrl ? { url: item.onlineStoreUrl } : {}),
    };
    const imageData = await photoData(item.id, image?.id || '', variant.id);
    setImported(item);
    setVariantId(variant.id);
    setImageId(image?.id || '');
    setProject((current) => ({
      id: keepKit && current ? current.id : crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      product: brief,
      kit: keepKit && current ? current.kit : createTemplateKit(brief),
      image: imageData,
      theme: current?.theme || 'clay',
      source: keepKit && current ? current.source : 'template',
      branding: keepKit && current?.branding ? current.branding : brand,
      ...(keepKit && current?.design ? { design: current.design } : {}),
    }));
    if (!keepKit) {
      setRecord(null);
      setGenerated(false);
    }
    setConfirmed(false);
    setDirty(true);
    setStale(false);
    setPicker(false);
    setSlide(0);
    setView('launch');
    setPreview(null);
    setHistory([]);
    setDesignOpen(false);
    setArtworkOpen(false);
    setListingProofOpen(false);
  };

  const chooseProduct = (item: ShopifyProduct) => {
    if (
      dirty &&
      !window.confirm('Replace the current brief and unsaved launch kit with this product?')
    )
      return;
    void operation(
      'import',
      async () => {
        const data = await shopifyJson<{ product: ShopifyProduct }>(
          `products/${encodeURIComponent(item.id)}`,
        );
        await importProduct(data.product);
        setNotice('Product imported. Review the facts and select the variant before generating.');
      },
      () => chooseProduct(item),
    );
  };

  const updateProduct = <K extends keyof Product>(field: K, value: Product[K]) => {
    setProject((current) =>
      current ? { ...current, product: { ...current.product, [field]: value } } : current,
    );
    setDirty(true);
    setConfirmed(false);
  };
  const updateKit = <K extends keyof Kit>(field: K, value: Kit[K]) => {
    setProject((current) =>
      current ? { ...current, kit: { ...current.kit, [field]: value } } : current,
    );
    setDirty(true);
    setPreview(null);
  };
  const updateSlide = (field: 'eyebrow' | 'headline' | 'body', value: string) => {
    if (!project) return;
    updateKit(
      'slides',
      project.kit.slides.map((item, index) =>
        index === slide ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateAppearance = (patch: Partial<Project>) => {
    setProject((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };
  const chooseCampaignPalette = (theme: Theme | 'brand') => {
    setProject((current) => {
      if (!current) return current;
      const colors =
        theme === 'brand'
          ? { primary: brand.primary, background: brand.background, ink: brand.ink }
          : { primary: THEMES[theme].accent, background: THEMES[theme].bg, ink: THEMES[theme].ink };
      return {
        ...current,
        ...(theme === 'brand' ? {} : { theme }),
        branding: { ...(current.branding || brand), ...colors },
      };
    });
    setDirty(true);
  };
  const hasPalette = (colors: { primary: string; background: string; ink: string }) =>
    project?.branding
      ? project.branding.primary.toLowerCase() === colors.primary.toLowerCase() &&
        project.branding.background.toLowerCase() === colors.background.toLowerCase() &&
        project.branding.ink.toLowerCase() === colors.ink.toLowerCase()
      : false;

  const changeVariant = (id: string) => {
    const variant = imported?.variants.find((item) => item.id === id);
    if (!variant || !project || !imported) return;
    void operation('import', async () => {
      const image = variant.image || imported.images[0];
      const imageData = await photoData(imported.id, image?.id || '', variant.id);
      setVariantId(variant.id);
      setImageId(image?.id || '');
      setProject((current) =>
        current
          ? {
              ...current,
              image: imageData,
              product: {
                ...current.product,
                price: variant.price,
                facts: [
                  imported.description.slice(0, 1500),
                  ...variant.selectedOptions
                    .filter((option) => option.value !== 'Default Title')
                    .map((option) => `${option.name}: ${option.value}`),
                ]
                  .filter(Boolean)
                  .join('\n')
                  .slice(0, 2000),
              },
            }
          : current,
      );
      setDirty(true);
      setConfirmed(false);
      setNotice(
        'Variant changed. The existing kit is preserved; review the new brief before regenerating affected assets.',
      );
    });
  };

  const loadMoreVariants = () => {
    if (!imported?.variantsPageInfo.endCursor) return;
    void operation('import', async () => {
      const data = await shopifyJson<{ product: ShopifyProduct }>(
        `products/${encodeURIComponent(imported.id)}?variantsAfter=${encodeURIComponent(imported.variantsPageInfo.endCursor!)}`,
      );
      setImported((current) =>
        current
          ? { ...data.product, variants: [...current.variants, ...data.product.variants] }
          : data.product,
      );
    });
  };

  const changeImage = (id: string) => {
    if (!imported) return;
    void operation('import', async () => {
      const image = await photoData(imported.id, id, variantId);
      setImageId(id);
      setProject((current) => (current ? { ...current, image } : current));
      setDirty(true);
    });
  };

  const generate = (target: AssetTarget) => {
    if (!project || !imported) return;
    if (
      target !== 'all' &&
      !window.confirm(
        'Regenerate this asset? Its current edits will be replaced. Other assets will stay as they are.',
      )
    )
      return;
    if (
      target === 'all' &&
      generated &&
      !window.confirm(
        'Generate a new complete kit? This will replace all current copy and slide edits.',
      )
    )
      return;
    void operation(
      'generate',
      async () => {
        const data = await shopifyJson<{
          kit: Kit;
          source: 'template' | 'gemini';
          usage?: StoreSummary['hostedAI'];
        }>(
          'generate',
          post({
            product: project.product,
            productId: imported.id,
            variantId,
            fingerprint: imported.fingerprint,
            imageId: imageId || undefined,
            factsConfirmed: confirmed,
            mode,
            ...(mode === 'byok' ? { apiKey } : {}),
            target,
            currentKit: project.kit,
          }),
        );
        setProject((current) =>
          current
            ? {
                ...current,
                kit: applyGeneratedAsset(current.kit, data.kit, target),
                source: data.source,
              }
            : current,
        );
        if (data.usage)
          setStore((current) => (current ? { ...current, hostedAI: data.usage! } : current));
        setGenerated(true);
        setDirty(true);
        setPreview(null);
        setNotice(
          target === 'all'
            ? 'Your launch kit is ready. Review every asset, then save it to your store.'
            : 'Asset regenerated. Your other edits are preserved.',
        );
      },
      () => generate(target),
    );
  };

  const saveKit = () => {
    if (!project || !imported || stale) return;
    void operation(
      'save',
      async () => {
        const data = await shopifyJson<{ kit: ShopifyKit }>(
          'kits',
          post({
            id: record?.id,
            revision: record?.revision,
            project,
            productId: imported.id,
            variantId,
            imageId: imageId || undefined,
            fingerprint: imported.fingerprint,
          }),
        );
        setRecord(data.kit);
        setProject(data.kit.project);
        setDirty(false);
        setNotice('Saved to your store. Authorized staff can reopen this kit on another device.');
      },
      saveKit,
    );
  };

  const loadSaved = () => {
    setView('saved');
    void operation(
      'saved',
      async () => {
        const data = await shopifyJson<{ kits: SavedKitSummary[] }>('kits');
        setSaved(data.kits);
      },
      loadSaved,
    );
  };

  const reopen = (id: string) => {
    if (dirty && !window.confirm('Leave the current unsaved edits and open this saved kit?'))
      return;
    void operation(
      'saved',
      async () => {
        const data = await shopifyJson<{
          kit: ShopifyKit;
          currentProduct: ShopifyProduct | null;
          stale: boolean;
          productUnavailable?: boolean;
        }>(`kits/${encodeURIComponent(id)}`);
        const current = data.currentProduct;
        if (!current) {
          setNotice(
            'This product is no longer available in Shopify. Your saved kit can still be downloaded. Select another product to create a new kit.',
          );
        } else if (!current.variants.some((variant) => variant.id === data.kit.link.variantId)) {
          setNotice(
            'The saved variant is not on the current page. Load more variants or select its replacement before saving.',
          );
        }
        setRecord(data.kit);
        setProject(data.kit.project);
        setImported(current);
        setVariantId(data.kit.link.variantId);
        setImageId(
          current
            ? productImages(current).find((image) => image.url === data.kit.link.imageUrl)?.id || ''
            : '',
        );
        setConfirmed(false);
        setGenerated(true);
        setDirty(false);
        setStale(data.stale);
        setView('launch');
        setPreview(null);
        setSlide(0);
        setHistory([]);
      },
      () => reopen(id),
    );
  };

  const refreshImported = () => {
    if (
      !imported ||
      !window.confirm(
        'Update this brief and photo from Shopify? Your edited launch assets will be preserved. Review and regenerate only the assets affected by the change.',
      )
    )
      return;
    void operation('import', async () => {
      const data = await shopifyJson<{ product: ShopifyProduct }>(
        `products/${encodeURIComponent(imported.id)}?variantId=${encodeURIComponent(variantId)}`,
      );
      await importProduct(data.product, variantId, true);
      setNotice(
        'Brief refreshed. Your assets are unchanged. Review the facts and regenerate affected assets, then save.',
      );
    });
  };

  const downloadKit = () => {
    if (!project) return;
    void operation(
      'download',
      async () => {
        await exportKit(project);
        setNotice('Launch kit downloaded.');
      },
      downloadKit,
    );
  };

  const saveBrand = () => {
    void operation(
      'brand',
      async () => {
        const data = await shopifyJson<{ brand: StoreBrand }>('brand', {
          method: 'PUT',
          body: JSON.stringify({ brand }),
        });
        setBrand(data.brand);
        setStore((current) => (current ? { ...current, brand: data.brand } : current));
        setNotice('Store branding saved. New kits use these defaults.');
      },
      saveBrand,
    );
  };

  const uploadLogo = (file: File) => {
    void operation('brand', async () => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 220000)
        throw new Error('Choose a PNG, JPG or WebP logo under 220 KB. SVG is not supported.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read this logo.'));
        reader.readAsDataURL(file);
      });
      setBrand((current) => ({ ...current, logo: data }));
      setNotice('Logo selected. Save store branding to use it across devices.');
    });
  };

  const prepareDescription = () => {
    if (!project || !imported) return;
    void operation(
      'preview',
      async () => {
        const data = await shopifyJson<{ preview: DescriptionPreview }>(
          'descriptions/preview',
          post({ productId: imported.id, description: project.kit.description }),
        );
        setPreview(data.preview);
        setApproved(false);
      },
      prepareDescription,
    );
  };

  const applyDescription = () => {
    if (!preview || !approved) return;
    void operation('apply', async () => {
      await shopifyJson('descriptions/apply', post({ previewId: preview.id, approved: true }));
      setPreview(null);
      setStale(true);
      setNotice(
        'Description saved to Shopify. The previous description is kept in history. Refresh the imported brief before your next generation.',
      );
    });
  };

  const loadHistory = () => {
    if (!imported) return;
    void operation(
      'history',
      async () => {
        const data = await shopifyJson<{ history: DescriptionPreview[] }>(
          `descriptions?${new URLSearchParams({ productId: imported.id })}`,
        );
        setHistory(data.history);
        if (!data.history.length)
          setNotice('No description changes have been saved for this product.');
      },
      loadHistory,
    );
  };

  const restore = (id: string) => {
    void operation('preview', async () => {
      const data = await shopifyJson<{ preview: DescriptionPreview }>(
        'descriptions/restore-preview',
        post({ historyId: id }),
      );
      setPreview(data.preview);
      setApproved(false);
    });
  };

  const enableWriting = () => {
    void operation('permission', async () => {
      await requestProductWrite();
      const data = await shopifyJson<{ store: StoreSummary }>('store');
      setStore(data.store);
      setNotice(
        data.store.canWriteProducts
          ? 'Product editing approved. Each change still needs your review and approval.'
          : 'Your staff account cannot edit products. Ask the store owner to check your permissions.',
      );
    });
  };

  const isBusy = Boolean(busy);
  const canGenerate = Boolean(
    confirmed &&
    project?.product.facts.trim() &&
    !stale &&
    (mode !== 'byok' || apiKey.trim()) &&
    (mode !== 'hosted' || (store?.hostedAI.enabled && store.hostedAI.remaining > 0)),
  );
  const badge =
    connection === 'connected'
      ? 'Store connected'
      : connection === 'waiting'
        ? 'Connecting to Shopify'
        : 'Not connected';

  return (
    <div className="sh-shell">
      {configured && (
        <Script
          id="studioshelf-app-bridge"
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          strategy="afterInteractive"
          onReady={connect}
          onError={() => {
            setConnection('error');
            setError(
              'Shopify App Bridge could not load. Check your connection or browser blocker, then retry.',
            );
          }}
        />
      )}
      <a className="skip-link" href="#shopify-main">
        Skip to workspace
      </a>
      <header className="sh-header">
        <a href="/" className="sh-wordmark" target="_blank" rel="noopener noreferrer">
          <BrandLogo size={34} />
          <span>
            Studio<span>Shelf</span>
            <small title={store?.domain}>{store?.name || 'FOR SHOPIFY'}</small>
          </span>
        </a>
        <div className="sh-header-right">
          <span className={`sh-status ${connection === 'connected' ? 'is-connected' : ''}`}>
            <span />
            {badge}
          </span>
          <ThemeToggle />
        </div>
      </header>
      <div className="sh-body">
        <aside className="sh-sidebar">
          <div className="sh-store">
            <span className="sh-store-icon">
              <Store size={21} />
            </span>
            <div>
              <strong>{store?.name || 'Your store'}</strong>
              <small>{store?.domain || 'Connect through Shopify Admin'}</small>
            </div>
          </div>
          <div className="sh-nav-label">YOUR CREATIVE DESK</div>
          <nav aria-label="Shopify workspace">
            <button
              aria-current={view === 'launch' ? 'page' : undefined}
              onClick={() => setView('launch')}
            >
              <Sparkles size={18} />
              Launch studio
            </button>
            <button
              aria-current={view === 'saved' ? 'page' : undefined}
              onClick={loadSaved}
              disabled={!store || isBusy}
            >
              <Cloud size={18} />
              Store kits
            </button>
            <button
              aria-current={view === 'brand' ? 'page' : undefined}
              onClick={() => setView('brand')}
              disabled={!store}
            >
              <Palette size={18} />
              Store branding
            </button>
            <button
              aria-current={view === 'help' ? 'page' : undefined}
              onClick={() => setView('help')}
            >
              <CircleHelp size={18} />
              Help & connections
            </button>
          </nav>
          <div className="sh-sidebar-note">
            <ShieldCheck size={20} />
            <h3>Your store. Your final say.</h3>
            <p>
              Draft freely. Nothing is published to Shopify without a preview and your approval.
            </p>
          </div>
          <div className="sh-sidebar-bottom">
            <small>Free beta · no subscription</small>
            <a href="/pricing" target="_blank" rel="noreferrer">
              Pricing & limits <ExternalLink size={12} />
            </a>
          </div>
        </aside>
        <main id="shopify-main" className="sh-main" aria-busy={isBusy}>
          <div className="sh-heading">
            <div>
              <span className="sh-eyebrow">
                STUDIOSHELF /{' '}
                {view === 'launch'
                  ? 'LAUNCH STUDIO'
                  : view === 'saved'
                    ? 'STORE KITS'
                    : view === 'brand'
                      ? 'STORE BRANDING'
                      : 'HELP & CONNECTIONS'}
              </span>
              <h1>
                {view === 'launch'
                  ? 'From your store. To your story.'
                  : view === 'saved'
                    ? 'A shelf for every launch.'
                    : view === 'brand'
                      ? 'Make it unmistakably yours.'
                      : 'A little help, right here.'}
              </h1>
              <p>
                {view === 'launch'
                  ? 'Turn a real product into a considered, ready-to-share introduction.'
                  : view === 'saved'
                    ? 'Saved to your store, ready for you and your authorized team.'
                    : view === 'brand'
                      ? 'One visual direction. A consistent voice. Saved for your whole store.'
                      : 'Connect your tools, understand your limits, and keep moving.'}
              </p>
            </div>
            {store && (
              <button className="sh-button primary" onClick={openPicker} disabled={isBusy}>
                <PackageSearch size={17} />
                Select product
              </button>
            )}
          </div>
          {(error || notice || isBusy) && (
            <div
              className={`sh-feedback ${error ? 'is-error' : ''}`}
              role={error ? 'alert' : 'status'}
              aria-live="polite"
            >
              {isBusy ? (
                <LoaderCircle className="sh-spin" size={17} />
              ) : error ? (
                <CircleHelp size={17} />
              ) : (
                <Check size={17} />
              )}
              <span>
                {error ||
                  (isBusy
                    ? {
                        '': 'Working…',
                        connect: 'Checking your Shopify identity…',
                        search: 'Searching your products…',
                        import: 'Importing product details and photo…',
                        generate: 'Creating your content…',
                        save: 'Saving to your store…',
                        download: 'Preparing five slides and your copy…',
                        brand: 'Updating store branding…',
                        preview: 'Preparing your description preview…',
                        apply: 'Saving the approved description…',
                        history: 'Loading description history…',
                        saved: 'Opening your store kits…',
                        permission: 'Checking product editing access…',
                      }[busy] || 'Working…'
                    : notice)}
              </span>
              {error && retry.current && !isBusy && (
                <button onClick={() => retry.current?.()}>Try again</button>
              )}
            </div>
          )}
          {!store && (
            <section className="sh-connect-card">
              <div className="sh-connect-art">
                <BrandLogo size={75} />
                <span>+</span>
                <ShoppingBag size={68} strokeWidth={1.2} />
              </div>
              <span className="sh-eyebrow">A MORE CONSIDERED PRODUCT LAUNCH</span>
              <h2>
                Your next introduction
                <br />
                starts in your store.
              </h2>
              <p>
                Select a Shopify product. Review the facts. Create an editable launch kit, save it
                with your team, and download your assets.
              </p>
              <ol className="sh-steps">
                <li>
                  <span>01</span>Select a product
                </li>
                <li>
                  <span>02</span>Shape your story
                </li>
                <li>
                  <span>03</span>Save & download
                </li>
              </ol>
              {configured ? (
                <div>
                  <p>
                    {connection === 'error'
                      ? 'Open StudioShelf from Apps in Shopify Admin. If your session has expired, reopen the app to reconnect.'
                      : 'Waiting for your authenticated Shopify Admin session.'}
                  </p>
                  <button className="sh-button primary" onClick={connect} disabled={isBusy}>
                    <RefreshCw size={16} />
                    Retry connection
                  </button>
                </div>
              ) : (
                <div className="sh-setup-note">
                  <ShieldCheck size={19} />
                  <div>
                    <strong>Shopify setup is not configured yet.</strong>
                    <p>
                      The deployment owner needs to register the app, add its server settings, and
                      install it on a development store. No store data is loaded in this preview.
                    </p>
                    <a href="/help" target="_blank" rel="noopener noreferrer">
                      Read the setup & onboarding guide <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
              )}
              <div className="sh-connect-links">
                <a href="/studio" target="_blank" rel="noopener noreferrer">
                  Try the standalone studio <ArrowRight size={14} />
                </a>
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy policy
                </a>
                <a href="/support" target="_blank" rel="noopener noreferrer">
                  Contact support
                </a>
              </div>
            </section>
          )}
          {store && view === 'launch' && !project && (
            <section className="sh-empty-launch">
              <div className="sh-empty-symbol">
                <PackageSearch size={40} strokeWidth={1.2} />
              </div>
              <span className="sh-eyebrow">01 / START WITH SOMETHING REAL</span>
              <h2>
                Good products deserve
                <br />a good introduction.
              </h2>
              <p>
                Your product details and photography are already in Shopify. Bring them onto your
                creative desk to get started.
              </p>
              <button className="sh-button primary" onClick={openPicker} disabled={isBusy}>
                Choose from your products <ArrowRight size={17} />
              </button>
              <div className="sh-empty-features">
                <span>
                  <Check size={14} />
                  Five editable story slides
                </span>
                <span>
                  <Check size={14} />
                  Listing & channel copy
                </span>
                <span>
                  <Check size={14} />
                  Saved for your store
                </span>
              </div>
            </section>
          )}
          {store && view === 'launch' && project && !imported && (
            <section className="sh-card sh-unavailable-kit">
              <span className="sh-eyebrow">SAVED LAUNCH KIT</span>
              <h2>{project.product.name}</h2>
              <p className="sh-caption">
                This Shopify product is no longer available. Your saved artwork and copy are
                preserved. Download the kit, or select another product to start a new launch.
              </p>
              <Preview project={project} index={slide} />
              <div className="sh-description-actions">
                <button className="sh-button" disabled={isBusy} onClick={openPicker}>
                  Select another product
                </button>
                <button className="sh-button primary" disabled={isBusy} onClick={downloadKit}>
                  <ArrowDownToLine size={16} />
                  Download saved kit
                </button>
              </div>
            </section>
          )}
          {store && view === 'launch' && project && imported && (
            <>
              <div className="sh-workflow-steps">
                <span className="is-done">
                  <Check size={13} />
                  Product selected
                </span>
                <span className={confirmed ? 'is-done' : 'is-current'}>
                  {confirmed ? <Check size={13} /> : '02'} Review facts
                </span>
                <span className={generated ? 'is-done' : ''}>03 Generate & edit</span>
                <span className={!dirty && record ? 'is-done' : ''}>04 Save & download</span>
              </div>
              {stale && (
                <div className="sh-stale" role="status">
                  <RefreshCw size={20} />
                  <div>
                    <strong>Your Shopify product has changed.</strong>
                    <p>
                      Review the latest product details before generating. Your edited assets are
                      preserved until you choose to replace them.
                    </p>
                  </div>
                  <button className="sh-button" onClick={refreshImported} disabled={isBusy}>
                    Review latest details
                  </button>
                </div>
              )}
              <div className="sh-workspace-grid">
                <section className="sh-card sh-brief">
                  <div className="sh-card-heading">
                    <span>01</span>
                    <h2>Your product brief.</h2>
                    <small>IMPORTED FROM SHOPIFY</small>
                  </div>
                  <div className="sh-photo">
                    {project.image ? (
                      <img src={project.image} alt={imported.title} />
                    ) : (
                      <div className="sh-no-photo">
                        <ImagePlus size={30} />
                        <span>No product photo</span>
                      </div>
                    )}
                    <span>REAL PRODUCT · YOUR STORE</span>
                  </div>
                  {productImages(imported).length > 1 && (
                    <div className="sh-photo-options" aria-label="Product images">
                      {productImages(imported).map((image, index) => (
                        <button
                          key={image.id}
                          className={imageId === image.id ? 'is-active' : ''}
                          aria-label={`Use product image ${index + 1}`}
                          aria-pressed={imageId === image.id}
                          onClick={() => changeImage(image.id)}
                          disabled={isBusy}
                        >
                          <img
                            src={image.url}
                            alt={image.altText || `Product image ${index + 1}`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="sh-field-grid">
                    <Field label="Product name">
                      <input
                        value={project.product.name}
                        maxLength={100}
                        onChange={(event) => updateProduct('name', event.target.value)}
                      />
                    </Field>
                    <Field label="Brand / vendor">
                      <input
                        value={project.product.brand}
                        maxLength={80}
                        onChange={(event) => updateProduct('brand', event.target.value)}
                      />
                    </Field>
                  </div>
                  {imported.title.length > 100 && (
                    <p className="sh-caption">
                      The imported title was shortened to fit launch assets. Review it before
                      generating.
                    </p>
                  )}
                  <Field label="Product variant">
                    <select
                      value={variantId}
                      onChange={(event) => changeVariant(event.target.value)}
                      disabled={isBusy}
                    >
                      {!imported.variants.some((variant) => variant.id === variantId) && (
                        <option value={variantId}>
                          Previously selected variant · load more or choose another
                        </option>
                      )}
                      {imported.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.title} · {store.currency} {variant.price}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {imported.variantsPageInfo.hasNextPage && (
                    <button className="sh-text-button" onClick={loadMoreVariants} disabled={isBusy}>
                      Load more variants <ChevronRight size={13} />
                    </button>
                  )}
                  <div className="sh-field-grid">
                    <Field label="Price">
                      <input
                        value={project.product.price}
                        inputMode="decimal"
                        maxLength={20}
                        onChange={(event) => updateProduct('price', event.target.value)}
                      />
                    </Field>
                    <Field label="Store currency">
                      <input value={project.product.currency} readOnly />
                    </Field>
                  </div>
                  <details className="sh-imported-description">
                    <summary>Original Shopify description</summary>
                    <p>{imported.description || 'This product has no description yet.'}</p>
                  </details>
                  <Field
                    label="Confirmed product facts"
                    hint="Review the imported description. Add materials, dimensions, care or delivery details only when you know them. One fact per line."
                  >
                    <textarea
                      value={project.product.facts}
                      rows={6}
                      maxLength={2000}
                      placeholder="Add the product facts your customers need to know…"
                      onChange={(event) => updateProduct('facts', event.target.value)}
                    />
                  </Field>
                  <details className="sh-brief-more">
                    <summary>Voice, audience & call to action</summary>
                    <Field label="Brand voice">
                      <input
                        value={project.product.voice}
                        maxLength={50}
                        onChange={(event) => updateProduct('voice', event.target.value)}
                      />
                    </Field>
                    <Field label="Audience">
                      <input
                        value={project.product.audience}
                        maxLength={200}
                        onChange={(event) => updateProduct('audience', event.target.value)}
                      />
                    </Field>
                    <Field label="Call to action">
                      <input
                        value={project.product.cta}
                        maxLength={80}
                        onChange={(event) => updateProduct('cta', event.target.value)}
                      />
                    </Field>
                  </details>
                  <div className="sh-product-url">
                    <ExternalLink size={14} />
                    {imported.onlineStoreUrl ? (
                      <a href={imported.onlineStoreUrl} target="_blank" rel="noreferrer">
                        View actual product page
                      </a>
                    ) : (
                      <span>Publish this product to the online store to include its live URL.</span>
                    )}
                  </div>
                  <label className="sh-confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span>
                      I reviewed these facts and filled in what was missing. Unconfirmed claims
                      should be left out.
                    </span>
                  </label>
                  <Field label="Create with">
                    <select
                      value={mode}
                      onChange={(event) => setMode(event.target.value as typeof mode)}
                      disabled={isBusy}
                    >
                      <option value="template">Templates · no AI key needed</option>
                      <option value="byok">Gemini · my own API key</option>
                      <option value="hosted" disabled={!store.hostedAI.enabled}>
                        Hosted Gemini{' '}
                        {store.hostedAI.enabled
                          ? `· ${store.hostedAI.remaining} left this month`
                          : '· not enabled'}
                      </option>
                    </select>
                  </Field>
                  {mode === 'byok' && (
                    <Field
                      label="Your Gemini API key"
                      hint="Kept in this tab’s memory. Sent to Google through the app only when you generate; never saved with the kit."
                    >
                      <input
                        type="password"
                        value={apiKey}
                        autoComplete="off"
                        onChange={(event) => setApiKey(event.target.value)}
                      />
                    </Field>
                  )}
                  {mode === 'hosted' && (
                    <p className="sh-caption">
                      {store.hostedAI.used} / {store.hostedAI.limit} generations used this month.
                      Every generation or asset regeneration uses one request. No automatic overage
                      charges.
                    </p>
                  )}
                  {mode !== 'template' && (
                    <p className="sh-caption">
                      Your confirmed product facts will be sent to Google. Product photos stay out
                      of AI requests. Review{' '}
                      <a
                        href="https://ai.google.dev/gemini-api/terms"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Gemini’s terms
                      </a>{' '}
                      before sharing sensitive content.
                    </p>
                  )}
                  <button
                    className="sh-button primary sh-full"
                    onClick={() => generate('all')}
                    disabled={isBusy || !canGenerate}
                  >
                    <Sparkles size={17} />
                    {generated ? 'Regenerate complete kit' : 'Generate launch kit'}
                    <ArrowRight size={17} />
                  </button>
                  {!confirmed && (
                    <p className="sh-caption sh-center">Confirm your product facts to continue.</p>
                  )}
                </section>
                <section className="sh-card sh-output">
                  <div className="sh-card-heading">
                    <span>02</span>
                    <h2>A whole introduction.</h2>
                    <small>
                      {generated
                        ? project.source === 'gemini'
                          ? 'GEMINI DRAFT'
                          : 'TEMPLATE DRAFT'
                        : 'PREVIEW'}
                    </small>
                  </div>
                  <div className="sh-asset-tabs" role="tablist" aria-label="Launch kit assets">
                    {(['carousel', 'listing', 'social'] as AssetTab[]).map((name) => (
                      <button
                        key={name}
                        role="tab"
                        aria-selected={tab === name}
                        aria-controls={`sh-panel-${name}`}
                        id={`sh-tab-${name}`}
                        onClick={() => setTab(name)}
                      >
                        {name === 'carousel'
                          ? 'Story slides'
                          : name === 'listing'
                            ? 'Product listing'
                            : 'Captions & email'}
                      </button>
                    ))}
                  </div>
                  {!generated && (
                    <div className="sh-draft-note">
                      This is a template preview from your imported facts. Confirm the brief and
                      generate to prepare your kit.
                    </div>
                  )}
                  <div role="tabpanel" id={`sh-panel-${tab}`} aria-labelledby={`sh-tab-${tab}`}>
                    {tab === 'carousel' && (
                      <>
                        <div className="sh-artboard-meta">
                          <span>INSTAGRAM PORTRAIT</span>
                          <span>1080 × 1350</span>
                        </div>
                        <div className="sh-canvas-tools">
                          <span>
                            {
                              CREATIVE_LAYOUTS.find(
                                (layout) => layout.id === getDesign(project).layout,
                              )?.name
                            }{' '}
                            <i />{' '}
                            {getDesign(project).typography === 'serif'
                              ? 'Editorial serif'
                              : 'Modern sans'}
                          </span>
                          <div>
                            <button
                              type="button"
                              className="sh-text-button"
                              onClick={() => setDesignOpen(true)}
                              aria-expanded={designOpen}
                              aria-controls="sh-design-options"
                              aria-haspopup="dialog"
                            >
                              <SlidersHorizontal size={14} /> Design options
                            </button>
                            <button
                              type="button"
                              className="sh-icon"
                              aria-label="Expand artwork"
                              onClick={() => setArtworkOpen(true)}
                            >
                              <Maximize2 size={15} />
                            </button>
                          </div>
                        </div>
                        <Preview project={project} index={slide} />
                        <div className="sh-slide-nav">
                          <button
                            className="sh-icon"
                            aria-label="Previous slide"
                            disabled={slide === 0}
                            onClick={() => setSlide((index) => index - 1)}
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <span>
                            Slide <strong>0{slide + 1}</strong> of 05
                          </span>
                          <button
                            className="sh-icon"
                            aria-label="Next slide"
                            disabled={slide === 4}
                            onClick={() => setSlide((index) => index + 1)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                        <div className="sh-slide-dots" aria-label="Choose slide">
                          {project.kit.slides.map((item, index) => (
                            <button
                              aria-label={`Edit slide ${index + 1}`}
                              aria-pressed={slide === index}
                              className={slide === index ? 'is-active' : ''}
                              key={index}
                              onClick={() => setSlide(index)}
                            >
                              <span>0{index + 1}</span>
                              <small>{item.eyebrow}</small>
                            </button>
                          ))}
                        </div>
                        <details className="sh-edit-slide" open>
                          <summary>Make this slide yours</summary>
                          <Field label="Slide eyebrow">
                            <input
                              value={project.kit.slides[slide].eyebrow}
                              maxLength={80}
                              onChange={(event) => updateSlide('eyebrow', event.target.value)}
                            />
                          </Field>
                          <Field label="Slide headline">
                            <textarea
                              value={project.kit.slides[slide].headline}
                              rows={2}
                              maxLength={100}
                              onChange={(event) => updateSlide('headline', event.target.value)}
                            />
                          </Field>
                          <Field label="Slide body">
                            <textarea
                              value={project.kit.slides[slide].body}
                              rows={3}
                              maxLength={240}
                              onChange={(event) => updateSlide('body', event.target.value)}
                            />
                          </Field>
                          <button
                            className="sh-text-button"
                            onClick={() => generate(`slide:${slide}`)}
                            disabled={isBusy || !canGenerate}
                          >
                            <RefreshCw size={14} />
                            Regenerate only this slide
                          </button>
                        </details>
                      </>
                    )}
                    {tab === 'listing' && (
                      <div className="sh-copy-editor">
                        <div className="sh-copy-proof-action">
                          <span>See how your copy reads in context.</span>
                          <button
                            type="button"
                            className="sh-button"
                            onClick={() => setListingProofOpen(true)}
                          >
                            <ShoppingBag size={14} /> Preview listing
                          </button>
                        </div>
                        <Field label="Listing title">
                          <input
                            value={project.kit.title}
                            maxLength={250}
                            onChange={(event) => updateKit('title', event.target.value)}
                          />
                        </Field>
                        <Field label="Description">
                          <textarea
                            value={project.kit.description}
                            rows={10}
                            maxLength={5000}
                            onChange={(event) => updateKit('description', event.target.value)}
                          />
                        </Field>
                        <Field label="Key features" hint="One feature per line.">
                          <textarea
                            value={project.kit.bullets.join('\n')}
                            rows={5}
                            maxLength={5000}
                            onChange={(event) =>
                              updateKit('bullets', event.target.value.split('\n').slice(0, 15))
                            }
                          />
                        </Field>
                        <Field label="Tags" hint="Separate tags with commas.">
                          <input
                            value={project.kit.tags.join(', ')}
                            maxLength={1000}
                            onChange={(event) =>
                              updateKit(
                                'tags',
                                event.target.value
                                  .split(',')
                                  .map((tag) => tag.trim())
                                  .slice(0, 15),
                              )
                            }
                          />
                        </Field>
                        <button
                          className="sh-text-button"
                          onClick={() => generate('listing')}
                          disabled={isBusy || !canGenerate}
                        >
                          <RefreshCw size={14} />
                          Regenerate only the listing
                        </button>
                        <div className="sh-shopify-save">
                          <ShoppingBag size={23} />
                          <div>
                            <h3>Give your product a fresh introduction.</h3>
                            <p>
                              Preview the current and proposed descriptions before approving a
                              change to Shopify.
                            </p>
                          </div>
                          {store.canWriteProducts ? (
                            <button
                              className="sh-button"
                              onClick={prepareDescription}
                              disabled={isBusy || !generated}
                            >
                              Preview Shopify change
                            </button>
                          ) : (
                            <button className="sh-button" onClick={enableWriting} disabled={isBusy}>
                              Enable product editing
                            </button>
                          )}
                          <button
                            className="sh-text-button"
                            onClick={loadHistory}
                            disabled={isBusy}
                          >
                            View description history
                          </button>
                        </div>
                        {history.length > 0 && (
                          <div className="sh-history">
                            <h3>Previous changes</h3>
                            {history.map((item) => (
                              <div key={item.id}>
                                <span>
                                  <strong>{shortDate(item.createdAt)}</strong>
                                  <small>{item.status}</small>
                                </span>
                                <button
                                  className="sh-text-button"
                                  onClick={() => restore(item.id)}
                                  disabled={isBusy || item.status !== 'applied'}
                                >
                                  Preview restore
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {tab === 'social' && (
                      <div className="sh-copy-editor">
                        <Field label="Instagram caption">
                          <textarea
                            value={project.kit.instagram}
                            rows={8}
                            maxLength={5000}
                            onChange={(event) => updateKit('instagram', event.target.value)}
                          />
                        </Field>
                        <button
                          className="sh-text-button"
                          onClick={() => generate('instagram')}
                          disabled={isBusy || !canGenerate}
                        >
                          <RefreshCw size={14} />
                          Regenerate Instagram only
                        </button>
                        <Field label="WhatsApp message">
                          <textarea
                            value={project.kit.whatsapp}
                            rows={6}
                            maxLength={5000}
                            onChange={(event) => updateKit('whatsapp', event.target.value)}
                          />
                        </Field>
                        <button
                          className="sh-text-button"
                          onClick={() => generate('whatsapp')}
                          disabled={isBusy || !canGenerate}
                        >
                          <RefreshCw size={14} />
                          Regenerate WhatsApp only
                        </button>
                        <Field label="Email subject">
                          <input
                            value={project.kit.emailSubject}
                            maxLength={250}
                            onChange={(event) => updateKit('emailSubject', event.target.value)}
                          />
                        </Field>
                        <Field label="Email body">
                          <textarea
                            value={project.kit.emailBody}
                            rows={8}
                            maxLength={5000}
                            onChange={(event) => updateKit('emailBody', event.target.value)}
                          />
                        </Field>
                        <button
                          className="sh-text-button"
                          onClick={() => generate('email')}
                          disabled={isBusy || !canGenerate}
                        >
                          <RefreshCw size={14} />
                          Regenerate email only
                        </button>
                      </div>
                    )}
                  </div>
                  <details className="sh-review-notes">
                    <summary>Your final review</summary>
                    <ul>
                      {project.kit.questions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                    <p>
                      Check your product facts, claims, links and prices. Generated copy is a draft;
                      you decide what to share.
                    </p>
                  </details>
                  <div className="sh-save-bar">
                    <span>
                      {dirty
                        ? 'Unsaved changes'
                        : record
                          ? `Saved · revision ${record.revision}`
                          : 'Ready for your review'}
                    </span>
                    <div>
                      <button
                        className="sh-button"
                        disabled={isBusy || !generated || !dirty || stale}
                        onClick={saveKit}
                      >
                        <Cloud size={16} />
                        Save kit
                      </button>
                      <button
                        className="sh-button primary"
                        disabled={isBusy || !generated}
                        onClick={downloadKit}
                      >
                        <ArrowDownToLine size={16} />
                        Download kit
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          {store && view === 'saved' && (
            <section className="sh-card sh-saved">
              <div className="sh-card-heading">
                <Cloud size={21} />
                <h2>Your store’s launch kits.</h2>
                <button className="sh-text-button" onClick={loadSaved} disabled={isBusy}>
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
              {saved.length ? (
                <div className="sh-kit-grid">
                  {saved.map((item) => (
                    <article className="sh-kit-card" key={item.id}>
                      <div className="sh-kit-photo">
                        {item.link.imageUrl ? (
                          <img src={item.link.imageUrl} alt={item.project.product.name} />
                        ) : (
                          <ShoppingBag size={45} strokeWidth={1} />
                        )}
                      </div>
                      <span className="sh-eyebrow">{item.project.product.brand}</span>
                      <h3>{item.project.product.name}</h3>
                      <p>
                        {shortDate(item.updatedAt)} · revision {item.revision}
                      </p>
                      {item.stale && <span className="sh-stale-tag">Product details changed</span>}
                      <div>
                        <button
                          className="sh-button"
                          onClick={() => reopen(item.id)}
                          disabled={isBusy}
                        >
                          Open kit <ArrowRight size={14} />
                        </button>
                        <button
                          className="sh-icon"
                          aria-label={`Delete kit for ${item.project.product.name}`}
                          disabled={isBusy}
                          onClick={() => {
                            if (
                              window.confirm('Permanently delete this saved kit from your store?')
                            )
                              void operation('saved', async () => {
                                await shopifyJson(`kits/${encodeURIComponent(item.id)}`, {
                                  method: 'DELETE',
                                });
                                setSaved((current) => current.filter((kit) => kit.id !== item.id));
                                setNotice('Kit deleted.');
                              });
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="sh-empty-inline">
                  <Cloud size={36} strokeWidth={1} />
                  <h3>Your first launch belongs here.</h3>
                  <p>
                    Generate a kit, review it, and choose Save kit. Your authorized staff will find
                    it here too.
                  </p>
                  <button className="sh-button" onClick={openPicker} disabled={isBusy}>
                    Select a product <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </section>
          )}
          {store && view === 'brand' && (
            <div className="sh-brand-grid">
              <section className="sh-card sh-brand-form">
                <div className="sh-card-heading">
                  <Palette size={21} />
                  <h2>Your store’s signature.</h2>
                </div>
                <Field
                  label="Store logo"
                  hint="PNG, JPG or WebP under 220 KB. Saved with store branding."
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={isBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadLogo(file);
                      event.target.value = '';
                    }}
                  />
                </Field>
                {brand.logo && (
                  <div className="sh-logo-preview">
                    <img src={brand.logo} alt="Store logo" />
                    <button
                      className="sh-text-button"
                      onClick={() => setBrand((current) => ({ ...current, logo: null }))}
                    >
                      Remove logo
                    </button>
                  </div>
                )}
                <div className="sh-color-grid">
                  {(['primary', 'background', 'ink'] as const).map((color) => (
                    <Field
                      key={color}
                      label={
                        color === 'primary'
                          ? 'Accent'
                          : color === 'background'
                            ? 'Background'
                            : 'Text'
                      }
                    >
                      <input
                        type="color"
                        value={brand[color]}
                        aria-label={`${color} colour`}
                        onChange={(event) =>
                          setBrand((current) => ({ ...current, [color]: event.target.value }))
                        }
                      />
                      <small>{brand[color]}</small>
                    </Field>
                  ))}
                </div>
                <Field label="Default brand voice">
                  <input
                    value={brand.voice}
                    maxLength={50}
                    onChange={(event) =>
                      setBrand((current) => ({ ...current, voice: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Default call to action">
                  <input
                    value={brand.cta}
                    maxLength={80}
                    onChange={(event) =>
                      setBrand((current) => ({ ...current, cta: event.target.value }))
                    }
                  />
                </Field>
                <button className="sh-button primary" onClick={saveBrand} disabled={isBusy}>
                  Save store branding <Check size={16} />
                </button>
                <p className="sh-caption">
                  Defaults apply to new imports. To apply this visual branding to your current kit
                  without replacing its copy, use the button below.
                </p>
                {project && (
                  <button
                    className="sh-button"
                    onClick={() => {
                      setProject((current) =>
                        current ? { ...current, branding: brand } : current,
                      );
                      setDirty(true);
                      setNotice(
                        'Branding applied to the current kit. Save the kit to keep this change.',
                      );
                    }}
                    disabled={isBusy}
                  >
                    Apply look to current kit
                  </button>
                )}
              </section>
              <div
                className="sh-brand-preview"
                style={{ background: brand.background, color: brand.ink }}
              >
                <span className="sh-eyebrow" style={{ color: brand.primary }}>
                  YOUR STORE / A FIRST IMPRESSION
                </span>
                {brand.logo ? (
                  <img src={brand.logo} alt="Your store logo" />
                ) : (
                  <span className="sh-brand-monogram" style={{ background: brand.primary }}>
                    {store.name.slice(0, 1)}
                  </span>
                )}
                <h2>
                  Made by you.
                  <br />
                  <em style={{ color: brand.primary }}>
                    Remembered
                    <br />
                    by them.
                  </em>
                </h2>
                <p>{brand.voice}</p>
                <span
                  className="sh-brand-cta"
                  style={{ background: brand.ink, color: brand.background }}
                >
                  {brand.cta} <ArrowRight size={17} />
                </span>
                <small>Your custom look is used in downloaded artwork.</small>
              </div>
            </div>
          )}
          {store && view === 'help' && (
            <div className="sh-help-grid">
              <section className="sh-card">
                <span className="sh-eyebrow">YOUR CONNECTION</span>
                <h2>{store.name}</h2>
                <p className="sh-domain">{store.domain}</p>
                <div className="sh-help-state">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>Authenticated through Shopify</strong>
                    <p>
                      Every protected request checks your current Shopify identity and product
                      permissions. Store kits are saved on the server.
                    </p>
                  </div>
                </div>
                <p>
                  Read products is required for importing and saving launch kits. Product editing is
                  optional.
                </p>
                {store.canWriteProducts ? (
                  <p className="sh-connected-text">
                    <Check size={15} />
                    Product description editing is enabled for your current account.
                  </p>
                ) : (
                  <button className="sh-button" onClick={enableWriting} disabled={isBusy}>
                    Enable optional product editing
                  </button>
                )}
                <button className="sh-text-button" onClick={connect} disabled={isBusy}>
                  <RefreshCw size={14} />
                  Recheck connection & access
                </button>
              </section>
              <section className="sh-card">
                <span className="sh-eyebrow">GENERATION & PRICING</span>
                <h2>Create at your own pace.</h2>
                <p>
                  Template generation is included in the free beta. You can also use your own Gemini
                  API key; Google’s quota and pricing apply.
                </p>
                <div className="sh-usage">
                  <strong>
                    {store.hostedAI.enabled ? store.hostedAI.remaining : '—'}
                    <small>
                      {store.hostedAI.enabled
                        ? 'hosted requests remaining this month'
                        : 'Hosted generation is not enabled'}
                    </small>
                  </strong>
                  {store.hostedAI.enabled && (
                    <p>
                      {store.hostedAI.used} used of {store.hostedAI.limit}. Each regeneration counts
                      as a request. There are no automatic overages.
                    </p>
                  )}
                </div>
                <p>
                  Hosted generation is opt-in for the deployment owner and protected by store and
                  app-wide budgets.
                </p>
                <a className="sh-text-button" href="/pricing" target="_blank" rel="noreferrer">
                  Read pricing & limits <ExternalLink size={13} />
                </a>
              </section>
              <section className="sh-card sh-help-links">
                <span className="sh-eyebrow">A LITTLE DIRECTION</span>
                <h2>Keep the good work moving.</h2>
                <ol>
                  <li>Select the product and its exact variant.</li>
                  <li>Review imported facts and confirm what is missing.</li>
                  <li>Generate, edit individual assets, then save the kit.</li>
                  <li>Download the ZIP of five story slides and launch copy.</li>
                  <li>Optionally preview and approve a description update.</li>
                </ol>
                <a href="/help" target="_blank" rel="noreferrer">
                  Onboarding & troubleshooting <ArrowRight size={15} />
                </a>
                <a href="/support" target="_blank" rel="noreferrer">
                  Contact support <ArrowRight size={15} />
                </a>
                <a href="/privacy" target="_blank" rel="noreferrer">
                  Privacy policy <ArrowRight size={15} />
                </a>
                <p className="sh-caption">
                  A store connection, product permissions, and deployment database settings are
                  required. Browser storage is not required for this workspace.
                </p>
              </section>
            </div>
          )}
          <footer className="sh-footer">
            <span>For the makers & the small-but-mighty brands.</span>
            <a href="/support" target="_blank" rel="noreferrer">
              Need a hand? <ArrowRight size={13} />
            </a>
          </footer>
        </main>
      </div>
      {project && designOpen && (
        <Modal
          id="sh-design-options"
          className="sh-design-dialog"
          title="Make your launch look like you."
          onClose={() => setDesignOpen(false)}
        >
          <p className="sh-caption">
            Explore a different direction. Your text and photos stay attached to the kit, and every
            design choice appears in your download.
          </p>
          <div className="sh-design-workbench">
            <div className="sh-design-proof">
              <div className="sh-artboard-meta">
                <span>YOUR LIVE ARTWORK</span>
                <span>1080 × 1350</span>
              </div>
              <Preview project={project} index={slide} />
              <div className="sh-slide-nav">
                <button
                  type="button"
                  className="sh-icon"
                  aria-label="Previous design preview slide"
                  disabled={slide === 0}
                  onClick={() => setSlide((index) => index - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  Slide <strong>0{slide + 1}</strong> of 05
                </span>
                <button
                  type="button"
                  className="sh-icon"
                  aria-label="Next design preview slide"
                  disabled={slide === 4}
                  onClick={() => setSlide((index) => index + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="sh-design-settings">
              <fieldset className="sh-campaign-palette">
                <legend>Campaign colours</legend>
                <div className="sh-campaign-swatches">
                  <button
                    type="button"
                    aria-pressed={hasPalette(brand)}
                    onClick={() => chooseCampaignPalette('brand')}
                  >
                    <span style={{ background: brand.background, color: brand.primary }}>
                      <i style={{ background: brand.ink }} />
                      <i style={{ background: brand.primary }} />
                    </span>
                    <strong>Store colours</strong>
                  </button>
                  {(Object.entries(THEMES) as [Theme, (typeof THEMES)[Theme]][]).map(
                    ([theme, colors]) => (
                      <button
                        type="button"
                        key={theme}
                        aria-pressed={
                          project.branding
                            ? hasPalette({
                                primary: colors.accent,
                                background: colors.bg,
                                ink: colors.ink,
                              })
                            : project.theme === theme
                        }
                        onClick={() => chooseCampaignPalette(theme)}
                      >
                        <span style={{ background: colors.bg, color: colors.accent }}>
                          <i style={{ background: colors.ink }} />
                          <i style={{ background: colors.accent }} />
                        </span>
                        <strong>{colors.name}</strong>
                      </button>
                    ),
                  )}
                </div>
                <p>Colours change this kit. Your saved store branding stays available.</p>
              </fieldset>
              <CreativeControls project={project} onChange={updateAppearance} />
              <button
                type="button"
                className="sh-button primary sh-full"
                onClick={() => setDesignOpen(false)}
              >
                <Check size={15} /> Keep this direction
              </button>
            </div>
          </div>
        </Modal>
      )}
      {project && artworkOpen && (
        <Modal
          className="sh-artwork-dialog"
          title={`Slide ${slide + 1} · ${project.product.name}`}
          onClose={() => setArtworkOpen(false)}
        >
          <div className="sh-expanded-artwork">
            <Preview project={project} index={slide} />
          </div>
          <div className="sh-slide-nav">
            <button
              type="button"
              className="sh-icon"
              aria-label="Previous expanded slide"
              disabled={slide === 0}
              onClick={() => setSlide((index) => index - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              Slide <strong>0{slide + 1}</strong> of 05
            </span>
            <button
              type="button"
              className="sh-icon"
              aria-label="Next expanded slide"
              disabled={slide === 4}
              onClick={() => setSlide((index) => index + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <p className="sh-caption">
            This preview uses the same artwork renderer as your download.
          </p>
        </Modal>
      )}
      {project && listingProofOpen && (
        <Modal
          className="sh-listing-proof-dialog"
          title="Your product, in context."
          onClose={() => setListingProofOpen(false)}
        >
          <AssetProof project={project} mode="shop" Preview={Preview} />
        </Modal>
      )}
      {picker && (
        <Modal
          title="Choose your product."
          onClose={() => {
            if (busy !== 'import') setPicker(false);
          }}
        >
          <p className="sh-caption">
            Search your connected store, then select the exact variant in your brief.
          </p>
          <form
            className="sh-search"
            onSubmit={(event) => {
              event.preventDefault();
              searchProducts();
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search Shopify products"
              placeholder="Search by product name…"
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="sh-button primary" type="submit" disabled={isBusy}>
              Search
            </button>
          </form>
          {busy === 'search' && (
            <p role="status" className="sh-picker-status">
              <LoaderCircle size={16} className="sh-spin" />
              Searching your store…
            </p>
          )}
          {error && (
            <p className="sh-picker-error" role="alert">
              {error}
            </p>
          )}
          <div className="sh-product-results">
            {products.map((item) => (
              <button
                key={item.id}
                className="sh-product-result"
                onClick={() => chooseProduct(item)}
                disabled={isBusy}
              >
                <span className="sh-product-thumb">
                  {item.images[0] ? (
                    <img src={item.images[0].url} alt={item.images[0].altText || item.title} />
                  ) : (
                    <ShoppingBag size={22} />
                  )}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.vendor || 'No vendor'} ·{' '}
                    {item.variants[0]
                      ? `${store?.currency} ${item.variants[0].price}`
                      : 'Choose a variant'}
                  </small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          {searched && !products.length && busy !== 'search' && (
            <p className="sh-picker-status">
              No products found. Try another name or add a product in Shopify first.
            </p>
          )}
          {pageInfo.hasNextPage && (
            <button
              className="sh-button sh-full"
              onClick={() => searchProducts(pageInfo.endCursor || undefined)}
              disabled={isBusy}
            >
              Load more products
            </button>
          )}
          {busy === 'import' && (
            <p className="sh-picker-status" role="status">
              <LoaderCircle size={16} className="sh-spin" />
              Importing product details and photo…
            </p>
          )}
        </Modal>
      )}
      {preview && (
        <Modal
          title="Review your Shopify change."
          onClose={() => {
            if (busy !== 'apply') setPreview(null);
          }}
        >
          <p className="sh-caption">
            This changes the product description in your connected store. Other Shopify fields stay
            as they are.
          </p>
          <div className="sh-description-diff">
            <section>
              <span className="sh-eyebrow">CURRENT DESCRIPTION</span>
              <pre>{preview.before || '(No description)'}</pre>
            </section>
            <section>
              <span className="sh-eyebrow">PROPOSED DESCRIPTION</span>
              <pre>{preview.after || '(No description)'}</pre>
            </section>
          </div>
          <label className="sh-confirm">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            <span>
              I reviewed both descriptions and approve this change to the product in Shopify.
            </span>
          </label>
          {error && (
            <p role="alert" className="sh-picker-error">
              {error}
            </p>
          )}
          <div className="sh-description-actions">
            <button
              className="sh-button"
              onClick={() => setPreview(null)}
              disabled={busy === 'apply'}
            >
              Keep current description
            </button>
            <button
              className="sh-button primary"
              onClick={applyDescription}
              disabled={!approved || isBusy}
            >
              {busy === 'apply' ? (
                <LoaderCircle size={16} className="sh-spin" />
              ) : (
                <Check size={16} />
              )}
              Save approved description
            </button>
          </div>
          <p className="sh-caption">
            The current description is retained in history so you can preview a restoration later.
            If Shopify changed since this preview, the update will be blocked for a fresh review.
          </p>
        </Modal>
      )}
    </div>
  );
}
