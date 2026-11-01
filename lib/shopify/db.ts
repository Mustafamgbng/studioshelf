import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { validateProject } from '../storage';
import { validateBranding } from '../branding';
import { ShopifyError } from './security';
import { assertVariant, getProduct, productId, storefrontUrl } from './products';
import {
  DEFAULT_STORE_BRAND,
  type SaveKitInput,
  type ShopifyKit,
  type StoreAuth,
  type StoreBrand,
  type StoreSummary,
} from './types';

let database: { url: string; key: string; client: SupabaseClient } | null = null;

export function getStoreDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new ShopifyError(
      503,
      'Store saving is not configured. Ask the app owner to complete the Shopify database setup.',
      'STORAGE_UNAVAILABLE',
    );
  if (!database || database.url !== url || database.key !== key) {
    database = {
      url,
      key,
      client: createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    };
  }
  return database.client;
}

export function storageFailure(error: { code?: string } | null, conflict = false): never {
  if (conflict || error?.code === 'PT409' || error?.code === '23505')
    throw new ShopifyError(
      409,
      'Another staff member changed this kit. Reload it before saving again.',
      'REVISION_CONFLICT',
    );
  throw new ShopifyError(
    503,
    'Store storage is temporarily unavailable. Your open work is unchanged. Please retry.',
    'STORAGE_UNAVAILABLE',
  );
}

export async function ensureStore(auth: StoreAuth): Promise<void> {
  const db = getStoreDb();
  // Ignore any client-supplied store identifiers; use only GraphQL-verified identity.
  const { error } = await db.from('shopify_stores').upsert(
    {
      id: auth.storeId,
      domain: auth.shop,
      name: auth.storeName,
      currency: auth.currency,
      status: 'connected',
      scopes: auth.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) storageFailure(error);
}

export function validateBrand(value: unknown): StoreBrand {
  try {
    return validateBranding(value);
  } catch (error) {
    throw new ShopifyError(
      400,
      error instanceof Error ? error.message : 'Check your store branding.',
    );
  }
}

export async function getBrand(auth: StoreAuth): Promise<StoreBrand> {
  const { data, error } = await getStoreDb()
    .from('shopify_stores')
    .select('brand')
    .eq('id', auth.storeId)
    .maybeSingle();
  if (error) storageFailure(error);
  if (!data)
    throw new ShopifyError(
      404,
      'This store is not connected. Reopen StudioShelf from Shopify Admin.',
    );
  if (!Object.keys(data.brand || {}).length) return { ...DEFAULT_STORE_BRAND };
  return validateBrand(data.brand);
}

export async function saveBrand(auth: StoreAuth, value: unknown): Promise<StoreBrand> {
  const brand = validateBrand(value);
  const { error, data } = await getStoreDb()
    .from('shopify_stores')
    .update({ brand, updated_at: new Date().toISOString() })
    .eq('id', auth.storeId)
    .select('id')
    .maybeSingle();
  if (error) storageFailure(error);
  if (!data) throw new ShopifyError(404, 'This store is no longer connected.');
  return brand;
}

function countSetting(name: string, fallback: number, maximum: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || Number(value) > maximum) return 0;
  return Number(value);
}

export function hostedSettings() {
  const limit = countSetting('SHOPIFY_AI_MONTHLY_LIMIT', 20, 10000);
  const globalLimit = countSetting('SHOPIFY_AI_GLOBAL_MONTHLY_LIMIT', 200, 1000000);
  const enabled =
    process.env.SHOPIFY_HOSTED_AI_ENABLED === 'true' &&
    !!process.env.GEMINI_API_KEY &&
    limit > 0 &&
    globalLimit > 0;
  return { enabled, limit: enabled ? limit : 0, globalLimit: enabled ? globalLimit : 0 };
}

export async function getHostedUsage(auth: StoreAuth): Promise<StoreSummary['hostedAI']> {
  const settings = hostedSettings();
  const month = new Date().toISOString().slice(0, 7) + '-01';
  const { data, error } = await getStoreDb()
    .from('shopify_ai_usage')
    .select('count')
    .eq('store_id', auth.storeId)
    .eq('month', month)
    .maybeSingle();
  if (error) storageFailure(error);
  const used = data?.count || 0;
  return {
    enabled: settings.enabled,
    limit: settings.limit,
    used,
    remaining: Math.max(0, settings.limit - used),
  };
}

export async function reserveHostedUsage(auth: StoreAuth): Promise<StoreSummary['hostedAI']> {
  const settings = hostedSettings();
  if (!settings.enabled)
    throw new ShopifyError(
      403,
      'Hosted AI is disabled. Use your Gemini key or free templates.',
      'HOSTED_AI_DISABLED',
    );
  const { data, error } = await getStoreDb().rpc('studioshelf_reserve_shopify_ai', {
    p_store_id: auth.storeId,
    p_limit: settings.limit,
    p_global_limit: settings.globalLimit,
  });
  if (error || !data) storageFailure(error);
  if (!data.allowed)
    throw new ShopifyError(
      429,
      'The hosted AI allowance has been reached. Your own key and templates remain available.',
      'HOSTED_AI_LIMIT',
    );
  return { enabled: true, limit: data.limit, used: data.used, remaining: data.remaining };
}

export async function getStoreSettings(auth: StoreAuth): Promise<StoreSummary> {
  const [brand, hostedAI] = await Promise.all([getBrand(auth), getHostedUsage(auth)]);
  return {
    id: auth.storeId,
    domain: auth.shop,
    name: auth.storeName,
    currency: auth.currency,
    status: 'connected',
    canWriteProducts: auth.scopes.includes('write_products'),
    hostedAI,
    brand,
  };
}

export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new ShopifyError(400, 'Choose a valid saved kit.');
  return value;
}

type KitRow = {
  id: string;
  store_id: string;
  project: ShopifyKit['project'];
  link: ShopifyKit['link'];
  revision: number;
  updated_at: string;
  stale: boolean;
};
export function kitFromRow(row: KitRow): ShopifyKit {
  return {
    id: row.id,
    revision: row.revision,
    updatedAt: row.updated_at,
    project: { ...row.project, id: row.id, updatedAt: row.updated_at },
    link: row.link,
    stale: row.stale,
  };
}

export type ShopifyKitSummary = Pick<
  ShopifyKit,
  'id' | 'revision' | 'updatedAt' | 'link' | 'stale'
> & { project: { product: { name: string; brand: string } } };
export async function listKits(auth: StoreAuth): Promise<ShopifyKitSummary[]> {
  const { data, error } = await getStoreDb()
    .from('shopify_kits')
    .select(
      'id,link,revision,updated_at,stale,product_name:project->product->>name,product_brand:project->product->>brand,product_currency:project->product->>currency',
    )
    .eq('store_id', auth.storeId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) storageFailure(error);
  // A catalogue response must not contain up to 100 full-resolution data-URL photographs.
  // Load complete copy, photos and brand snapshots only through the individual kit endpoint.
  return (data || []).map((row) => ({
    id: row.id,
    revision: row.revision,
    updatedAt: row.updated_at,
    link: row.link,
    stale: row.stale || row.product_currency !== auth.currency,
    project: { product: { name: row.product_name as string, brand: row.product_brand as string } },
  }));
}

export async function getKit(auth: StoreAuth, id: string): Promise<ShopifyKit> {
  const { data, error } = await getStoreDb()
    .from('shopify_kits')
    .select('id,store_id,project,link,revision,updated_at,stale')
    .eq('store_id', auth.storeId)
    .eq('id', uuid(id))
    .maybeSingle();
  if (error) storageFailure(error);
  if (!data)
    throw new ShopifyError(
      404,
      'This kit is unavailable in the connected store.',
      'KIT_UNAVAILABLE',
    );
  return kitFromRow(data as KitRow);
}

export async function saveKit(auth: StoreAuth, input: SaveKitInput): Promise<ShopifyKit> {
  if (!input || typeof input !== 'object') throw new ShopifyError(400, 'Check this launch kit.');
  let project: ShopifyKit['project'];
  try {
    project = validateProject({
      ...input.project,
      id: input.id || randomUUID(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new ShopifyError(400, error instanceof Error ? error.message : 'Check this launch kit.');
  }
  if (project.product.currency !== auth.currency)
    throw new ShopifyError(400, 'The launch kit currency must match the connected store currency.');
  if (typeof input.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(input.fingerprint))
    throw new ShopifyError(400, 'Import and confirm this product before saving.');
  const current = input.id ? await getKit(auth, uuid(input.id)) : null;
  if (current && (!Number.isInteger(input.revision) || input.revision !== current.revision))
    storageFailure(null, true);
  const product = await getProduct(auth, productId(input.productId));
  const variant = await assertVariant(auth, product, input.variantId);
  const images = [...product.images, ...(variant.image ? [variant.image] : [])];
  const imageId = (input as SaveKitInput & { imageId?: unknown }).imageId;
  if (imageId !== undefined && typeof imageId !== 'string')
    throw new ShopifyError(400, 'Choose a valid product image.');
  const selectedImage = imageId
    ? images.find((image) => image.id === imageId)
    : variant.image || product.images[0];
  if (imageId && !selectedImage)
    throw new ShopifyError(
      400,
      'This image no longer belongs to the imported product. Reimport it before saving.',
    );
  const link: ShopifyKit['link'] = {
    storeId: auth.storeId,
    productId: product.id,
    variantId: variant.id,
    importedAt: current?.link.importedAt || new Date().toISOString(),
    fingerprint: input.fingerprint,
    updatedAt: product.updatedAt,
    url: storefrontUrl(product, variant.id),
    imageUrl: selectedImage?.url || null,
  };
  if (link.url) project.product.url = link.url;
  else delete project.product.url;
  const { data, error } = await getStoreDb().rpc('studioshelf_save_shopify_kit', {
    p_store_id: auth.storeId,
    p_product_id: product.id,
    p_variant_id: variant.id,
    p_project: project,
    p_link: link,
    p_stale: product.fingerprint !== input.fingerprint,
    p_id: current?.id || null,
    p_expected_revision: current?.revision || null,
  });
  if (error || !data) storageFailure(error);
  return kitFromRow(data as KitRow);
}

export async function deleteKit(auth: StoreAuth, id: string): Promise<void> {
  const { error, data } = await getStoreDb()
    .from('shopify_kits')
    .delete()
    .eq('store_id', auth.storeId)
    .eq('id', uuid(id))
    .select('id');
  if (error) storageFailure(error);
  if (!data?.length) throw new ShopifyError(404, 'This kit is unavailable in the connected store.');
}

export async function handleShopifyWebhook(
  topic: string,
  shop: string,
  payload: unknown,
  eventId: string,
): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) || !eventId || eventId.length > 200)
    throw new ShopifyError(400, 'Invalid webhook delivery.');
  const allowed = [
    'customers/data_request',
    'customers/redact',
    'shop/redact',
    'app/uninstalled',
    'app/scopes_update',
    'products/update',
  ];
  if (!allowed.includes(topic)) throw new ShopifyError(400, 'Unsupported webhook topic.');
  let id: string | null = null;
  if (topic === 'products/update') {
    if (!payload || typeof payload !== 'object')
      throw new ShopifyError(400, 'Invalid product webhook.');
    const p = payload as Record<string, unknown>;
    const raw =
      p.admin_graphql_api_id ||
      (typeof p.id === 'number' && Number.isSafeInteger(p.id)
        ? `gid://shopify/Product/${p.id}`
        : typeof p.id === 'string' && /^\d+$/.test(p.id)
          ? `gid://shopify/Product/${p.id}`
          : null);
    id = productId(raw);
  }
  let storeId: string | null = null;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const raw = topic === 'app/uninstalled' ? p.id : p.shop_id;
    if (typeof raw === 'string' && /^gid:\/\/shopify\/Shop\/[1-9]\d*$/.test(raw)) storeId = raw;
    else if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0)
      storeId = `gid://shopify/Shop/${raw}`;
    else if (typeof raw === 'string' && /^[1-9]\d*$/.test(raw))
      storeId = `gid://shopify/Shop/${raw}`;
  }
  // Only delivery metadata + store/product IDs reach SQL. Customer payloads are discarded.
  const { error } = await getStoreDb().rpc('studioshelf_shopify_webhook', {
    p_event_id: eventId,
    p_topic: topic,
    p_shop: shop,
    p_product_id: id,
    p_store_id: storeId,
  });
  if (error) storageFailure(error);
}
