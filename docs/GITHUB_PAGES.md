# GitHub Pages demonstration

Published demo: [mustafamgbng.github.io/studioshelf-demo](https://mustafamgbng.github.io/studioshelf-demo/). Compiled-only repository: [Mustafamgbng/studioshelf-demo](https://github.com/Mustafamgbng/studioshelf-demo). GitHub Pages serves `main` at the repository root with HTTPS enforced. The original StudioShelf source remains private.

StudioShelf has a separate static build for a public, interactive project demo. It preserves the complete server application and the private source repository.

The demo supports templates, product-photo uploads, photo assignments, artwork and copy editing, undo, seller review, browser saves, backup import and HTML/text/PNG/ZIP downloads. It has no Gemini generation, API-key entry, accounts, cloud storage, Shopify installation or store access. The demo information pages describe that exact data flow.

GitHub Pages serves static files, so it cannot run the application’s server API. GitHub also excludes operating commercial SaaS on Pages. This deployment is a project demonstration; deploy the full application on an appropriate server host before offering the connected product commercially. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports) and [Next.js basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath).

## Build

Use the installed Node version required by the project and its existing dependencies:

```bash
node scripts/build-demo.mjs --base-path /studioshelf-demo
```

The helper creates a verified `.demo-build` staging directory, copies an allowlist of app sources, then links the existing dependencies. It leaves the regular `app`, `proxy.ts`, configuration and full-server build untouched. The static build receives only a small operating-system environment allowlist plus the two public demo settings. It does not copy `.env` files, private docs, source backups or secrets.

The staged studio reads validated query parameters in a client component under Suspense. Static-only help, privacy, pricing, support and Shopify availability pages replace request-dependent pages. API routes and the authentication proxy are omitted. Images are served without the Next image server; the repository prefix is applied when images are rendered or loaded, without changing canonical paths in editable project backups.

Only `.demo-build/out` is publishable. It contains HTML, CSS, JavaScript, public media, `.nojekyll` and `THIRD-PARTY-LICENSES.txt`. The license file preserves the project's existing third-party notice plus available license and copyright text from installed production dependencies, including bundled notices and installed optional/peer dependencies. It identifies packages that declare a license without shipping a standalone text. The helper validates expected routes and rejects server directories, TypeScript, SQL, environment files, dependency manifests and source maps in the output. The browser bundle is necessarily public; the original repository and server source can stay private.

The generated HTML includes a demo-specific Content Security Policy meta tag. It permits same-origin assets, local data/blob images and Next’s inline scripts/styles, but blocks external application connections and form submissions. GitHub Pages does not support the full server application’s per-store response headers; the demo has no embedded authenticated store workflow.

## Local verification

```bash
node scripts/serve-demo.mjs --base-path /studioshelf-demo --port 4173
```

Open `http://127.0.0.1:4173/studioshelf-demo/`. This server reproduces a repository subpath and real per-route static files. It does not silently return the homepage for a missing path. Check homepage handoff, direct `/studio/` queries, refresh, uploads, saving/reopening, mobile layout, theme persistence and real exports before publishing.

## Publish and update

Create a separate public demonstration repository, such as `studioshelf-demo`, and publish only the generated output. Keep StudioShelf’s source repository private. Configure GitHub Pages to serve the demonstration repository’s deployment branch root. A `.nojekyll` file ensures Next’s `_next` assets are served.

For an update, review source changes through the private repository’s feature-branch and pull-request workflow, rebuild with the same repository prefix, verify the static artifact, and update the public deployment files. Rebuild if the public repository name changes: the prefix is fixed in the browser bundle at build time.

Do not upload the staging source, `.next`, `node_modules`, local projects, environment files or private documentation. Do not put API keys or Shopify credentials in a Pages repository or browser bundle.
