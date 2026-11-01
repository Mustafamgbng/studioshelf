# Verification report

Verified on 1 November 2026 using Node 24.22.1 on Windows.

## Current Shopify revision

See [Shopify verification](SHOPIFY_VERIFICATION.md) for the current integration: 45 automated tests, production build, browser checks and branded export verification. The checks below record the earlier editorial revision and remain useful history. They are not live Shopify account tests. Shopify registration, real-store tests, SQL execution and App Store review are deferred at the owner's request; Vercel deployment currently needs working account access.

## Automated checks

- Strict TypeScript check passed.
- Next.js optimized production build passed. It generated the static homepage and logo favicon, the dynamic workspace at `/studio`, and the dynamic `/api/generate` route.
- All 12 automated tests passed. Coverage includes input and price validation, template fact retention, malformed AI output, backup validation and unknown-field removal, CSV formula protection, bounded artwork text, cross-origin and request-size rejection, anonymous server-key protection, mocked Gemini requests and provider errors, the new sample backups and Graphite palette, and legacy mug-image fallback.
- Prettier formatting check passed.

## Browser checks

- Loaded and visually inspected the homepage and studio in both dark and light mode.
- Confirmed the interface theme persisted after reload and navigation between the homepage and studio.
- Selected the Tote and Fragrance product previews and confirmed the edit links used the corresponding sample URLs. Followed Create a launch to `/studio?sample=fragrance` and confirmed the correct product appeared.
- Confirmed the hero photo used Next.js image optimization and loaded successfully. Inspected the generated concept photography and the original logo in the rendered interface.
- Checked the homepage and studio at the phone breakpoint in both interface themes. With a requested 390-pixel browser viewport and a measured 375-pixel client width, document content width equaled client width on both routes; no horizontal overflow was detected.
- Opened the mobile navigation and reached Connections.
- Downloaded a fresh No. 04 fragrance launch ZIP through the actual studio UI using the photographic asset.
- Verified ZIP integrity and confirmed all five PNGs were 1080 × 1350 pixels. The verified export is bundled at `demo/sample-launch-kit.zip`.

The package includes the current light homepage at `docs/preview.png`, dark homepage at `docs/preview-dark.png`, and light editor at `docs/studio-preview.png`.

## Earlier workflow checks

Before the visual redesign, browser verification also covered IndexedDB save/reopen, the listing / captions / review panels, text and palette editing, and a local synthetic photo upload. Those earlier checks are historical; the browser checks above describe the flows exercised on the redesign. New sample backup compatibility and the legacy mug-image fallback are covered by the current automated tests.

## External integration limits

No real Gemini API key or Supabase project was supplied. Provider behavior was tested with mocks, not a live generation. Supabase sign-up, email delivery, cloud CRUD, row-level isolation and the SQL quota function still require execution against an actual configured project. The schema and integration code are included; do not present those paths as live-account verified.

Vercel deployment has not been performed. The source follows the standard Next.js app layout and the production build passed; the deployment guide lists the required settings. Commercial hosting terms need review for the buyer's intended use.

This report is a functional validation record, not a security certification, market validation or sales estimate.
