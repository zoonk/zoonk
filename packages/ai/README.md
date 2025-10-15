# Zoonk AI

This package contains functions for AI-powered features in Zoonk. We're using the [Vercel AI SDK](https://ai-sdk.dev/) for AI generation. Only other dependencies when the AI SDK doesn't support the required functionality.

## Usage

```tsx
import { generateCourseSuggestions } from "zoonk/ai/course-suggestions";
```

## Guidelines

- Give a meaningful name to each function that clearly indicates its purpose.
- Prefix content generation functions with `generate` (e.g., `generateCourseSuggestions`).
- Use kebab-case for file names (e.g., `course-suggestions.ts`).
- Create a markdown file for the system prompt associated with each function (e.g., `course-suggestions.md`).
