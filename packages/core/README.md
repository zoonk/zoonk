# Zoonk Core

This package contains **shared utilities** used across multiple apps. It handles cross-cutting concerns like authentication, user management, organization access, and cache revalidation.

## What does NOT belong in Core

App-specific data fetching that is not shared across apps should live in the app's `src/data/` folder. This allows each app to:

- Control its own caching strategy
- Handle permissions at the appropriate level
- Avoid complex conditional logic for different use cases

For example:

- `apps/editor/src/data/courses/` - Editor-specific course queries with permission checks
- `apps/main/src/data/courses/` - Public course queries, cacheable

## Guidelines

- For `get` and `list` functions, use React `cache` to deduplicate requests
- For async functions, use the `safeAsync` helper to handle errors
- Keep this package focused on truly shared utilities

## Cross-App Cache Revalidation

When updating data in one app (e.g., `editor`) that affects cached data in another app (e.g., `main`), use the `revalidateMainApp` function:

```tsx
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { after } from "next/server";

// After local revalidation, trigger cross-app revalidation in the background
after(async () => {
  await revalidateMainApp(["tag1", "tag2"]);
});
```

### Required Environment Variables

The following environment variables must be set for cross-app revalidation to work:

| Variable                   | Description                                                                                               | Example                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `REVALIDATE_SECRET`        | Shared secret for authenticating revalidation requests between apps. Generate with `openssl rand -hex 32` | `a1b2c3d4e5f6...`                                  |
| `NEXT_PUBLIC_MAIN_APP_URL` | The URL of the main app                                                                                   | `https://www.zoonk.com` or `http://localhost:3000` |

Both the `editor` app and the `main` app need `REVALIDATE_SECRET` set to the same value.
