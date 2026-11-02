# Verification report

Latest checks on 2 November 2026 using Node 24.22.1 on Windows.

The [deep demo audit](DEEP_AUDIT.md) records the latest 88-test revision, confirmed defects, fixes and fresh browser checks. Earlier sections below remain the historical validation record for their respective releases.

## GitHub Pages interactive demonstration

- Published the static project demonstration to [the live HTTPS site](https://mustafamgbng.github.io/studioshelf-demo/), from a separate public repository containing compiled files only. The original source repository remains private. GitHub's Pages settings confirmed successful deployment and enforced HTTPS.
- All 78 automated tests passed, including deployment-prefix handling. Whole-project Prettier, the regular full-server production build and the isolated static-export build passed. API routes, authentication proxy, request-dependent pages and server integrations remain in the normal application; the demo build omits or replaces them.
- Independently inspected 91 public files and 182 local HTML links/assets. All local targets resolved under the repository prefix. No environment files, server/API directories, TypeScript/SQL, source maps or server credential names were found in public output. Production dependency notices are included.
- On the exact local static artifact, exercised product-photo upload, template generation, save, refresh, reopen and complete-kit export. The ZIP passed integrity checks and retained the uploaded photo and canonical gallery paths; all five PNGs measured 1080 × 1350. Connections had no password/API-key fields, and generation offered templates only. No browser console errors were recorded in that pass.
- On the public GitHub Pages site, verified homepage-to-Publish-pack navigation, loaded visible product images, a downloaded five-file channel pack and browser saving. Narrow layout and dark appearance were also inspected locally with equal client/content widths; browser viewport overrides were not consistently applied, so a precise phone-width measurement is not claimed for this deployment pass.

Evidence: [live homepage](github-pages-live.jpg). Browser saving is origin-specific; local-preview kits do not automatically appear on the public domain. This demo does not provide Gemini, cloud accounts or Shopify, and is not a commercial SaaS launch. The full integration limits below still apply.

## Four-channel launch handoff

- Final strict TypeScript, whole-project Prettier check and optimized Next.js production build passed.
- 76 automated tests passed, including current edited export values, HTML escaping, unsafe destination rejection, real channel-link inspection, missing-input checks and the Publish pack deep link. Independent code review identified and corrected legacy-generation snapshot promotion and an overly broad destination-ready claim.
- Browser checks exercised shop and email visual previews, Instagram copy success feedback, the read-only file view, keyboard Home/End tab navigation, the missing-product-link action, product URL entry and full template generation. All four exported channels then contained that URL. Browser clipboard text was not observable in this last pass; success feedback and exported contents were verified.
- Downloaded an individual email HTML file, the five-file channel ZIP and the complete launch kit through the UI. Both ZIPs passed integrity checks; the complete kit contained five 1080 × 1350 PNGs and five files under `publish/`. All four channel bodies contained the demonstration URL. This complete kit replaces the bundled demo export.
- Inspected desktop light/dark and phone previews. At the 390-pixel requested phone viewport, document client and content widths were both 375 pixels. The cramped desktop price input was corrected and measured 163 pixels wide. No browser console errors were recorded in this pass.
- Homepage copy describes the actual handoff, and its Publish pack link opened the selected editor tab. Claims of unique capabilities, customer demand, time savings or sales results are not made.

Evidence: [shop handoff](publish-pack-light.jpg), [dark checks](publish-pack-dark.jpg), [phone handoff](publish-pack-mobile.jpg). Live Shopify, Gemini, Supabase and Vercel limits below remain unchanged.

## Photographic campaign workflow

- 72 automated tests passed. New cases cover gallery source restrictions, bounded image storage, per-slide image resolution, renderer frame colour, gallery undo/redo, review invalidation/backup validation and persisted generation facts.
- Strict TypeScript, Prettier and optimized production build passed.
- Replaced the repeated fan with Artwork/Listing/Email tabs. Browser checks exercised slide navigation, clipboard success and actual clipboard text, and opening the email editor with its email preview selected.
- Inspected all four photographic asset cards and verified listing, channel and review cards open their matching editor tabs. Artificial canvas borders were removed; contained-image space now matches the campaign background.
- Uploaded and resized a product photo through the actual multi-file chooser. Assigned it to a slide, used one photo across slides, mixed photos, removed a photo and undid removal. Existing assignments and unrelated slides remained intact.
- Confirmed two review items, saved and reopened the kit, then changed its price. Review progress reset, and the outdated-copy warning remained visible after another save/reopen.
- Inspected desktop light mode and phone photo controls/asset cards. At a requested 390-pixel viewport, both client width and content width measured 375 pixels.
- Downloaded the multi-photo kit through the UI. ZIP integrity passed; five PNGs measured 1080 × 1350. JSON retained two gallery entries and explicit photo assignments, and the exported lifestyle slide was visually inspected. The bundled sample ZIP is this export.

Evidence: [asset cards](campaign-assets-light.jpg), [phone asset cards](campaign-assets-mobile.jpg), [phone photo library](campaign-photos-mobile.jpg). The real Shopify, Gemini and Supabase integration limits below still apply. The new photo library and saved checklist are standalone-workspace features; live merchant workflows are not claimed as newly tested.

## Visual workspace revision

The current source adds a visual creative desk, a working homepage playground, three exported creative layouts, browser-local default branding, contextual content previews, bounded session undo/redo and selective standalone regeneration.

- All 62 automated tests passed. New coverage includes creative-setting validation, image framing and bounded text, history, saved-brand validation and restricted storage, validated homepage handoff, and sample-photo identity across renames and backups.
- Strict TypeScript, Prettier and the optimized Next.js production build passed.
- Browser checks exercised layout changes, text editing with undo/redo, product rename with retained concept photo, palette changes, zoom, the large preview, listing/social/email views, and the three-step guided tour into the editor.
- Partial listing regeneration retained the outdated-brief warning; full generation cleared it. Undoing generation restored the warning and redo cleared it.
- Uploaded the included StudioShelf raster mark as a test logo and changed a custom brand colour; the real artwork preview updated.
- Saved and reopened a kit after refresh, confirming its Spotlight layout and Field notes palette. The dark interface preference also survived refresh.
- Selected Tote, Field notes and slide five in the homepage playground, copied its actual WhatsApp text, and followed Edit this kit into the matching product, palette, slide and channel tab.
- Inspected the desktop workspace in light and dark mode and the phone canvas/brief panels. At a requested 390-pixel viewport (375-pixel client width), document width remained 375 pixels. The phone canvas measured 250 pixels at 100% and 300 pixels at 120% zoom.
- Downloaded and visually inspected PNGs from Editorial, Spotlight and Gallery. Downloaded a fresh complete Spotlight/Field notes kit through the UI; ZIP integrity passed and all five PNGs measured 1080 × 1350. Its JSON retained the design settings and pinned fragrance photo. This export replaces `demo/sample-launch-kit.zip`.

Current screenshots: [light editor](workspace-editor-light.jpg), [dark editor](workspace-editor-dark.jpg), [light desk](workspace-overview-light.jpg), [dark desk](workspace-overview-dark.jpg) and [phone editor](workspace-mobile.jpg).

The Shopify design dialog shares the renderer and controls; its configured-store workflow still requires live development-store testing. Browser-local brand failure handling is covered by unit tests; restrictive-browser and live cloud behavior are not claimed as newly browser-tested.

## Shopify integration verification

See [Shopify verification](SHOPIFY_VERIFICATION.md) for the integration revision: 45 automated tests, production build, browser checks and branded export verification. These are not live Shopify account tests. Shopify registration, real-store tests, SQL execution and App Store review are deferred at the owner's request; Vercel deployment currently needs working account access.

## Earlier editorial automated checks

- Strict TypeScript check passed.
- Next.js optimized production build passed. It generated the static homepage and logo favicon, the dynamic workspace at `/studio`, and the dynamic `/api/generate` route.
- All 12 automated tests passed. Coverage includes input and price validation, template fact retention, malformed AI output, backup validation and unknown-field removal, CSV formula protection, bounded artwork text, cross-origin and request-size rejection, anonymous server-key protection, mocked Gemini requests and provider errors, the new sample backups and Graphite palette, and legacy mug-image fallback.
- Prettier formatting check passed.

## Earlier editorial browser checks

- Loaded and visually inspected the homepage and studio in both dark and light mode.
- Confirmed the interface theme persisted after reload and navigation between the homepage and studio.
- Selected the Tote and Fragrance product previews and confirmed the edit links used the corresponding sample URLs. Followed Create a launch to `/studio?sample=fragrance` and confirmed the correct product appeared.
- Confirmed the hero photo used Next.js image optimization and loaded successfully. Inspected the generated concept photography and the original logo in the rendered interface.
- Checked the homepage and studio at the phone breakpoint in both interface themes. With a requested 390-pixel browser viewport and a measured 375-pixel client width, document content width equaled client width on both routes; no horizontal overflow was detected.
- Opened the mobile navigation and reached Connections.
- Downloaded a fresh No. 04 fragrance launch ZIP through the actual studio UI using the photographic asset.
- Verified ZIP integrity and confirmed all five PNGs were 1080 × 1350 pixels. The verified export is bundled at `demo/sample-launch-kit.zip`.

The earlier editorial evidence includes the light homepage at `docs/preview.png`, dark homepage at `docs/preview-dark.png`, and light editor at `docs/studio-preview.png`. Updated workspace evidence should be identified separately or these files replaced after fresh verification.

## Earlier workflow checks

Before the visual redesign, browser verification also covered IndexedDB save/reopen, the listing / captions / review panels, text and palette editing, and a local synthetic photo upload. Those earlier checks are historical; the browser checks above describe the flows exercised on the redesign. New sample backup compatibility and the legacy mug-image fallback are covered by the current automated tests.

## External integration limits

No real Gemini API key or Supabase project was supplied. Provider behavior was tested with mocks, not a live generation. Supabase sign-up, email delivery, cloud CRUD, row-level isolation and the SQL quota function still require execution against an actual configured project. The schema and integration code are included; do not present those paths as live-account verified.

Vercel deployment has not been performed. The source follows the standard Next.js app layout and the production build passed; the deployment guide lists the required settings. Commercial hosting terms need review for the buyer's intended use.

This report is a functional validation record, not a security certification, market validation or sales estimate.
