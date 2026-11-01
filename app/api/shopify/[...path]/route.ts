import { handleShopifyApi } from '@/lib/shopify/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  return handleShopifyApi(request, path);
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
