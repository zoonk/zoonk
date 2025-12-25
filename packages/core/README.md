# Zoonk Core

This package organizes all requests that need to interact with multiple services such as external services or databases. This is our public interface for other packages and apps to use.

This means apps won't likely need to interact with packages such as `@zoonk/ai` or `@zoonk/db` directly. Instead, they should use the functions in this package.

## Usage

```tsx
import { listCourses } from "@zoonk/core/courses/list";
import { getCourse } from "@zoonk/core/courses/get";
```

## Guidelines

- Each file should represent a specific domain or service (e.g., `list-courses.ts`, `get-course.ts`).
- For `get` and `list` functions, make sure to use React `cache` to deduplicate requests.
- For async functions, use the `safeAsync` helper to handle errors.

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
