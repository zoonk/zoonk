---
name: zoonk-code-review
description: Use when asked to review a Zoonk diff, branch or pull request, or to judge review comments someone supplied.
license: MIT
metadata:
  author: zoonk
  version: "2.4.0"
---

# Zoonk code review

Review correctness, product intent, architecture, permissions, performance, and the user experience. Automated checks support these judgments; a green suite is not proof that the design or assumptions are correct.

## Scope and evidence

Determine the requested comparison: index, unstaged changes, working tree, commit, branch, or PR. Inspect every file in that diff and enough callers and contracts to understand changed behavior. Do not mix unrelated unstaged work into an index review. Use applicable repository instructions already in context; read additional scoped guidance only where the changed paths need it.

Follow the root instructions for fixing confirmed bugs during reviews. An explicitly findings-only or read-only review stays read-only. For authorized fixes, preserve the user's index and complete relevant verification before local review; the skill does not authorize commits or external publication.

Reconstruct the intended behavior independently of the implementation’s explanation. Identify the assumptions required for the design to work, then investigate reachable conditions that could invalidate them. Trace those assumptions across callers, shared state, and component boundaries; individually correct parts do not establish correct composition. A constructed reproduction proves that case occurs under its supplied conditions; verify that those conditions are possible in this product.

A follow-up review covers the fixes and the behavior they affect, including any earlier conclusion whose assumptions a fix changed. Reuse valid evidence, and review fixes with the same scrutiny as the original change.

Classify concerns before reporting:

- **Real bug:** A reachable path violates the established product or repository contract with a concrete consequence.
- **Behavior-dependent:** The outcome depends on an unverified product rule, caller, environment, or deployment condition. State that condition and keep it separate from confirmed findings.
- **Non-bug:** Intentional, unreachable, speculative, or preference-only. Explain rejected supplied comments briefly; omit them from findings.

## Evidence before findings

Try to break the change rather than read it for flaws. A concern becomes a finding only with evidence:

- **Shown:** a request, a command or a screen in the running app that shows it, or a failing test. A read-only review puts the test in the finding, for the author to run and keep as the regression test.
- **Traced:** when it can't run here (a deploy window, a race only production timing hits), the path from an entry point (a route, an action, a tap, a workflow step) through each caller to the consequence, with a file and line at each hop.

Before reporting a race, stale state or a missing guard, look for what already prevents it: a lock, a unique constraint, a transaction, a component remounted by its key, the only caller. A concern with neither kind of evidence is behavior-dependent at best.

## Follow the changed behavior

Trace the areas the change reaches rather than running a fixed audit of every subsystem: product and correctness, architecture and simplicity, permissions and privacy, performance, data and workflows, UI and native behavior, the learner's experience, and test coverage. [Review areas](references/areas.md) says what to check in each and where to look things up.

## Checks and output

Start from `pnpm verify:diff --base <base>`, which lists the lines a principal engineer, a security researcher and a designer would each question; the verify skill's checklists for the [engineer](../verify/references/review-engineer.md), the [designer](../verify/references/review-designer.md) and the [security researcher](../verify/references/security.md) say how to check them. Use current CI results when available. Run local checks to answer a concrete question, reproduce a defect, or close a coverage gap. In read-only reviews use check-only commands. Do not repeat the entire pipeline by default or treat an intermittent failure as a pass.

Lead with actionable findings ordered by impact: P0 for immediate catastrophic impact, P1 for high-impact failures, P2 for functional or architectural defects, and P3 for small real defects. Severity describes impact, not certainty, and does not excuse leaving an authorized confirmed fix unfinished.

Each finding needs a concise title, tight file/line reference, reachable trigger, consequence, its evidence, and the simplest fix direction when it is not obvious. Include a regression-coverage gap only when it adds information. Keep unsupported conditions separate.

End with a brief account of what was traced or exercised, which relevant checks passed or failed, and material limitations. If there are no findings, say so without implying exhaustive proof of correctness.
