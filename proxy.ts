import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from './lib/shopify/auth';
import {
  framePolicy,
  signFrameContext,
  signedQueryShop,
  verifyFrameContext,
} from './lib/shopify/security';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const embeddedRoute = url.pathname === '/shopify' || url.pathname.startsWith('/shopify/');
  const key = process.env.SHOPIFY_API_KEY;
  const secret = process.env.SHOPIFY_API_SECRET;
  let shop: string | null = null;
  let initialVerified = false;
  if (embeddedRoute && key && secret && url.searchParams.getAll('frame_context').length <= 1) {
    shop = verifyFrameContext(url.searchParams.get('frame_context'), key, secret);
    if (shop && url.searchParams.get('shop') !== shop) shop = null;
    if (!shop && url.searchParams.getAll('id_token').length === 1) {
      try {
        const identity = verifyIdToken(url.searchParams.get('id_token')!, key, secret);
        const requestedShop = url.searchParams.get('shop');
        if (!requestedShop || requestedShop === identity.shop) shop = identity.shop;
      } catch {
        /* A forged/stale launch token never relaxes iframe protection. */
      }
      initialVerified = !!shop;
    }
    if (!shop) {
      shop = signedQueryShop(url.searchParams, secret);
      initialVerified = !!shop;
    }
  }
  let response: NextResponse;
  if (shop && initialVerified) {
    // Keep the authenticated frame domain across reloads without storing cookies or
    // retaining Shopify's short-lived ID token in browser history. This permit is
    // never accepted by authenticateShopify and conveys no staff/API permissions.
    const target = url.clone();
    target.searchParams.delete('id_token');
    target.searchParams.delete('hmac');
    target.searchParams.delete('signature');
    target.searchParams.set('shop', shop);
    target.searchParams.set('frame_context', signFrameContext(shop, key!, secret!));
    response = NextResponse.redirect(target, 307);
  } else response = NextResponse.next();
  response.headers.set('Content-Security-Policy', framePolicy(shop));
  response.headers.delete('X-Frame-Options');
  if (embeddedRoute || url.pathname.startsWith('/api/shopify')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|samples/|brand/).*)'],
};
