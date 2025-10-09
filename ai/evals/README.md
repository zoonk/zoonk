# AI Evaluation System

This directory contains the evaluation system for AI-generated content in Zoonk.

## Purpose

The evaluation system serves two main purposes:

1. **Model Comparison**: Evaluate how different AI models perform for a given task
2. **Regression Testing**: Detect regressions when making changes to system prompts

## Structure

### Core Files

- `models.ts` - Model configurations with pricing information
- `test-cases.ts` - Test case definitions for each task
- `eval-system.ts` - Core evaluation logic (scoring, metrics calculation)
- `leaderboard.ts` - Functions to update the leaderboard markdown file

### Task-Specific Files

- `course-suggestions-eval.ts` - Evaluation logic specific to course suggestions
- `results/` - Stores JSON output from evaluations (gitignored)

### System Prompts

- `score-prompt.md` - System prompt for the AI that scores/evaluates outputs

## How It Works

1. **Run Evaluation**: Select a model and run the evaluation
2. **Generate Output**: The system calls the AI model for each test case
3. **Score Output**: Each output is scored by GPT-5 (high reasoning effort)
4. **Calculate Metrics**: Average, median scores and cost per 100 calls are calculated
5. **Update Leaderboard**: Results are saved and the leaderboard is updated

## Running Evaluations

### Via UI (Development Only)

Navigate to `/evals` in the browser (only visible in non-production environments).

1. Select a model from the dropdown
2. Click "Run Eval"
3. View results and updated leaderboard

### Programmatically

```typescript
import {
  runCourseSuggestionsEval,
  saveEvalResults,
} from "@/ai/evals/course-suggestions-eval";
import { updateLeaderboard } from "@/ai/evals/leaderboard";
import { EVAL_MODELS } from "@/ai/evals/models";

const model = EVAL_MODELS[0]; // or select your model
const result = await runCourseSuggestionsEval(model);
await saveEvalResults(result);
await updateLeaderboard(result);
```

## Adding New Tasks

To add evaluation for a new task:

1. Create test cases in `test-cases.ts`
2. Create a task-specific eval file (e.g., `new-task-eval.ts`)
3. Create a leaderboard file (e.g., `../../new-task-evals.md`)
4. Add UI components to run the eval

## Metrics

- **Average Score**: Mean score across all test cases (0-10)
- **Median Score**: Median score across all test cases (0-10)
- **Avg. Cost**: Average cost per 100 calls in USD

## Adding New Models

Add models to the `EVAL_MODELS` array in `models.ts`:

```typescript
{
  id: "provider/model-name",
  name: "model-name",
  inputCostPerMillion: 2.5,  // USD per million input tokens
  outputCostPerMillion: 10.0, // USD per million output tokens
  reasoningEffort: "low",     // optional, for reasoning models
}
```

## Scorer Configuration

The scorer uses GPT-5 with high reasoning effort. This can be changed in `models.ts` by updating the `SCORER_MODEL` constant.
