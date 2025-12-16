# Zoonk Core

This package organizes all requests that need to interact with multiple services such as external services or databases.

## Usage

```tsx
import { fetchCourseSuggestions } from "zoonk/core/course-suggestions";
```

## Guidelines

- Each file should represent a specific domain or service (e.g., `course-suggestions.ts`, `user-profile.ts`).
- Use descriptive function names that clearly indicate their purpose (e.g., `fetchCourseSuggestions`, `updateUserProfile`).
- Cache functions using `next/cache`.
- When caching a function, ensure to always include the `use cache` directive and calling the `cacheLife` and `cacheTag` functions.

## Cross-App Cache Revalidation

When updating data in one app (e.g., `editor`) that affects cached data in another app (e.g., `main`), use the `revalidateMainApp` function:

```tsx
import { revalidateMainApp } from "@zoonk/core/revalidate";
import { after } from "next/server";

// After local revalidation, trigger cross-app revalidation in the background
after(async () => {
  await revalidateMainApp(["tag1", "tag2"]);
});
```

### Required Environment Variables

The following environment variables must be set for cross-app revalidation to work:

| Variable | Description | Example |
|----------|-------------|---------|
| `REVALIDATE_SECRET` | Shared secret for authenticating revalidation requests between apps. Generate with `openssl rand -hex 32` | `a1b2c3d4e5f6...` |
| `MAIN_APP_URL` | The URL of the main app | `https://zoonk.com` or `http://localhost:3000` |

Both the `editor` app and the `main` app need `REVALIDATE_SECRET` set to the same value.
