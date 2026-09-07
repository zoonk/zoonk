---
name: zoonk-issue-planning
description: Break work into GitHub issues, epics, or dependencies when the user explicitly requests an issue breakdown.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Issue planning

Produce a coherent breakdown of the requested work into independently reviewable outcomes. This skill applies to explicit issue planning; ordinary feature implementation or recording a single problem does not require an epic.

## Boundaries and size

- Group changes that must ship together, including their types, migrations, and relevant tests. Keep one source of truth for shared contracts and respect the repository's core/app boundaries.
- Prefer small issues that can be implemented and reviewed coherently. Treat estimated line count as a sizing signal, not a hard limit; do not split one capability solely to fit a quota.
- Split at real feature, resource, or integration boundaries. Related endpoints can share an issue when they form one capability; do not prescribe one issue per endpoint.
- Keep testing and verification with the implementation they establish. Do not create separate generic testing or verification issues. A task specifically about a testing defect can stand on its own.
- Use sub-epics only when a substantial domain benefits from its own tracking. Avoid empty hierarchy around a few tasks.

## Dependencies

Add a dependency when one deliverable is required by another, integration cannot proceed without it, or simultaneous changes would conflict. Leave independent work unblocked. Inspect actual contracts rather than automatically making all frontend work wait for all backend work.

Use local identifiers or spec filenames in drafts, such as `api-search` or `02-course-search.md`. Do not use `#123` for local numbering; GitHub assigns issue numbers later. Preserve a local-identifier-to-GitHub-number mapping if the plan is published.

## Deliverable and authorization

For each planned issue, give its intended outcome and real dependencies; include verification in a requested implementation plan in proportion to the change. Use a compact list or table, adding a dependency diagram only when it clarifies the work.

For published issue bodies, follow [zoonk-github-issues](../zoonk-github-issues/SKILL.md): preserve the problem and desired outcome rather than copying internal estimates, temporary paths, or a generic implementation checklist. Add technical detail when the user requested a specification; keep the parent epic focused on the overall problem.

A request to plan ends with a reviewable plan. If the user also asked to create the issues, proceed through that authorized publication using the GitHub issue skill without requiring a second planning approval. Do not assign owners, add time estimates, or change product scope unless requested.
