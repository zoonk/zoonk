# Core capabilities

- `@zoonk/core` is the shared Next.js-aware server and business package for Main, API, Admin, future Next.js apps, and clients that reach those capabilities through API. Do not add a framework-abstraction layer until another framework is actually adopted.

## Capability boundaries

- If an app must coordinate multiple core calls to perform one coherent API-like operation, add a resource- or domain-capability leaf in core instead of duplicating that orchestration across apps. Do not create page-sized aggregate functions or expose one function per Prisma query.
- Public authenticated core functions call the shared `getSession()` capability themselves and own every permission check. Apps may pass untrusted resource IDs and validated input, but they must never pass a caller-selected acting `userId` to a public core capability.
- Internal core helpers may receive a user ID only after a public core boundary derives it from the authenticated session. Do not export those helpers as authorization boundaries.
- Import core capabilities through direct package subpath leaf exports. Do not create a monolithic facade or root barrel that imports every feature; client-only, workflow-safe, and server-only leaves must remain separate so unused dependencies stay outside each consumer's module graph.

## Reads, caching, and invalidation

- Use `"use cache"` for reusable caller-independent reads and `"use cache: private"` for authenticated or request-dependent reads that need same-tree deduplication and runtime prefetching. Cache the complete exported read capability when instant navigation depends on its full result.
- Do not blanket-cache every Prisma read. Mutations, authorization preconditions whose freshness controls a write, generation polling, and durable workflow-step reads remain uncached unless their freshness and invalidation contract is explicitly designed.
- Do not convert session or persistence failures into `null` inside reusable core reads or Cache Component leaves. Reserve `null` for legitimate missing data, let infrastructure failures propagate for HTTP 5xx mapping, and place any intentional web-only graceful fallback in the owning app outside the `"use cache"` or `"use cache: private"` leaf.
- Use the default cache-life profile unless a product requirement explicitly establishes another freshness policy. You don't need to call `cacheLife("default")`. That's redundant.
- Normalize route values and other semantically equivalent inputs before calling a regular `"use cache"` leaf so encoded and decoded values share one canonical cache key.
- Core mutations own cache-tag invalidation and return only their domain resource or outcome. Use `revalidateCacheTags(tags)` from `src/cache/revalidate-cache-tags.ts`, never `revalidateTag` directly: it expires the tags with `{ expire: 0 }` from both Server Actions and Route Handlers. Each Next.js app has its own cache, so a shared `"use cache"` read must not keep a not-yet-written state that another app will write (read it again uncached, as `getPlayableLibraryLesson` does); written content relies on the default revalidation. Apps retain only route-specific `revalidatePath()` calls.

## Learner data

- Progress and stats reads never join content tables. They read learner-owned rows, such as daily totals and activity records, so every number survives content being deleted, merged, or regenerated.
- Learner rows never cascade from content. Reference content with `onDelete: SetNull`, or keep a plain id with a snapshot of what the learner saw, such as the title.

For Prisma query shapes, use the shared [Prisma guidance](../../.agents/guides/prisma.md). React leaves in this package also follow the shared [web guidance](../../.agents/guides/web.md).
