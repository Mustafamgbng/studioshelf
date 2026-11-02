import {
  cp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  lstat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDemoLicenses } from './demo-licenses.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let basePath = '/studioshelf-demo';
let prepareOnly = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--base-path') basePath = args[++index];
  else if (args[index] === '--prepare-only') prepareOnly = true;
  else throw new Error(`Unknown argument: ${args[index]}`);
}
if (typeof basePath !== 'string' || !/^\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(basePath)) {
  throw new Error('Use one repository path such as --base-path /studioshelf-demo.');
}

const buildRoot = join(root, '.demo-build');
const site = join(buildRoot, 'site');
const output = join(buildRoot, 'out');
const within = (parent, target) => {
  const part = relative(parent, target);
  return (
    part !== '' &&
    !isAbsolute(part) &&
    !part.startsWith(`..${sep}`) &&
    part !== '..' &&
    !part.startsWith(sep)
  );
};
if (!within(root, buildRoot) || relative(root, buildRoot) !== '.demo-build') {
  throw new Error('The demo staging directory must stay inside this checkout.');
}

// Remove only this script's verified staging directory. Unlink the dependency
// junction first so cleanup never descends into the installed dependencies.
try {
  const info = await lstat(buildRoot);
  if (info.isSymbolicLink() || !within(await realpath(root), await realpath(buildRoot))) {
    throw new Error('Refusing to clean a demo staging path outside this checkout.');
  }
  try {
    const link = join(site, 'node_modules');
    if ((await lstat(link)).isSymbolicLink()) await unlink(link);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await rm(buildRoot, { recursive: true, force: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(site, { recursive: true });

// Copy a source allowlist. Never copy .env files, docs, backups, credentials,
// Git metadata or a prior build into the static site.
for (const directory of ['app', 'components', 'lib', 'public']) {
  await cp(join(root, directory), join(site, directory), {
    recursive: true,
    filter(source) {
      const path = relative(root, source).split(sep).join('/');
      const name = path.split('/').at(-1);
      if (name.startsWith('.') || name.endsWith('.map')) return false;
      if (path === 'app/api' || path === 'components/shopify-workspace.tsx') return false;
      if (
        path.startsWith('lib/shopify/') &&
        !['lib/shopify/client.ts', 'lib/shopify/types.ts'].includes(path)
      )
        return false;
      return true;
    },
  });
}
for (const file of ['package.json', 'tsconfig.json']) {
  await cp(join(root, file), join(site, file));
}
await writeFile(
  join(site, 'next-env.d.ts'),
  '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
);
await symlink(
  join(root, 'node_modules'),
  join(site, 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir',
);
await writeFile(
  join(site, 'next.config.mjs'),
  `export default {
  output: 'export',
  trailingSlash: true,
  basePath: ${JSON.stringify(basePath)},
  images: { unoptimized: true },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  devIndicators: false,
};\n`,
);

// Read route queries on the client: request-time searchParams are unavailable
// in a static export. Preserve duplicate-query validation and the editor key.
await writeFile(
  join(site, 'app/studio/page.tsx'),
  `'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Studio from '@/components/studio';
import { studioOptions } from '@/lib/studio-route';
function DemoStudio() {
  const query = useSearchParams();
  const params: Record<string, string | string[]> = {};
  for (const key of new Set(query.keys())) {
    const values = query.getAll(key);
    params[key] = values.length === 1 ? values[0] : values;
  }
  const options = studioOptions(params);
  return <Studio key={JSON.stringify(options)} initialSampleId={options.sample}
    initialTheme={options.theme} initialSlide={options.slide} initialTab={options.tab} />;
}
export default function DemoStudioPage() {
  return <Suspense fallback={<main style={{padding:32}}>Opening your demo workspace…</main>}><DemoStudio /></Suspense>;
}
`,
);

const page = (eyebrow, title, body) => `import Link from 'next/link';
import PublicInfo from '@/components/public-info';
export default function DemoInfoPage() {
  return <PublicInfo eyebrow=${JSON.stringify(eyebrow)} title=${JSON.stringify(title)}>
    ${body}
    <p><Link className="btn primary" href="/studio">Open the interactive demo</Link></p>
  </PublicInfo>;
}\n`;
const infoPages = {
  shopify: page(
    'GITHUB PAGES DEMO',
    'Explore the studio. Store connection comes later.',
    `
    <p>This is a public project demonstration. It cannot install into Shopify, import store products, share kits with staff or update product descriptions.</p>
    <h2>Try the product workflow.</h2><p>Use an example or your own photo and confirmed facts. Edit artwork and channel copy, save in this browser, review the kit and download your files.</p>
    <h2>About the full integration.</h2><p>The separate server application requires Shopify registration, secure authentication, database setup and development-store testing before installation. None of those services are connected to this demo.</p>`,
  ),
  privacy: page(
    'DEMO PRIVACY',
    'Your work stays in this browser.',
    `
    <p>This policy describes the interactive GitHub Pages demonstration, not an installed Shopify app.</p>
    <h2>Photos and product details.</h2><p>Template generation, image resizing, artwork rendering and downloads run in your browser. The demo does not upload your photos or product facts to an application server. Gemini generation and API-key entry are unavailable here.</p>
    <h2>Browser storage.</h2><p>Saved kits, uploaded photos and branding can be stored in this browser. Your interface theme and brand defaults may use local storage. There are no accounts or cloud saves in this demo. Clearing site data or using another browser will not preserve your saved work; download an editable backup first.</p>
    <h2>Public hosting.</h2><p>GitHub serves the website and may process normal web-request information under <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">GitHub’s privacy statement</a>. Opening an external product link takes you to that destination. The app includes no analytics or advertising trackers.</p>
    <h2>Keep a copy.</h2><p>Download your launch ZIP or project backup to take work to another browser. Browser storage can be restricted or cleared, so it is not a replacement for a backup.</p>`,
  ),
  support: page(
    'DEMO HELP',
    'A little help for your preview.',
    `
    <p>This is a project demonstration with browser-local work. Public merchant onboarding, accounts, Gemini and Shopify connections are unavailable.</p>
    <h2>If something does not work.</h2><p>Download a project backup before refreshing. Check whether your browser allows site storage and downloads. You can still create and export a kit when browser saving is unavailable.</p>
    <h2>Share useful feedback.</h2><p>Tell the person who shared this demo which action you tried, your browser and the visible error. Do not include passwords, API keys, customer information or a private product brief.</p>`,
  ),
  pricing: page(
    'FREE PROJECT DEMO',
    'Try the complete template workflow.',
    `
    <p>The interactive demonstration is free to explore. There is no checkout, subscription, paid plan or hosted AI allowance on this GitHub Pages site.</p>
    <h2>Included in this preview.</h2><p>Fact-based templates, product-photo uploads, five-slide editing, four channel previews, seller review, browser saves, backup import and downloads.</p>
    <h2>What needs a separate server.</h2><p>Gemini generation, account-based cloud storage and the Shopify integration are not connected here. Templates arrange the facts you supply; they do not pretend to be AI or independently verify product claims.</p>`,
  ),
  help: page(
    'INTERACTIVE DEMO GUIDE',
    'From a product to useful files.',
    `
    <ol>
      <li><h2>Choose an example or your product.</h2><p>Add a product photo and facts you can confirm. Templates run in your browser without an API key or account.</p></li>
      <li><h2>Make the artwork yours.</h2><p>Use Photos to assign different images to slides, Design to change layout and framing, and Text to edit each slide. Preview zoom does not change exported dimensions.</p></li>
      <li><h2>Edit each channel.</h2><p>Review the listing, Instagram caption, WhatsApp message and email. Regenerate one template asset to preserve the others. A changed product brief can leave older copy outdated, so read the warning and review affected assets.</p></li>
      <li><h2>Review, then hand off.</h2><p>Confirm the seller checklist and open Publish pack. Follow checks for missing facts or links, inspect the four channel previews and download HTML or text files. Nothing is posted or sent automatically.</p></li>
      <li><h2>Keep your work.</h2><p>Save kits in this browser. Download the complete ZIP for five 1080 × 1350 PNGs, channel files and an editable backup. Use the backup to move work between browsers; there are no cloud accounts here.</p></li>
    </ol>`,
  ),
};
for (const [route, content] of Object.entries(infoPages)) {
  await mkdir(join(site, 'app', route), { recursive: true });
  await writeFile(join(site, 'app', route, 'page.tsx'), content);
}

if (prepareOnly) {
  console.log(JSON.stringify({ prepared: true, site, basePath }));
  process.exit(0);
}

// Next loads .env only from the isolated site, where none were copied. Build
// with an environment allowlist rather than inheriting operator credentials.
const buildEnv = {};
const allowedEnvironment = new Set([
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'HOME',
  'APPDATA',
  'LOCALAPPDATA',
  'LANG',
  'LC_ALL',
  'TZ',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
]);
for (const [key, value] of Object.entries(process.env)) {
  if (allowedEnvironment.has(key.toUpperCase()) && value !== undefined) buildEnv[key] = value;
}
Object.assign(buildEnv, {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_STATIC_DEMO: 'true',
  NEXT_PUBLIC_BASE_PATH: basePath,
});
const status = await new Promise((resolveStatus, reject) => {
  const child = spawn(
    process.execPath,
    [join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'],
    {
      cwd: site,
      env: buildEnv,
      stdio: 'inherit',
    },
  );
  child.on('error', reject);
  child.on('exit', resolveStatus);
});
if (status !== 0) throw new Error(`Static demo build failed (${status}).`);
await cp(join(site, 'out'), output, { recursive: true });
await writeDemoLicenses(output);

const securityMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'"><meta name="referrer" content="strict-origin-when-cross-origin">`;
let fileCount = 0;
let totalBytes = 0;
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, item.name);
    const name = relative(output, full).split(sep).join('/');
    if (item.isSymbolicLink()) throw new Error(`Unexpected symlink in public output: ${name}`);
    if (item.isDirectory()) {
      if (['api', 'server', 'node_modules', '.git'].includes(item.name))
        throw new Error(`Unexpected server directory in public output: ${name}`);
      await inspect(full);
    } else {
      if (
        /(^|\/)\.env|\.(?:map|tsx?|sql|nft\.json)$|(?:^|\/)(?:package(?:-lock)?\.json|tsconfig\.json|next\.config\.[cm]?js)$/.test(
          name,
        )
      )
        throw new Error(`Unexpected source artifact in public output: ${name}`);
      if (name.endsWith('.html')) {
        const html = await readFile(full, 'utf8');
        await writeFile(full, html.replace('<head>', `<head>${securityMeta}`));
      }
      fileCount++;
      totalBytes += (await lstat(full)).size;
    }
  }
}
await inspect(output);
for (const expected of [
  'index.html',
  '404.html',
  'studio/index.html',
  'shopify/index.html',
  'privacy/index.html',
  'help/index.html',
]) {
  await lstat(join(output, expected));
}
await writeFile(join(output, '.nojekyll'), '');
console.log(
  JSON.stringify({
    built: true,
    outputDirectory: output,
    basePath,
    files: fileCount + 1,
    bytes: totalBytes,
  }),
);
