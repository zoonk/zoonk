- Treat the public OpenAPI document as a product contract. Reuse runtime Zod boundary schemas in the document, give public operations stable `operationId` and security declarations, make compatibility an explicit product decision instead of adding aliases by default, and keep Better Auth's infrastructure routes out of the public product API.
- Add public API endpoints to `src/lib/openapi/document.ts`.
- `src/app` and `src/lib` only deliver: the rules a route needs, interactive model calls included, live in core, and the route returns or streams the result.
- A run that writes missing content claims the content's key with `claimRunToken`, so a second request follows the run already writing it.
- Apps open the auth pages (`src/app/auth/[locale]`) in a new document, so the CDN serves them, prerendered per locale, before any function runs (`ensureStatic = "shell"`). What depends on the request streams in Suspense holes; a decision that must come before the page (a browser that's already signed in, a visit that names no locale) is a `next.config.ts` rewrite to `/auth/open`. next-intl reads the locale from root params, so route handlers and Server Actions pass one (`getBrowserLocale`).
- Workflow files containing `"use workflow"` cannot call Node APIs directly; put those calls in `"use step"` functions. Prefer linear waves of independent work with `Promise.allSettled`. Installed workflow docs are in `apps/api/node_modules/workflow/docs/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
