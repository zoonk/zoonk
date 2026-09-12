# Zoonk repository guidance

## Principles

- **KISS:** Choose the simplest complete solution that satisfies the product requirements. Avoid over-engineering, speculative infrastructure, and workarounds when an equivalent direct approach works.
- **DRY:** Keep a single source of truth for behavior that must stay consistent, including repeated UI patterns and runtime schemas used by documentation. Extract for real shared rules or known extensions; a small number of callers is not a reason to leave competing implementations.
- **SOLID:** Keep functions and modules focused, composable, and responsible for one concern. Use clear boundaries and dependencies; apply these principles without adding unnecessary class hierarchies, interfaces, or abstraction layers. Prefer functional composition and immutable transformations.
- Think from first principles. Preserve intended behavior, question assumptions and existing patterns, and choose maintainable designs without expanding the requested scope.
- Preserve unrelated formatting; `oxfmt` owns formatting. Do not hard-wrap Markdown prose.

## Scope and completion

- Own the user’s intended outcome through implementation and verification. Before declaring completion, reconcile the intended outcome, the resulting implementation, and the evidence collected. Close material gaps that can be investigated within the authorized task. Passing selected checks establishes only what those checks exercise. Carry earlier evidence forward only while subsequent changes leave it applicable.
- Keep changes within the requested scope. Refactor supporting code when needed for a complete solution, and remove code, tests, types, and layout left over from superseded requirements.
- Treat review comments and specs as hypotheses. Verify the actual path, product assumptions, and impact. In review/assessment work, fix confirmed bugs unless the user asks for findings only or the fix requires a meaningful product or architecture decision. Explain unsupported claims without changing code to satisfy them.
- Read task-relevant files and documentation. Skills provide conditional guidance; an explicit user request takes precedence. If an instruction blocks authorized work, identify the file and rule and explain the concrete conflict.
- Report the outcome and verification in plain language, distinguishing observed behavior, static review, and passed checks. Base progress and completion claims on observed results, accounting for failures across the relevant run. Identify running, blocked, or unrun checks and material verification limits.
- Never patch dependencies. Patches are hard to maintain.

## Architecture shared by all workspaces

- Put reusable business rules, authorization, persistence, and orchestration in `@zoonk/core`. Apps own delivery: HTTP parsing/serialization, UI composition, translations, URLs, metadata, and presentation fallbacks. Do not add framework abstraction until another framework is adopted.
- Apps call authenticated core capabilities rather than supplying an acting user ID. Read the [core capability contract](packages/core/AGENTS.md) when adding or changing those capabilities or their callers.
- Reusable product behavior must be reachable through the public API. Main owns its [capability parity audit](apps/main/AGENTS.md); API owns the [public contract and transport rules](apps/api/AGENTS.md).

## Verification

- Derive verification scope from the behavior and contracts being changed, including affected consumers and tests in unchanged files. Use focused checks when that scope is demonstrably bounded. When the impact is broad or uncertain, run the relevant containing suites. For behavior changes, prefer a failing regression test before implementation when practical. For documentation, copy, styling, or other low-impact edits, use relevant validation without adding tests that mirror the edit.
- Use [zoonk-testing](.agents/skills/zoonk-testing/SKILL.md) when writing or changing tests: E2E for user flows, real-database integration tests for persistence and business logic, and unit tests for non-trivial pure helpers. Do not write React component unit tests. Do not add tests for `admin`, `evals`, or `blog`.
- Run relevant local checks and fix failures caused by the requested change without pausing for review after each step. Investigate failures, including intermittent ones; do not rerun until green and dismiss them. Fix failures in the affected scope, and report unrelated failures with evidence instead of silently expanding the task.
- Once the affected scope has been verified, broaden or repeat checks only for new changes, failures, unresolved risks, or an explicit request. For timing, concurrency, or fixture-isolation changes, repeat the focused affected coverage to establish stability.

## Task-specific guidance

Read the scoped `AGENTS.md` files governing paths you change, including when working from the repository root. Read shared guides only when the task matches their scope; this index is not a required reading list for every edit.

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
| Local services, sign-in, or validation commands                 | [Development guide](.agents/guides/development.md)                                 |

## Maintaining these instructions

Keep repository rules focused on project constraints and non-obvious decisions. Put task-specific procedures in the relevant skill and load supporting references only as needed.
