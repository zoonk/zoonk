---
name: zoonk-issue-planning
description: "Break down implementation plans into small, manageable GitHub issues. Use when you have a plan and want to create GitHub issues instead of implementing immediately. Outputs a structured breakdown with epic, sub-issues, and dependencies for review."
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Issue Planning Skill

Break down implementation plans into small, well-organized GitHub issues. This skill focuses on the **planning process** — determining what issues to create, how to organize them, and what dependencies exist.

For actually **creating** issues in GitHub, see [zoonk-github-issues](./../zoonk-github-issues/SKILL.md).

## When to Use This Skill

- You have an implementation plan and want to create GitHub issues instead of implementing immediately
- A feature is too large for a single issue
- You need to coordinate work across multiple areas (API, apps, packages)
- You want to enable parallel work where possible

## Issue Size Guidelines

### Target Size

- **~300 lines of code** per issue (ideal)
- **500 lines of code** maximum (hard limit)

### What Counts

These contribute to the size calculation:

- Application code
- Configuration changes

### What Doesn't Count

These do NOT contribute to the size calculation:

- **Test code** (tests are required but don't count toward LOC limit)
- Generated code (Prisma client, etc.)
- Translation files (PO files)
- Lock files (pnpm-lock.yaml, etc.)
- Type definitions from codegen
- Comments and documentation

### When Uncertain

Split smaller. It's easier to combine issues later than to split them mid-implementation.

## Critical Rules

### Tests Are Always Included

Every issue that adds functionality MUST include its tests in the same issue. Never create separate "testing" issues.

**Good:**

- "Add course search endpoint" (includes endpoint + tests)

**Bad:**

- "Add course search endpoint" + "Add tests for course search endpoint"

### Verification Is Part of Every Issue

Every issue implicitly includes verification. Don't create separate "verify X works" issues. An issue isn't complete until it's verified to work.

### One Endpoint = One Issue

For API work, each endpoint (or small group of related endpoints) should be its own issue with tests included. Don't group many endpoints into one issue, then create a separate testing issue.

**Good:**

```
1. Add GET /courses/:slug endpoint
2. Add POST /courses endpoint
3. Add PATCH /courses/:slug endpoint
```

**Bad:**

```
1. Add course CRUD endpoints (GET, POST, PATCH, DELETE)
2. Add tests for course endpoints
```

## Breaking Down Process

### Step 1: Read the Plan

Understand the full scope before breaking down:

- What's the end goal?
- What are the major pieces?
- What are the natural boundaries?

### Step 2: Identify Natural Boundaries

Look for clear separation points:

- **Layers**: Schema → API → Frontend
- **Apps**: Main app, Editor, Admin
- **Packages**: Shared libraries
- **Features**: Independent functionality
- **Components**: Self-contained UI pieces

### Step 3: Group Related Changes

Changes that MUST ship together go in the same issue:

- A function and its tests
- A component and its styles
- An API endpoint and its types

### Step 4: Split Large Groups

If a group exceeds ~300 LOC, find sub-boundaries:

- Split by route/page
- Split by component
- Split by functionality (read vs write operations)

### Step 5: Map Dependencies

Identify what blocks what:

- Schema changes block API work
- API endpoints block frontend integration
- Shared components block pages that use them

### Step 6: Verify Size

Estimate each issue's size. If any exceeds 500 LOC, go back to Step 4.

## Issue Hierarchy

### Epic

The overall feature or task. Describes the **what** at a high level.

- Contains all sub-issues
- Tracks overall progress
- One-line description of the goal

### Sub-Issues (Tasks)

Individual implementation pieces. Describes the **how** broken down.

- Small, focused scope
- Clear deliverable
- Can be worked on independently (if unblocked)

### Nested Epics

For large implementations spanning multiple apps or domains:

- **Main Epic**: The overall feature
  - **Sub-Epic**: A domain-specific grouping (e.g., "API", "Main App", "Editor", "Schools", "Teams", etc.)
    - **Tasks**: Implementation pieces within that domain

Dependencies can exist between epics, not just between tasks.

### When to Use Sub-Epics

Sub-epics are for **substantial** groupings, not small collections of tasks. If you have isolated tasks that don't belong to an epic, just make them sub-issues under the main epic. You can have sub-issues and sub-epics side-by-side. Not everything under an epic needs to be a sub-epic.

**Use a sub-epic when:**

- The domain has 5+ related issues
- The work is complex enough to warrant its own tracking
- Multiple people might work on different parts

**Don't use a sub-epic when:**

- There are only 1-3 issues (just make them top-level tasks)
- The "sub-epic" is really just a single task with verification

**Example - Too Granular:**

```
Sub-Epic: Main App Migration (2 issues)
1. Migrate main app to SDK
2. Verify migration works
```

**Better:**

```
Task: Migrate main app to SDK
(verification is implicit in the task)
```

**Example - Good Sub-Epic:**

```
Sub-Epic: Organization Content API (12 issues)
1. Add GET /orgs/:slug/courses endpoint
2. Add POST /orgs/:slug/courses endpoint
3. Add PATCH /orgs/:slug/courses/:slug endpoint
...
```

## Dependency Guidelines

### When to Add Dependencies

Add a `blocked-by` relationship when:

- One issue's output is required as another's input
- Changes would conflict if done in parallel
- Integration requires the other piece to exist

### Common Patterns

```
Schema → API → Frontend
Shared component → Pages using it
Type definitions → Code using types
```

### When NOT to Add Dependencies

- Issues can be done in any order
- Work areas don't overlap
- Integration can happen later

**Don't over-constrain.** More parallel work = faster overall progress.

### If Uncertain

Leave unblocked. Dependencies can be added later if needed.

## Output Format

After planning, present issues in this format for review:

### Simple Format (Single Epic)

```markdown
## Epic: [Title]

[One-line description]

### Sub-issues

1. **[Title]** - [Short description]
2. **[Title]** - [Short description]
   - Blocked by: 1
3. **[Title]** - [Short description]
   - Blocked by: 1
4. **[Title]** - [Short description]
   - Blocked by: 2, 3

### Dependency Graph

1 → 2 → 4
1 → 3 → 4
```

### Nested Format (Multiple Domains)

```markdown
## Epic: [Main Feature Title]

[One-line description]

### Sub-Epic: API

[One-line description]

Sub-issues:

1. **[Title]** - [Short description]
2. **[Title]** - [Short description]
   - Blocked by: API.1

### Sub-Epic: Main App

[One-line description]

- Blocked by: Sub-Epic: API

Sub-issues:

1. **[Title]** - [Short description]
2. **[Title]** - [Short description]
   - Blocked by: Main.1

### Sub-Epic: Editor

[One-line description]

- Blocked by: Sub-Epic: API

Sub-issues:

1. **[Title]** - [Short description]

### Dependency Graph

API → Main App
API → Editor
```

## Example Breakdown

Given a plan to "Add user notification preferences":

### Analysis

- Schema changes: ~50 LOC
- API endpoints: ~150 LOC
- Main app settings page: ~200 LOC
- Notification triggers: ~150 LOC

Total: ~550 LOC → needs splitting

### Result

```markdown
## Epic: User Notification Preferences

Allow users to control which notifications they receive

### Sub-issues

1. **Add notification preferences schema** - Prisma model and migration
2. **Add preferences API endpoints** - CRUD operations for preferences
   - Blocked by: 1
3. **Add notification settings page** - UI for managing preferences
   - Blocked by: 2
4. **Wire up notification triggers** - Check preferences before sending
   - Blocked by: 2

### Dependency Graph

1 → 2 → 3
1 → 2 → 4
```

## What This Skill Does NOT Do

- **Write specifications**: Issues get title + short description only
- **Create issues**: Use [zoonk-github-issues](./../zoonk-github-issues/SKILL.md) for that
- **Estimate time**: Focus on scope, not duration
- **Assign issues**: That happens after creation

## Reference

For creating the planned issues in GitHub:

- [zoonk-github-issues](./../zoonk-github-issues/SKILL.md) - Commands for creating issues, setting types, adding dependencies
