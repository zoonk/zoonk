# Zoonk repository guidance

This file holds what every task needs: the principles, the rules that hold everywhere, and [where to read](#where-to-read) for the task in front of you. Read a linked file when its line matches what you're doing.

## Principles

- **Think big about the product:** Start from the best product we could build: the best experience and interface for learners, including ideas that were once impossible and that current models and platforms now make possible. Today's code, data and prompts are where the build starts, not a limit on what learners get: "nothing reads this yet" is a reason to build the reader, not to drop the idea. Use the current system to cost the vision and split it into phases, never to rule an idea out. Propose the ambitious version; when it goes beyond the request, the user decides what ships.
- **Write for someone who knows nothing about Zoonk:** every screen, page, label and message is read by a person who hasn't seen the code, the plan's rules or the spec. Say what they get and what to do, in words they already use. In the app, leave the rest out: a true sentence still has to earn its place ([Words](.agents/skills/zoonk-design/SKILL.md#words)). On a marketing page, a visitor is deciding whether to start, so every section answers a question they have ([Marketing pages](.agents/skills/zoonk-design/references/marketing-pages.md)).
- **Look at what you ship, with a designer's eye:** Open every screen, picture and message your work produces, including what a subagent hands back, and look at it as someone who cares about the product would; a passing check is not looking. Notice what nobody asked about, fix it when it's part of your task, and raise the rest with your recommendation. A rule about how a screen looks serves the screen: never ship a worse screen for a rule's sake ([when a rule looks wrong](.agents/guides/exceptions.md)).
- **Engaging, not only accurate:** a learner who stops coming back learns nothing. In lessons, practice and review, the effort goes into the skill, never into reading the screen, waiting for a verdict or working the controls; judge each by whether a tired learner on a phone would do the next one. Proving what someone can do unaided is a test's job, and a test says it is one ([learning is light](.agents/skills/zoonk-design/SKILL.md#zoonks-learning-experience)).
- **Guide people through a task:** before they start, show the effort and what they'll get. As they go, show where they are, what remains and how to leave with their work saved. When they finish, give them a clear next step ([guided tasks](.agents/skills/zoonk-design/SKILL.md#zoonks-learning-experience)).
- **KISS:** Build each piece in the simplest complete way that meets the product requirements; simplicity governs the implementation, never how far the product reaches. Avoid over-engineering, speculative infrastructure, and workarounds when an equivalent direct approach works.
- **Simplify instead of patching:** A bug, failing test, review finding or roadblock invites a patch: a guard, retry, setting, fallback, second code path or test harness. Each feels necessary in the moment, and they pile up. Before adding one, find the root cause, check what the code and its dependencies already do, and ask what the simplest version of this part would be if you built it today; often the fix is to delete or reshape code. Add compatibility code only for data and clients that exist in production. When an approach changes, remove what the earlier attempt added. Before finishing, reread your diff and cut whatever you can't justify by a concrete failure it prevents.
- **DRY:** Keep a single source of truth for behavior that must stay consistent, including repeated UI patterns and runtime schemas used by documentation. Extract for real shared rules or known extensions; a small number of callers is not a reason to leave competing implementations. Before building a piece, [find the one that exists](.agents/skills/zoonk-design/SKILL.md#find-the-piece-before-you-build-one) by the words it shows; extracting one moves every copy onto it in the same change.
- **SOLID:** Keep functions and modules focused, composable, and responsible for one concern. Use clear boundaries and dependencies, without adding unnecessary class hierarchies, interfaces, or abstraction layers. Prefer functional composition and immutable transformations.
- **Comments:** The default is none. Keep a comment only when it says what the code can't; otherwise change the code until it says it ([comments guide](.agents/guides/comments.md)).
- **Think from first principles.** Preserve intended behavior, question assumptions and existing patterns, and choose maintainable designs without expanding the requested scope.
- **When progress stalls** (repeated review rounds, small optimizations that don't converge, growing machinery), stop and reframe; otherwise you keep optimizing the wrong thing. Question the problem itself: what does the user actually need, and what is the minimal work if you built it from scratch? Approach it from different angles like a polymath, borrowing proven principles from other fields and products: keep a running balance instead of re-summing the ledger, compute derived facts when their inputs change and only read them on views, load each fact once per request. Prefer removing work and machinery over optimizing it.
- **Look for the best approach, not just the first one:** The task is the outcome the user wants. An issue's suggested fix, a spec's design and your own first idea are each one hypothesis among several. When one fails, falls short or only partly works, try others (a different split of the work, model, data shape or product angle), measure them, and decide by the results; an approach that loses is still a finding. When you're stuck or out of ideas, ask models from other families for their approaches before you settle. Never accept a mediocre result because a better approach seems outside the issue: making the product better is always in scope.
- **Check what exists today before you build:** Before declaring a capability unavailable, adding infrastructure, or implementing behavior a dependency might own, check installed versions and current official documentation. Research newer models, products and libraries when they could materially simplify the solution, and prefer supported capabilities and composition over rebuilding them ([capability research](.agents/skills/zoonk-capability-research/SKILL.md)).
- **Check the current catalog before you choose:** Before choosing, adding, or replacing a model, dependency, API, or version, check the provider's current catalog or registry for the latest option and its lifecycle (deprecation and shutdown dates on every route we call). Existing code, your training data, and a deprecation notice's suggested replacement may already be outdated.
- **US English for engineering work:** code, identifiers, comments, docs, commit messages, and examples in them. Use other languages only where the content is about that language or its learners: translation catalogs, language guides, test inputs and fixtures, eval cases, and AI prompt variants written for a language.
- Preserve unrelated formatting; `oxfmt` owns formatting. Do not hard-wrap Markdown prose.
- Make the best decision that will elevate all three: the user experience (UX), developer experience (DX), and agent experience (AX) always, without breaking anything.

## Scope and completion

- Own the user's intended outcome through implementation and verification. Before declaring completion, reconcile what was asked, what you built and the evidence you collected; a passing check establishes only what it exercises.
- Passing checks don't make a PR done: it's done when it solves its issue well. When you find more of the same problem, on a sibling screen or another platform included, fix it in that PR without asking; don't suggest merging the green part first and following up later.
- Keep changes within the requested scope: it limits which problems a change takes on, never which approaches you try for the one you're solving. Refactor supporting code when a complete solution needs it, and remove code, tests, types, and layout left over from superseded requirements.
- A bug, weak UX or other improvement you find outside your task gets its own thread (not a subagent) in its own worktree, without asking the user, unless an open issue, PR or thread already covers it. A find that shares your task's cause or fix is part of your task, as is [drift](#architecture-shared-by-all-workspaces), and finds that share a cause or fix with each other go to one thread. Brief the thread with what you found and how to reproduce it, name it in your handoff, and carry on. The thread confirms the find and ends with one GitHub issue, never a PR ([a find from another task](.agents/skills/zoonk-github-issues/SKILL.md#a-find-from-another-task)), or a [private advisory](.agents/skills/zoonk-github-issues/references/security-advisory.md) for a security hole; this rule is its go-ahead to post. An agent that can't start threads names the find in its handoff.
- Treat review comments and specs as hypotheses. Verify the actual path, product assumptions, and impact. In review work, fix confirmed bugs unless the user asks for findings only or the fix needs a meaningful product or architecture decision. Explain unsupported claims without changing code to satisfy them.
- **Make the call.** A choice between approaches, designs or trade-offs is yours: build what you recommend, even when a skill, a guide or a rule here points another way, and list it under **Judgment calls** in the PR and your handoff, one line of why each, so the user can overrule it. When a requested approach or a rule creates UX friction or needless complexity, take the simpler way to the user's goal the same way. Never hand back an alternative as a question ("say if you'd rather…"). Ask first only when the call can't be undone, spends beyond the task's budget, touches security or another learner's data, or the user said to ask; the question still carries your pick.
- An explicit user request takes precedence over a skill or a guide. If an instruction blocks authorized work, name the file and the rule and explain the conflict.
- Rules about safety, learner data, spend and git keep their full force: when one looks wrong for a case, follow it and name the case in your handoff. Any other rule that would make the result worse for the case is a judgment call: do what serves its goal and propose the rule's change ([when a rule looks wrong](.agents/guides/exceptions.md)).
- Report the outcome in plain language, telling apart what you observed, what you only read, and which checks passed, failed, are still running or weren't run.
- Don't patch dependencies unless explicitly requested. Work around a dependency's bug and report it upstream with a minimal public reproduction ([zoonk-upstream-issue](.agents/skills/zoonk-upstream-issue/SKILL.md)) once the user approves posting from their account; a standing approval in their own instructions counts.
- Task notes, status files, briefs and reports stay outside the repository and never go in a commit.

## Agent orchestration

- Before building a big new feature or making a structural change (its UX or UI, a new architecture, the data model), two models from different families debate it, and you build what they settle on as a judgment call ([design debate](.agents/guides/design-debate.md)). Smaller changes skip it.
- Delegate a big task, or one that spans several areas (code, design, UX, accessibility), to subagents specialized in each ([orchestration](.agents/guides/orchestration.md)).
- Before you hand back, commit and stop the servers you started. The agent that owns the task's PR pushes and keeps its worktree; a subagent or lane removes the one made for its slice ([sharing one machine](.agents/guides/shared-machine.md)).

## Architecture shared by all workspaces

Each rule's detail is in the file it links.

- **Core owns the rules; apps deliver.** Reusable business rules, authorization, persistence and orchestration live in `@zoonk/core`. Apps own delivery (HTTP, UI composition, translations, URLs, metadata) and call authenticated core capabilities instead of supplying an acting user ID ([core](packages/core/AGENTS.md)). Do not add framework abstraction until another framework is adopted.
- **Reusable product behavior is reachable through the public API** ([Main](apps/main/AGENTS.md), [API](apps/api/AGENTS.md)).
- **Main, Apple and Android are one product.** When a change alters what a learner sees or does in Main (a feature, a fix, copy, a contract), make the same change in the [Apple](apps/apple/AGENTS.md) and [Android](apps/android/AGENTS.md) apps in the same task, and name in your handoff a platform you couldn't change. Behavior that core or the API already decides for every client needs only the contract and each app's test fixtures. A difference you find between the platforms, or between screens that do one job (what it shows, says or does, its structure, a shared piece's look), is drift and part of your task: fix it in the shared piece in the same PR, with web as the reference unless web is the one that's wrong. Being already on main, or the fix changing other screens that use the piece, is no reason to leave it. Ask the user only when aligning them needs a product decision none of them has made, and then with your recommendation. A handoff never lists drift as known differences.
- **AI work starts only from a POST** (a Server Action or an API POST) by a signed-in learner or a guest, never from a GET, a render, metadata or a page load without a click, so a crawler or a prefetch can't spend. The one exception is system work only the platform can start, such as the daily sweeps.
- **Generation runs only inside an API workflow step,** one model call per step, so it outlives the request and a failure retries only the call that failed. The exception is an interactive call, whose output the learner is waiting for in that request ([generation](packages/core/AGENTS.md#follow-ups-and-generation)).
- **Work a write owes is recorded in core, in the write's transaction** (`oweFollowUps`), and an API workflow runs it, so it survives a failed request and is owed once. Apps never decide what to start after a write.
- **Retries come from what we already run on.** Put the work in a workflow step and let it throw; don't add retry wrappers or loops, `maxRetries`, or `RetryableError` ([retries](packages/core/AGENTS.md#retries)).
- **An app's proxy (`proxy.ts`) reads only the request** (URL, headers, cookies): it runs on every matched request, ahead of the CDN cache and far from the database, so no database, cache or service calls, and a page answers its own 404 or redirect. Instrumentation's `register()` loads only what every server needs at once. Tests hold both.
- **A page render, a prefetch or a read endpoint makes no unnecessary write** that a crawler, link preview or prefetch could trigger; the learner's POST makes it. Writes the request itself needs (a session refresh, a rate limit, a sign-in callback, the checkout return) are fine. Never disable, re-route or wrap Better Auth endpoints or behavior for this rule.
- **What a client sends is a claim.** Every entry point gets the same request twice, several at once, with forged fields, and again after a partial failure; that is ordinary traffic. A decision that spends, publishes, grants, cancels or limits reads facts the server wrote or measured, and a limit or a "once" is claimed atomically before the work it limits ([admission](packages/core/AGENTS.md#admission)).
- **A limit or budget never interrupts or shortens what a learner already started,** such as a call or a lesson: it refuses the next start. When cost and the learner's experience conflict, keep the experience and bound the cost at the next start.

## Verification

- When you finish work, before each commit, and before handing off, run the [verify skill](.agents/skills/verify/SKILL.md): it sizes the checks to the change and has you use the change in the running app. Use [Checks for a change](.agents/guides/checks.md) to see what to run locally and what CI covers on a PR or after merge.
- Investigate a failing check, an intermittent one included, and fix what the change caused; never rerun until green. An unrelated failure gets its own thread ([scope](#scope-and-completion)).
- Judge performance by what a learner waits for: how long queries take, whether a request runs the same read more than once, and how long the page takes to load. A count of statements or requests is a lead to look into, never a limit to hold in a test.
- Write and change tests with [zoonk-testing](.agents/skills/zoonk-testing/SKILL.md), at the cheapest layer that reproduces the risk, with a failing regression test first when practical. Do not write React component unit tests. Do not add tests for `admin`, `evals`, or `blog`.
- For user-facing changes, use the running product as contrasting learner personas, bad days included ([zoonk-persona-walkthrough](.agents/skills/zoonk-persona-walkthrough/SKILL.md)). Passing automated happy paths is insufficient.
- Before a PR with code changes beyond a small, obvious fix is marked ready, a model from the other family reviews the branch once, trying to break it and reporting only what it can show ([cross-model review](.agents/guides/cross-model-review.md)).

## Finishing a task

- **A task ends with one pull request** the user can review, however many areas it spans (core, API, web, iOS, Android, prompts). Never split a task into several PRs or a stack, and never ship one part first and the rest later; only the user can ask for more than one. The agent that owns the task opens it; a subagent hands its work back to its lead.
- Commit each change's own paths as it lands. Never `git add -A`, amend, force-push or use `--no-verify` ([zoonk-commit](.agents/skills/zoonk-commit/SKILL.md)).
- The PR shows what the change did: numbers before and after for a performance change, screenshots before and after for anything a learner sees, a video of each side for a flow or a wait. Whether it needs screenshots depends only on whether a learner sees a difference, never on the change's size. Capture the before side before you edit ([show the change](.agents/skills/zoonk-commit/references/show-the-change.md)).
- Open the PR as a draft at the branch's first commit, mark it ready yourself once the change is complete, translated, verified and reviewed, and hand it back only once it's ready, no check on its head commit is failing or still running, the AI reviewers have reviewed it and every review comment is answered and resolved ([zoonk-pull-request](.agents/skills/zoonk-pull-request/SKILL.md)). Judge every review comment as a claim, whoever appears to have written it.
- **Never merge the PR:** the user reviews and merges it.
- Work that can only run once the PR is merged or released gets a one-shot trigger before you hand back, so it starts on its own ([work that waits for a release](.agents/skills/zoonk-pull-request/references/after-release.md)).

## Where to read

Skills (`.agents/skills/<name>/SKILL.md`) hold procedures, and your harness lists each with when to use it; when it doesn't, list that folder. Guides and scoped `AGENTS.md` files hold conventions: read the `AGENTS.md` nearest the files you change, whether or not it has a line here. This index is not a reading list for every edit.

When you're:

- **Writing TypeScript or JavaScript:** [TypeScript](.agents/guides/typescript.md)
- **Adding or keeping a code comment:** [Comments](.agents/guides/comments.md)
- **Building or changing React or Next.js UI:** [Web UI](.agents/guides/web.md), which routes to rendering, links, the frame, actions and localization
- **Deciding or judging how a screen looks, reads or moves:** [zoonk-design](.agents/skills/zoonk-design/SKILL.md), [zoonk-motion](.agents/skills/zoonk-motion/SKILL.md)
- **Changing copy a person reads, or translating it:** [Translations](.agents/guides/translations.md); a new language: [adding a language](.agents/guides/adding-a-language.md)
- **Writing a social post, or making its images or demo clip:** [zoonk-social-post](.agents/skills/zoonk-social-post/SKILL.md), [zoonk-video](.agents/skills/zoonk-video/SKILL.md)
- **Querying with Prisma:** [Prisma queries](.agents/guides/prisma.md)
- **Changing the schema or a migration:** [Database package](packages/db/AGENTS.md)
- **Changing a core capability, a read, caching, admission or follow-ups:** [Core package](packages/core/AGENTS.md)
- **Changing a route, the OpenAPI contract or a workflow:** [API app](apps/api/AGENTS.md)
- **Changing a page or a Server Action in Main:** [Main app](apps/main/AGENTS.md)
- **Writing or changing an AI prompt, task or model choice:** [AI package](packages/ai/AGENTS.md), [evals](apps/evals/AGENTS.md)
- **Working in Admin or the staff CLI (`pnpm zoonk`):** [Admin](apps/admin/AGENTS.md), [CLI](apps/cli/AGENTS.md)
- **Working in the Apple app:** [Apple app](apps/apple/AGENTS.md)
- **Working in the Android app:** [Android app](apps/android/AGENTS.md)
- **Choosing which checks to run:** [Checks for a change](.agents/guides/checks.md)
- **Starting the app, signing in, setting up databases:** [Running the app locally](.agents/guides/local-app.md)
- **Running Vitest or E2E, or a test database is in the way:** [Running tests locally](.agents/guides/local-tests.md)
- **Running a heavy command, booting a device, or handing back a worktree:** [Sharing one machine](.agents/guides/shared-machine.md)
- **Setting up a cloud agent:** [Cloud agents](.agents/guides/cloud-agents.md)
- **Starting a subagent, or splitting a task into lanes:** [Orchestration](.agents/guides/orchestration.md), [lanes](.agents/guides/lanes.md)
- **Picking a model or a provider for an agent:** [Models](.agents/guides/models.md), [providers](.agents/guides/providers.md)
- **Waiting for a build, CI or a server:** [Waiting](.agents/guides/waiting.md)
- **A rule looks wrong for your case:** [When a rule looks wrong](.agents/guides/exceptions.md)

## Maintaining these instructions

- **Keep this file short:** it holds the principles, the rules that hold on every task, and the index. A procedure, a list of cases, a tool's manual and anything that belongs to one area go in the small file the index points at.
- **One subject per file, and small.** A guide, a skill's entry and a reference each do one job, so reading one costs little. When a file grows a second subject, split it and add its line to the index or to the skill's entry. A skill's `SKILL.md` is a short entry that says when to read each of its references, with what matters most at the top.
- **One home per rule.** State a rule in one place and link to it from everywhere else; a second copy drifts.
- **Goal and reason before any number.** Say what to do, what it serves and why, in a sentence or two. Keep a number only when it's a constraint we can't change; any other number is a target, and the piece or the check owns the value. A check is a lead and a guard against a fault coming back, never the definition of a good result.
- **No example from the task that prompted a rule,** and at most one example. When you add to a file, look for what it lets you take out. `pnpm agent-rules:check` holds each file's size, every link and anchor, and the skill symlinks.
- An `AGENTS.md` holds general guidance for its scope: conventions, boundaries, commands, and rules every change there must follow. A decision about one specific piece of code goes in a comment beside that code when it clears the [comments guide](.agents/guides/comments.md)'s bar, never in an `AGENTS.md`.
- Write for any contributor, on any OS and agent harness: no one person's name, personal paths, computer, personal memory or soon-stale branch names. Call the person an agent works for "the user", and state a step that needs one OS or tool as a condition ("On macOS, …"). Personal preferences belong in your own user-level instructions.
- When you move or rename a section, update everything that points at it, scripts included (`git grep -n -e AGENTS.md -e .agents/`).
- Keep `.agents/skills` as the source of truth. When adding, renaming, or removing a skill, update its relative symlink in `.claude/skills`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
