# Verification report

Verified on 1 November 2026 using Node 24.22.1 on Windows.

## Automated checks

- Strict TypeScript check passed.
- Next.js optimized production build passed. It generated the static homepage at `/`, the dynamic workspace at `/studio`, and the dynamic `/api/generate` route.
- All 12 automated tests passed. Coverage includes input and price validation, template fact retention, malformed AI output, backup validation and unknown-field removal, CSV formula protection, bounded artwork text, cross-origin and request-size rejection, anonymous server-key protection, mocked Gemini requests and provider errors, the new sample backups and Graphite palette, and legacy mug-image fallback.
- Prettier formatting check passed.

## Browser checks

- Loaded and visually inspected the homepage and studio in both dark and light mode.
- Confirmed the interface theme persisted after reload and navigation between the homepage and studio.
- Selected Fragrance on the homepage, followed Start creating to `/studio?sample=fragrance`, and confirmed the studio showed the correct product name while retaining light mode.
- Confirmed the Tote and Headphones selectors updated the Start creating destination to their corresponding sample URLs.
- Checked the homepage and studio at the phone breakpoint in both interface themes. With a requested 390-pixel browser viewport and a measured 375-pixel client width, document content width equaled client width on both routes; no horizontal overflow was detected.
- Opened the mobile navigation and reached Connections.
- Downloaded a fresh Studio Headphones launch ZIP through the actual studio UI using the Graphite palette.
- Verified ZIP integrity and confirmed all five PNGs were 1080 × 1350 pixels. The verified export is bundled at `demo/sample-launch-kit.zip`.

The package includes the current dark homepage at `docs/preview.png`, light homepage at `docs/preview-light.png`, and dark editor at `docs/studio-preview.png`.

## Earlier workflow checks

Before the visual redesign, browser verification also covered IndexedDB save/reopen, the listing / captions / review panels, text and palette editing, and a local synthetic photo upload. Those earlier checks are historical; the browser checks above describe the flows exercised on the redesign. New sample backup compatibility and the legacy mug-image fallback are covered by the current automated tests.

## External integration limits

No real Gemini API key or Supabase project was supplied. Provider behavior was tested with mocks, not a live generation. Supabase sign-up, email delivery, cloud CRUD, row-level isolation and the SQL quota function still require execution against an actual configured project. The schema and integration code are included; do not present those paths as live-account verified.

Vercel deployment has not been performed. The source follows the standard Next.js app layout and the production build passed; the deployment guide lists the required settings. Commercial hosting terms need review for the buyer's intended use.

This report is a functional validation record, not a security certification, market validation or sales estimate.
