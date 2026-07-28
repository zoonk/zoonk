# Zoonk Core

This package contains the shared Next.js-aware business capabilities used by the web apps, public API, mobile clients, CLI tools, and agents.

## What belongs in Core

- Business rules and orchestration that must behave consistently across delivery surfaces
- Prisma access for reusable product capabilities
- Authentication and authorization decisions at public capability boundaries
- Resource-oriented queries and commands that can back both direct server calls and HTTP endpoints
- Shared authentication, Cache Component, cache-tag, and Next.js server utilities

Public authenticated functions call the shared private-cached `getSession()` capability themselves. Apps may pass untrusted resource IDs and validated input, but they must not choose the acting user ID or duplicate core permission checks.

## What does not belong in Core

- HTTP parsing and serialization, UI composition, and other delivery-specific behavior
- App-specific routes, translations, metadata, Suspense boundaries, and presentation fallbacks
- Web-only indexing and SEO queries such as sitemaps
- Durable workflow runtime adapters that must call Node.js APIs from `"use step"` modules

## Guidelines

- Import capabilities from direct package subpath leaf exports so consumers include only what they use.
- Use `"use cache"` for reusable public reads and `"use cache: private"` for authenticated or request-dependent reads. Keep mutations, volatile reads, and write preconditions uncached.
- Keep Better Auth's cookie cache enabled. The shared `getSession()` private-cache boundary supplies same-tree deduplication without a custom context or React `cache()`.
- Keep authorization in the public core function and never accept an acting user ID from an app.
- Let infrastructure errors propagate from reusable reads; apps may add presentation-only graceful fallbacks outside cached leaves.
- Use the default cache-life profile and explicit cache tags for invalidation.
- Own cache-tag invalidation inside mutations and return only route-neutral resources or outcomes. Delivery adapters retain route-specific behavior such as `revalidatePath()`.
