# StudioShelf for Shopify

The code supports an embedded Shopify workspace at `/shopify`. Account registration, installation on real stores, production service configuration and Shopify review are deferred at the owner's request. The checked-in app configuration is a template, not evidence of a registered or approved Shopify app. See `VERIFICATION.md` for checks actually run.

The first-release workflow is **Install → Select product and variant → Review facts → Generate → Edit → Save to store workspace → Download**. Description previews, approved updates and restoration history are also implemented, but should be tested as a separate rollout before enabling that workflow for merchants.

## Architecture and permissions

Shopify App Bridge loads from Shopify's CDN in the embedded workspace. The browser obtains a fresh ID token for every protected request and sends it as a Bearer token to the app's own server. The server verifies HS256 signature, audience, issuer/destination, lifetime and staff/session claims. It exchanges the token for an **online** Admin API access token on every request, checks the associated staff scopes, then checks the live store and current installation through GraphQL. A `shop` query parameter or a client-supplied store ID never authorizes access. This follows Shopify's [embedded token-exchange flow](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange).

Online tokens respect the current staff member's permissions. Tokens are held only for the current server request: no Shopify access token, refresh token, app secret, customer record or staff identity is saved in the database. This release has no offline API jobs. A later background worker would need a separate expiring offline-token lifecycle and secure credential storage. Shopify documents the [online/offline distinction](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) and [ID-token checks](https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens).

| Permission                    | Use                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read_products`               | Installation scope for searching/importing products and variants, rechecking source details, and authorizing the shared store workspace.                                     |
| `write_products`              | Optional scope requested through App Bridge only when the seller enables description editing. Every preview/apply/restore request checks the current staff permission again. |
| Customer/order/payment scopes | None requested.                                                                                                                                                              |

The GraphQL Admin API and webhook version are pinned to `2026-10`. Product search reads a small catalogue page; selecting a product fetches its detail and paginated variants. No legacy REST Admin API product calls are used. Review [scope management](https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes) before adding features or permissions.

## Configure the deployment later

1. Choose a stable public HTTPS origin for the Next.js deployment. An origin such as `https://your-app.example` goes in `SHOPIFY_APP_URL`; **do not append `/shopify`** to this environment variable. The Shopify app's application URL is the full `https://your-app.example/shopify` URL.
2. Create the app in Shopify's developer dashboard when ready, obtain its client ID and secret, and link its configuration using `shopify app config link`. Preserve this Next.js source rather than replacing it with a new framework scaffold. Use a separate development app/store setup for testing.
3. Replace the placeholders in `shopify.app.toml`: client ID, application URL and the registered URL under `[auth]`. Keep `embedded = true`, managed installation (`use_legacy_install_flow = false`), minimal required scope and the webhook subscriptions. Managed installation/token exchange does not use an authorization-code callback in this app.
4. Configure the environment variables below in the hosting provider's secret settings. Redeploy after changes. Keep secrets out of browser code, Git, screenshots and support messages.
5. Apply `supabase/migrations/001_initial.sql`, then `002_shopify.sql` to a test Supabase project. The first migration preserves standalone accounts; the second adds server-only Shopify store storage, versioned kits, description history, usage counters and webhook receipts. Do not run the migrations against an unrelated database.
6. Register/release the app configuration with `shopify app deploy` after checking the linked app and URLs. This releases Shopify app configuration; it does not deploy the Next.js server or approve an App Store listing. Use the dashboard's development-store install/test flow, then complete the live matrix below.

Shopify's [app configuration reference](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration) describes the TOML fields. Confirm the configured API version remains supported before launching or updating the app.

| Variable                                                    | Purpose and exposure                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SHOPIFY_API_KEY`                                           | Shopify client ID. Server setting; the layout exposes this public identifier in the App Bridge meta tag.                                                                                   |
| `SHOPIFY_API_SECRET`                                        | Server-only app secret for token signatures, token exchange, webhook verification and frame permits.                                                                                       |
| `SHOPIFY_APP_URL`                                           | Stable HTTPS origin, with no credentials, path, query or fragment. Local HTTP is accepted only for non-production localhost development; Shopify installation still needs reachable HTTPS. |
| `SHOPIFY_API_VERSION`                                       | Optional override; default `2026-10`. Keep TOML webhooks and tested queries aligned.                                                                                                       |
| `SUPABASE_URL`                                              | Store database URL; falls back to `NEXT_PUBLIC_SUPABASE_URL`.                                                                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Server-only database role for Shopify endpoints. **Never use a `NEXT_PUBLIC_` prefix or send this value to the browser.**                                                                  |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional standalone email-account integration. The anonymous key does not authorize Shopify tables.                                                                                        |
| `SHOPIFY_HOSTED_AI_ENABLED`                                 | Hosted Gemini opt-in; only the exact value `true` enables it, with a server key and positive limits. Leave off for the free development beta.                                              |
| `SHOPIFY_AI_MONTHLY_LIMIT`                                  | Per-store monthly hosted-attempt cap; default 20 if enabled. Valid range 0–10,000; zero disables it.                                                                                       |
| `SHOPIFY_AI_GLOBAL_MONTHLY_LIMIT`                           | Deployment-wide monthly hosted-attempt cap; default 200 if enabled. Valid range 0–1,000,000; zero disables it.                                                                             |
| `GEMINI_API_KEY`, `GEMINI_MODEL`                            | Optional hosted provider key and enabled model. The model default is defined in `.env.example`; check availability in the operator's Google project.                                       |
| `STUDIOSHELF_SUPPORT_EMAIL`                                 | Real, monitored support address displayed on public help/privacy/support pages.                                                                                                            |

Store storage requires the service role even if standalone accounts are disabled. Shopify tables have row-level security enabled and no anonymous/authenticated grants; server queries derive the store key from verified Shopify identity. SQL functions are restricted to `service_role`. Never expose a general SQL/database endpoint to clients.

## Iframe protection and refresh

The global `SAMEORIGIN` frame header is removed. Proxy applies `frame-ancestors 'none'` to standalone pages. The Shopify workspace permits only the verified store's `https://…myshopify.com` origin and `https://admin.shopify.com`, following [Shopify's per-store CSP requirement](https://shopify.dev/docs/apps/build/security/app-server/set-up-iframe-protection).

A valid launch ID token or fresh Shopify-signed query establishes the frame's store. Proxy redirects once to the same route, preserves the host/context parameters, strips the launch token/signature, and adds a signed `frame_context` permit. This permits ordinary iframe reloads without third-party cookies. It expires after 12 hours; reopen the app from Shopify Admin to get a fresh launch after expiry. Changing its shop, audience, signature or lifetime invalidates it. **The frame permit controls framing only and is never accepted as API authentication.** Every data request still needs fresh staff identity and Shopify permission checks.

The workspace does not rely on localStorage, IndexedDB or cookies to authenticate or save Shopify kits. The optional interface-theme preference degrades gracefully when browser storage is blocked. Standalone browser saves remain a separate feature.

## Product import, saving and branding

The picker searches the connected store, imports product title, plain-text description, images, variants, price and store currency, and uses the selected variant's actual product URL when one is published. Unpublished products do not receive an invented storefront link. Sellers must confirm the product facts before generation; the app does not infer unknown materials, certifications, delivery terms or other claims from photography.

Every saved kit is linked to verified store/product/variant IDs and an imported fingerprint. Saves use revisions so one staff member cannot silently overwrite another's newer kit. Product-update webhooks flag affected kits; opening a kit compares current product details and currency again. Refreshing the brief preserves edited assets so the seller can regenerate only what changed. Template, BYOK and hosted operations can replace a single listing, caption, email or slide without replacing other edited content.

Store branding includes a raster logo, custom colours, voice and default call to action. Kits retain their own branding snapshot for consistent downloads. Only staff with the required active Shopify access can read or change shared store records; sharing does not depend on the browser or a separate StudioShelf account.

## Description approval and restoration

Description writes use the optional product-write permission. The server creates a short-lived, store-bound before/after preview. A seller must explicitly approve that preview before `productUpdate` is sent. New descriptions are escaped plain text converted into HTML; clients cannot submit arbitrary replacement HTML. Restoration uses exact historical HTML previously read from that store and creates a new preview for approval.

Before applying, the server rereads the current description, checks it against the preview, and atomically claims the preview. Concurrent retries cannot apply it twice. Ambiguous network outcomes are retained as `uncertain`; a subsequent check can reconcile a matching Shopify description, otherwise the seller must inspect Shopify and create a fresh preview. History is retained before the mutation so the previous description can be recovered.

**Concurrency limit:** Shopify's `productUpdate` description field has no compare-and-swap condition. An external edit can still occur between the last read and mutation. The app detects changes before that window and prevents duplicate preview execution, but cannot guarantee that it will never race an external Shopify editor. Test this behavior before rolling out writes, and instruct staff to avoid simultaneous description edits.

## Webhooks, uninstall and privacy

All configured topics post to `/api/shopify/webhooks`:

| Topic                                        | Handling                                                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customers/data_request`, `customers/redact` | Verify and acknowledge durably. Customer/order payload data is discarded before database processing because the app does not fetch or index those records.                                            |
| `shop/redact`                                | Delete the store and cascade its kits, history, branding and per-store usage.                                                                                                                         |
| `app/uninstalled`                            | Mark disconnected and remove kits, history and branding. Keep the non-personal monthly counter until shop redaction to prevent reinstall quota resets. No stored Shopify credential needs revocation. |
| `app/scopes_update`                          | Invalidate the recorded scope snapshot; every subsequent API request obtains current effective staff/install scopes.                                                                                  |
| `products/update`                            | Mark kits linked to the affected product for review.                                                                                                                                                  |

HMAC is verified over the raw request bytes before JSON processing. Invalid signatures return `401`; persistence failures return `503` so Shopify can retry. Durable event receipts and database changes happen in one transaction; a repeated valid event is acknowledged without repeating effects. Signed payload store IDs must match the stored domain. Receipts retain only non-identifying delivery metadata; global aggregate attempt totals remain after store redaction. Provider backups/logs follow the provider's retention settings.

After reinstall, fresh online authorization reconnects the store. Deleted content is not resurrected. The same month's remaining allowance is preserved. No customer/order scopes are requested; sellers should still avoid placing personal information in free-text briefs, and the operator must handle accidental personal-data requests through support. Shopify requires [all three compliance topics](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) even when an app collects no customer records.

## AI limits and free-beta pricing

The current pricing page offers a **$0 StudioShelf development beta**. There is no paid app plan, card collection or external app checkout. BYOK uses the seller's own Google quota and billing; that key stays in tab memory and is omitted from saved kits. Shopify workspace generation sends confirmed text facts to Google, not product photographs. Standalone studio generation can also send an explicitly supplied photo, as described in its UI/privacy policy.

Hosted generation is off by default. When enabled, SQL reserves one per-store and global monthly attempt before contacting Gemini, including requests that later fail. UTC-month counters, an output-token bound and positive integer limits constrain usage. Invalid limit settings fail closed. These are **attempt allowances, not a monetary spending cap**; the operator must configure Google-side quotas/budgets, check model pricing and monitor spend. The app does not buy extra quota or charge overages.

Before offering a paid public plan, implement Shopify-supported app pricing, approval, entitlement and billing lifecycle handling. The current release does not contain paid-plan enforcement. Shopify's current recommendation for new public apps is [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing).

## Public distribution and owner information

Prepare for **public distribution** if the goal is to serve unrelated merchants, initially at the free-beta price. Develop and test privately first. No distribution choice or App Store submission has been made by this code change. Shopify's [distribution guide](https://shopify.dev/docs/apps/launch/distribution) explains that public distribution needs approval, the choice cannot later be changed, and App Store registration has a fee. Confirm those terms and costs in the owner's account when ready; a free app does not mean every platform service is free.

Before public merchant onboarding, publish the operator's identity and monitored support contact, review `/privacy` for the actual providers and retention practices, and verify `/support`, `/help` and `/pricing`. Missing support configuration deliberately displays a development notice. Check production hosting/database/Gemini terms and resource limits for the intended commercial use. Follow the current [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) and complete Shopify's review; do not describe local tests or this template as approval.

## Required live development-store matrix — deferred

All rows below are **pending live verification**. Mocked tests support the implementation but cannot demonstrate actual Shopify installation, staff policy enforcement, deployed database isolation or App Store compliance. Use two development stores, separate staff roles and a non-production database. Record date, app/config version, deployment URL, tester, outcome and evidence for each row without including credentials or customer data.

| Scenario                             | Expected evidence                                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh installation in stores A and B | Managed permission prompt requests only `read_products`; app opens embedded and displays the correct verified store name/domain.                                                                                                         |
| Products and variants                | Search, pagination, a product with more than 100 variants, variant images/prices, empty catalogue and unpublished product all behave correctly. Imported currency and real variant URL match Shopify.                                    |
| Facts confirmation                   | Generation stays unavailable until reviewed facts are confirmed; incomplete facts are surfaced for the seller.                                                                                                                           |
| Templates, BYOK and hosted AI        | Correct provider choice; no key in saved data/log evidence; provider timeout/quota/invalid output preserves edited work and offers retry. Hosted mode remains unavailable when disabled.                                                 |
| Individual regeneration              | Regenerating each supported asset preserves every other asset, including edits made while the request was in flight.                                                                                                                     |
| Store saves across devices           | Staff in store A can reopen the same kit on a fresh device without browser-local persistence. Revision conflicts prevent silent concurrent overwrites.                                                                                   |
| Store isolation                      | A's authenticated request for B's kit/preview UUID is denied; B's product/variant IDs cannot be imported or saved through A. Try altered client store IDs and frame permits too.                                                         |
| Staff restrictions                   | A staff role without product access cannot read/generate/save; a read-only role cannot preview/apply/restore descriptions. Revoking access takes effect on the next protected request.                                                   |
| Refresh and storage restrictions     | Refresh inside Admin in both themes; block cookies/localStorage/IndexedDB. Store identity and server saves still work. After the frame permit expires, reopening from Admin gets a new launch.                                           |
| Token expiry and logout              | Expired/forged/wrong-audience tokens return `401`; the client fetches a new ID token once. Logged-out/revoked sessions do not expose cached server data or become anonymous access.                                                      |
| Iframe headers                       | Production HTML has exact per-store `frame-ancestors`; no `SAMEORIGIN` conflict. Arbitrary/forged shop context and standalone pages cannot be embedded.                                                                                  |
| Product staleness                    | Change title, description, price, images, variant or store currency; affected kits prompt review. Reimport preserves edited assets and allows deliberate selective regeneration.                                                         |
| Downloads                            | Export all five 1080 × 1350 images plus copy/editable data; verify selected image, branding, actual URL, ZIP integrity and lack of credentials.                                                                                          |
| Optional write access                | Decline and approve optional `write_products`; downloads keep working when declined, and current staff permission remains enforced after approval.                                                                                       |
| Description preview/approval         | Before/after text is accurate; approval is required; expired or changed previews are rejected; only the selected product changes.                                                                                                        |
| Description restore and retries      | Restore an applied version through a new approval; duplicate requests apply once. Simulate ambiguous save response, reconcile safely, and retain usable prior history. Test an external concurrent edit and document the remaining race. |
| Uninstall/reinstall                  | Uninstall clears kits/history/brand and access; reinstall requires current Shopify authorization, reconnects cleanly and does not reset the same month's hosted allowance.                                                               |
| Mandatory privacy signatures         | Real signed deliveries for each compliance topic succeed; missing/modified HMAC returns `401`; mismatched store binding is rejected. Customer/order PII is not persisted.                                                                |
| Webhook retries and persistence      | Repeat the same valid event; effects happen once. Simulated database failure returns `503`, and Shopify's later retry succeeds without lost events.                                                                                      |
| Shop redaction                       | Deliver `shop/redact` and verify all linked store records are removed, with only non-identifying receipts/global totals remaining. Verify the provider-backup retention policy separately.                                               |
| Hosted usage races                   | Simultaneous requests in both stores cannot exceed per-store or global caps. Zero/invalid settings disable hosted AI; failed provider calls consume the documented attempt.                                                              |
| Public information and review        | Operator identity, contact, privacy, support, onboarding and pricing match actual operation. Complete Shopify's live automated checks, review and approval before public launch.                                                         |
