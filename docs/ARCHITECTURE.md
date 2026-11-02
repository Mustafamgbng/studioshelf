# Architecture

## Shopify workspace

`/shopify` adds a separate embedded workspace while preserving `/studio`. App Bridge supplies a fresh identity token per protected request; server-side online token exchange checks effective staff and installation scopes and obtains the live store ID. Shopify tokens are never saved. Service-role-only Supabase tables bind kits, branding, description history and usage to that verified store. Local browser storage is not used by this workspace.

The GraphQL layer imports products and paginated variants. Selected images are fetched through an authenticated, ownership-checked image endpoint with CDN allowlisting, no redirects and a 3 MB limit; product images are requested at bounded dimensions. Fingerprints and store-currency comparisons prevent silent reuse of outdated imports. Partial regeneration merges only the requested asset on the server and into the latest editor state on the client.

Optional product writes require `write_products`, a persisted before/after preview and explicit approval. Description history precedes the mutation; atomic preview claims prevent duplicate writes, and ambiguous outcomes require reconciliation. The iframe proxy sets verified per-store CSP and standalone frame denial. Durable signed webhooks cover privacy, uninstall, scopes and product changes. See [Shopify setup and limitations](SHOPIFY.md) and [current verification](SHOPIFY_VERIFICATION.md).

These paths are implemented source, not a live installation. Shopify app registration, credentials, database migration execution, development-store tests and public-app review remain deferred. The unconfigured route provides setup guidance instead of showing a connected store.

## Homepage and studio

The `/` route introduces the product with a warm editorial hero, a floating navigation dock, a workflow explanation and three fictional product examples. A working playground uses the actual template output and canvas renderer for carousel, listing and channel previews. Visitors can change palettes, copy draft text or download the selected slide. The edit link carries the sample ID, palette, slide and asset tab into `/studio`.

The studio route awaits Next.js's `searchParams`; `lib/studio-route.ts` validates the sample, theme, slide and tab before passing them into a keyed `Studio` component. Unknown or repeated sample parameters return to the overview. The corresponding example is available in the server-rendered initial view; it does not depend on a later browser effect to read the URL. Direct `/studio` visits open the visual creative desk, with the current kit, examples, asset shortcuts, recent browser saves and a three-step walkthrough.

`lib/samples.ts` defines headphones, fragrance and everyday tote examples. The standalone desk initially uses the fragrance kit. A project's optional `sampleId` keeps its selected concept photograph attached when the seller renames the product; an uploaded image takes precedence. Product-name image lookup remains as a fallback for older backups, including the original Sunday Mug illustration. The optional creative and sample fields do not require replacing existing project records or changing the cloud schema.

## Interface themes

The homepage and workspace share a light/dark control. Light is the default for new visitors; an existing saved preference is preserved. A small head script applies the browser's saved `studioshelf-theme` preference before the initial paint. The control updates the document theme, records the preference in local storage when available, and synchronizes changes across open tabs. If storage is unavailable, the switch still works for the current page.

Interface theme and campaign palette are separate concerns. A visitor can use a dark interface while exporting a pale campaign, or use a light interface with a darker campaign palette. The preference is not included in a product backup and does not change the seller's product facts or copy.

Four campaign palettes are available: Graphite, Peach studio, Lilac hour and Field notes. The headphones example starts with Graphite, whose default typography uses a modern sans-serif treatment. Optional project-level creative settings independently select Editorial, Spotlight or Gallery layout, serif or sans typography, image fit and scale, text alignment and brand visibility. Legacy projects without these settings retain the appropriate palette defaults.

## Single product workflow

`Product` is the confirmed input. `Kit` is editable output. `Project` binds both to a photo, palette, optional branding and creative settings, source engine and ID. Changing a brief marks copy as stale. Full generation replaces the kit; selective regeneration merges only the requested slide, listing or channel into the latest editor state so other edits remain. In-flight generation and photo uploads check project identity before applying their results. Save is explicit, and leaving with unsaved changes triggers a browser warning.

The standalone editor keeps up to 40 undo/redo snapshots in memory, coalescing short bursts of typing. Save metadata does not become an undo step, and undo preserves the saved project identity. Opening another project or refreshing resets this history. Contextual shop, social and email previews display the current draft without publishing or sending it; preview zoom changes only the on-screen canvas size.

The initial sample data is deterministic, so server rendering and hydration agree. User-created IDs use `crypto.randomUUID()` in browser event handlers. A built-in sample receives a fresh UUID when first saved.

## Generation

Template generation is a pure function. It rearranges the supplied facts and does not call any service. The tone/audience controls guide Gemini; templates use a fixed neutral structure. The homepage's live sample preview uses this local template engine and does not imply a successful Gemini request.

Gemini calls go to one Next.js Node route. It enforces same-origin browser requests, reads a bounded JSON body, validates input fields, accepts only bounded JPEG/PNG/WebP data URLs, uses header authentication to Google's generateContent API, requests a JSON schema and validates the response again. It returns curated errors and never falls back to a template while claiming AI success.

A visitor-provided key is used only for that request. A server-owned key requires a bearer token verified by Supabase Auth plus a successful atomic database quota call. The app does not expose the hosted key in the client bundle. The in-memory burst limiter is a convenience and is not a distributed abuse-control system.

## Images and exports

The bundled product examples use AI-generated concept photographs; their exact prompts and provenance are documented in `ASSET_PROMPTS.md`. The logo is an original SVG monogram with a reusable React component and favicon. Sample photos are separate from user uploads and do not represent actual products for sale.

Uploaded photos are resized locally to at most 1400 pixels on their longest side and re-encoded as JPEG. Transparency is flattened onto white. We do not alter the product itself, remove backgrounds or invent a product scene. Gemini receives the resized image only when selected by the user.

The same canvas renderer powers previews and exports, so edited copy, palettes, logos and creative settings appear in both. PNG dimensions are 1080 × 1350 for all three layouts. Bounded text areas shrink or shorten overlong copy; long unspaced words wrap, and line limits use an ellipsis. ZIP is generated in the browser, with five PNGs, Markdown, a formula-protected CSV and a portable JSON project. The CSV is not a marketplace API integration.

The checked-in `demo/sample-launch-kit.zip` is a UI-generated export of the No. 04 fragrance example using the photographic concept asset. It includes the five rendered PNGs and a portable project backup. The older illustrated exports are no longer bundled; the legacy mug lookup remains for existing saved mug projects.

## Storage and accounts

IndexedDB holds standalone local projects including photos, branding and creative settings. There is no hidden automatic upload. The optional default brand uses the browser's `studioshelf-brand-v1` local-storage entry. Validated raster logos, colours, voice and call to action apply to new blank kits or an explicit apply action; existing kits and examples keep their own settings. Blocked or full browser storage produces a useful error, and the current kit can still be exported as a backup. Browser defaults are separate from Shopify's persistent store branding.

Supabase's browser SDK manages optional standalone account sessions. The server verifies bearer tokens when authorizing its own AI key. Standalone cloud CRUD uses the signed-in browser client with row-level policies enforcing ownership and never uses a service-role key. The separate Shopify server repository does require a server-only service-role key and verified store identity, as described above.

The SQL schema includes a bounded JSON project record and a usage table. A `security definer` function with an empty search path increments usage atomically. Direct authenticated writes to the usage table are revoked. Backup validation limits the format, strips unknown object properties and rejects arbitrary SVG/HTML image data.

## Deliberate limits

- No billing or social scheduling. Content previews do not publish posts or send messages. The Shopify integration separately supports explicitly previewed and approved product-description writes once configured.
- No validated keyword volume, analytics or sales forecasting.
- No background jobs or image-generation fees.
- Authentication and cloud saves require a real Supabase project to verify end to end.
- Gemini requires a real key and enabled model to verify end to end.
- Standalone account auth is email/password; password-reset UI and alternative identity providers are future extensions. Shopify uses its own App Bridge identity flow.
- No production observability or service-level promise is bundled. Standalone hosted AI has a per-user daily quota; the Shopify code includes separate per-store limits and operator controls that still require live configuration and verification.
