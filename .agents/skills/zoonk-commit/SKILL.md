---
name: zoonk-commit
description: Guidelines for writing commit messages and PR descriptions. Use when creating commits, writing PR descriptions, or asking about commit format.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Commit Messages

## Format

```
type(scope): short message
```

## Types

- `feat` - new feature
- `fix` - bug fix
- `refactor` - code refactoring
- `chore` - maintenance tasks (deps, config, tooling)

## Scopes

Use the app or package name as scope when working in a monorepo:

**Apps**: `web`, `mobile`, `api`, `admin`, `docs`

**Packages**: `ui`, `utils`, `core`, `db`, `config`

**Inferred scopes** (when change doesn't fit an app/package):

- `agents` - CLAUDE.md, AGENTS.md, `.claude/` folder
- `ci` - GitHub workflows, CI/CD configuration
- `deps` - dependency updates across multiple packages
- `data` - data layer changes spanning multiple packages

## Examples

```
feat(web): add user profile page
fix(api): handle null response in auth
refactor(db): use enum for status field
chore(deps): update react to v19
chore(agents): add commit skill
fix(ci): update node version in workflow
```

## Rules

- Use lowercase for entire message
- No period at the end
- Keep message under 72 characters
- Use imperative mood ("add" not "added")

# PR Descriptions

Keep descriptions brief. Focus on what changed. No need to list verification commands run.
