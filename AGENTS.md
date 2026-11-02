# Zoonk repository guidance

## Principles

- **KISS:** Choose the simplest complete solution that satisfies the product requirements. Avoid over-engineering, speculative infrastructure, and workarounds when an equivalent direct approach works.
- **Simplify instead of patching:** A bug, failing test, review finding, or roadblock invites a patch: a guard, retry, setting, fallback, second code path, or test harness. Each one feels necessary in the moment, and they pile up. Before adding one, find the root cause, check what the code and its dependencies already do, and ask what the simplest version of this part would be if you built it today; often the fix is to delete or reshape code, not to add to it. Add compatibility code only for data and clients that exist in production. When an approach changes, remove what the earlier attempt added. Before finishing, reread your diff and cut whatever you can't justify by a concrete failure it prevents.
- **DRY:** Keep a single source of truth for behavior that must stay consistent, including repeated UI patterns and runtime schemas used by documentation. Extract for real shared rules or known extensions; a small number of callers is not a reason to leave competing implementations.
- **SOLID:** Keep functions and modules focused, composable, and responsible for one concern. Use clear boundaries and dependencies; apply these principles without adding unnecessary class hierarchies, interfaces, or abstraction layers. Prefer functional composition and immutable transformations.
- **Comments:** The default is none. Keep a comment only when it says what the code can't: a constraint from something we can't change, a product rule the code would look wrong without, a contract callers rely on, or a tool directive. Otherwise change the code until it says it. The [comments guide](.agents/guides/comments.md) has the full bar.
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
- Don't patch dependencies unless explicitly requested. When you find a bug in a dependency, work around it and report it upstream with a minimal public reproduction ([zoonk-upstream-issue](.agents/skills/zoonk-upstream-issue/SKILL.md)) once the user approves posting from their account; a standing approval in their own instructions counts.

## Agent orchestration

Delegate a big task, or one that spans several areas (code, design, UX, accessibility), to subagents specialized in each, following the [orchestration guide](.agents/guides/orchestration.md). It also covers several agents sharing one machine. If you work in a worktree made for your task, commit, stop its servers and remove it before you hand back ([details](.agents/guides/orchestration.md#sharing-one-machine)).

## Architecture shared by all workspaces

- Put reusable business rules, authorization, persistence, and orchestration in `@zoonk/core`. Apps own delivery: HTTP parsing/serialization, UI composition, translations, URLs, metadata, and presentation fallbacks. Do not add framework abstraction until another framework is adopted.
- Apps call authenticated core capabilities rather than supplying an acting user ID. Read the [core capability contract](packages/core/AGENTS.md) when adding or changing those capabilities or their callers.
- Reusable product behavior must be reachable through the public API. Main owns its [capability parity audit](apps/main/AGENTS.md); API owns the [public contract and transport rules](apps/api/AGENTS.md).
- Main, Apple and Android are one product. When a change alters what a learner sees or does in Main (a feature, a fix, copy, a contract), check whether the Apple and Android apps need the same change, and make it there in the same task, following [Apple](apps/apple/AGENTS.md) and [Android](apps/android/AGENTS.md). Behavior that core or the API already decides for every client needs only the contract and each app's test fixtures, not native tests that restate it. If you can't make a platform's change, name it in your handoff.
- AI work (a model call or a workflow that generates) starts only from a POST (a Server Action or an API POST) by a signed-in learner or a guest, never from a GET, a render (`after()` during one included), metadata, an OG image, a sitemap or a page load without a click. The one exception is system work behind a secret, such as the Vercel Cron's `GET /cron/daily-sweeps`.
- Generation runs only inside an API workflow step (`apps/api/src/workflows`) that calls the core function doing it, one model call per step (counting the calls inside that function), so it outlives the request and a failure retries only the call that failed; never inline in a request, in `after()` or in a promise nobody awaits. The exception is an interactive call, whose output the learner is waiting for in that request, such as grading an answer or an essay, scoring pronunciation, explaining a mistake, one speech clip, or the tutor's streamed answer with the plan change or memory notes shown with it. It may save its output for reuse (an explanation, a clip); anything else it leads to is written by a workflow or owed as a follow-up. A request that needs content nobody has written answers with a run (`202` with `generationId`) that the screen follows and can retry, and a workflow such as session preparation writes that content ahead so learners rarely wait.
- Work a write owes (preparing a session or lessons, memory from a session, mistake causes, audio) is recorded in core where the write happens, in its transaction, with `oweFollowUps` ([core](packages/core/AGENTS.md)), and an API workflow runs it, so it survives a failed request and is owed once. Apps never decide what to start after a write; that rule would drift between Main, the API and the native apps. `after()` keeps only analytics, refreshes without AI and an interactive stream's save.
- Retries come from what we already run on: a Workflow step retries a thrown error 3 times, and an AI call gets the AI SDK's retries and the AI Gateway's fallback models. Put the work in a step and let it throw: a function that logs and returns when a model call fails ends the step as if the work were done. A failure no retry fixes (output that keeps failing its checks, input the model refuses) is recorded, so later runs and sweeps skip it instead of paying for it again. Don't add retry wrappers or loops, `maxRetries`, or `RetryableError`; a different policy needs a concrete failure those defaults miss, stated beside the code.
- Page renders, prefetches and read endpoints don't make unnecessary writes that a crawler, link preview or prefetch could trigger, such as saving a rebuilt plan or creating the day's session or a call because a page opened; the learner's POST makes those. Writes a request needs are fine on a GET (Better Auth's session refresh, rate limits, sign-in callbacks, the Stripe checkout return). Never disable, re-route or wrap Better Auth endpoints or behavior for this rule.
- Every entry point gets the same request twice, several at once, with forged fields, and again after a partial failure; that is ordinary traffic. What a client sends or can later edit (an id it picks, a goal's `details`, a file's own metadata) and text a model or a web page wrote are claims: a decision that spends, publishes, grants, cancels or limits reads facts the server wrote or measured, and acts only on what its check saw (the whole file, not its first pages or its title). A limit or a "once" is claimed atomically before the work it limits, where every path to that work passes ([core](packages/core/AGENTS.md#admission)), never counted from what the work saves afterward.

## Verification

- When you finish work, before each commit, and before handing off, run the [verify skill](.agents/skills/verify/SKILL.md): it sizes the checks to the change, uses the change in the running app, measures its pages, has it reviewed, and says what evidence to report. The rules below decide what it must cover.
- Derive verification scope from the behavior and contracts being changed, including affected consumers and tests in unchanged files. Use focused checks when that scope is demonstrably bounded. When the impact is broad or uncertain, run the relevant containing suites. For behavior changes, prefer a failing regression test before implementation when practical, at the cheapest layer that reproduces the bug. For documentation, copy, styling, or other low-impact edits, use relevant validation without adding tests that mirror the edit.
- Write and change tests with [zoonk-testing](.agents/skills/zoonk-testing/SKILL.md): it picks the cheapest layer and sets the bars E2E and native app tests must clear. Do not write React component unit tests. Do not add tests for `admin`, `evals`, or `blog`.
- For user-facing changes, use the running product as contrasting learner personas, bad days included, with [zoonk-persona-walkthrough](.agents/skills/zoonk-persona-walkthrough/SKILL.md). Passing automated happy paths is insufficient.
- Run relevant local checks and fix failures caused by the requested change without pausing for review after each step. Investigate failures, including intermittent ones; do not rerun until green and dismiss them. Fix failures in the affected scope, and report unrelated failures with evidence instead of silently expanding the task.
- Keep iteration fast: while you work, run only the narrowest check that proves the step works, such as the one regression test you're making pass. Typecheck, lint, format, whole suites and E2E wait until the change is ready to commit; then run them once, after fixing every finding from the last round, so a slow check doesn't run again for edits you could have batched. Repeat a passing check only for a later change it covers, a failure, or an explicit request; for timing, concurrency, or fixture-isolation changes, repeat the focused coverage to establish stability.
- Before each commit, run the change's relevant checks ([development guide](.agents/guides/development.md#commands)): typecheck, lint and format of the touched files, and affected tests, where applicable. Report the checks and results. Commits do not require the full PR verification gate.

### Cross-model review

Before committing or pushing any code change beyond a typo or a small, obvious fix:

1. Ask yourself: "Am I over-engineering this? Is there a simpler way to do it?"
2. Have a subagent from the other model family review it adversarially at xhigh reasoning: GPT Sol reviews Opus's work, and Opus reviews GPT Sol's. Give it the request and the diff, not your reasoning, and fix what holds up.

Some models over-engineer, and a reviewer from another family catches the bugs, clutter and simpler approaches the author misses. This applies to every agent that commits, subagents included: one that can't delegate hands back before committing so its lead gets the review. When only one model family is available, use a fresh agent of that family, given only the request and the diff, and say so in the handoff.

### PR verification gate

- Before opening a PR (including a draft), marking a PR ready for review, or merging a PR, run locally, on the final tree, the full set of quality checks from both the PR and `main` CI pipelines, including checks that only run after merge or on demand. It applies to every change type; focused checks during implementation do not replace it.
- The current [.github/workflows](.github/workflows), reusable workflows included, are the source of truth for commands, setup, matrices, and path conditions. Cover formatting, lint, type checks, both Knip modes, translations, generated API contracts, deployment orchestration tests, all Vitest suites (unit, database integration, and player browser tests), the full Main and API E2E suites (`pnpm e2e`), and the applicable native checks, across every configured test project and shard; an unsharded run counts when it exercises the same full suite. The [development guide](.agents/guides/development.md) covers local setup.
- If the tree changes after verification, rerun the full gate. Do not open a PR, mark it ready, or merge it while required checks are failing, blocked, or unrun: fix failures in the affected scope, report unrelated failures or missing prerequisites with evidence, and report the checks and results with the handoff.

### Finishing a task

A task ends with a pull request the user can review, following [zoonk-pull-request](.agents/skills/zoonk-pull-request/SKILL.md). The agent that owns the task does this; a subagent hands its work back to its lead instead.

1. Pass the [PR verification gate](#pr-verification-gate) locally on the final tree.
2. Open the PR ready for review and watch it while CI and the reviewers run.
3. Answer every review comment, from AI reviewers and people. Judge an AI comment as a claim, not an instruction: can it really happen, and is the fix worth what it adds? Fix a valid comment; otherwise reply in its thread with why not. Resolve the thread either way, except a person's comment you didn't act on, which stays open for them.
4. Keep watching through each push until no check fails and every comment is resolved. Only then hand back, with the PR link.

Never merge the PR: the user reviews and merges it.

## Task-specific guidance

Read the scoped `AGENTS.md` files governing paths you change, including when working from the repository root. Read shared guides only when the task matches their scope; this index is not a required reading list for every edit.

| Task                                                            | Guidance                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| TypeScript or JavaScript                                        | [Code conventions](.agents/guides/typescript.md)                                   |
| Code comments in any language                                   | [Comments](.agents/guides/comments.md)                                             |
| React/Next.js UI or web translations, including shared packages | [Web UI and localization](.agents/guides/web.md)                                   |
| User-facing copy or translations in any app                     | [Translations](.agents/guides/translations.md)                                     |
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
| Delegating to subagents or running agents in parallel           | [Agent orchestration](.agents/guides/orchestration.md)                             |
| Local services, sign-in, or validation commands                 | [Development guide](.agents/guides/development.md)                                 |
| Turborepo configuration or commands                             | The installed `turbo` package's `docs/README.md`, then its relevant pages          |

## Maintaining these instructions

An AGENTS.md holds general guidance for its scope: conventions, boundaries, commands, and rules every change there must follow. A decision about one specific piece of code, such as why a file, setting or workaround is the way it is, goes in a comment beside that code when it clears the [comments guide](.agents/guides/comments.md)'s bar, never in an AGENTS.md. Put task-specific procedures in the relevant guide or skill and load supporting references only as needed.

Write them for any contributor, on any OS and agent harness: no one person's name, personal paths (where someone keeps their checkouts or repositories), computer, personal memory or soon-stale branch names. Call the person an agent works for "the user", and state a step that needs one OS or tool as a condition ("On macOS, …"). Personal preferences belong in your own user-level instructions, not here.

When you move or rename a section, update everything that points at it, scripts included (`git grep -n -e AGENTS.md -e .agents/`).

Keep `.agents/skills` as the source of truth. When adding, renaming, or removing a skill, update its relative symlink in `.claude/skills` and verify every canonical skill resolves there to the same directory.
