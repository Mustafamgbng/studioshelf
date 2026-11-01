# StudioShelf — codebase handoff

## What the asset does

An editable product-launch workspace for independent makers and small ecommerce sellers. A single product brief produces a coherent deliverable: listing copy, three channel messages and a five-slide visual story.

The practical distinction from a prompt wrapper is the finished workflow: inputs stay attached to the project, drafts remain editable, previews use the real export renderer, projects can be reopened, and the final ZIP can be delivered to a seller. A buyer can run the full template demo without API credentials.

The product homepage lives at `/`; the creative workspace lives at `/studio`. The homepage lets visitors compare headphones, fragrance and everyday tote examples before opening an editable project. Both views provide light and dark interface modes with a remembered browser preference.

## Included

- Next.js 16 / React 19 / TypeScript source with a pinned pnpm lockfile.
- Browser-based design and export engine; no image-generation service required.
- Optional Gemini integration with image input and structured validated output.
- Optional Supabase auth, database schema, RLS policies and daily hosted-key quota.
- Responsive homepage and workspace, light/dark interface modes, local project storage, backup and restore.
- Three fictional product examples with original SVG illustrations, four campaign palettes and five carousel layouts. Graphite provides a darker sans-serif direction and is the headphones default. The original mug illustration remains for older demo projects.
- Automated tests, architecture notes, setup and Vercel deployment instructions.

## Five-minute demonstration

1. Launch without environment variables and open `/`. Switch between the three product previews.
2. Toggle the interface between light and dark, then open an example in `/studio`.
3. Change its campaign palette, edit a carousel headline and inspect the preview. The interface mode should not change the exported campaign palette.
4. Edit a listing description and switch to captions / email.
5. Save, find it on the shelf, and reopen it.
6. Export a ZIP; show all five 1080 × 1350 PNGs and the editable project backup.
7. Optionally add your own Gemini key and generate from a different product brief and photo.

The bundled `demo/sample-launch-kit.zip` is a fresh Studio Headphones export using Graphite. The package also includes dark and light homepage screenshots and a dark workspace screenshot. Follow the verification report for the exact checks performed and external integration limits.

## Possible buyers and extensions

The likely audience to test is an agency creating recurring product-launch assets, a developer wanting an ecommerce micro-SaaS foundation, or a seller-tool operator needing a white-label workspace. This is a hypothesis, not validated demand.

Potential next additions: custom brand palettes and logos, per-channel length rules, reusable product templates, multilingual copy, password reset, team workspaces and a publishing integration. Validate interest before paying to build them.

## What not to advertise

Do not claim existing revenue, customers, search-ranking gains, conversion improvements, verified product facts or guaranteed AI accuracy. Do not claim the app is fully penetration-tested, has live-verified Supabase integration, or includes a commercial hosting allowance. Confirm the verification report and update it when live services are tested.

## A practical sale package

Use a private repository or the source ZIP, a short recorded demo, the sample export, screenshots and the verification report. Clearly distinguish an exclusive source sale from non-exclusive template licenses. Decide support scope, updates, branding rights and third-party obligations before listing. A sale price or eventual sale cannot be established from the code alone.
