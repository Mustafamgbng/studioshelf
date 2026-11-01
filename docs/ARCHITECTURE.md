# Architecture

## Homepage and studio

The `/` route introduces the product with a warm editorial hero, a floating navigation dock, a workflow explanation and three fictional product examples. Each example links to `/studio?sample=<id>`, which opens the workspace with its brief and concept photograph. The studio remains directly accessible at `/studio`.

The studio route awaits Next.js's `searchParams` and passes the selected sample ID into a keyed `Studio` component. The corresponding example is available in the server-rendered initial view; it does not depend on a later browser effect to read the URL.

`lib/samples.ts` defines headphones, fragrance and everyday tote examples. The default is the first configured example. Sample-image lookup also retains the original Sunday Mug illustration so older demo projects can still render. The redesign does not require replacing saved project records or changing the cloud schema.

## Interface themes

The homepage and workspace share a light/dark control. Light is the default for new visitors; an existing saved preference is preserved. A small head script applies the browser's saved `studioshelf-theme` preference before the initial paint. The control updates the document theme, records the preference in local storage when available, and synchronizes changes across open tabs. If storage is unavailable, the switch still works for the current page.

Interface theme and campaign palette are separate concerns. A visitor can use a dark interface while exporting a pale campaign, or use a light interface with a darker campaign palette. The preference is not included in a product backup and does not change the seller's product facts or copy.

Four campaign palettes are available: Graphite, Peach studio, Lilac hour and Field notes. The headphones example starts with Graphite, whose export renderer uses a modern sans-serif treatment. The other palettes retain their own artwork styling.

## Single product workflow

`Product` is the confirmed input. `Kit` is editable output. `Project` binds both to a photo, palette, source engine and ID. Changing a brief marks copy as stale; generating deliberately replaces copy. Save is explicit, and leaving with unsaved changes triggers a browser warning.

The initial sample data is deterministic, so server rendering and hydration agree. User-created IDs use `crypto.randomUUID()` in browser event handlers. A built-in sample receives a fresh UUID when first saved.

## Generation

Template generation is a pure function. It rearranges the supplied facts and does not call any service. The tone/audience controls guide Gemini; templates use a fixed neutral structure. The homepage's live sample preview uses this local template engine and does not imply a successful Gemini request.

Gemini calls go to one Next.js Node route. It enforces same-origin browser requests, reads a bounded JSON body, validates input fields, accepts only bounded JPEG/PNG/WebP data URLs, uses header authentication to Google's generateContent API, requests a JSON schema and validates the response again. It returns curated errors and never falls back to a template while claiming AI success.

A visitor-provided key is used only for that request. A server-owned key requires a bearer token verified by Supabase Auth plus a successful atomic database quota call. The app does not expose the hosted key in the client bundle. The in-memory burst limiter is a convenience and is not a distributed abuse-control system.

## Images and exports

The bundled product examples use AI-generated concept photographs; their exact prompts and provenance are documented in `ASSET_PROMPTS.md`. The logo is an original SVG monogram with a reusable React component and favicon. Sample photos are separate from user uploads and do not represent actual products for sale.

Uploaded photos are resized locally to at most 1400 pixels on their longest side and re-encoded as JPEG. Transparency is flattened onto white. We do not alter the product itself, remove backgrounds or invent a product scene. Gemini receives the resized image only when selected by the user.

The same canvas renderer powers previews and exports, so edited copy and palettes appear in both. PNG dimensions are 1080 × 1350. Text wrapping handles long words and uses an ellipsis at its line limit. ZIP is generated in the browser, with five PNGs, Markdown, a formula-protected CSV and a portable JSON project. The CSV is not a marketplace API integration.

The checked-in `demo/sample-launch-kit.zip` is a UI-generated export of the No. 04 fragrance example using the photographic concept asset. It includes the five rendered PNGs and a portable project backup. The older illustrated exports are no longer bundled; the legacy mug lookup remains for existing saved mug projects.

## Storage and accounts

IndexedDB holds local projects including photos. There is no hidden automatic upload. Supabase's browser SDK manages optional account sessions. The server verifies bearer tokens when authorizing its own AI key. Cloud CRUD uses the signed-in browser client with row-level policies enforcing ownership. No service-role key is used.

The SQL schema includes a bounded JSON project record and a usage table. A `security definer` function with an empty search path increments usage atomically. Direct authenticated writes to the usage table are revoked. Backup validation limits the format, strips unknown object properties and rejects arbitrary SVG/HTML image data.

## Deliberate limits

- No billing, social scheduling or marketplace publish integration.
- No validated keyword volume, analytics or sales forecasting.
- No background jobs or image-generation fees.
- Authentication and cloud saves require a real Supabase project to verify end to end.
- Gemini requires a real key and enabled model to verify end to end.
- Auth is email/password; password-reset UI and alternative identity providers are future extensions.
- No production observability, service-level promise or aggregate AI spending cap is bundled.
