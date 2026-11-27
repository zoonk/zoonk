# Core capabilities

- `@zoonk/core` is the shared Next.js-aware server and business package for Main, API, Admin, and the clients that reach those capabilities through the API.

## Capability boundaries

- If an app must coordinate multiple core calls to perform one coherent API-like operation, add a resource- or domain-capability leaf in core instead of duplicating that orchestration across apps. Do not create page-sized aggregate functions or expose one function per Prisma query.
- Public authenticated core functions call the shared `getSession()` capability themselves and own every permission check. Apps may pass untrusted resource IDs and validated input, but they must never pass a caller-selected acting `userId` to a public core capability.
- Internal core helpers may receive a user ID only after a public core boundary derives it from the authenticated session. Do not export those helpers as authorization boundaries. On GET paths, load each request-stable fact through its one canonical private leaf in `learner/facts/`, behind the public capability's authorization. Helpers receive already-loaded facts instead of IDs to re-read. Write and workflow preconditions keep fresh reads.
- Import core capabilities through direct package subpath leaf exports. Do not create a monolithic facade or root barrel that imports every feature; client-only, workflow-safe, and server-only leaves must remain separate so unused dependencies stay outside each consumer's module graph.
- A field's description says what the value means and when it's set. It never tells a client what to say, show or word ("say so", "say it with the change", "show a quiet notice"). A value a client receives is not a sentence it owes the learner: what a screen says is designed for that screen under [zoonk-design's Words](../../.agents/skills/zoonk-design/references/words.md). Web, iOS and Android match by making the same decisions and using the same words where words are shown. The API's `description-wording.test.ts` checks every description its public document publishes.

## Reads, caching, and invalidation

- How a read is cached (`"use cache"`, `"use cache: private"`), deduplicated within a request, kept fresh after a write and kept free of clocks and randomness: [caching and reads in core](../../.agents/guides/core-caching.md). Read it before adding or changing a read, a cache tag or a mutation's invalidation.
- A page render, a prefetch or a read endpoint makes no write a crawler, link preview or prefetch could trigger, such as saving a rebuilt plan or creating the day's session or a call because a page opened; the learner's POST makes those. Writes a request needs are fine on a GET (Better Auth's session refresh, rate limits, sign-in callbacks, the Stripe checkout return).

## Admission

- Work that costs (a model call, a download or parse, paid research) is admitted by a claim before it starts, inside the capability that does the work, so a new caller (another route, a correction, a guest, a background check) can't reach the work without it. A claim is a row under a unique key, or a count and an insert under the learner's lock in one short write ([`claimUsage`](src/entitlements/claim-usage.ts) and its siblings), never a transaction held open across the work. A cap counts its claims, not what the work saves afterward. A claim keyed by the request charges a retry once, but `claimUsage` still answers it as allowed: to run the work once, only the request whose insert won does it, and the others replay its saved result or follow its run.
- What decides a charge, a share, a replacement or "already done" lives in a column only core writes, never in a field clients send or edit (`details`, a reported length or count).
- What a client sends or can later edit (an id it picks, a goal's `details`, a file's own metadata) and text a model or a web page wrote are claims. A decision that spends, publishes, grants, cancels or limits reads facts the server wrote or measured, and acts only on what its check saw: the whole file, not its first pages or its title.

## Follow-ups and generation

- AI work (a model call or a workflow that generates) starts only from a POST by a signed-in learner or a guest: never from a GET, a render (`after()` during one included), metadata, an OG image, a sitemap or a page load without a click. The one exception is system work only the platform can start, such as the daily sweeps that Vercel Schedules runs in a function with no public URL.
- Generation runs only inside an API workflow step (`apps/api/src/workflows`) that calls the core function doing it, one model call per step (counting the calls inside that function): never inline in a request, in `after()` or in a promise nobody awaits. The exception is an interactive call, whose output the learner is waiting for in that request, such as grading an answer or an essay, scoring pronunciation, explaining a mistake, one speech clip, or the tutor's streamed answer with the plan change or memory notes shown with it. It may save its output for reuse (an explanation, a clip); anything else it leads to is written by a workflow or owed as a follow-up.
- Work a write owes (preparing a session or lessons, memory from a session, mistake causes, audio) is recorded where the write happens, in its transaction, with `oweFollowUps`, and an API workflow runs it. Apps never decide what to start after a write; that rule would drift between Main, the API and the native apps. `after()` keeps only analytics, refreshes without AI and an interactive stream's save.
- A write calls `oweFollowUps` in the branch that actually changes the row (the first time a session ends, not a repeat call that finds it ended), never returning a "start this next" result for apps. A workflow that makes the write starts its next run itself, from the step's result.
- Shared content has no learner to owe work to, so the work its write owes (a picture's check, an exam's freshness check) is a column on its row that the write sets and the work clears, such as `MediaAsset.checkOwedAt`. The daily sweep starts what's still owed, and every run doing that work holds the row's run token and claims an attempt first, so it never runs twice at once or keeps paying for a failure no retry fixes.
- A capability that needs content nobody has written returns what to write and its key instead of writing it, before it starts, charges or reserves anything, since the client sends the same request again once that content is written. The API turns that into a run (`202` with `generationId`) that the screen follows and can retry, and a workflow such as session preparation writes that content ahead so learners rarely wait.

## Retries

- Retries come from what we already run on: a Workflow step retries a thrown error 3 times, and an AI call gets the AI SDK's retries and the AI Gateway's fallback models. Put the work in a step and let it throw: a function that logs and returns when a model call fails ends the step as if the work were done.
- A failure no retry fixes (output that keeps failing its checks, input the model refuses) is recorded, so later runs and sweeps skip it instead of paying for it again.
- Don't add retry wrappers or loops, `maxRetries`, or `RetryableError`. A different policy needs a concrete failure those defaults miss, stated beside the code.

## Learner data

- Progress and stats reads never join content tables. They read learner-owned rows, such as daily totals and activity records, so every number survives content being deleted, merged, or regenerated.
- Learner rows never cascade from content. Reference content with `onDelete: SetNull`, or keep a plain id with a snapshot of what the learner saw, such as the title.

For Prisma query shapes, use the shared [Prisma guidance](../../.agents/guides/prisma.md). React leaves in this package also follow the shared [web guidance](../../.agents/guides/web.md).
