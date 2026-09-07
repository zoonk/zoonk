- Every reusable product capability exposed by Main must also be reachable through the public API so native apps, CLI tools, and agents can provide the same behavior. Audit new Main pages against the OpenAPI document; exclude only delivery-specific concerns such as URLs, redirects, metadata, prefetch presentation, and SEO.
- Do not add direct Prisma access to an app for a capability that belongs in another app, the public API, mobile, CLI, or an agent. Web-only indexing and SEO queries such as sitemaps may remain in a web app.

Use the shared [web UI and localization guidance](../../.agents/guides/web.md) for React composition, typed links, and translated copy. Reusable business behavior belongs in core capabilities governed by [packages/core/AGENTS.md](../../packages/core/AGENTS.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
