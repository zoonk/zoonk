# Zoonk Evals

An internal evaluation system for testing and monitoring AI-generated content quality across all Zoonk AI tasks.

## Features

- **Task Evaluation**: Run evaluations on AI tasks using different models
- **Model Comparison**: Compare performance and cost across supported models
- **Automatic Scoring**: AI-powered scoring system evaluates outputs against expectations
- **Result Persistence**: Results are cached locally to avoid redundant AI calls
- **Cost Analysis**: Calculate estimated costs for 1000 runs of each task

## Running the App

From the root directory of the repository, run:

```bash
pnpm evals
```

This will build the evals app and start the server. You can then access the app at `http://localhost:3000`.

From there, you'll have a UI to run evals for different models and tasks.

## Adding a New Task

Adding a new task to the eval system requires no changes to the core evaluation code. Simply:

1. **Create a test cases file** in `src/tasks/[task-name]/test-cases.ts`:

```typescript
export const TEST_CASES = [
  {
    id: "unique-test-case-id", // Unique ID for deduplication
    userInput: {
      // Any key-value pairs your task needs
      locale: "en",
      prompt: "your test input",
      // Add more fields as needed
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
import { generateYourFunction } from "@zoonk/ai/your-function";
import type { Task } from "../../lib/types";
import { TEST_CASES } from "./test-cases";

export const yourTask: Task<YourInput, YourOutput> = {
  id: "your-task-id",
  name: "Your Task Name",
  description: "Brief description",
  testCases: TEST_CASES,
  generate: async (input) => {
    // The input will contain all fields from testCase.userInput plus { model }
    // For example: { locale, prompt, customField, model }
    return await generateYourFunction(input);
  },
  formatOutput: (output) => JSON.stringify(output, null, 2),
};
```

3. **Register the task** in `src/tasks/index.ts`:

```typescript
import { yourTask } from "./your-task/task";

export const TASKS = [
  courseSuggestionsTask,
  yourTask, // Add your task here
];
```

That's it! Your task will automatically appear in the dashboard.

## Supported Models

Models are configured in `src/lib/models.ts`. Each model includes:

- **ID**: The model identifier for the AI SDK
- **Name**: Display name
- **Input Cost**: Cost per million input tokens (in USD)
- **Output Cost**: Cost per million output tokens (in USD)
- **Reasoning Effort**: Optional setting for reasoning models

## How It Works

### Evaluation Flow

1. **Test Case Execution**: For each test case, the system:

   - Calls the task's generate function with the test input
   - Captures the output, system prompt, and token usage

2. **Scoring**: The output is scored using GPT-5 with a specialized evaluation prompt that:

   - Checks for major errors
   - Identifies minor errors
   - Suggests potential improvements
   - Assigns a score from 1-10

3. **Result Storage**: Results are saved to `eval-results/[task-id]-[model-id].json` including:

   - Individual test case results with scores and token usage
   - Task ID and model ID for reference
   - Note: Average metrics (score, tokens) and cost are calculated dynamically in the UI, not stored in the file

4. **Caching & Deduplication**: Results are cached by test case ID and model. If a result already exists for a specific test case ID + model combination, it's skipped to avoid redundant API calls. This means you can safely re-run evals after partial failures, and only the missing test cases will be executed.

### Scoring System

The scoring system uses a multi-step evaluation:

- **Major Errors**: Critical issues that significantly impact quality
- **Minor Errors**: Small issues that reduce utility slightly
- **Potential Improvements**: Suggestions for enhancement

The final score is the average of all step scores, providing a comprehensive quality metric.

## Dashboard

The dashboard provides:

- **Task Overview**: Lists all available tasks with test case counts
- **Model Selection**: Choose a model to evaluate
- **Run Evals**: Execute evaluations for selected task + model
- **Results Display**:
  - Summary with average score, tokens, and cost (calculated dynamically)
  - Individual test case breakdowns
  - Detailed evaluation steps and reasoning
  - Raw output inspection

## File Structure

```
src/
├── app/
│   ├── tasks/[taskId]/
│   │   ├── [modelId]/
│   │   │   ├── page.tsx              # Task + model results page
│   │   │   └── task-page-with-model.tsx
│   │   ├── actions.ts                # Server actions for running evals
│   │   ├── page.tsx                  # Model selection page
│   │   └── eval-results.tsx          # Results display component
│   ├── layout.tsx
│   └── page.tsx                      # Dashboard home
├── lib/
│   ├── eval-runner.ts                # Core eval execution logic
│   ├── models.ts                     # Model configurations
│   ├── score.ts                      # Scoring system
│   ├── stats.ts                      # Statistics calculation utilities
│   ├── types.ts                      # TypeScript types
│   └── system-prompt.md              # Evaluation prompt
└── tasks/
    ├── index.ts                      # Task registry
    └── course-suggestions/
        ├── task.ts
        └── test-cases.ts
```
