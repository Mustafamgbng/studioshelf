import ShopifyWorkspace from '@/components/shopify-workspace';
import { publicShopifyConfig } from '@/lib/shopify/config';

export const dynamic = 'force-dynamic';

export default function ShopifyPage() {
  return <ShopifyWorkspace configured={publicShopifyConfig().configured} />;
}
