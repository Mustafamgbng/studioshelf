import type { Kit, Product, Project, Theme } from '../types';

export type ShopifyImage = { id: string; url: string; altText: string | null };
export type ShopifyVariant = {
  id: string;
  title: string;
  price: string;
  image: ShopifyImage | null;
  selectedOptions: { name: string; value: string }[];
};
export type ShopifyProduct = {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  handle: string;
  vendor: string;
  productType: string;
  updatedAt: string;
  onlineStoreUrl: string | null;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  variantsPageInfo: { hasNextPage: boolean; endCursor: string | null };
  fingerprint: string;
};
export type StoreBrand = {
  logo: string | null;
  primary: string;
  background: string;
  ink: string;
  voice: string;
  cta: string;
};
export const DEFAULT_STORE_BRAND: StoreBrand = {
  logo: null,
  primary: '#3d5bd6',
  background: '#f8f5ee',
  ink: '#14233b',
  voice: 'Warm & thoughtful',
  cta: 'Shop now',
};
export type StoreSummary = {
  id: string;
  domain: string;
  name: string;
  currency: string;
  status: 'connected';
  canWriteProducts: boolean;
  hostedAI: { enabled: boolean; limit: number; used: number; remaining: number };
  brand: StoreBrand;
};
export type ProductLink = {
  storeId: string;
  productId: string;
  variantId: string;
  importedAt: string;
  fingerprint: string;
  updatedAt: string;
  url: string | null;
  imageUrl: string | null;
};
export type ShopifyKit = {
  id: string;
  revision: number;
  updatedAt: string;
  project: Project;
  link: ProductLink;
  stale?: boolean;
};
export type DescriptionPreview = {
  id: string;
  productId: string;
  before: string;
  after: string;
  createdAt: string;
  status: string;
};
export type AssetTarget =
  'all' | 'listing' | 'instagram' | 'whatsapp' | 'email' | `slide:${number}`;
export type GenerationInput = {
  product: Product;
  productId: string;
  variantId: string;
  fingerprint: string;
  imageId?: string;
  factsConfirmed: boolean;
  mode: 'template' | 'byok' | 'hosted';
  apiKey?: string;
  target: AssetTarget;
  currentKit?: Kit;
};
export type SaveKitInput = {
  id?: string;
  revision?: number;
  project: Project;
  productId: string;
  variantId: string;
  fingerprint: string;
};
export type StoreAuth = {
  shop: string;
  storeId: string;
  storeName: string;
  currency: string;
  staffId: string;
  accessToken: string;
  scopes: string[];
  expiresAt: number;
};
export type ShopifyRequestError = { error: string; code?: string; reconnect?: boolean };
export type BrandExport = { theme: Theme; brand: StoreBrand };
