# Zoonk AI

This package contains functions for AI-powered features in Zoonk. We're using the [Vercel AI SDK](https://ai-sdk.dev/) for AI generation. Only other dependencies when the AI SDK doesn't support the required functionality.

This is an internal package used by other packages. It shouldn't be imported directly by apps. Use `@zoonk/core` instead.

## Usage

```tsx
import { generateCourseSuggestions } from "zoonk/ai/course-suggestions/generate";
```
