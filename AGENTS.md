# Zoonk repository guidance

## Principles

- **KISS:** Choose the simplest complete solution that satisfies the product requirements. Avoid over-engineering, speculative infrastructure, and workarounds when an equivalent direct approach works.
- **Simplify instead of patching:** A bug, failing test, review finding, or roadblock invites a patch: a guard, retry, setting, fallback, second code path, or test harness. Each one feels necessary in the moment, and they pile up. Before adding one, find the root cause, check what the code and its dependencies already do, and ask what the simplest version of this part would be if you built it today; often the fix is to delete or reshape code, not to add to it. Add compatibility code only for data and clients that exist in production. When an approach changes, remove what the earlier attempt added. Before finishing, reread your diff and cut whatever you can't justify by a concrete failure it prevents. Comments explain why the current code exists, not its history.
- **DRY:** Keep a single source of truth for behavior that must stay consistent, including repeated UI patterns and runtime schemas used by documentation. Extract for real shared rules or known extensions; a small number of callers is not a reason to leave competing implementations.
- **SOLID:** Keep functions and modules focused, composable, and responsible for one concern. Use clear boundaries and dependencies; apply these principles without adding unnecessary class hierarchies, interfaces, or abstraction layers. Prefer functional composition and immutable transformations.
- Think from first principles. Preserve intended behavior, question assumptions and existing patterns, and choose maintainable designs without expanding the requested scope.
- When progress stalls (repeated review rounds, small optimizations that don't converge, growing machinery), stop and reframe; otherwise you keep optimizing the wrong thing. Question the problem itself: what does the user actually need, and what is the minimal work if you built it from scratch? Approach it from different angles like a polymath, borrowing proven principles from other fields and products: keep a running balance instead of re-summing the ledger, compute derived facts when their inputs change and only read them on views, load each fact once per request. Prefer removing work and machinery over optimizing it.
- Before declaring a capability unavailable, adding infrastructure, or implementing behavior a dependency might own, check installed versions and current official documentation. Research relevant newer models, products, and libraries when they could materially simplify the solution; prefer supported capabilities and composition over rebuilding them. Use [capability research](.agents/skills/zoonk-capability-research/SKILL.md) for these decisions.
- Before choosing, adding, or replacing a model, dependency, API, or version, check the provider's current catalog or registry for the latest option and its lifecycle (deprecation and shutdown dates on every route we call). Existing code, your training data, and a deprecation notice's suggested replacement may already be outdated.
- Write engineering work in US English: code, identifiers, comments, docs, commit messages, and examples in them. Use other languages only where the content is about that language or its learners: translation catalogs, language guides, test inputs and fixtures, eval cases, and AI prompt variants written for a language.
- Preserve unrelated formatting; `oxfmt` owns formatting. Do not hard-wrap Markdown prose.
- Make the best decision that will elevate all three: the user experience (UX), developer experience (DX), and agent experience (AX) always, without breaking anything.

## Scope and completion

- Own the user’s intended outcome through implementation and verification. Before declaring completion, reconcile the intended outcome, the resulting implementation, and the evidence collected. Close material gaps that can be investigated within the authorized task. Passing selected checks establishes only what those checks exercise. Carry earlier evidence forward only while subsequent changes leave it applicable.
- Keep changes within the requested scope. Refactor supporting code when needed for a complete solution, and remove code, tests, types, and layout left over from superseded requirements.
- Treat review comments and specs as hypotheses. Verify the actual path, product assumptions, and impact. In review/assessment work, fix confirmed bugs unless the user asks for findings only or the fix requires a meaningful product or architecture decision. Explain unsupported claims without changing code to satisfy them.
- Act as a product peer: when a requested approach or repository rule creates observed UX friction or unnecessary complexity, explain the conflict and propose a simpler way to achieve the user's goal. Make improvements within the authorized scope; surface decisions that would change explicit requirements.
- Read task-relevant files and documentation. Skills provide conditional guidance; an explicit user request takes precedence. If an instruction blocks authorized work, identify the file and rule and explain the concrete conflict.
- Report the outcome and verification in plain language, distinguishing observed behavior, static review, and passed checks. Base progress and completion claims on observed results, accounting for failures across the relevant run. Identify running, blocked, or unrun checks and material verification limits.
- Don't patch dependencies unless explicitly requested. When you find a bug in an upstream dependency, report it without waiting to be asked: build a minimal public reproduction and open the issue on the owner's behalf with [zoonk-upstream-issue](.agents/skills/zoonk-upstream-issue/SKILL.md) and [zoonk-post-on-behalf](.agents/skills/zoonk-post-on-behalf/SKILL.md). Meanwhile, figure out a workaround we can use.

## Agent orchestration

If this is a big task or it requires checking multiple areas (eg code, design, ux, accessibility, etc), delegate tasks to sub-agents especialized in those fields. For instructions, read _[Agent orchestration](.agents/guides/orchestration.md)_.

## Architecture shared by all workspaces

- Put reusable business rules, authorization, persistence, and orchestration in `@zoonk/core`. Apps own delivery: HTTP parsing/serialization, UI composition, translations, URLs, metadata, and presentation fallbacks. Do not add framework abstraction until another framework is adopted.
- Apps call authenticated core capabilities rather than supplying an acting user ID. Read the [core capability contract](packages/core/AGENTS.md) when adding or changing those capabilities or their callers.
- Reusable product behavior must be reachable through the public API. Main owns its [capability parity audit](apps/main/AGENTS.md); API owns the [public contract and transport rules](apps/api/AGENTS.md).
- AI work (a model call or a workflow that generates) starts only from a POST (a Server Action or an API POST) by a signed-in learner or a guest, never from a GET, a render (`after()` during one included), metadata, an OG image, a sitemap or a page load without a click. The one exception is system work behind a secret, such as the Vercel Cron's `GET /cron/daily-sweeps`.
- Page renders, prefetches and read endpoints don't make unnecessary writes that a crawler, link preview or prefetch could trigger, such as saving a rebuilt plan or creating the day's session or a call because a page opened; the learner's POST makes those. Writes a request needs are fine on a GET (Better Auth's session refresh, rate limits, sign-in callbacks, the Stripe checkout return). Never disable, re-route or wrap Better Auth endpoints or behavior for this rule.

## Verification

- When you finish work, before each commit, and before handing off, run the [verify skill](.agents/skills/verify/SKILL.md): it sizes the checks to the change, audits the diff (`pnpm verify:diff`), uses the change in the running app, measures its pages (`pnpm verify:pages` on the production build `pnpm start` serves), has it reviewed as a principal engineer, a security researcher and a designer would, and reports the evidence. The rules below decide what it must cover.
- Derive verification scope from the behavior and contracts being changed, including affected consumers and tests in unchanged files. Use focused checks when that scope is demonstrably bounded. When the impact is broad or uncertain, run the relevant containing suites. For behavior changes, prefer a failing regression test before implementation when practical, at the cheapest layer that reproduces the bug; an E2E test only when the bug clears zoonk-testing's E2E bar. For documentation, copy, styling, or other low-impact edits, use relevant validation without adding tests that mirror the edit.
- Use [zoonk-testing](.agents/skills/zoonk-testing/SKILL.md) when writing or changing tests: E2E only for the high-risk journeys and seams its E2E bar allows, Vitest browser tests in `packages/player` for lesson player behavior, real-database integration tests for persistence and business logic, and unit tests for non-trivial pure helpers. Do not write React component unit tests. Do not add tests for `admin`, `evals`, or `blog`.
- For user-facing changes, use [zoonk-persona-walkthrough](.agents/skills/zoonk-persona-walkthrough/SKILL.md) to use the running product as contrasting learner personas, from entry to outcome and return visits, including their bad days, with eyes that haven't seen the implementation where possible. Judge clarity, effort, honesty, recovery, and unnecessary UI; passing automated happy paths is insufficient. Fix observed issues, add regression coverage for reproducible problems where zoonk-testing's bar says a test is worth it, and report the evidence.
- Run relevant local checks and fix failures caused by the requested change without pausing for review after each step. Investigate failures, including intermittent ones; do not rerun until green and dismiss them. Fix failures in the affected scope, and report unrelated failures with evidence instead of silently expanding the task.
- During implementation, once the affected scope has been verified, broaden or repeat checks only for new changes, failures, unresolved risks, or an explicit request. For timing, concurrency, or fixture-isolation changes, repeat the focused affected coverage to establish stability.
- Before each commit, run the change's relevant checks: typecheck, lint and format of the touched files, and affected tests, where applicable. Report the checks and results. Commits do not require the full PR verification gate.

### PR verification gate

- Before opening a PR (including a draft), marking a PR ready for review, or merging a PR, run locally the full set of quality checks from both the PR and `main` CI pipelines, including checks that only run after merge. It applies to every change type; focused checks during implementation do not replace it.
- Read the current [.github/workflows](.github/workflows), including reusable workflows, as the source of truth for commands, setup, matrices, and platform-specific path conditions. Cover formatting, lint, type checks, both Knip modes, translations, generated API contracts, deployment orchestration tests, all Vitest suites (unit, database integration, and player browser tests), and the full Main and API E2E suites (`pnpm e2e`, which builds and migrates what it tests). Cover every configured test project and shard; an unsharded run is sufficient when it exercises the same full suite. Include applicable native CI checks. Use the [development guide](.agents/guides/development.md) for local environment and browser execution requirements.
- Verify the final tree before opening a PR, marking it ready for review, or merging it. If it changes after verification, rerun the full gate. Fix failures in the affected scope and report unrelated failures or missing prerequisites with evidence; do not open a PR, mark it ready, or merge it while required checks are failing, blocked, or unrun. Report the checks and results with the handoff.

## Task-specific guidance

Read the scoped `AGENTS.md` files governing paths you change, including when working from the repository root. Read shared guides only when the task matches their scope; this index is not a required reading list for every edit.

Use the shared [Eloqnt style guides](packages/i18n/.eloqnt/styleguide.md) for recurring Zoonk tone and terminology choices; put locale-specific choices in `styleguide.<locale>.md`. Keep them brief and self-contained: Eloqnt supplies translation best practices, so avoid generic i18n rules and one-off copy fixes. For example, `goal → meta` belongs in the Portuguese glossary; lists of ordinary UI translations like “Save”, “Cancel”, and “Next”, or tutorials on ICU plurals, do not.

| Task                                                            | Guidance                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| TypeScript or JavaScript                                        | [Code conventions](.agents/guides/typescript.md)                                   |
| React/Next.js UI or web translations, including shared packages | [Web UI and localization](.agents/guides/web.md)                                   |
| Prisma queries in any workspace                                 | [Prisma query conventions](.agents/guides/prisma.md)                               |
| Prisma schema, migrations, or generated client                  | [Database package](packages/db/AGENTS.md)                                          |
| Core authorization, reads, caching, or mutations                | [Core package](packages/core/AGENTS.md)                                            |
| Main product capabilities                                       | [Main app](apps/main/AGENTS.md)                                                    |
| API routes, OpenAPI, or durable workflows                       | [API app](apps/api/AGENTS.md)                                                      |
| Admin data access                                               | [Admin app](apps/admin/AGENTS.md)                                                  |
| Apple app                                                       | [Apple app](apps/apple/AGENTS.md)                                                  |
| Android UI                                                      | [Android Material guidelines](.agents/skills/android-material-guidelines/SKILL.md) |
| AI task prompts                                                 | [AI package](packages/ai/AGENTS.md)                                                |
| Adding a supported language                                     | [Adding a language](.agents/guides/adding-a-language.md)                           |
| Local services, sign-in, or validation commands                 | [Development guide](.agents/guides/development.md)                                 |

## Maintaining these instructions

Keep repository rules focused on project constraints and non-obvious decisions. Put task-specific procedures in the relevant skill and load supporting references only as needed.

Keep `.agents/skills` as the source of truth. When adding, renaming, or removing a skill, update its relative symlink in `.claude/skills` and verify every canonical skill resolves there to the same directory.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
