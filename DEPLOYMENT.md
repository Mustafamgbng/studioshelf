# Deploy StudioShelf

## GitHub Pages project demonstration

The public interactive demo is [here](https://mustafamgbng.github.io/studioshelf-demo/). It is a static showcase with browser-local templates, editing, saving and downloads. It has no API server, Gemini, cloud accounts or connected Shopify stores. See [docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md) for the isolated build and update process. The Vercel/full-server instructions below apply to the complete application.

## Local demo first

Use Node 22.13+ and run the quick start in README. Template mode works without Gemini, Supabase or any cloud account. Use it to create a demonstration ZIP and verify the experience before provisioning services.

## Vercel

You can deploy the complete code now with Shopify settings unset. The standalone studio remains available; `/shopify` displays its unconfigured state. App registration, store access, database setup and live Shopify testing can be completed later as requested. The repository includes `vercel.json` for the Next.js preset. Deploy `feature/shopify-seller-app` for the current integration; `main` still contains the earlier baseline until a PR is approved and merged.

1. Put the project files in a private GitHub repository. Do not include `.env.local`, `node_modules`, `.next`, or customer project backups.
2. In Vercel, import the repository as a **Next.js** project. If importing a larger repository, select this application's directory as Root Directory.
3. Use Node 24 (or supported Node 22) and the default Next.js framework preset. Build command: `npm run build` or `pnpm build`. Leave Output Directory at the framework default.
4. For a template-only / BYOK demo, environment variables are optional. For cloud accounts, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and run the SQL migration first.
5. Only add `GEMINI_API_KEY` if you also configure Supabase. Anonymous calls cannot use the hosted key. Set `GEMINI_MODEL` to a model available to your project if the default is unavailable.
6. Deploy. Configure the deployed URL in Supabase Auth. Create a test account in your own project, verify email confirmation, save/reopen a cloud project, and test RLS with two separate accounts before wider use.

Vercel's [Hobby plan](https://vercel.com/docs/plans/hobby) is restricted to personal, non-commercial use. Do not promise free commercial hosting to a buyer. [Supabase's free plan](https://supabase.com/pricing) has quotas and inactive-project pausing. [Gemini free-tier limits and data handling](https://ai.google.dev/gemini-api/docs/pricing) also vary. Confirm current terms for the intended deployment.

## Data and secrets

- Keep the hosted Gemini key server-side; never prefix it with `NEXT_PUBLIC_`.
- The Supabase anon/publishable key is intentionally public. Database protection comes from RLS, not hiding that key.
- Shopify's store database requires `SUPABASE_SERVICE_ROLE_KEY` in Vercel's server-only environment. Never prefix it with `NEXT_PUBLIC_`, expose it to the browser or use it for the standalone browser client. Shopify tables are service-role-only; every server operation must first verify Shopify identity and staff permissions.
- BYOK Gemini keys are tab-only. A hosting operator can see server request data; do not claim a zero-knowledge key flow.
- Avoid request-body/header logging in hosting integrations. The app does not log credentials or provider error bodies.
- Do not add marketing analytics that capture inputs without an explicit privacy design.
- Deleting a cloud project is permanent; the UI asks before deletion. Keep exported backups if needed.

## Hosted AI allowance

The included SQL function enforces 10 attempts per authenticated user per UTC day. It has a fixed allowance; users cannot pass a higher limit. The quota is consumed before calling Gemini. RLS prevents direct client mutation of usage records. BYOK calls use the visitor's key and provider quota, with a best-effort per-instance burst limit of six requests per minute.

This is not a global budget cap. Before offering public hosted-key access, set provider-side project limits where supported and consider verified-account controls, signup abuse protection, aggregate budget controls and the host's firewall. These are deployment concerns, not evidence that a private demo needs a paid service.

## Shopify configuration after deployment

Keep the generated production HTTPS domain stable. Set `SHOPIFY_APP_URL` to its origin and register `/shopify` as the application URL in Shopify. Use the managed-install template in `shopify.app.toml`, replace registration placeholders and publish the app configuration with Shopify CLI. App deployment and Shopify configuration deployment are different operations. Privacy callbacks use `/api/shopify/webhooks` and must be reachable by Shopify without a Vercel sign-in page. Keep preview deployment protection enabled; use the intended public production origin for Shopify. Do not remove account-wide protection settings to fix a callback.

Apply both database migrations and set the server variables from `.env.example`. Run `npm run check:shopify` to check configuration without printing credentials, then complete the real-store test matrix in `docs/SHOPIFY.md`. This script is not evidence of installation, database isolation or review approval. Public distribution and any future paid plan require the operator's Shopify account setup and Shopify review; the code does not claim those steps are complete.

## Buyer transfer

Transfer the source and agreed brand/assets through a private repository or archive. The buyer creates their own Vercel / Supabase / Google projects and keys. Redeploy under those accounts. Do not transfer your API credentials or customer data as part of the source bundle. If transferring a deployed project instead, review each provider's supported transfer flow and billing responsibility first.
