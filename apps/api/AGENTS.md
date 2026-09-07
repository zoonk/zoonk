- Treat the public OpenAPI document as a product contract. Reuse runtime Zod boundary schemas in the document, give public operations stable `operationId` and security declarations, make compatibility an explicit product decision instead of adding aliases by default, and keep Better Auth's infrastructure routes out of the public product API.
- Add public API endpoints to `document.ts`. Unversioned same-origin UI transport routes stay out of the public OpenAPI document, but require an explicit architecture record, CSRF protection for cookie-authenticated mutations, and E2E coverage.
- Workflow files containing `"use workflow"` cannot call Node APIs directly; put those calls in `"use step"` functions. Prefer linear waves of independent work with `Promise.allSettled`. Installed workflow docs are in `apps/api/node_modules/workflow/docs/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
