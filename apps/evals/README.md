# Zoonk Evals

An internal evaluation system for testing and monitoring AI-generated content quality across all Zoonk AI tasks.

## Features

- **Task Evaluation**: Run evaluations on AI tasks using different models
- **Model Comparison**: Compare performance and cost across supported models
- **Automatic Scoring**: AI-powered scoring system evaluates outputs against expectations

## Running the App

From the root directory of the repository, run:

```bash
pnpm evals
```

This will build the evals app and start the server. You can then access the app at `http://localhost:3001`.

From there, you'll have a UI to run evals for different models and tasks.

## Adding a New Task

Adding a new task to the eval system requires no changes to the core evaluation code. Simply:

1. **Create a test cases file** in `src/tasks/[task-name]/test-cases.ts`:

```typescript
export const TEST_CASES = [
  {
    id: "unique-test-case-id",
    userInput: {
      locale: "en",
      prompt: "your test input",
    },
    expectations: `
      - expected behavior 1
      - expected behavior 2
    `,
  },
  // Add more test cases...
];
```

**Important**: Each test case must have a unique `id`. This ensures that when re-running evals after a partial failure, only the missing test cases are executed, preventing duplicates.

2. **Create a task definition** in `src/tasks/[task-name]/task.ts`:

```typescript
import { generateYourFunction } from "@zoonk/ai/your-task";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const yourTask: Task<YourInput, YourOutput> = {
  id: "your-task-id",
  name: "Your Task Name",
  description: "Brief description",
  testCases: TEST_CASES,
  generate: generateYourFunction,
};
```

3. **Register the task** in `src/tasks/index.ts`:

```typescript
import { yourNewTask } from "./your-task/task";

export const TASKS = [courseSuggestionsTask, yourNewTask];
```

That's it! Your task will automatically appear in the dashboard.

## Supported Models

Models are configured in [src/lib/models.ts](./src/lib/models.ts).

## Removing Test Cases

You can remove specific test cases from all task results using by calling `pnpm evals:remove taskId id1 [id2 ...]`. This is useful if you want to run new evals for those test cases.

> [!TIP]
> You need to call it from the root of the repository.

## Exporting Test Case Comparisons

You can export answers from all models for a specific test case to compare responses side-by-side:

```bash
pnpm evals:export taskId testCaseId
```

**Example:**

```bash
pnpm evals:export course-suggestions en-black-holes-1
```

This will create a JSON file in `apps/evals/eval-results/[taskId]/comparisons/[testCaseId].json` with:

- All model responses for that specific test case
- Anonymous model IDs (Model 1, Model 2, etc.) to enable blind comparison
- Only the output field for easier comparison
