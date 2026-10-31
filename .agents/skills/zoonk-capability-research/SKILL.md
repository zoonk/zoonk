---
name: zoonk-capability-research
description: Research current library, platform, AI model, and product capabilities before choosing a substantial implementation, adding infrastructure, or declaring a feature unavailable.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Capability research

Find the simplest supported way to achieve the user's outcome. Use this skill when the choice depends on current technology or a proposed implementation duplicates behavior a dependency may already provide. Routine edits with established behavior need no separate research exercise.

## Start with the outcome

Describe what the user needs and the constraints that affect the choice: timing, reliability, cost, privacy, deployment, or interaction. Distinguish required behavior from a suggested mechanism. For example, "resume work when an event arrives" leaves more options open than "build a polling service."

Inspect existing product capabilities and relevant dependencies before designing a new subsystem. Resolve the installed version from the owning workspace and read its bundled docs, public APIs, types, and relevant source when necessary. Follow the library's skill if available.

## Check what exists now

- Read current official documentation and relevant release notes for decisions sensitive to changing capabilities. Separate what the installed version supports from what needs an upgrade, configuration, or a different service. Training data and old examples are starting hypotheses.
- Before writing retries, scheduling, rate limits, validation, or coordination, check who already owns that behavior and whether its semantics meet the requirement. For Workflow, investigate retries, durable waits, hooks, and webhooks; for authentication, investigate the configured provider's protections. Verify these against the relevant version rather than treating this list as a permanent capability catalog.
- When AI or platform capabilities materially affect feasibility, check relevant current models, tools, libraries, and products. Look for a different decomposition of the problem and useful combinations of existing primitives, not just a replacement for the first proposed implementation.
- Prefer primary sources. Check the limits that could invalidate the choice, such as durability, event delivery, authorization, deployment support, model quality, or pricing. Treat marketing claims as candidates for verification.

## Choose and prove the approach

Compare the credible options against the actual constraints, including operational burden and migration cost. Prefer existing supported capabilities when they fit; custom behavior needs a concrete unmet requirement. Newer technology is useful when it simplifies the outcome, not merely because it is newer.

Use the smallest meaningful probe when documentation leaves a consequential uncertainty. Exercise the relevant integration or evaluate representative AI inputs; avoid building the entire feature to test one assumption. Respect existing authorization for external calls, spending, and dependency changes.

Stop researching once evidence supports a workable choice and the important uncertainties are resolved. Briefly explain the chosen capability, applicable version, source links, and any remaining limit. If research or a probe is blocked, report what is unknown; lack of evidence is not proof that the feature is impossible.
