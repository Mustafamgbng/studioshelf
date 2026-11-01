import { readFile } from 'node:fs/promises';

const issues = [];
for (const name of [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_APP_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STUDIOSHELF_SUPPORT_EMAIL',
]) {
  if (
    !process.env[name]?.trim() ||
    /REPLACE_WITH|YOUR_|example\.(com|test)/i.test(process.env[name])
  )
    issues.push(`${name} is missing or is a placeholder.`);
}
if (!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL))
  issues.push('SUPABASE_URL is missing.');
try {
  const url = new URL(process.env.SHOPIFY_APP_URL);
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    ['localhost', '127.0.0.1'].includes(url.hostname)
  )
    throw new Error();
} catch {
  issues.push('SHOPIFY_APP_URL must be the stable public HTTPS origin, without /shopify.');
}
if (
  process.env.STUDIOSHELF_SUPPORT_EMAIL &&
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.STUDIOSHELF_SUPPORT_EMAIL)
)
  issues.push('STUDIOSHELF_SUPPORT_EMAIL is invalid.');
const toml = await readFile(new URL('../shopify.app.toml', import.meta.url), 'utf8');
if (toml.includes('REPLACE_WITH'))
  issues.push('shopify.app.toml still contains registration placeholders.');
if (
  process.env.SHOPIFY_APP_URL &&
  !toml.includes(`${process.env.SHOPIFY_APP_URL.replace(/\/$/, '')}/shopify`)
)
  issues.push('The Shopify application URL does not match the configured origin.');
if (process.env.SHOPIFY_HOSTED_AI_ENABLED === 'true') {
  if (!process.env.GEMINI_API_KEY) issues.push('Hosted AI is enabled without GEMINI_API_KEY.');
  for (const name of ['SHOPIFY_AI_MONTHLY_LIMIT', 'SHOPIFY_AI_GLOBAL_MONTHLY_LIMIT'])
    if (!/^\d+$/.test(process.env[name] || '') || Number(process.env[name]) < 1)
      issues.push(`${name} must be an explicit positive limit before enabling hosted AI.`);
}
if (issues.length) {
  console.error(
    'Shopify launch setup is incomplete:\n' + issues.map((issue) => `- ${issue}`).join('\n'),
  );
  process.exitCode = 1;
} else
  console.log(
    'Configuration checks passed. This does not verify database migrations, live Shopify installation, webhook delivery or App Store approval. Complete the live test matrix in docs/SHOPIFY.md before public launch.',
  );
