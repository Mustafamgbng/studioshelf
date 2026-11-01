# Deploy StudioShelf

## Local demo first

Use Node 22.13+ and run the quick start in README. Template mode works without Gemini, Supabase or any cloud account. Use it to create a demonstration ZIP and verify the experience before provisioning services.

## Vercel

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
- Never add a Supabase service-role key to this app.
- BYOK Gemini keys are tab-only. A hosting operator can see server request data; do not claim a zero-knowledge key flow.
- Avoid request-body/header logging in hosting integrations. The app does not log credentials or provider error bodies.
- Do not add marketing analytics that capture inputs without an explicit privacy design.
- Deleting a cloud project is permanent; the UI asks before deletion. Keep exported backups if needed.

## Hosted AI allowance

The included SQL function enforces 10 attempts per authenticated user per UTC day. It has a fixed allowance; users cannot pass a higher limit. The quota is consumed before calling Gemini. RLS prevents direct client mutation of usage records. BYOK calls use the visitor's key and provider quota, with a best-effort per-instance burst limit of six requests per minute.

This is not a global budget cap. Before offering public hosted-key access, set provider-side project limits where supported and consider verified-account controls, signup abuse protection, aggregate budget controls and the host's firewall. These are deployment concerns, not evidence that a private demo needs a paid service.

## Buyer transfer

Transfer the source and agreed brand/assets through a private repository or archive. The buyer creates their own Vercel / Supabase / Google projects and keys. Redeploy under those accounts. Do not transfer your API credentials or customer data as part of the source bundle. If transferring a deployed project instead, review each provider's supported transfer flow and billing responsibility first.
