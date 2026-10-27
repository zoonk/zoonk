# Reviewing as a security researcher

Start from what the change opens: new input, a new entry point, new data shown or stored, new spend. For each, ask how someone who isn't the learner, or a learner acting in bad faith, would use it, and check the answer in the code or the running app. `pnpm verify:diff` lists the lines to start from; `pnpm verify:pages --email <learner> --intruder <another learner>` checks the pages themselves.

## Entry points

- Every Server Action export and route handler is a public endpoint anyone can POST to. Each one authenticates, authorizes through a core capability (the [core contract](../../../../packages/core/AGENTS.md): the acting learner comes from the session, never from the request), validates its input at the boundary, and returns only what that caller may see.
- Ownership: an id in a URL, form or body (a goal, session, lesson, essay, upload) is checked against the signed-in learner on every read and write (`packages/core/src/learner/_utils/owned-goal.ts` is the pattern). Core's real-database tests cover each capability as its owner, another learner and signed out; HTTP tests only cover the transport. `--intruder` loads the pages as another learner after the learner warmed them, and fails if they carry the learner's email, account id or full name.
- Better Auth's endpoints and defaults stay as they are (root `AGENTS.md`).

## Data exposure

- `"use cache"` without `private` shares its result across learners: nothing inside may depend on the session, cookies or headers unless they are arguments, and access is still checked on every delivery (a learner id in the key isn't authorization). Also sign out and in as someone else in one tab: nothing of the first learner may remain.
- Public render paths (metadata, OG images, sitemaps, prerendered pages, the signed-out shell) never read a learner's data. `verify:pages` opens every path signed out and fails if the learner's email, account id or full name arrives.
- Client bundles carry only `NEXT_PUBLIC_` values; logs, analytics events and error reports carry ids, not learner text or emails.

## Injection

- SQL through Prisma or tagged `$queryRaw` templates only; HTML from learners or models is never rendered as HTML.
- Learner text that reaches a prompt is data, not instructions: the prompt says so and the output is checked before it's saved or shown (prompt injection).
- Server requests to a URL anyone chose go through `isPublicUrl` and `publicLookup` (`packages/core/src/library/sources/_utils/public-url.ts`), so they can't reach private networks.
- Redirects go to this site's own paths only; blob and file keys never come from raw input.

## Abuse and cost

- Model calls start only from a learner's POST, inside their plan's limits and the guest budget (root `AGENTS.md`); a GET, a render, `after()` in a render, metadata or a prefetch never starts one. A browser can't see a model call made inside a server GET, so core and API tests with the no-spend provider doubles assert none on GET, prefetch or a refused request, and a bounded number on a retry. Input size, tool rounds, retries and fallbacks are bounded before anything is spent.
- Anything that spends, awards or charges is idempotent: a retry, a second tab or a race records it once (answers, Brain Power, test-outs, purchases).
- New endpoints that can be called in a loop have a rate limit or a budget.

## Secrets, configuration and dependencies

- `verify:diff` blocks credentials and env files in the diff; a new env var goes in the PR's migration guide.
- When the lockfile changes, `verify:diff` runs `pnpm audit --prod` and blocks an advisory the change adds; before a PR, `pnpm audit --audit-level high` covers dev and build tools too. A registry error means unverified, not clean. A new dependency must earn its place: needed, maintained, latest stable, no install scripts; `allowBuilds` and `overrides` in `pnpm-workspace.yaml` and GitHub Actions pinned to commit SHAs are part of the same review.
- The shared response headers live in `packages/core/src/security/headers.ts` (no CSP yet), and the API's origin checks for cookie-authenticated writes in `apps/api/src/proxy.ts`, covered by `apps/api/e2e/me.test.ts`. Header values and cookie flags (Secure, HttpOnly, SameSite) are checked on a deployed preview (`pnpm preview`, then `curl -sI <url>`), not on local http servers, whose defaults differ. Better Auth owns its own CSRF and cookie behavior.
- Verification output is an artifact too: `verify:pages` keeps no request headers or query strings in its report, and screenshots of a persona carry only seeded data.

## Where to run it

In Claude Code, `/security-review` reviews the branch in a fresh subagent; give it this checklist. Any other agent runs it as a separate reviewer that didn't write the change ([orchestration guide](../../../guides/orchestration.md)). Report findings with the entry point, the attacker's steps and the consequence, and keep unproven concerns apart from confirmed ones.
