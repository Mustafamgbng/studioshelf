# StudioShelf — codebase handoff

## What the asset does

An editable product-launch workspace for independent makers and small ecommerce sellers. A single product brief produces a coherent deliverable: listing copy, three channel messages and a five-slide visual story.

The intended reason to choose StudioShelf is a compact product-launch handoff: one saved brief, coordinated artwork and editable copy, a seller review, and useful files for the shop, Instagram, WhatsApp and email. Inputs stay attached to the project, artwork previews use the real export renderer, and projects can be reopened. A buyer can run the full template demo without API credentials. This positioning still needs testing with real sellers; it is not a claim that competitors lack these capabilities.

The product homepage lives at `/`; the creative workspace lives at `/studio`. The homepage lets visitors explore actual carousel, listing and channel drafts for headphones, fragrance and everyday tote examples, change palettes, copy text and download a PNG. Opening an example preserves the selected palette, slide and asset tab. Both views provide light and dark interface modes with a remembered browser preference.

The standalone creative desk provides a visual overview, current-kit previews, example projects, asset shortcuts, recent browser saves and a guided walkthrough. The editor includes real artwork controls, contextual listing/social/email previews, current-session undo/redo and individual asset regeneration. A browser-local default brand can carry a logo, colours, voice and call to action into new blank kits. It is not a cross-device brand account; Shopify branding uses the separate store-based integration.

The source now includes an embedded Shopify workspace at `/shopify`, with product/variant import, shared store kits, branding, selective regeneration, approved description writes and restoration history. Shopify app registration, service credentials, development-store verification and review are intentionally deferred. This is an integration codebase, not an approved or installed public Shopify app. Use `SHOPIFY.md` and `SHOPIFY_VERIFICATION.md` for setup and honest validation limits.

## Included

- Next.js 16 / React 19 / TypeScript source with a pinned pnpm lockfile.
- Browser-based design and export engine; no image-generation service required.
- Optional Gemini integration with image input and structured validated output.
- Optional Supabase auth, database schema, RLS policies and daily hosted-key quota.
- Responsive homepage and workspace, light/dark interface modes, local project storage, backup and restore.
- Three fictional product examples with AI-generated concept photography, four campaign palettes and three creative layouts: Editorial, Spotlight and Gallery. Each kit has five carousel slides. Typography, photo framing/scale, alignment and brand visibility are saved in the project and used by PNG exports. The original StudioShelf logo is included in SVG and PNG formats with a favicon. Graphite is the headphones default; the legacy mug illustration remains available for older projects.
- A brand editor with raster-logo upload and browser-local defaults, plus portable kit branding in project backups.
- Automated tests, architecture notes, setup and Vercel deployment instructions.

## Five-minute demonstration

1. Launch without environment variables and open `/`. Try the three sample products, carousel/listing/captions tabs and palette controls. Copy a draft or download the current slide.
2. Toggle the interface between light and dark, then use **Edit this kit**. The selected palette, slide and asset tab should carry into `/studio`.
3. Visit **Overview** and take the quick tour, then open **Creative studio**. Choose Editorial, Spotlight or Gallery, change typography or framing and inspect the large preview. Interface appearance and preview zoom should not change export dimensions or colours.
4. In **Text**, edit a headline, undo and redo it. Edit a listing or channel draft and inspect its contextual preview. Refresh one asset to preserve edits in the others; the free template engine remains a fixed, fact-based structure.
5. In **Brand studio**, set colours and a logo, then save a browser default. New blank kits use it; existing kits and examples retain their own look. Voice and call-to-action changes affect subsequent generation rather than silently replacing edited copy.
6. In **Photos**, mix different photos across slides. In **Review**, confirm facts and inspect the slides. Open **Publish pack**, inspect the four channels and follow a missing-input check. Download a single HTML/text file or the channel ZIP.
7. Save, find the kit on the shelf and reopen it. Export a complete ZIP; show all five 1080 × 1350 PNGs, five channel files and the editable project backup, including creative settings and branding. Undo history is session-only and does not travel with the backup.
8. Optionally add your own Gemini key and generate from a different confirmed product brief and photo.

The bundled `demo/sample-launch-kit.zip` is a fresh No. 04 fragrance export using three photographic concept assets. Its example.com destination is a placeholder for demonstration. The package includes workspace and channel-pack screenshots. Follow the verification report for exact checks and external integration limits.

## Possible buyers and extensions

The likely audience to test is an agency creating recurring product-launch assets, a developer wanting an ecommerce micro-SaaS foundation, or a seller-tool operator needing a white-label workspace. This is a hypothesis, not validated demand.

Shopify store palettes, logos, staff sharing and description publishing are implemented in the integration code, with live configuration and development-store testing still required. Potential next additions include per-channel length rules, reusable product templates, multilingual copy and paid Shopify App Pricing plans after development-store testing and platform review. Validate interest before paying to build them.

## What not to advertise

Do not claim existing revenue, customers, search-ranking gains, conversion improvements, verified product facts or guaranteed AI accuracy. Do not claim the app is fully penetration-tested, has live-verified Supabase integration, or includes a commercial hosting allowance. Confirm the verification report and update it when live services are tested.

## A practical sale package

Use a private repository or the source ZIP, a short recorded demo, the sample export, screenshots and the verification report. Clearly distinguish an exclusive source sale from non-exclusive template licenses. Decide support scope, updates, branding rights and third-party obligations before listing. A sale price or eventual sale cannot be established from the code alone.
