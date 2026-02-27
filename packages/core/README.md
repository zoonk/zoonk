# Zoonk Core

This package contains **shared utilities** used across multiple apps. It handles cross-cutting concerns like authentication, user management, and organization access.

## What does NOT belong in Core

App-specific data fetching that is not shared across apps should live in the app's `src/data/` folder. This allows each app to:

- Handle permissions at the appropriate level
- Avoid complex conditional logic for different use cases

For example:

- `apps/editor/src/data/courses/` - Editor-specific course queries with permission checks
- `apps/main/src/data/courses/` - Public course queries

## Guidelines

- For `get` and `list` functions, use React `cache` to deduplicate requests
- For async functions, use the `safeAsync` helper to handle errors
- Keep this package focused on truly shared utilities
