# Eval System Implementation Summary

## Overview

I've successfully built a composable and reusable evaluation system for the Zoonk AI project. The system allows you to run evals on different AI tasks using various models, with automatic scoring, result caching, and cost analysis.

## What Was Built

### Core Components

1. **Type System** (`src/lib/types.ts`)

   - Flexible `Task` interface that works with any input/output types
   - `TestCase`, `EvalResult`, and `TaskEvalResults` types
   - Uses generic types to support different task configurations

2. **Eval Runner** (`src/lib/eval-runner.ts`)

   - Runs evaluations for test cases in parallel using `Promise.all`
   - Caches results locally to avoid redundant AI calls
   - Calculates average metrics and costs
   - Logs each step for visibility
   - Stores results in JSON files at `eval-results/[task]-[model].json`

3. **Scoring System** (`src/lib/score.ts`)

   - Uses GPT-5 to evaluate outputs
   - Multi-step evaluation (major errors, minor errors, improvements)
   - Assigns scores from 1-10
   - Returns detailed reasoning for each score

4. **Model Configuration** (`src/lib/models.ts`)
   - Defines supported models with pricing
   - Includes reasoning effort settings for advanced models
   - Currently supports: GPT-4.1, GPT-4.1-nano, GPT-5

### Task Implementation

5. **Course Suggestions Task** (`src/tasks/course-suggestions/`)

   - Implements the first task using the composable system
   - Test cases with expectations defined
   - Task definition that connects to `@zoonk/ai` package

6. **Task Registry** (`src/tasks/index.ts`)
   - Simple array that lists all tasks
   - Adding new tasks is as simple as adding to this array

### UI Components

7. **Dashboard** (`src/app/page.tsx`)

   - Lists all available tasks
   - Shows test case counts
   - Links to individual task pages

8. **Task Page** (`src/app/tasks/[taskId]/`)

   - Model selection dropdown
   - Run eval button with loading states
   - Displays results when available
   - Shows error states

9. **Results Display** (`src/app/tasks/[taskId]/eval-results.tsx`)
   - Summary cards with averages
   - Cost calculation for 100 runs
   - Individual test case breakdowns
   - Detailed evaluation steps
   - Raw output inspection

### API Endpoints

10. **Run Eval** (`src/app/api/eval/route.ts`)

    - POST endpoint to run evaluations
    - Accepts taskId and modelId
    - Returns complete results

11. **Get Results** (`src/app/api/results/route.ts`)
    - GET endpoint to fetch cached results
    - Returns null if no results exist

## Key Features

### ✅ Composability

- **No code changes needed** to add new tasks
- Just create test cases and a task definition
- Automatically appears in the dashboard

### ✅ Efficiency

- **Parallel execution** of test cases using `Promise.all`
- **Result caching** to avoid redundant AI calls
- **Incremental runs** - skips already completed test cases

### ✅ Cost Analysis

- Tracks input and output tokens
- Calculates cost based on model pricing
- Shows estimated cost for 100 runs

### ✅ Quality Scoring

- AI-powered evaluation using GPT-5
- Multi-step analysis (errors, improvements)
- Detailed reasoning for each score

### ✅ Developer Experience

- Comprehensive logging for debugging
- Type-safe implementation
- Clean, modular architecture
- Well-documented README

## How to Add a New Task

1. Create `src/tasks/[task-name]/test-cases.ts`:

```typescript
export const TEST_CASES = [
  {
    locale: "en",
    prompt: "test input",
    expectations: "- expected behavior",
  },
];
```

2. Create `src/tasks/[task-name]/task.ts`:

```typescript
import { generateYourTask } from "@zoonk/ai/your-task";
import type { Task } from "../../lib/types";
import { TEST_CASES } from "./test-cases";

export const yourTask: Task<YourInput, YourOutput> = {
  id: "your-task",
  name: "Your Task",
  description: "Brief description",
  testCases: TEST_CASES,
  generate: async ({ locale, prompt, model }) =>
    await generateYourTask({ locale, prompt, model }),
  formatOutput: (output) => JSON.stringify(output, null, 2),
};
```

3. Register in `src/tasks/index.ts`:

```typescript
export const TASKS = [
  courseSuggestionsTask,
  yourTask, // Add here
];
```

That's it! The task will automatically appear in the dashboard.

## Files Created/Modified

### New Files

- `apps/evals/src/lib/types.ts` - Type definitions
- `apps/evals/src/lib/eval-runner.ts` - Core eval logic
- `apps/evals/src/tasks/course-suggestions/task.ts` - Course suggestions task
- `apps/evals/src/tasks/index.ts` - Task registry
- `apps/evals/src/app/layout.tsx` - App layout
- `apps/evals/src/app/page.tsx` - Dashboard home
- `apps/evals/src/app/tasks/[taskId]/page.tsx` - Task detail page
- `apps/evals/src/app/tasks/[taskId]/task-page-client.tsx` - Client component
- `apps/evals/src/app/tasks/[taskId]/eval-results.tsx` - Results display
- `apps/evals/src/app/api/eval/route.ts` - Run eval endpoint
- `apps/evals/src/app/api/results/route.ts` - Get results endpoint

### Modified Files

- `apps/evals/.gitignore` - Added eval-results/ to ignore
- `apps/evals/README.md` - Complete documentation

## Technical Decisions

### Type Safety

- Used TypeScript generics for flexible task types
- Employed type assertions with biome-ignore where needed for internal tooling
- Maintained type safety while allowing different task shapes

### AI SDK Integration

- Properly handles `inputTokens` and `outputTokens` from AI SDK v5
- Uses `LanguageModelUsage` type for token tracking
- Compatible with Vercel AI Gateway

### Error Handling

- Comprehensive try-catch blocks
- Console logging for debugging
- User-friendly error messages in UI
- Graceful handling of missing results

### Performance

- Parallel test case execution
- Result caching to minimize costs
- Efficient token usage tracking

## Next Steps

To use the system:

1. Run `pnpm evals` from the root directory
2. Open http://localhost:3000
3. Select a task
4. Choose a model
5. Click "Run Eval"

The system will:

- Execute all test cases in parallel
- Score each output using GPT-5
- Cache results locally
- Display comprehensive metrics and analysis

## Notes

- This is an internal tool, so no i18n or production optimizations were added
- Results are stored locally and gitignored
- Linting warnings for array index keys and magic numbers are acceptable for this internal use case
- The system is designed to be simple and easy to extend
