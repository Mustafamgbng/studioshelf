'use client';

import type { Kit } from '../types';
import type { AssetTarget } from './types';

// Merge against the latest editor state, not the snapshot submitted to the server.
// A different asset might have been edited while the request was in flight.
export function applyGeneratedAsset(current: Kit, generated: Kit, target: AssetTarget): Kit {
  if (target === 'all') return generated;
  if (target === 'listing')
    return {
      ...current,
      title: generated.title,
      description: generated.description,
      bullets: generated.bullets,
      tags: generated.tags,
    };
  if (target === 'email')
    return { ...current, emailSubject: generated.emailSubject, emailBody: generated.emailBody };
  if (target === 'instagram' || target === 'whatsapp')
    return { ...current, [target]: generated[target] };
  const index = Number(target.split(':')[1]);
  return {
    ...current,
    slides: current.slides.map((slide, position) =>
      position === index ? generated.slides[position] : slide,
    ),
  };
}

type ShopifyBridge = {
  idToken: () => Promise<string>;
  scopes?: { request: (scopes: string[]) => Promise<{ result: string }> };
};

declare global {
  interface Window {
    shopify?: ShopifyBridge;
  }
}

export class ShopifyClientError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
  ) {
    super(message);
    this.name = 'ShopifyClientError';
  }
}

let expectedShop: string | null = null;
export function expectShop(domain: string | null) {
  expectedShop = domain;
}

async function identity() {
  if (!window.shopify?.idToken)
    throw new ShopifyClientError(
      'Open StudioShelf from your installed apps in Shopify Admin.',
      401,
    );
  const token = await window.shopify.idToken();
  // This check prevents unsaved UI state being submitted after a context change.
  // The server independently verifies the JWT and authorizes every request.
  if (expectedShop) {
    let shop: string;
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      shop = new URL(JSON.parse(atob(payload)).dest).hostname;
    } catch {
      throw new ShopifyClientError('Shopify identity could not be read. Reopen the app.', 401);
    }
    if (shop !== expectedShop)
      throw new ShopifyClientError(
        'Your store changed. Reopen StudioShelf before continuing.',
        409,
        'STORE_CHANGED',
      );
  }
  return token;
}

export async function shopifyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await identity()}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await fetch(`/api/shopify/${path}`, {
        ...init,
        headers,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch {
      throw new ShopifyClientError(
        'The connection was interrupted. Your edits are still here. Try again.',
      );
    }
    if (
      response.status === 401 &&
      attempt === 0 &&
      response.headers.has('X-Shopify-Retry-Invalid-Session-Request')
    )
      continue;
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ShopifyClientError(
        data.error || 'The operation could not finish. Please try again.',
        response.status,
        data.code,
      );
    }
    return response;
  }
  throw new ShopifyClientError(
    'Your Shopify session expired. Reopen the app from Shopify Admin.',
    401,
  );
}

export async function shopifyJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await shopifyFetch(path, init)).json();
}

export async function requestProductWrite() {
  if (!window.shopify?.scopes)
    throw new ShopifyClientError('Update App Bridge, then reopen StudioShelf from Shopify Admin.');
  const result = await window.shopify.scopes.request(['write_products']);
  if (result.result !== 'granted-all')
    throw new ShopifyClientError(
      'Product editing was not approved. You can still save and download kits.',
    );
}
