# StudioShelf repository workflow

The user owns the private GitHub repository https://github.com/Mustafamgbng/studioshelf.

For subsequent requested code changes, start a feature branch from `main`, commit and push the update, and open a pull request for review. Do not push changes directly to `main` or merge a pull request unless the user asks for that action. Preserve working features and the user's remembered light/dark choice. Keep credentials, local environment files, browser data, dependency folders and generated build output out of Git.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
