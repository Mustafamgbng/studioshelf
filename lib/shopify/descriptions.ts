import { createHash } from 'node:crypto';
import { getStoreDb, storageFailure, uuid } from './db';
import { getProduct, productId } from './products';
import { shopifyGraphql } from './graphql';
import { ShopifyError } from './security';
import type { DescriptionPreview, StoreAuth } from './types';

type HistoryRow = {
  id: string;
  store_id: string;
  product_id: string;
  before_html: string;
  after_html: string;
  before_text: string;
  after_text: string;
  created_at: string;
  status: string;
  applied_at: string | null;
};

export function textToDescriptionHtml(value: string): string {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escaped
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function descriptionDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function assertDescriptionUnchanged(actual: string, expected: string): void {
  if (descriptionDigest(actual) !== descriptionDigest(expected))
    throw new ShopifyError(
      409,
      'The Shopify description changed after this preview. Create a fresh preview before approving.',
      'DESCRIPTION_CONFLICT',
    );
}

function requireWrite(auth: StoreAuth) {
  if (!auth.scopes.includes('write_products'))
    throw new ShopifyError(
      403,
      'Product-write access is required. Approve the optional Shopify product permission, then retry.',
      'WRITE_SCOPE_REQUIRED',
    );
}
export function descriptionFromRow(row: HistoryRow): DescriptionPreview {
  return {
    id: row.id,
    productId: row.product_id,
    before: row.before_text,
    after: row.after_text,
    createdAt: row.created_at,
    status: row.status,
  };
}
async function historyRow(auth: StoreAuth, id: string): Promise<HistoryRow> {
  const { data, error } = await getStoreDb()
    .from('shopify_description_history')
    .select('*')
    .eq('store_id', auth.storeId)
    .eq('id', uuid(id))
    .maybeSingle();
  if (error) storageFailure(error);
  if (!data)
    throw new ShopifyError(404, 'This description preview is unavailable in the connected store.');
  return data as HistoryRow;
}
async function createPreview(
  auth: StoreAuth,
  id: string,
  afterText: string,
  afterHtml: string,
): Promise<DescriptionPreview> {
  requireWrite(auth);
  const current = await getProduct(auth, productId(id));
  if (Buffer.byteLength(current.descriptionHtml, 'utf8') >= 1000000)
    throw new ShopifyError(
      413,
      'This description is too large for safe versioned editing. Edit it directly in Shopify.',
    );
  if (current.descriptionHtml === afterHtml)
    throw new ShopifyError(400, 'This description is already saved in Shopify.');
  const { data, error } = await getStoreDb()
    .from('shopify_description_history')
    .insert({
      store_id: auth.storeId,
      product_id: current.id,
      before_html: current.descriptionHtml,
      after_html: afterHtml,
      before_text: current.description,
      after_text: afterText,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error || !data) storageFailure(error);
  return descriptionFromRow(data as HistoryRow);
}

export async function previewDescription(
  auth: StoreAuth,
  id: string,
  description: unknown,
): Promise<DescriptionPreview> {
  if (typeof description !== 'string' || !description.trim() || description.length > 5000)
    throw new ShopifyError(400, 'Enter a description between 1 and 5,000 characters.');
  return createPreview(auth, id, description.trim(), textToDescriptionHtml(description.trim()));
}
export async function previewRestore(auth: StoreAuth, id: string): Promise<DescriptionPreview> {
  requireWrite(auth);
  const previous = await historyRow(auth, id);
  if (previous.status !== 'applied')
    throw new ShopifyError(
      400,
      'Only a successfully applied description has a previous version to restore.',
    );
  // Only exact HTML previously read from this store may be restored; clients cannot supply HTML.
  return createPreview(auth, previous.product_id, previous.before_text, previous.before_html);
}

export async function listDescriptions(auth: StoreAuth, id: string): Promise<DescriptionPreview[]> {
  productId(id);
  const { data, error } = await getStoreDb()
    .from('shopify_description_history')
    .select('*')
    .eq('store_id', auth.storeId)
    .eq('product_id', id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) storageFailure(error);
  return (data || []).map((row) => descriptionFromRow(row as HistoryRow));
}

async function setStatus(auth: StoreAuth, id: string, status: string) {
  const { error } = await getStoreDb()
    .from('shopify_description_history')
    .update({ status, ...(status === 'applied' ? { applied_at: new Date().toISOString() } : {}) })
    .eq('store_id', auth.storeId)
    .eq('id', id);
  if (error) storageFailure(error);
}

export async function applyDescription(auth: StoreAuth, id: string, approved: unknown) {
  requireWrite(auth);
  if (approved !== true)
    throw new ShopifyError(
      400,
      'Review the before-and-after preview and approve it before saving.',
      'APPROVAL_REQUIRED',
    );
  const row = await historyRow(auth, id);
  const current = await getProduct(auth, row.product_id);
  if (row.status === 'applied')
    return { preview: descriptionFromRow(row), applied: true, reconciled: true };
  if (row.status === 'applying' || row.status === 'uncertain') {
    if (descriptionDigest(current.descriptionHtml) === descriptionDigest(row.after_html)) {
      await setStatus(auth, id, 'applied');
      return {
        preview: descriptionFromRow({ ...row, status: 'applied' }),
        applied: true,
        reconciled: true,
      };
    }
    throw new ShopifyError(
      409,
      'A previous save has an uncertain outcome. Refresh Shopify and create a new preview; this request will not be sent twice.',
      'DESCRIPTION_UNCERTAIN',
    );
  }
  if (row.status !== 'pending')
    throw new ShopifyError(
      409,
      'Create a fresh description preview before saving.',
      'DESCRIPTION_CONFLICT',
    );
  if (Date.now() - Date.parse(row.created_at) > 15 * 60 * 1000)
    throw new ShopifyError(
      409,
      'This preview expired. Create a fresh preview before saving.',
      'PREVIEW_EXPIRED',
    );
  try {
    assertDescriptionUnchanged(current.descriptionHtml, row.before_html);
  } catch (error) {
    await setStatus(auth, id, 'conflict');
    throw error;
  }

  // The conditional update is an atomic claim. Concurrent staff/retries cannot send this preview twice.
  const { data: claimed, error: claimError } = await getStoreDb()
    .from('shopify_description_history')
    .update({ status: 'applying' })
    .eq('store_id', auth.storeId)
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError) storageFailure(claimError);
  if (!claimed)
    throw new ShopifyError(
      409,
      'This description is already being saved. Refresh before retrying.',
      'DESCRIPTION_BUSY',
    );
  try {
    // Shopify productUpdate has no description CAS primitive. A small external concurrent-edit
    // window remains between the read above and this mutation; this is called out in the handoff.
    const result = await shopifyGraphql<{
      productUpdate: {
        product: { id: string; descriptionHtml: string } | null;
        userErrors: { field: string[] | null; message: string }[];
      };
    }>(
      auth,
      'mutation StudioShelfDescription($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id descriptionHtml } userErrors { field message } } }',
      { product: { id: row.product_id, descriptionHtml: row.after_html } },
    );
    if (result.productUpdate.userErrors.length || !result.productUpdate.product)
      throw new ShopifyError(
        422,
        'Shopify did not accept this description. Review it in Shopify and create a new preview.',
        'SHOPIFY_WRITE_REJECTED',
      );
    await setStatus(auth, id, 'applied');
    return {
      preview: descriptionFromRow({ ...row, status: 'applied' }),
      applied: true,
      reconciled: false,
    };
  } catch (error) {
    // Network failures can occur after Shopify commits. Preserve history and require reconciliation,
    // never automatically replay a product mutation after an ambiguous response.
    await setStatus(auth, id, 'uncertain');
    if (error instanceof ShopifyError) throw error;
    throw new ShopifyError(
      502,
      'The save outcome could not be confirmed. Refresh and check Shopify before trying again.',
      'DESCRIPTION_UNCERTAIN',
    );
  }
}
