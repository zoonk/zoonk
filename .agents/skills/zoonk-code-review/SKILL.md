---
name: zoonk-code-review
description: Review Zoonk code changes for correctness, product intent, simplicity, architecture, security, performance, and user experience. Use for staged or unstaged diffs, branches, commits, pull requests, proposed implementations, and follow-up reviews in the Zoonk repository.
---

# Zoonk Code Review

## Review Standard

Review like an owner of the system, not a style checker. Protect correctness, user data, permissions, product intent, maintainability, performance, accessibility, and the repository's long-term architecture.

Prioritize judgments CI cannot make: does this solve the right problem, does the design make sense, are its assumptions sound, and what consequences does it have for users and the wider system? Linting, typechecking, and tests already run in CI. Use checks to support the investigation, not as the focus or completion criterion of the review.

Prefer the cleanest complete solution. Reject both needless abstraction and short-term duplication that creates competing sources of truth. Apply DRY, SOLID, and KISS from first principles rather than accepting a pattern because it already exists nearby.

Treat every review claim, including your own, as a hypothesis. Ask what must be true for it to happen, verify those assumptions against the actual code and product, and look for evidence that would disprove it. A reviewer's confidence is not evidence. If the issue is real, recommend the simplest correct fix; if it is not, explain why without changing code to satisfy the comment. Distinguish plausible risk from merely imaginable edge cases, considering both likelihood and impact.

## Establish the Review Scope

1. Read the live [repository instructions](../../../AGENTS.md) and any more specific `AGENTS.md` files that govern changed paths.
2. Determine the requested comparison: staged changes, unstaged changes, working tree, commit, branch, or pull request. When the user asks to review staged files, treat the index as the review ledger and do not mix in unrelated unstaged work.
3. Enumerate every changed file before reviewing details. Inspect the complete diff, not only the most obvious implementation files. Organize the review around changed behavior and its callers, not isolated lines.
4. Read enough surrounding code, callers, schemas, tests, configuration, and product contracts to understand the actual behavior. Search for other implementations of the same pattern before deciding whether code should be shared.
5. For Next.js changes, read the relevant current documentation under `apps/{app}/node_modules/next/dist/docs/` before judging framework behavior.
6. Keep review-only work read-only. Do not edit files unless the user also asks to address findings.

## Classify Evidence Before Reporting

Classify every suspected issue internally:

- **Real bug:** The affected code path and harmful outcome are confirmed by the diff and repository behavior.
- **Behavior-dependent:** The outcome depends on a product rule, environment, deployment state, or caller contract that is not yet established. State the missing condition instead of presenting the issue as certain.
- **Non-bug:** The concern is theoretical, unreachable, intentional, or merely a personal preference. Do not report it as a finding.

Use severity to describe impact, not confidence:

- **P0:** Immediate catastrophic impact such as broad data loss, critical compromise, or total outage.
- **P1:** High-impact correctness, security, permission, privacy, or availability failure.
- **P2:** Confirmed functional, architectural, performance, accessibility, or coverage defect that should be fixed.
- **P3:** Small but real defect with narrow impact. Do not use this label to dismiss a confirmed bug.

Do not inflate severity, invent failure modes, or report generic best-practice violations without a concrete consequence in this repository.

## Review Workflow

### 1. Verify Correctness and Product Behavior

- Trace inputs through validation, normalization, persistence, side effects, caching, rendering, and output.
- Check happy paths, empty states, errors, redirects, retries, cancellation, duplicate submissions, concurrent first hits, partial failures, and stale state.
- Review how the parts interact, not just whether each part looks correct. Identify the assumptions they make about each other and whether real inputs or event ordering can violate them.
- Confirm state-changing operations use appropriate HTTP and workflow boundaries and cannot be triggered unexpectedly by crawlers, prefetching, retries, or replay.
- Look for read-then-write races, missing uniqueness handling, non-idempotent retries, transaction gaps, lost updates, and assumptions that fail under concurrency.
- Verify compatibility changes with the simplest equivalent shape before accepting adapters, aliases, re-exports, or fallback layers.
- Preserve the intended product contract. If a concern depends on identity, canonicalization, routing, or generation rules, read those contracts before calling it a bug.

### 2. Review Simplicity and Architecture

- Ask what problem the added code solves, whether that problem needs solving, and whether the existing design can solve it more simply. Weigh the value of a change against its complexity, maintenance, and runtime costs. Apply the same scrutiny to your own code; do not defend an approach merely because it is already implemented.
- Look for duplicated logic, markup, class names, schemas, types, constants, prompts, or documentation that should have one source of truth.
- Look for code, tests, and dependencies that no longer serve the current requirements.
- Prefer small named functions, linear pipelines, early returns, immutable transformations, meaningful names, and one responsibility per file.
- Flag nested business logic in `map`, `filter`, `flatMap`, or `reduce`; nested conditionals; value computation through `let` and reassignment; and large files that mix parsing, validation, persistence, and orchestration. Prefer functional composition, immutability, early returns, and small helpers that can be unit tested.
- Check that functions with multiple domain parameters use one named object parameter, except framework callbacks and functions wrapped in React `cache`, where stable primitive positional arguments preserve memoization.
- Reject unnecessary aliases, compatibility re-exports after moves, boolean-prop proliferation, premature providers, and abstractions that make a single path harder to understand.
- Also reject "only used twice" reasoning when repeated UI or domain behavior needs to stay synchronized. Prefer a reusable primitive or helper when it creates a real single source of truth.
- When a function needs a rationale, require a meaningful `/** ... */` comment explaining **why**, not its implementation. Do not demand comments for self-explanatory functions.
- Separate semantic changes from formatting churn and flag unrelated formatting-only diffs.

### 3. Review Security, Permissions, and Privacy

- Treat Server Actions, route handlers, workflow entry points, webhooks, and state-changing pages as public endpoints. Authenticate and authorize at the server boundary even when the UI hides access.
- Verify authorization checks the requested resource, action, ownership, organization, tenant, role, and publication state. Look for IDOR/BOLA paths where a valid user can access another user's data by changing an identifier.
- Keep permission checks beside protected data reads and writes. Do not rely only on layouts, middleware, client checks, or navigation visibility.
- In `apps/admin`, require admin data functions to use `cacheAdminData` so independently streamed route segments enforce `requireAdminRouteAccess` beside each query.
- Check cache keys and scopes for cross-user or cross-tenant data leaks. Never place private data in a shared cross-request cache without all authorization dimensions in the key.
- Validate untrusted input at boundaries and review for SQL or command injection, XSS, unsafe HTML, CSRF, SSRF, path traversal, open redirects, insecure file uploads, prototype pollution, and unsafe URL handling when relevant.
- Check secrets, tokens, personal data, prompts, and internal errors are not exposed through logs, analytics, client bundles, URLs, or responses.
- Verify webhook signatures, rate limits, bot protection, replay handling, and idempotency where abuse or duplicate execution is plausible.
- Inspect dependency changes for unnecessary packages, vulnerable versions, install scripts, bundle cost, and whether the platform already provides the capability.

### 4. Review Performance and Concurrency

- Identify independent async work and ensure it starts together with `Promise.all`, `Promise.allSettled`, Suspense, or another appropriate parallel structure. Treat newly serialized independent reads as a regression.
- Preserve existing parallelism. Do not move one branch out of `Promise.all` merely because another branch does not use its result.
- Look for N+1 queries, queries inside loops, repeated parsing or model calls, unbounded lists, missing pagination, oversized client payloads, and unnecessary rerenders.
- Use React `cache` for server-side per-request deduplication of database and other non-`fetch` data functions that may be called more than once in a render tree.
- Review React `cache` arguments carefully: inline object arguments defeat shallow-identity memoization. Prefer an object-parameter public wrapper over an internal cached function with stable primitive arguments.
- Remember that React `cache` is per request. Do not mistake it for durable cross-request caching or use it as an authorization substitute.
- For admin data functions, use `cacheAdminData` instead of raw React `cache`.
- Check database filtering, ordering, uniqueness, indexes, pagination, aggregation, and transaction boundaries against expected data volume.
- Follow repository Prisma conventions: return full small models by default, use `omit` for unused large columns, use `include` for relations, and avoid manual types that mirror generated Prisma shapes.
- Minimize server-to-client serialization and client bundle growth. Keep server-only code, secrets, large dependencies, and data processing outside client components.

### 5. Review React and Next.js

Read [Vercel React best practices](../vercel-react-best-practices/SKILL.md) and [next-dev-loop](../next-dev-loop/SKILL.md) for React or Next.js changes. Read [Next.js Cache Components Optimizer](../next-cache-components-optimizer/SKILL.md) when the diff uses Cache Components, `use cache`, cache tags, or partial prerendering.

- Prefer Server Components and server data fetching. Require a concrete browser-only need for every `"use client"`, `useState`, and `useEffect` boundary.
- For every `useEffect`, first ask whether rendering, derived values, an event handler, `useSyncExternalStore`, a key, or server data can express the behavior. If the effect is necessary, verify dependencies, cleanup, race handling, Strict Mode behavior, stale closures, and whether `useEffectEvent` is appropriate. Also read React's [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
- Check Server Component boundaries for serializable props, accidental client propagation, request waterfalls, and duplicated data reads.
- Require Suspense loading states to use `Skeleton` from `@zoonk/ui/components/skeleton`, with the skeleton colocated in the same file as the component it represents.
- Confirm awaited operations use `safeAsync` where repository conventions require explicit error handling.
- Check route handlers, Server Actions, metadata, redirects, error boundaries, images, fonts, and runtime selection against the installed Next.js docs.
- Preserve typed-route safety. Use literals or `as const` for dynamic hrefs and never cast values to `Route` to silence the type system.
- Avoid dynamic `await import()` unless loading at runtime is genuinely required.

### 6. Review Components, Tailwind, Design, and Accessibility

Read [Zoonk compound components](../zoonk-compound-components/SKILL.md) and [Vercel composition patterns](../vercel-composition-patterns/SKILL.md) for component architecture. Read [Zoonk design](../zoonk-design/SKILL.md) for visible or interaction changes.

- Prefer existing `@zoonk/ui` components. If no suitable component exists, check the shadcn registry before approving a custom primitive.
- Require compound components for reusable UI. Look for duplicated wrappers, style props, boolean variants, domain-specific primitives, or repeated markup that should become flat, composable subcomponents.
- Use Tailwind utilities instead of new CSS modules for component styling. Prefer semantic design tokens and existing variants over hardcoded hex, RGB, arbitrary color values, or duplicated class strings.
- Check responsive behavior, overflow, touch targets, keyboard navigation, focus visibility, semantic HTML, labels, contrast, dark mode, reduced motion, loading, empty, disabled, and error states.
- Keep interfaces clean, minimal, calm, and consistent with Apple, Linear, and Vercel inspiration. Flag clutter, unnecessary cards, heavy borders or shadows, weak hierarchy, confusing action priority, excessive motion, and controls that do not clearly communicate their effect.
- Use outline buttons for most actions and links, default buttons for selected or submit actions, and secondary buttons for deliberate emphasis unless the product context requires otherwise.
- For Apple-platform changes, read [Apple Human Interface Guidelines](../apple-human-interface-guidelines/SKILL.md). For Android changes, read [Android Material Guidelines](../android-material-guidelines/SKILL.md).
- Judge the changed experience in the actual application. Technically correct components do not necessarily compose into a clear, usable flow. If runtime verification is unavailable, distinguish what the code suggests from what you observed.

### 7. Review Data, APIs, and Workflows

- Verify data functions enforce publication, ownership, organization, locale, and other visibility rules at the query boundary.
- Check Prisma queries follow the repository's `include`, `omit`, and generated-type conventions and do not add maintenance-heavy `select` clauses without a real reason.
- Require schema migrations to be generated through the repository command, never handwritten. Check corresponding Prisma client generation and database test setup when schemas change.
- For workflow files containing `"use workflow"`, ensure Node APIs run only inside `"use step"` functions.
- Prefer linear wave-based workflow orchestration with `Promise.allSettled` when operations are independent. Check retry safety, failure aggregation, resumability, and deterministic step inputs.
- Require new endpoints to be documented in `document.ts` and review their authentication, validation, status codes, error shape, idempotency, and observability.

### 8. Review Test Coverage

Read [Zoonk testing](../zoonk-testing/SKILL.md) whenever the change adds behavior, fixes a bug, or changes tests.

- Read test assertions to understand what they prove and what they miss. Judge whether they protect intended behavior, not whether they reproduce the implementation. Passing tests do not establish that the requirements or design are correct.
- Require end-to-end tests for user-visible flows and browser behavior. Do not request React Testing Library unit tests for components.
- Require Prisma integration tests for data functions, permissions, business logic, transactions, races, and workflows.
- Require unit tests for non-trivial pure helpers such as validation, normalization, transformations, and regular expressions.
- Do not request tests for `admin`, `evals`, or `blog`; these internal apps are excluded. Still review their runtime correctness, permissions, and quality checks.
- Do not request tests that merely assert CSS, copy, prompt wording, Zod schemas, static configuration, snapshots, or library behavior.
- Check E2E tests create unique data with `*Fixture()` helpers, parallelize independent fixtures, avoid seed mutations, and use semantic queries such as `getByRole`, `getByLabel`, `getByText`, and `getByPlaceholder`.
- Reject `data-testid`, `data-slot`, CSS selectors, and direct `.locator()` selectors in E2E tests. If semantic queries are difficult, improve component accessibility.
- Confirm a regression test failed for the right reason before the fix when TDD evidence is available.
- Treat any flaky run as a broken test. Do not dismiss failures as intermittent or pre-existing, and run relevant E2E coverage repeatedly before declaring it stable.

### 9. Review i18n and Copy

- Require `getExtracted` on the server and `useExtracted` on the client with string literals. Do not allow translation keys, variables, deferred translation calls, or passing translation functions through props or helpers.
- Require ICU plural messages instead of code branches for singular and plural copy.
- Check `ClientLink` is used when a Base UI `render` prop requires a client component.
- Never recommend manual PO edits. Source strings must be extracted by the relevant build and translated with `pnpm i18n`.
- Review UI copy against `packages/i18n/.eloqnt/styleguide.md`: use plain, direct, concrete language; avoid jargon, internal taxonomy, ambiguity, and unnecessary words.
- Read [copywriting](../copywriting/SKILL.md) for new persuasive or marketing copy and [copy editing](../copy-editing/SKILL.md) for revisions to existing copy. For marketing copy (eg pricing pages, landing pages, etc), also read [marketing psychology](../marketing-psychology/SKILL.md).

### 10. Use Automated Checks as Supporting Evidence

- Consult existing CI results for the reviewed revision when available. Run local checks when they answer a concrete review question, reproduce a suspected defect, or cover a gap in CI. Do not spend the review repeating the automated pipeline by default.
- Prefer check-only variants during a review when a fix command would modify files. If the repository exposes only a fix command, report that it was not run rather than mutating the review scope without permission.
- Distinguish clearly between passing, failing, not run, unavailable, and blocked checks. Include exact failing commands and the relevant failure, not an unsupported summary.

## Common Review Misses

- Reviewing only changed lines while missing a broken caller, permission boundary, schema constraint, route entry point, cache scope, or generated artifact.
- Not flagging over-engineered code that could be simplified.
- Not checking leftovers from previous implementations.
- Not checking the actual UI and UX for correctness, accessibility, and design.
- Assuming an existing pattern is correct without checking whether it violates current repository standards.
- Suggesting a local patch when the invariant belongs in a shared data, component, validation, or workflow boundary.
- Removing independent work from `Promise.all` and accidentally introducing a waterfall.
- Adding object parameters directly to a React-cached function and silently defeating deduplication.
- Checking admin access only in a layout while streamed data functions remain callable without `cacheAdminData`.
- Treating hidden UI as authorization or treating TypeScript types as runtime validation.
- Adding a client component or effect to solve behavior that the server, render phase, URL, or event handler already expresses.
- Testing implementation details instead of observable behavior or adding component unit tests where E2E coverage is required.
- Copying a bad pattern, adding a re-export after a move, or keeping duplicated sources of truth for short-term convenience.
- Calling a concern a security or performance issue without tracing a reachable exploit or measurable cost.
- Trusting a ticket or review comment over the actual product contract.
- Reporting that all checks pass when some checks were not run.

## Review Output

Lead with findings ordered by severity. For every finding include:

1. A concise severity-tagged title.
2. A tight file and line reference.
3. The concrete execution path or condition that makes the issue real.
4. The user, security, data, performance, accessibility, or maintenance impact.
5. The simplest correct direction for a fix when it is not obvious.
6. The missing or inadequate test when coverage should catch the regression.

Keep findings independent and actionable. Do not bury confirmed bugs inside a broad architecture essay. Do not include praise, summaries of the diff, or speculative suggestions in the findings list.

When assessing supplied review comments, briefly explain which claims are unsupported or incorrect and why. Do not present them as findings or implement them just to satisfy the reviewer.

After findings, briefly state:

- **Coverage:** Which changed behaviors were traced and exercised, which were reviewed only statically, and which remain unverified. Do not imply exhaustive coverage from a green suite.
- **Verification:** Which checks passed, failed, were not run, or were unavailable.
- **Residual risks:** Only behavior-dependent concerns or areas that could not be verified.

If there are no findings, say so directly and still report coverage, verification, and residual risks. Never imply that no findings means the code is proven correct.
