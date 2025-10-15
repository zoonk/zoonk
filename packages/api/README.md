# Zoonk API

This package organizes all requests that need to interact with multiple services such as external APIs or databases.

## Usage

```tsx
import { fetchCourseSuggestions } from "zoonk/api/course-suggestions";
```

## Guidelines

- Each file should represent a specific domain or service (e.g., `course-suggestions.ts`, `user-profile.ts`).
- Use descriptive function names that clearly indicate their purpose (e.g., `fetchCourseSuggestions`, `updateUserProfile`).
- Cache functions using `next/cache`.
- When caching a function, ensure to always include the `use cache` directive and calling the `cacheLife` and `cacheTag` functions.
