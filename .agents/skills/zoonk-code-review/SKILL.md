---
name: zoonk-code-review
description: Review Zoonk diffs or assess supplied review comments against actual product behavior and repository constraints.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Zoonk code review

Review correctness, product intent, architecture, permissions, performance, and the user experience. Automated checks support these judgments; a green suite is not proof that the design or assumptions are correct.

## Scope and evidence

Determine the requested comparison: index, unstaged changes, working tree, commit, branch, or PR. Inspect every file in that diff and enough callers and contracts to understand changed behavior. Do not mix unrelated unstaged work into an index review. Use applicable repository instructions already in context; read additional scoped guidance only where the changed paths need it.

Follow the root instructions for fixing confirmed bugs during reviews. An explicitly findings-only or read-only review stays read-only. For authorized fixes, preserve the user's index and complete relevant verification before local review; the skill does not authorize commits or external publication.

Reconstruct the intended behavior independently of the implementation’s explanation. Identify the assumptions required for the design to work, then investigate reachable conditions that could invalidate them. Trace those assumptions across callers, shared state, and component boundaries; individually correct parts do not establish correct composition. A constructed reproduction proves that case occurs under its supplied conditions; verify that those conditions are possible in this product.

A follow-up review must reassess the assumptions and coverage supporting the earlier conclusion. Reuse valid evidence, but investigate what the earlier review did not establish. Review fixes with the same scrutiny as the original change, including their effects on surrounding behavior.

Classify concerns before reporting:

- **Real bug:** A reachable path violates the established product or repository contract with a concrete consequence.
- **Behavior-dependent:** The outcome depends on an unverified product rule, caller, environment, or deployment condition. State that condition and keep it separate from confirmed findings.
- **Non-bug:** Intentional, unreachable, speculative, or preference-only. Explain rejected supplied comments briefly; omit them from findings.

## Follow the changed behavior

Choose the relevant areas below rather than running a fixed audit of every subsystem:

- **Product and correctness:** Trace input through validation, persistence, side effects, caching, and output. Examine retries, cancellation, concurrency, stale state, and partial failure where the changed path permits them. Preserve the product contract and remove leftovers from superseded requirements.
- **Architecture and simplicity:** Check the core/app boundary, API parity, ownership of shared rules, and whether the added abstraction solves an actual need. Evaluate reused abstractions against the guarantees their callers require. Establish those guarantees from their implementations and actual usage, rather than their names, proximity, or existing adoption. Reject competing sources of truth and unnecessary compatibility layers. Check consumers when moving symbols or changing contracts.
- **Permissions and privacy:** Check authorization beside protected reads/writes, including resource ownership and publication state. Review cache scope, input handling, and exposure of private data through responses, logs, analytics, or client bundles. UI visibility is not authorization.
- **Performance:** Preserve independent async work; examine added queries, model calls, unbounded results, or client payloads. Repeated cheap translation calls are expected. Require evidence before proposing performance machinery.
- **Data and workflows:** Check uniqueness, transactions, retry safety, freshness, and invalidation. Public API changes must preserve the OpenAPI contract; distinguish public product endpoints from the same-origin transport exception in [API guidance](../../../apps/api/AGENTS.md).
- **UI and native behavior:** Judge the whole changed flow, including accessibility and recovery states, in the actual application when relevant. Distinguish rendered observations from static inference.
- **Coverage:** Check whether assertions would catch the real defect and whether fixtures isolate persisted state. Do not request tests that only mirror copy, styles, schemas, or library behavior.

## Conditional references

- For a disputed Next.js API or caching behavior, consult the relevant installed docs in `apps/<app>/node_modules/next/dist/docs/`. Apply the [core Cache Component contract](../../../packages/core/AGENTS.md); do not prescribe React `cache` for every read. Its object-argument identity and per-request scope matter when it is actually used.
- For component architecture, use [compound components](../zoonk-compound-components/SKILL.md); for visual or interaction judgment, use [design guidance](../zoonk-design/SKILL.md), which routes native platform work.
- For effect or React performance questions, consult the relevant [React best practices](../vercel-react-best-practices/SKILL.md). Load [next-dev-loop](../next-dev-loop/SKILL.md) when runtime investigation is needed, not for every TSX diff.
- For test design or fixture questions, use [testing guidance](../zoonk-testing/SKILL.md). Internal app exclusions and the prohibition on React component unit tests still apply.
- For user-facing copy, consult the [copy styleguide](../../../packages/i18n/.eloqnt/styleguide.md). Translation generation and ownership follow the shared [web guidance](../../guides/web.md).

## Checks and output

Use current CI results when available. Run local checks to answer a concrete question, reproduce a defect, or close a coverage gap. In read-only reviews use check-only commands. Do not repeat the entire pipeline by default or treat an intermittent failure as a pass.

Lead with actionable findings ordered by impact: P0 for immediate catastrophic impact, P1 for high-impact failures, P2 for functional or architectural defects, and P3 for small real defects. Severity describes impact, not certainty, and does not excuse leaving an authorized confirmed fix unfinished.

Each finding needs a concise title, tight file/line reference, reachable trigger, consequence, and the simplest fix direction when it is not obvious. Include a regression-coverage gap only when it adds information. Keep unsupported conditions separate.

End with a brief account of what was traced or exercised, which relevant checks passed or failed, and material limitations. If there are no findings, say so without implying exhaustive proof of correctness.
