import type { Metadata } from 'next';
import './shopify.css';

export const metadata: Metadata = {
  title: 'StudioShelf for Shopify — Your product launch studio',
  robots: { index: false, follow: false },
  other: process.env.SHOPIFY_API_KEY ? { 'shopify-api-key': process.env.SHOPIFY_API_KEY } : {},
};

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
