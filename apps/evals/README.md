# Zoonk Evals

An internal evaluation system for testing and monitoring AI-generated content quality across all Zoonk AI tasks.

## Features

- **Task Evaluation**: Run evaluations on AI tasks using different models
- **Model Comparison**: Compare quality, cost and latency (p50 and p95) across supported models, with English and Portuguese scored apart and a pass or fail for tasks with a latency budget
- **Evaluation Models**: Classifiers can also run through `experimental_evaluate`, so Jev and language models used as evaluation models land on the same leaderboard as the task's own prompt
- **Automatic Scoring**: Task-specific deterministic scoring when outputs have exact pass/fail rules, with AI-powered judge scoring as the fallback for open-ended tasks. Classifiers also report per-label accuracy and a confusion matrix
- **Gateway Prices**: Costs use the AI Gateway's price list, including cached input and reasoning tokens, and judge calls are priced too

## Running the App

From the root directory of the repository, run:

```bash
pnpm evals
```

This will build the evals app and start the server. You can then access the app at `http://localhost:3201`.

From there, you'll have a UI to run evals for different models and tasks.

## Adding a New Task

Adding a new task to the eval system requires no changes to the core evaluation code. Simply:

1. **Create a test cases file** in `src/tasks/[task-name]/test-cases.ts`:

```typescript
export const TEST_CASES = [
  {
    id: "unique-test-case-id",
    userInput: { language: "en", prompt: "your test input" },
    expectations: `
      - expected behavior 1
      - expected behavior 2
    `,
  },
  // Add more test cases...
];
```

**Important**: Each test case must have a unique `id`. This ensures that when re-running evals after a partial failure, only the missing test cases are executed, preventing duplicates.

Every task needs cases in English and Portuguese (see [Language Coverage](#language-coverage)). A case's language comes from its own `language` field, then `learnerLanguage` or `language` in `userInput`, then an id that starts with a language code (`pt-enem-math`). Set `language` on the case when the input doesn't carry one, such as a goal typed in Portuguese.

2. **Create a task definition** in `src/tasks/[task-name]/task.ts`:

```typescript
import { generateYourFunction } from "@zoonk/ai/your-task/generate";
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

For structured classifier or extractor tasks, add `expected` data to each test case and a task-level `score` function. Use deterministic scoring when the output can be checked by parsing fields and comparing them to an explicit accepted list. Leave `score` unset for open-ended generation tasks that need the judge model.

For classifiers, set `reportsLabels: true` on the string-field scorer (or return `classification` from a custom scorer) so results show accuracy per label and a confusion matrix, not only an average.

For judge-scored tasks, declare a weighted rubric with `defineScoreCategories` and set it as the task's `scoreCategories`, as `skill-graph` does. Weights must total 100; the judge scores each category on its own.

When learners wait on the task, set a `latencyBudget` (`{ p50, p95 }` in seconds), as `step-variant` does. A model counts as a fit only when both its p50 and p95 are within the budget. See [Latency Budgets](#latency-budgets).

To compare evaluation models on a classifier, add an `evaluate` route next to `generate`. `createChoiceEvaluation` and `createBooleanEvaluation` (in `src/lib/evaluation-routes.ts`) run the classifier the task exports next to its generation function (such as `courseIntentClassifier`) and map the answer back to the task's output, so the same scorer grades both kinds of model.

3. **Register the task** in `src/tasks/index.ts`:

```typescript
import { yourNewTask } from "./your-task/task";

export const TASKS = [courseRequestRoutingTask, yourNewTask];
```

That's it! Your task will automatically appear in the dashboard.

## Supported Models

Models are configured in [src/lib/models.ts](./src/lib/models.ts). Each one has a kind:

- `generation` models run the task's own prompt through `generate`.
- `evaluation` models run the task's `evaluate` route through the AI SDK's `experimental_evaluate`: Jev natively, and Luna, Flash Lite and Haiku through the SDK's language-model evaluation adapter (their ids end in `/evaluation`). They only appear for tasks with an `evaluate` route.

Prices come from the AI Gateway's model list, saved in `data/gateway-prices.json` with the time it was fetched. Refresh it after adding a model or when prices change:

```bash
pnpm --filter evals prices:refresh
```

## Judges

Scoring mode uses one judge, GPT-6 Astra, so scores stay comparable. Battle mode uses one judge per model family (Anthropic, Google, OpenAI) and a judge never scores models from its own family, so models are ranked by their average score across the judges that scored them.

## Running Evals From the Command Line

`eval:run` runs tasks for several models one after another and prints a table per task with accuracy per label, the English and Portuguese results apart (accuracy for classifiers, the average score otherwise, with the case count), p50 and p95 latency, whether each model meets the task's latency budget, and cost. Outputs and scores are saved in `eval-results` like dashboard runs.

```bash
pnpm --filter evals eval:run --task course-intent --model typesafe-ai/jev --model openai/gpt-6-luna --limit 40 --fresh
```

- `--limit` samples that many cases spread across expected labels and languages.
- `--language` keeps only cases in those languages, such as `--language en --language pt`.
- `--case` keeps only cases whose id contains one of the given texts, such as `--case :parallel` for the production search tool in `find-official-sources`.
- `--fresh` regenerates the sampled cases even if saved outputs exist, so every model's latency is measured the same way. Without it, only cases with no saved output are generated.
- `--saved` prints the same table from saved results without calling any model.
- `live-conversation` runs only on `openai/gpt-live-1`: it plays scripted learner turns, spoken by Gemini 3.8 Flash TTS at real-time pace, against the production instructions over GPT-Live's native Live WebSocket, with the production objective check after each answer. GPT-Live bills $0.05 per minute of session, so the six cases cost about $0.50 of voice plus the judge; the table's "Spent" only shows the judge.

Generation runs at most four calls at a time so a model's own requests don't slow each other down. "Spent" is what the sampled cases' saved outputs and judge calls cost, including ones generated in earlier runs. Search tool fees (`find-official-sources`) are billed per search and aren't included.

## Language Coverage

`eval:languages` lists every task's cases per language and how many came from production samples. It fails when a task has no English or no Portuguese case, or a case whose language can't be told:

```bash
pnpm --filter evals eval:languages
```

## Quality Floor

A task's production model should score at least 8.0 (the judge or rubric average out of 10), or 85% accuracy for classifiers, in English and in Portuguese. Check both languages with:

```bash
pnpm --filter evals eval:run --task <task> --model <model> --language en --language pt
```

Case counts per language are small, so rerun a task before trusting a single miss.

## Latency Budgets

A model wins a task when it's close to the best quality at the lowest cost and meets the task's latency budget. Budgets are tight where learners wait on the answer and absent for work made ahead of time:

| Task                                       | p50  | p95  | Why                                                                                                                |
| ------------------------------------------ | ---- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `step-variant` ("Simpler" and "Go deeper") | 4 s  | 6 s  | The learner taps and waits on the same screen                                                                      |
| `quick-explanation`                        | 12 s | 18 s | The first screen should show in about 20 seconds, and the generality check, the save and the page load come on top |

Measure latency with `--fresh` when nothing else is running.

## Sampling Real Inputs

Test cases should come from what learners and the pipeline actually produce. `sample:production` reads a local database (it refuses any other host): the `zoonk` dev database by default, or `zoonk_prod_copy`, the local copy of production. It replaces emails, links, phone numbers and user names and writes `datasets/production-inputs.json`, which git ignores:

```bash
pnpm --filter evals sample:production --limit 50 --database-url postgresql://localhost:5432/zoonk_prod_copy
```

Each section is sampled equally across what production recorded (and language), so rare labels still show up:

| Section              | From                                                                   | Recorded label and provenance                                                    |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `coursePrompts`      | Goals typed before v2                                                  | The intent production gave them                                                  |
| `goals`              | Goals typed in onboarding                                              | The goal kind                                                                    |
| `goalUnderstandings` | What onboarding understood from a typed goal                           | The route and result, with model and prompt version                              |
| `tutorQuestions`     | Tutor questions and answers                                            | The screen or answer they were about, with model and prompt version              |
| `typedAnswers`       | Typed answers to lesson and item questions                             | Whether grading accepted them, with the model and prompt version of the question |
| `evaluationRuns`     | The evaluation-model log (Jev's verdicts), where the input may be kept | Each question's answer and probability, with model and prompt version            |

A section is skipped when the database predates its table, and provenance is empty where it predates those columns.

The labels in that file are what production recorded, not ground truth. Label cases by hand before using them as `expected` values, and mark them `origin: "production"` so `eval:languages` counts them (as `course-intent` and `question-generality` do).

## Shared Learner Dataset

Tasks that take learner context (example lines, memory relevance and reconcile, plan edits, mistake causes and goal understanding) also run cases built from the seed learners that E2E tests and screenshots use: Maya, Sam and a guest in English, and Ana, Lucas, Pedro and Marcos in Brazilian Portuguese. `src/datasets/seed-learners.ts` reads them from `@zoonk/db/seed/v2/personas` on a fixed Monday (`SEED_LEARNERS_TODAY`) and gives each task their goal as typed and planned, their memory facts, the explanation screens of their lessons and the mistakes in their notebook. Each task's `persona-cases.ts` picks from it and labels the expected result by hand; case ids read `<language>-persona-<learner>-…`.

When the seed changes a learner, lesson, fact or mistake a case points at, loading the task throws with the missing piece, so the case changes with the seed instead of silently testing something else.

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
pnpm evals:export course-intent topic-biology
```

This will create a JSON file in `apps/evals/eval-results/[taskId]/comparisons/[testCaseId].json` with:

- All model responses for that specific test case
- Anonymous model IDs (Model 1, Model 2, etc.) to enable blind comparison
- Only the output field for easier comparison
