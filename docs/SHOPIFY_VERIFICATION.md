# Shopify integration verification

1 November 2026, Node 24.22.1 on Windows. This records implemented code and checks actually performed, not Shopify approval or a production-store certification.

## Automated checks

- All 45 tests passed across the original engine/API tests and new Shopify auth, client, persistence, generation and media tests. Affected suites were rerun after later changes.
- Tests exercise signature/audience/time/issuer validation, signed query canonicalization, staff scope checks, store identity, per-store CSP permits, cookie-free fresh-token requests and restricted-storage behavior.
- Mocked HTTP-boundary tests cover two-store kit isolation, revision conflicts, ownership-bound saves and image selection, variant ownership, confirmed facts, stale-import rejection, preservation of other edited assets and pending-request edits, actual product URLs, provider failures and hosted-limit denial before provider use.
- Mandatory privacy webhook tests cover all three compliance topics, invalid signatures returning 401, discarded customer payload data and failed persistence returning 503. Description tests cover approval, permissions, changed source and reconciliation without replaying an uncertain write.
- Image tests cover ownership, CDN allowlisting, disabled redirects, response size limits and a selected variant image outside the initial product page.
- Optimized Next.js production build and TypeScript passed. Formatting checks passed. The build includes `/shopify`, its protected API routes, webhook route, iframe proxy and public help/privacy/support/pricing routes.

## Browser and export checks

- Inspected the unconfigured Shopify workspace in light and dark modes. It states that setup is incomplete and shows no fabricated store connection.
- Checked both Shopify themes at a requested 390-pixel viewport (375-pixel measured client width); content width matched client width. Mobile help navigation and the updated homepage also had no horizontal overflow.
- Opened `/help`, `/privacy`, `/support` and `/pricing` at the phone breakpoint and verified their headings and widths. Missing support contact and beta status are disclosed.
- Imported a synthetic branded project through the actual standalone studio file chooser, waited for canvas rendering and downloaded its ZIP through the UI. Verified ZIP integrity, five PNGs at 1080 × 1350, the expected custom background pixel on every slide, and retained logo/branding in the editable backup. This validates the shared export renderer, not a live Shopify import.
- Current setup-screen screenshots are `shopify-preview-light.png` and `shopify-preview-dark.png` in this folder.

## External checks deferred or blocked

The owner asked to complete Shopify account integration later. No registered Shopify app/client credentials, Supabase database or development stores were connected. The SQL migration has not been executed against PostgreSQL; database constraints/RPC concurrency, real installation, App Bridge in Admin, real product imports, live staff/store isolation, uninstall/reinstall and real privacy delivery still require the live matrix in `SHOPIFY.md`. Gemini responses were mocked; no live provider call was made.

Vercel registration/login returned “Unauthorized to access the given account” through the GitHub flow. No Vercel deployment URL is claimed. `vercel.json`, ignored deployment files, environment examples and setup documentation are included so deployment can proceed once account access works. App Store review and public launch are not complete. No paid plans or billing integration are active.

Shopify description updates do not expose an atomic compare-and-swap field. A small external concurrent-edit window remains despite source rechecks and atomic preview claims. Hosted allowances are attempt limits with a global cap, not a guaranteed monetary budget; provider-side controls remain necessary before enabling hosted AI.
