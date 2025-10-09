# AI Evaluations

This directory contains the evaluation system for AI-generated content in Zoonk.

## Purpose

The evaluation system serves two main goals:

1. **Model Comparison**: Evaluate how different AI models perform for a given task
2. **Regression Detection**: Detect any performance degradation when we make changes to system prompts

## Structure

```
ai/evals/
├── models.ts                      # Model pricing configuration
├── score.ts                       # Scoring/evaluation logic
├── score-prompt.md                # System prompt for the evaluator
├── course-suggestions-cases.ts    # Test cases for course suggestions
├── run-course-suggestions.ts      # Course suggestions evaluation runner
├── run-eval.ts                    # CLI script to run evaluations
└── results/                       # Generated results (gitignored)
    └── course-suggestions-*.json
```

**Note**: The evaluation scripts (`run-*.ts`, `score.ts`) don't use `server-only` imports and read `.md` files directly using `fs.readFileSync` instead of importing them. This is necessary because they run via `tsx` outside of the Next.js build process, which means they don't have access to the webpack loaders configured in `next.config.ts`.

## Running Evaluations

### Prerequisites

Make sure you have your environment variables set up with the necessary API keys in your `.env` file. The evaluation script automatically loads environment variables using `dotenv`.

### Running Course Suggestions Evals

```bash
pnpm eval:course-suggestions <model>
```

**Example:**

```bash
pnpm eval:course-suggestions openai/gpt-4.1
```

**Available models:**

- `openai/gpt-4.1`
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `openai/o1`
- `openai/o1-mini`
- `anthropic/claude-3-5-sonnet-latest`
- `anthropic/claude-3-5-haiku-latest`
- `google/gemini-2.0-flash-exp`

### Output

The evaluation will:

1. Run all test cases for the specified model
2. Score each response using the evaluation model (GPT-O1)
3. Save detailed results to `ai/evals/results/course-suggestions-<model>.json`
4. Update the leaderboard in `ai/course-suggestions-evals.md`

### Example Output

```
============================================================
Course Suggestions Evaluation
============================================================

Running evaluations for model: openai/gpt-4.1
  Running test case: pt-coding
  Scoring response for: pt-coding
  Score: 8.50
  Running test case: en-black-holes
  Scoring response for: en-black-holes
  Score: 9.20

Results saved to: /path/to/ai/evals/results/course-suggestions-openai-gpt-4.1.json
Leaderboard updated: /path/to/ai/course-suggestions-evals.md

============================================================
Evaluation Complete
============================================================
Model: openai/gpt-4.1
Average Score: 8.85
Median Score: 8.85
Average Cost per 100 calls: $0.0125
============================================================
```

## Leaderboard

The leaderboard is automatically updated after each evaluation run and stored in:

```
ai/course-suggestions-evals.md
```

It shows:

- **Model**: Model name (without provider prefix)
- **Average**: Average score across all test cases (0-10 scale)
- **Median**: Median score across all test cases (0-10 scale)
- **Avg. Cost**: Average cost per 100 calls in USD

Models are sorted by average score (highest first).

## Adding New Test Cases

To add more test cases for course suggestions, edit `ai/evals/course-suggestions-cases.ts`:

```typescript
export const COURSE_SUGGESTIONS_TEST_CASES: TestCase[] = [
  // ... existing cases
  {
    id: "unique-test-id",
    locale: "en",
    prompt: "your test prompt",
    expectations: `
- Expectation 1
- Expectation 2
- etc
    `.trim(),
  },
];
```

## Adding New Tasks

To create evaluations for a new AI task:

1. **Create test cases file**: `ai/evals/<task>-cases.ts`
2. **Create runner file**: `ai/evals/run-<task>.ts`
3. **Add script to package.json**: `"eval:<task>": "tsx ai/evals/run-eval-<task>.ts"`
4. **Create leaderboard file**: `ai/<task>-evals.md`

The evaluation system is designed to be easily extensible to new tasks while maintaining the same scoring and leaderboard structure.

## Model Costs

Model pricing is configured in `ai/evals/models.ts`. Costs are in USD per million tokens.

To add a new model:

1. Add its pricing to `MODEL_COSTS` in `models.ts`
2. The model will automatically appear in the available models list

## Scoring System

The evaluation uses GPT-O1 as the evaluator model. It analyzes:

1. **Major Errors**: Significant issues that impact trust or safety
2. **Minor Errors**: Small issues that slightly reduce utility
3. **Potential Improvements**: Suggestions for enhancement

The final score (0-10) comes from the last evaluation step.

## Files Generated

- **Results**: `ai/evals/results/` (gitignored)
  - Detailed JSON files with all test results, scores, and usage data
- **Leaderboard**: `ai/<task>-evals.md` (committed)
  - Public-facing leaderboard with aggregated metrics
